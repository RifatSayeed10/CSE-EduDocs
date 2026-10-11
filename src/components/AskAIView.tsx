import React from "react";
import { Sparkles, Send, Loader2, FileText, AlertCircle, RotateCcw, LogIn } from "lucide-react";
import { api } from "../lib/api";
import { AiSource, AiStatus, User } from "../types";

interface AskAIViewProps {
  currentUser: User | null;
  aiStatus: AiStatus | null;
  onOpenSource: (paperId: string, page?: number) => void;
  onNavigateToAuth: (tab: "signin" | "register") => void;
}

interface Turn {
  role: "user" | "assistant";
  content: string;
  sources?: AiSource[];
  error?: boolean;
}

const EXAMPLES = [
  "Which theses work on Bangla OCR or handwriting recognition?",
  "What datasets have been used for Bengali NLP in this department?",
  "কোন থিসিসগুলোতে IoT বা কৃষি নিয়ে কাজ হয়েছে?",
  "Summarize the methods used for traffic prediction in the archive.",
];

// Very small, safe formatter: paragraphs, "- " / "1. " lists, **bold**, and [n] citation chips
function renderAnswer(text: string, sources: AiSource[], onCite: (s: AiSource) => void) {
  const byN = new Map(sources.map(s => [s.n, s]));
  const inline = (line: string, key: string) => {
    const parts: React.ReactNode[] = [];
    const re = /\*\*([^*]+)\*\*|\[(\d+)\]/g;
    let last = 0, m: RegExpExecArray | null, i = 0;
    while ((m = re.exec(line))) {
      if (m.index > last) parts.push(line.slice(last, m.index));
      if (m[1]) parts.push(<strong key={`${key}-b${i++}`}>{m[1]}</strong>);
      else {
        const src = byN.get(Number(m[2]));
        parts.push(src ? (
          <button
            key={`${key}-c${i++}`}
            onClick={() => onCite(src)}
            title={`${src.title}${src.page ? ` — page ${src.page}` : ""}`}
            className="mx-0.5 inline-flex items-center rounded bg-violet-100 dark:bg-violet-900/40 px-1.5 text-[10px] font-bold text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-800 align-super cursor-pointer"
          >
            {src.n}
          </button>
        ) : m[0]);
      }
      last = m.index + m[0].length;
    }
    if (last < line.length) parts.push(line.slice(last));
    return parts;
  };

  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={`l${blocks.length}`} className={`${list.ordered ? "list-decimal" : "list-disc"} pl-5 space-y-1`}>
        {list.items.map((it, i) => <li key={i}>{inline(it, `l${blocks.length}-${i}`)}</li>)}
      </Tag>
    );
    list = null;
  };
  text.split("\n").forEach((raw, idx) => {
    const line = raw.trim();
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const num = line.match(/^\d+[.)]\s+(.*)$/);
    if (bullet || num) {
      const ordered = !!num;
      if (!list || list.ordered !== ordered) { flush(); list = { ordered, items: [] }; }
      list.items.push((bullet || num)![1]);
      return;
    }
    flush();
    if (!line) return;
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    blocks.push(
      heading
        ? <p key={`p${idx}`} className="font-semibold">{inline(heading[1], `h${idx}`)}</p>
        : <p key={`p${idx}`}>{inline(line, `p${idx}`)}</p>
    );
  });
  flush();
  return blocks;
}

export default function AskAIView({ currentUser, aiStatus, onOpenSource, onNavigateToAuth }: AskAIViewProps) {
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [remaining, setRemaining] = React.useState<number | null | undefined>(aiStatus?.remainingToday);
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  React.useEffect(() => {
    setRemaining(aiStatus?.remainingToday);
  }, [aiStatus?.remainingToday]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    const history = turns.filter(t => !t.error).map(t => ({ role: t.role, content: t.content }));
    setTurns(prev => [...prev, { role: "user", content: q }]);
    setInput("");
    setBusy(true);
    try {
      const res = await api.askAI(q, history);
      setTurns(prev => [...prev, { role: "assistant", content: res.answer, sources: res.sources }]);
      if (res.remainingToday !== undefined) setRemaining(res.remainingToday);
    } catch (e: any) {
      setTurns(prev => [...prev, { role: "assistant", content: e?.message || "Something went wrong.", error: true }]);
    } finally {
      setBusy(false);
    }
  };

  if (!aiStatus?.enabled) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <Sparkles className="mx-auto h-10 w-10 text-zinc-300" />
        <h2 className="font-serif text-lg font-bold mt-3 text-zinc-900 dark:text-white">AI assistant is not enabled</h2>
        <p className="text-sm text-zinc-500 mt-1">An administrator needs to add an AI provider in the server settings (.env).</p>
      </div>
    );
  }

  if (!currentUser && !aiStatus.allowGuests) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <Sparkles className="mx-auto h-10 w-10 text-violet-400" />
        <h2 className="font-serif text-lg font-bold mt-3 text-zinc-900 dark:text-white">Ask the archive</h2>
        <p className="text-sm text-zinc-500 mt-1">Please sign in to ask questions about the theses and papers in the archive.</p>
        <button
          onClick={() => onNavigateToAuth("signin")}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-xs font-semibold cursor-pointer"
        >
          <LogIn className="h-4 w-4" /> Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl flex flex-col min-h-[70vh] font-sans">
      <div className="flex items-start justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-violet-600" /> Ask the Archive
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Answers come only from the theses and papers stored here, with links to the exact page. Ask in English or বাংলা.
          </p>
        </div>
        {turns.length > 0 && (
          <button
            onClick={() => setTurns([])}
            disabled={busy}
            className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" /> New chat
          </button>
        )}
      </div>

      <div className="flex-1 py-5 space-y-5">
        {turns.length === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {EXAMPLES.map(ex => (
              <button
                key={ex}
                onClick={() => ask(ex)}
                className="text-left rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 hover:border-violet-300 dark:hover:border-violet-700 cursor-pointer transition"
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {turns.map((t, i) => (
          <div key={i} className={t.role === "user" ? "flex justify-end" : "flex justify-start"}>
            {t.role === "user" ? (
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2.5 text-sm whitespace-pre-wrap">
                {t.content}
              </div>
            ) : (
              <div className={`max-w-[92%] rounded-2xl rounded-bl-sm border px-4 py-3 text-sm leading-relaxed space-y-2 ${
                t.error
                  ? "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300"
                  : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200"
              }`}>
                {t.error ? (
                  <div className="flex items-start gap-2"><AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /><span>{t.content}</span></div>
                ) : (
                  renderAnswer(t.content, t.sources || [], s => onOpenSource(s.paperId, s.page || undefined))
                )}
                {!t.error && t.sources && t.sources.length > 0 && (
                  <div className="pt-2 mt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-1">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Sources</div>
                    {t.sources.map(s => (
                      <button
                        key={s.n}
                        onClick={() => onOpenSource(s.paperId, s.page || undefined)}
                        className="flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-left text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                      >
                        <span className="font-bold text-violet-600 dark:text-violet-400 w-5 shrink-0">[{s.n}]</span>
                        <FileText className="h-3.5 w-3.5 mt-px shrink-0" />
                        <span className="flex-1">
                          {s.title}{s.year ? ` (${s.year})` : ""}
                          <span className="text-zinc-400"> — {s.page ? `page ${s.page}` : "abstract"}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {busy && (
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Searching the archive and writing an answer…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={e => { e.preventDefault(); ask(input); }}
        className="sticky bottom-3 rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 shadow-md flex items-end gap-2"
      >
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); }
          }}
          rows={1}
          maxLength={1000}
          placeholder="Ask about the theses and papers… (Shift+Enter for a new line)"
          className="flex-1 resize-none bg-transparent px-2 py-2 text-sm text-zinc-900 dark:text-white outline-none max-h-40"
        />
        <button
          type="submit"
          disabled={busy || !input.trim() || remaining === 0}
          className="rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white p-2.5 cursor-pointer transition"
          title="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
      <p className="text-center text-[11px] text-zinc-400 mt-2">
        AI can make mistakes — check the cited pages.
        {typeof remaining === "number" && ` ${remaining} questions left today.`}
        {!currentUser && (
          <>
            {" "}
            <button onClick={() => onNavigateToAuth("signin")} className="underline hover:text-zinc-600 cursor-pointer">
              Sign in
            </button>{" "}
            for more questions per day.
          </>
        )}
      </p>
    </div>
  );
}
