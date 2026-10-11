// In-memory full-text search over paper metadata and the text of every PDF page.
// - Unicode tokenizer (works for Bangla and English)
// - BM25 ranking, with prefix matches ("transfor" -> "transformer") and one-letter
//   typo tolerance, which helps with OCR mistakes
// - Results are grouped by paper and include page numbers + highlighted snippets
// Sized for a department archive (hundreds to a few thousand papers).

import { Paper, SearchHit, SearchResult } from "./src/types";
import { loadFileText } from "./server-ocr";

interface Doc {
  paperId: string;
  page: number;   // 0 = metadata (title, authors, abstract, keywords ...)
  text: string;
  len: number;    // number of tokens
}

const TOKEN_RE = /[\p{L}\p{N}][\p{L}\p{M}\p{N}‌‍]*/gu;

const STOPWORDS = new Set([
  // English
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have", "in", "is", "it", "its",
  "of", "on", "or", "that", "the", "this", "to", "was", "were", "with", "we", "our", "which", "these", "those",
  "what", "who", "how", "there", "any", "about", "into", "also", "can", "been", "their", "they", "them", "i", "me", "my",
  // Bangla
  "এবং", "ও", "এর", "করে", "হয়", "হয়", "এই", "থেকে", "জন্য", "সাথে", "যে", "একটি", "না", "কি", "কী", "আছে",
  "কোন", "কোনো", "কে", "তে", "আর", "বা", "নিয়ে", "নিয়ে", "করা", "হয়েছে", "হয়েছে", "গুলো", "সম্পর্কে",
].map(w => normalizeToken(w)));

export function normalizeToken(t: string): string {
  return t.normalize("NFC").toLowerCase().replace(/[‌‍]/g, "");
}

export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(TOKEN_RE)) {
    const t = normalizeToken(m[0]);
    if (t.length < 2 && !/\p{N}/u.test(t)) continue;
    if (STOPWORDS.has(t)) continue;
    out.push(t);
  }
  return out;
}

const BANGLA_RE = /^[\u0980-\u09FF]+$/;

// Tokens stored in the index. Bangla text from PDFs/OCR often has wrong spaces inside
// words ("শনাক্ত করণের"), so adjacent Bangla tokens are also indexed joined together.
export function indexTokens(text: string): string[] {
  const base = tokenize(text);
  const out = base.slice();
  for (let i = 0; i + 1 < base.length; i++) {
    if (BANGLA_RE.test(base[i]) && BANGLA_RE.test(base[i + 1])) out.push(base[i] + base[i + 1]);
  }
  return out;
}

// Edit distance <= 1 check (insert/delete/substitute/adjacent swap)
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i++;
  if (la === lb) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true;                                   // substitute
    return i + 1 < la && a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2); // swap
  }
  return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);         // delete/insert
}

const K1 = 1.2;
const B = 0.75;

export class SearchIndex {
  private docs: (Doc | null)[] = [];
  private postings = new Map<string, Map<number, number>>(); // term -> (docIdx -> term frequency)
  private byPaper = new Map<string, number[]>();
  private totalLen = 0;
  private liveDocs = 0;
  private vocab: string[] | null = null; // sorted, rebuilt lazily

  stats() {
    return { papers: this.byPaper.size, documents: this.liveDocs, terms: this.postings.size };
  }

  // ---- building ----

  private addDoc(doc: Doc, tokens: string[]) {
    const idx = this.docs.length;
    this.docs.push(doc);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    for (const [t, n] of tf) {
      let p = this.postings.get(t);
      if (!p) { p = new Map(); this.postings.set(t, p); this.vocab = null; }
      p.set(idx, n);
    }
    this.totalLen += doc.len;
    this.liveDocs++;
    const list = this.byPaper.get(doc.paperId) || [];
    list.push(idx);
    this.byPaper.set(doc.paperId, list);
  }

  removePaper(paperId: string) {
    const list = this.byPaper.get(paperId);
    if (!list) return;
    for (const idx of list) {
      const doc = this.docs[idx];
      if (!doc) continue;
      for (const t of new Set(indexTokens(doc.text))) {
        const p = this.postings.get(t);
        if (p) {
          p.delete(idx);
          if (p.size === 0) { this.postings.delete(t); this.vocab = null; }
        }
      }
      this.totalLen -= doc.len;
      this.liveDocs--;
      this.docs[idx] = null;
    }
    this.byPaper.delete(paperId);
    // Compact occasionally so deleted slots don't pile up
    if (this.docs.length > 1000 && this.liveDocs < this.docs.length / 2) this.compact();
  }

  private compact() {
    const old = this.docs.filter((d): d is Doc => !!d);
    this.docs = []; this.postings = new Map(); this.byPaper = new Map();
    this.totalLen = 0; this.liveDocs = 0; this.vocab = null;
    for (const d of old) this.addDoc(d, indexTokens(d.text));
  }

  static metadataText(p: Paper): string {
    return [
      p.title, p.title, // title counts double
      (p.authors || []).join(", "),
      p.supervisor, p.coSupervisor, p.publicationType, String(p.year || ""),
      (p.keywords || []).join(", "), (p.categories || []).join(", "),
      p.summary,
    ].filter(Boolean).join("\n");
  }

  // (Re)index one paper: metadata + every extracted page
  indexPaper(p: Paper) {
    this.removePaper(p.id);
    const meta = SearchIndex.metadataText(p);
    const metaTokens = indexTokens(meta);
    this.addDoc({ paperId: p.id, page: 0, text: meta, len: metaTokens.length }, metaTokens);

    const ft = loadFileText(p.fileUrl);
    if (!ft) return;
    ft.pages.forEach((text, i) => {
      if (!text) return;
      const tokens = indexTokens(text);
      if (tokens.length === 0) return;
      this.addDoc({ paperId: p.id, page: i + 1, text, len: tokens.length }, tokens);
    });
  }

  rebuild(papers: Paper[]) {
    this.docs = []; this.postings = new Map(); this.byPaper = new Map();
    this.totalLen = 0; this.liveDocs = 0; this.vocab = null;
    const t0 = Date.now();
    for (const p of papers) this.indexPaper(p);
    const s = this.stats();
    console.log(`[Search] Indexed ${s.papers} papers, ${s.documents} pages/records, ${s.terms} terms in ${Date.now() - t0}ms`);
  }

  // ---- querying ----

  private getVocab(): string[] {
    if (!this.vocab) this.vocab = Array.from(this.postings.keys()).sort();
    return this.vocab;
  }

  // Index terms to use for one query term, with a weight (1 = exact)
  private expandTerm(q: string): Map<string, number> {
    const out = new Map<string, number>();
    const add = (t: string, w: number) => { if (this.postings.has(t) && (out.get(t) || 0) < w) out.set(t, w); };
    add(q, 1);

    // simple English plural/singular
    if (/^[a-z]+$/.test(q)) {
      if (q.length > 4 && q.endsWith("s") && !q.endsWith("ss")) add(q.slice(0, -1), 0.9);
      else add(q + "s", 0.9);
    }

    const vocab = this.getVocab();
    // prefix matches
    if (q.length >= 3) {
      let lo = 0, hi = vocab.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (vocab[mid] < q) lo = mid + 1; else hi = mid; }
      for (let i = lo, n = 0; i < vocab.length && vocab[i].startsWith(q) && n < 50; i++, n++) {
        if (vocab[i] !== q) add(vocab[i], 0.6);
      }
    }
    // one-typo matches (OCR errors, spelling mistakes)
    if (q.length >= 5) {
      let n = 0;
      for (const t of vocab) {
        if (Math.abs(t.length - q.length) > 1 || t[0] !== q[0] && t[1] !== q[1]) continue;
        if (t !== q && withinOneEdit(t, q)) { add(t, 0.45); if (++n >= 30) break; }
      }
    }
    return out;
  }

  // Score every matching doc
  private scoreDocs(query: string, visible: (paperId: string) => boolean) {
    const qTerms = Array.from(new Set(tokenize(query))).slice(0, 12);
    const N = this.liveDocs || 1;
    const avgLen = this.totalLen / N || 1;
    const scores = new Map<number, number>();
    const coverage = new Map<number, number>();
    const matchedTerms = new Set<string>();

    for (const q of qTerms) {
      const expanded = this.expandTerm(q);
      const bestForDoc = new Map<number, number>();
      for (const [term, weight] of expanded) {
        const post = this.postings.get(term)!;
        matchedTerms.add(term);
        const idf = Math.log(1 + (N - post.size + 0.5) / (post.size + 0.5));
        for (const [idx, tf] of post) {
          const doc = this.docs[idx];
          if (!doc || !visible(doc.paperId)) continue;
          const s = weight * idf * (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * doc.len / avgLen));
          if ((bestForDoc.get(idx) || 0) < s) bestForDoc.set(idx, s);
        }
      }
      for (const [idx, s] of bestForDoc) {
        scores.set(idx, (scores.get(idx) || 0) + s);
        coverage.set(idx, (coverage.get(idx) || 0) + 1);
      }
    }

    const results: { idx: number; score: number }[] = [];
    for (const [idx, s] of scores) {
      const cov = (coverage.get(idx) || 0) / (qTerms.length || 1);
      const doc = this.docs[idx]!;
      // Docs that contain more of the query words rank higher; metadata (title/abstract) gets a boost
      results.push({ idx, score: s * (0.4 + cov * cov) * (doc.page === 0 ? 1.8 : 1) });
    }
    results.sort((a, b) => b.score - a.score);
    return { results, matchedTerms };
  }

  // Find the densest window of matches and return it with highlight ranges
  private snippet(text: string, matched: Set<string>, size = 260): { snippet: string; highlights: [number, number][]; } {
    const findSpans = (t: string): [number, number][] => {
      const toks = Array.from(t.matchAll(TOKEN_RE)).map(m => ({ s: m.index!, e: m.index! + m[0].length, n: normalizeToken(m[0]) }));
      const out: [number, number][] = [];
      for (let i = 0; i < toks.length; i++) {
        if (matched.has(toks[i].n)) out.push([toks[i].s, toks[i].e]);
        else if (i + 1 < toks.length && matched.has(toks[i].n + toks[i + 1].n)) { out.push([toks[i].s, toks[i + 1].e]); i++; }
      }
      return out;
    };
    const spans = findSpans(text);
    let start = 0;
    if (spans.length) {
      let best = 0, bestCount = 0;
      for (let i = 0; i < spans.length; i++) {
        let c = 0;
        for (let j = i; j < spans.length && spans[j][0] < spans[i][0] + size; j++) c++;
        if (c > bestCount) { bestCount = c; best = i; }
      }
      start = Math.max(0, spans[best][0] - 60);
      const ws = text.lastIndexOf(" ", start);   // start at a word boundary
      if (ws > start - 30 && ws >= 0) start = ws + 1;
    }
    let end = Math.min(text.length, start + size);
    const we = text.indexOf(" ", end);
    if (we !== -1 && we < end + 30) end = we;
    const raw = text.slice(start, end);
    const prefix = start > 0 ? "…" : "";
    const suffix = end < text.length ? "…" : "";
    const snippet = prefix + raw.replace(/\s+/g, " ") + suffix;
    // recompute highlight positions on the whitespace-collapsed snippet
    return { snippet, highlights: findSpans(snippet) };
  }

  // Search grouped by paper (for the Papers page)
  search(query: string, visible: (paperId: string) => boolean, limit = 30): SearchResult[] {
    const { results, matchedTerms } = this.scoreDocs(query, visible);
    const perPaper = new Map<string, { idx: number; score: number }[]>();
    for (const r of results) {
      const id = this.docs[r.idx]!.paperId;
      const list = perPaper.get(id) || [];
      list.push(r);
      perPaper.set(id, list);
    }
    const grouped: SearchResult[] = [];
    for (const [paperId, list] of perPaper) {
      const score = list[0].score + 0.25 * list.slice(1, 4).reduce((a, b) => a + b.score, 0);
      const hits: SearchHit[] = list
        .filter(r => this.docs[r.idx]!.page > 0)   // page hits only; metadata is visible on the card anyway
        .slice(0, 3)
        .map(r => {
          const d = this.docs[r.idx]!;
          return { page: d.page, ...this.snippet(d.text, matchedTerms) };
        });
      grouped.push({ paperId, score: Math.round(score * 100) / 100, hits });
    }
    grouped.sort((a, b) => b.score - a.score);
    return grouped.slice(0, limit);
  }

  // Best passages for the AI assistant (not grouped), trimmed around the matches
  retrieve(query: string, visible: (paperId: string) => boolean, maxPassages = 8, maxChars = 9000): { paperId: string; page: number; text: string }[] {
    const { results, matchedTerms } = this.scoreDocs(query, visible);
    const out: { paperId: string; page: number; text: string }[] = [];
    const perPaperCount = new Map<string, number>();
    const budget = Math.floor(maxChars / maxPassages);
    let used = 0;
    for (const r of results) {
      if (out.length >= maxPassages || used >= maxChars) break;
      const d = this.docs[r.idx]!;
      const c = perPaperCount.get(d.paperId) || 0;
      if (c >= 3) continue; // spread the sources over several papers
      perPaperCount.set(d.paperId, c + 1);
      const size = Math.min(budget, maxChars - used);
      const text = d.text.length <= size ? d.text : this.snippet(d.text, matchedTerms, size).snippet;
      out.push({ paperId: d.paperId, page: d.page, text });
      used += text.length;
    }
    return out;
  }
}

export const searchIndex = new SearchIndex();
