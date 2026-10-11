import React, { useState, useRef, useMemo, useEffect } from "react";
import { 
  Search, Filter, BookOpen, Bookmark, BookmarkCheck, Upload, 
  FileText, Download, Calendar, Users, X, UserCheck, 
  Paperclip, Eye, Tag, PlusCircle, CheckCircle2, ChevronRight,
  ExternalLink, FileSpreadsheet, ArrowLeft, Quote, Copy, Check, Trash2, FileSearch, Loader2
} from "lucide-react";
import { Paper, Topic, Researcher, User, SearchResult, AiStatus, AiMetadataSuggestion } from "../types";
import { api } from "../lib/api";
import { useAiMetadata } from "../lib/useAiMetadata";
import { Highlighted } from "../lib/highlight";
import AiAutofillPanel from "./AiAutofillPanel";

interface PapersViewProps {
  papers: Paper[];
  topics: Topic[];
  researchers: Researcher[];
  currentUser: User | null;
  initialQuery?: string;
  onRefreshData: () => void;
  onNavigateToAuth: (tab: "signin" | "register") => void;
  onUpdateCurrentUser: (user: User | null) => void;
  aiStatus?: AiStatus | null;
  // Ask the page to open a paper's PDF (e.g. from an AI answer citation)
  openRequest?: { paperId: string; page?: number; nonce: number } | null;
  // Changes whenever the "Upload Paper" button in the navbar/home page is clicked
  uploadRequest?: number;
}

export default function PapersView({
  papers = [],
  topics = [],
  researchers = [],
  currentUser,
  initialQuery = "",
  onRefreshData,
  onNavigateToAuth,
  onUpdateCurrentUser,
  aiStatus = null,
  openRequest = null,
  uploadRequest = 0
}: PapersViewProps) {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedType, setSelectedType] = useState<string>("All");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedYear, setSelectedYear] = useState<string>("All");
  const [popularitySort, setPopularitySort] = useState<string>("Newest");
  const [viewBookmarksOnly, setViewBookmarksOnly] = useState(false);

  // Active selected paper for details & PDF viewing
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [viewPdfModal, setViewPdfModal] = useState<boolean>(false);
  const [pdfPage, setPdfPage] = useState<number | undefined>(undefined);

  // Full-text search results (text inside the PDFs)
  const [fullText, setFullText] = useState<SearchResult[] | null>(null);
  const [fullTextLoading, setFullTextLoading] = useState(false);

  // Upload assistant
  const ai = useAiMetadata();

  // Citation modal state
  const [citePaper, setCitePaper] = useState<Paper | null>(null);
  const [copiedCitation, setCopiedCitation] = useState<string>("");

  // Upload Paper Form State
  const [uploadOpen, setUploadOpen] = useState(false);
  const [submitTitle, setSubmitTitle] = useState("");
  const [submitAuthors, setSubmitAuthors] = useState("");
  const [submitSupervisor, setSubmitSupervisor] = useState("");
  const [submitCoSupervisor, setSubmitCoSupervisor] = useState("");
  const [submitPublicationType, setSubmitPublicationType] = useState("Undergraduate Thesis");
  const [submitYear, setSubmitYear] = useState(new Date().getFullYear());
  const [submitPages, setSubmitPages] = useState(45);
  const [submitCategory, setSubmitCategory] = useState("");
  const [submitKeywords, setSubmitKeywords] = useState("");
  const [submitSummary, setSubmitSummary] = useState("");

  // Upload file state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string>("");
  const [pdfName, setPdfName] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Paper Deletion Modal States
  const [paperToDelete, setPaperToDelete] = useState<Paper | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Same rule as the server: admins/editors, or the person who uploaded it
  const canDeletePaper = (p: Paper) => {
    if (!currentUser) return false;
    if (currentUser.role === "admin" || currentUser.role === "editor") return true;
    return !!p.uploaderId && p.uploaderId === currentUser.id;
  };

  // Search inside PDFs (debounced)
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setFullText(null);
      setFullTextLoading(false);
      return;
    }
    setFullTextLoading(true);
    let cancelled = false;
    const t = setTimeout(() => {
      api.search(q)
        .then(r => { if (!cancelled) setFullText(r); })
        .catch(() => { if (!cancelled) setFullText(null); })
        .finally(() => { if (!cancelled) setFullTextLoading(false); });
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [searchQuery, papers]);

  const fullTextMap = useMemo(
    () => new Map((fullText || []).map(r => [r.paperId, r])),
    [fullText]
  );

  useEffect(() => {
    if (uploadRequest) setUploadOpen(true);
  }, [uploadRequest]);

  // Open a paper requested from outside (AI answer citations)
  useEffect(() => {
    if (!openRequest) return;
    const p = papers.find(x => x.id === openRequest.paperId);
    if (p) handleOpenPaper(p, true, openRequest.page);
  }, [openRequest?.nonce, papers.length]);

  const confirmDeletePaper = async () => {
    if (!paperToDelete) return;
    setDeleteLoading(true);
    setDeleteError("");
    try {
      await api.deletePaper(paperToDelete.id);
      if (selectedPaper?.id === paperToDelete.id) {
        setSelectedPaper(null);
        setViewPdfModal(false);
      }
      const deletedTitle = paperToDelete.title;
      setPaperToDelete(null);
      setSuccessMsg(`Paper "${deletedTitle}" deleted successfully.`);
      setTimeout(() => setSuccessMsg(""), 4000);
      onRefreshData();
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete paper.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialQuery) {
      setSearchQuery(initialQuery);
    }
  }, [initialQuery]);

  useEffect(() => {
    if (topics.length > 0 && !submitCategory) {
      setSubmitCategory(topics[0].name);
    }
  }, [topics]);

  // Derived filters
  const uniqueYears = useMemo(() => {
    const years = papers.map((p) => String(p.year));
    return ["All", ...Array.from(new Set(years)).sort((a, b) => b.localeCompare(a))];
  }, [papers]);

  const publicationTypes = [
    "All",
    "Undergraduate Thesis",
    "Master's Thesis",
    "Conference Paper",
    "Journal Article"
  ];

  // Filtering Logic matching CSE scope:
  // - Keyword matching across: title, summary, authors (including roll numbers), supervisor, coSupervisor, publicationType, keywords, categories
  const filteredPapers = useMemo(() => {
    return papers
      .filter((paper) => {
        // 1. Text / Keyword Search
        const query = searchQuery.toLowerCase().trim();
        const matchesSearch =
          !query ||
          paper.title.toLowerCase().includes(query) ||
          paper.summary?.toLowerCase().includes(query) ||
          paper.authors?.some((a) => a.toLowerCase().includes(query)) ||
          paper.supervisor?.toLowerCase().includes(query) ||
          paper.coSupervisor?.toLowerCase().includes(query) ||
          paper.publicationType?.toLowerCase().includes(query) ||
          paper.keywords?.some((k) => k.toLowerCase().includes(query)) ||
          paper.categories?.some((c) => c.toLowerCase().includes(query)) ||
          fullTextMap.has(paper.id);

        // 2. Publication Type Filter
        const matchesType =
          selectedType === "All" ||
          paper.publicationType?.toLowerCase() === selectedType.toLowerCase();

        // 3. Category Filter
        const matchesCategory =
          selectedCategory === "All" ||
          paper.categories?.includes(selectedCategory);

        // 4. Year Filter
        const matchesYear =
          selectedYear === "All" || String(paper.year) === selectedYear;

        // 5. Bookmarks Filter
        const matchesBookmark =
          !viewBookmarksOnly ||
          (currentUser && currentUser.bookmarks.includes(paper.id));

        return matchesSearch && matchesType && matchesCategory && matchesYear && matchesBookmark;
      })
      .sort((a, b) => {
        // While searching, best matches first (full-text relevance)
        if (searchQuery.trim() && fullTextMap.size > 0) {
          const diff = (fullTextMap.get(b.id)?.score || 0) - (fullTextMap.get(a.id)?.score || 0);
          if (diff !== 0) return diff;
        }
        if (popularitySort === "Oldest") return a.year - b.year;
        return b.year - a.year; // Default newest
      });
  }, [papers, searchQuery, selectedType, selectedCategory, selectedYear, viewBookmarksOnly, popularitySort, currentUser, fullTextMap]);

  // Fill the upload form with the AI suggestions (only fields the AI found)
  const applyAiSuggestion = (s: AiMetadataSuggestion) => {
    if (s.title) setSubmitTitle(s.title);
    if (s.authors?.length) setSubmitAuthors(s.authors.join(", "));
    if (s.supervisor) setSubmitSupervisor(s.supervisor);
    if (s.coSupervisor) setSubmitCoSupervisor(s.coSupervisor);
    if (s.publicationType && s.publicationType !== "Capstone Project") setSubmitPublicationType(s.publicationType);
    if (s.year) setSubmitYear(s.year);
    if (s.pages) setSubmitPages(s.pages);
    if (s.keywords?.length) setSubmitKeywords(s.keywords.join(", "));
    if (s.abstract) setSubmitSummary(s.abstract);
    if (s.category && topics.some(t => t.name === s.category)) setSubmitCategory(s.category);
  };

  // File loading methods
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndLoadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndLoadFile(e.target.files[0]);
    }
  };

  const validateAndLoadFile = (file: File) => {
    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      setErrorMsg("Validation error: Only valid PDF documents (.pdf) can be uploaded.");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setErrorMsg("File is larger than 50MB.");
      return;
    }

    setErrorMsg("");
    setPdfFile(file);
    setPdfName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      setPdfBase64(reader.result as string);
    };
    reader.onerror = () => {
      setErrorMsg("Failed to read the selected PDF file.");
    };
    reader.readAsDataURL(file);
  };

  // Submit Paper Handler
  const handlePaperSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onNavigateToAuth("signin");
      return;
    }

    if (!submitTitle.trim() || !submitAuthors.trim() || !submitSummary.trim()) {
      setErrorMsg("Please fill in the title, student authors, and summary abstract.");
      return;
    }

    setUploading(true);
    setErrorMsg("");

    try {
      if (!pdfFile) {
        setErrorMsg("Please attach the PDF file of the paper.");
        setUploading(false);
        return;
      }
      // Reuses the upload made by the AI assistant, if any
      const fileUrl = await ai.ensureUploaded(pdfFile);

      const parsedAuthors = submitAuthors
        .split(",")
        .map((a) => a.trim())
        .filter((a) => a.length > 0);

      const parsedKeywords = submitKeywords
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k.length > 0);

      const payload: Partial<Paper> = {
        title: submitTitle.trim(),
        authors: parsedAuthors,
        supervisor: submitSupervisor.trim() || undefined,
        coSupervisor: submitCoSupervisor.trim() || undefined,
        publicationType: submitPublicationType,
        year: Number(submitYear),
        pages: Number(submitPages) || 10,
        status: "Active",
        categories: [submitCategory || topics[0]?.name || "Artificial Intelligence & ML"],
        keywords: parsedKeywords.length > 0 ? parsedKeywords : [submitPublicationType, "CSE Department"],
        summary: submitSummary.trim(),
        fileUrl: fileUrl,
      };

      await api.createPaper(payload);

      setSuccessMsg("Manuscript indexed and archived successfully!");
      setSubmitTitle("");
      setSubmitAuthors("");
      setSubmitSupervisor("");
      setSubmitCoSupervisor("");
      setSubmitSummary("");
      setSubmitKeywords("");
      setPdfFile(null);
      setPdfBase64("");
      setPdfName("");
      ai.reset();

      onRefreshData();
      setTimeout(() => {
        setUploadOpen(false);
        setSuccessMsg("");
      }, 1500);

    } catch (err: any) {
      setErrorMsg(err.message || "Failed to index manuscript.");
    } finally {
      setUploading(false);
    }
  };

  const handleBookmarkToggle = async (paperId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) {
      onNavigateToAuth("signin");
      return;
    }
    try {
      const isBookmarked = currentUser.bookmarks.includes(paperId);
      let updatedUser;
      if (isBookmarked) {
        updatedUser = await api.unbookmarkPaper(paperId);
      } else {
        updatedUser = await api.bookmarkPaper(paperId);
      }
      onUpdateCurrentUser(updatedUser);
      onRefreshData();
    } catch (err) {
      console.error(err);
    }
  };

  function handleOpenPaper(paper: Paper, openPdfDirectly: boolean = false, page?: number) {
    setSelectedPaper(paper);
    setViewPdfModal(openPdfDirectly);
    setPdfPage(page);
    api.viewPaper(paper.id).catch(() => {});
  };

  const getBibTeX = (paper: Paper) => {
    const cleanKey = "pust_cse_" + paper.id.replace("paper_cse_", "");
    const cleanAuthors = paper.authors.join(" and ");
    return `@article{${cleanKey},
  title = {${paper.title}},
  author = {${cleanAuthors}},
  school = {Pabna University of Science and Technology (PUST)},
  department = {Department of Computer Science and Engineering},
  year = {${paper.year}},
  note = {Supervisor: ${paper.supervisor || "Faculty Member"}}
}`;
  };

  const getAPA = (paper: Paper) => {
    return `${paper.authors.join(", ")} (${paper.year}). ${paper.title}. Department of Computer Science & Engineering, Pabna University of Science and Technology (PUST).`;
  };

  const getIEEE = (paper: Paper) => {
    return `${paper.authors.join(", ")}, "${paper.title}," Dept. CSE, Pabna Univ. of Sci. & Tech. (PUST), ${paper.year}.`;
  };

  const handleCopyCitation = (text: string, format: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCitation(format);
    setTimeout(() => setCopiedCitation(""), 2000);
  };

  return (
    <div className="space-y-8 pb-16 font-sans">
      
      {/* 1. SECTION HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl text-zinc-900 dark:text-white font-bold">
            Thesis & Publication Library
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 font-sans mt-0.5">
            Pabna University of Science and Technology • Undergraduate theses, MSc dissertations, and conference papers.
          </p>
        </div>

        {/* Top Actions: Bookmarks & Upload */}
        <div className="flex flex-wrap items-center gap-2.5">
          {currentUser && (
            <button
              onClick={() => setViewBookmarksOnly(!viewBookmarksOnly)}
              className={`flex items-center gap-1.5 rounded-lg border px-3.5 py-2 font-sans text-xs font-semibold transition-all cursor-pointer select-none ${
                viewBookmarksOnly
                  ? "bg-zinc-900 dark:bg-zinc-100 border-zinc-900 text-white dark:text-zinc-900 shadow-xs"
                  : "bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50"
              }`}
            >
              <Bookmark className={`h-3.5 w-3.5 ${viewBookmarksOnly ? "fill-current" : ""}`} />
              <span>{viewBookmarksOnly ? "Showing Saved" : "Saved Papers"}</span>
            </button>
          )}

          <button
            onClick={() => {
              if (!currentUser) {
                onNavigateToAuth("signin");
              } else {
                setUploadOpen(!uploadOpen);
              }
            }}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 px-4 py-2 font-sans text-xs font-semibold shadow-xs transition-all cursor-pointer select-none"
            id="btn-upload-init"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Upload Thesis / Paper</span>
          </button>
        </div>
      </div>

      {/* 2. UPLOAD MODAL INBOUND FORM */}
      {uploadOpen && currentUser && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-md space-y-5" id="upload-panel">
          
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3.5 select-none">
            <div className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-zinc-900 dark:text-zinc-100" />
              <h3 className="font-serif text-lg font-bold text-zinc-900 dark:text-white">
                Upload Scanned Thesis or Academic Publication
              </h3>
            </div>
            <button
              onClick={() => {
                setUploadOpen(false);
                setErrorMsg("");
                ai.reset();
              }}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handlePaperSubmit} className="grid grid-cols-1 gap-6 md:grid-cols-2">
            
            {/* Left Inputs */}
            <div className="space-y-4">
              
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Paper / Thesis Title *
                </label>
                <input
                  type="text"
                  required
                  value={submitTitle}
                  onChange={(e) => setSubmitTitle(e.target.value)}
                  placeholder="e.g. BanglaBERT-OCR: Transformer-based Document Text Extraction"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2 text-xs sm:text-sm text-zinc-900 dark:text-white outline-none focus:bg-white dark:focus:bg-zinc-900 focus:border-zinc-900 dark:focus:border-zinc-100 focus:ring-2 focus:ring-zinc-100 font-sans transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-0.5">
                  Student Author(s) with Roll/ID *
                </label>
                <span className="block text-[11px] text-zinc-400 font-sans mb-1">Comma-separated (e.g. Tanvir Ahmed (Roll: 1904012), Sumaiya Rahman (Roll: 1904045))</span>
                <input
                  type="text"
                  required
                  value={submitAuthors}
                  onChange={(e) => setSubmitAuthors(e.target.value)}
                  placeholder="Tanvir Ahmed (Roll: 1904012), Sumaiya Rahman (Roll: 1904045)"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2 text-xs sm:text-sm text-zinc-900 dark:text-white outline-none focus:bg-white dark:focus:bg-zinc-900 focus:border-zinc-900 dark:focus:border-zinc-100 focus:ring-2 focus:ring-zinc-100 font-sans transition-all"
                />
              </div>

              {/* Faculty Supervisor & Co-Supervisor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Faculty Supervisor *
                  </label>
                  <input
                    type="text"
                    required
                    value={submitSupervisor}
                    onChange={(e) => setSubmitSupervisor(e.target.value)}
                    placeholder="e.g. Dr. Farhana Sarker"
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2 text-xs sm:text-sm text-zinc-900 dark:text-white outline-none focus:bg-white dark:focus:bg-zinc-900 focus:border-zinc-900 dark:focus:border-zinc-100 focus:ring-2 focus:ring-zinc-100 font-sans transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Co-Supervisor (Optional)
                  </label>
                  <input
                    type="text"
                    value={submitCoSupervisor}
                    onChange={(e) => setSubmitCoSupervisor(e.target.value)}
                    placeholder="e.g. Prof. Dr. Mohammad Tariqul Islam"
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2 text-xs sm:text-sm text-zinc-900 dark:text-white outline-none focus:bg-white dark:focus:bg-zinc-900 focus:border-zinc-900 dark:focus:border-zinc-100 focus:ring-2 focus:ring-zinc-100 font-sans transition-all"
                  />
                </div>
              </div>

              {/* Publication Type & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Publication Type *
                  </label>
                  <select
                    value={submitPublicationType}
                    onChange={(e) => setSubmitPublicationType(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs sm:text-sm text-zinc-900 dark:text-white outline-none focus:bg-white focus:border-zinc-900 transition-all"
                  >
                    <option value="Undergraduate Thesis">Undergraduate Thesis</option>
                    <option value="Master's Thesis">Master's Thesis</option>
                    <option value="Conference Paper">Conference Paper</option>
                    <option value="Journal Article">Journal Article</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Research Area / Track *
                  </label>
                  <select
                    value={submitCategory}
                    onChange={(e) => setSubmitCategory(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs sm:text-sm text-zinc-900 dark:text-white outline-none focus:bg-white focus:border-zinc-900 transition-all"
                  >
                    {topics.map((t) => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                    {topics.length === 0 && (
                      <option value="Artificial Intelligence & ML">Artificial Intelligence & ML</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Year & Pages */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Year *</label>
                  <input
                    type="number"
                    required
                    value={submitYear}
                    onChange={(e) => setSubmitYear(Number(e.target.value))}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2 text-xs sm:text-sm text-center font-mono text-zinc-900 dark:text-white outline-none focus:bg-white focus:border-zinc-900 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Page Count</label>
                  <input
                    type="number"
                    value={submitPages}
                    onChange={(e) => setSubmitPages(Number(e.target.value))}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2 text-xs sm:text-sm text-center font-mono text-zinc-900 dark:text-white outline-none focus:bg-white focus:border-zinc-900 transition-all"
                  />
                </div>
              </div>

            </div>

            {/* Right Inputs & PDF File Drop */}
            <div className="space-y-4 flex flex-col justify-between">
              
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Keywords (Comma-separated)
                </label>
                <input
                  type="text"
                  value={submitKeywords}
                  onChange={(e) => setSubmitKeywords(e.target.value)}
                  placeholder="e.g. Bangla OCR, Transformer, Bengali NLP, Scanned Documents"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2 text-xs sm:text-sm text-zinc-900 dark:text-white outline-none focus:bg-white focus:border-zinc-900 focus:ring-2 focus:ring-zinc-100 font-sans transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Abstract / Executive Summary *
                </label>
                <textarea
                  required
                  rows={3}
                  value={submitSummary}
                  onChange={(e) => setSubmitSummary(e.target.value)}
                  placeholder="Brief overview of research objectives, methodologies, datasets, and experimental findings..."
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-3 text-xs sm:text-sm text-zinc-900 dark:text-white outline-none focus:bg-white focus:border-zinc-900 focus:ring-2 focus:ring-zinc-100 resize-none font-sans leading-relaxed transition-all"
                />
              </div>

              {/* Drag n Drop Upload Area */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Scanned / Digital Manuscript PDF *
                </label>
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-5 rounded-xl cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all text-center font-sans"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="application/pdf"
                    className="hidden"
                  />
                  {pdfFile ? (
                    <div className="space-y-1.5">
                      <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-white">
                        <FileText className="h-5 w-5" />
                      </div>
                      <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate max-w-[240px]">
                        {pdfFile.name}
                      </p>
                      <p className="text-[11px] text-zinc-500 font-medium">
                        {(pdfFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for submission
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Paperclip className="h-6 w-6 text-zinc-500 mx-auto" />
                      <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        Drag and drop scanned PDF here, or click to browse
                      </p>
                      <p className="text-[11px] text-zinc-400">
                        Supports scanned thesis & camera PDF documents up to 50MB
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {aiStatus?.enabled && aiStatus.pdfTextAvailable && (
                <AiAutofillPanel ai={ai} file={pdfFile} onApply={applyAiSuggestion} />
              )}

              {/* Status and Action Buttons */}
              <div className="space-y-2 select-none pt-1">
                {errorMsg && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-red-700 dark:text-red-400 text-xs font-medium border border-red-200 dark:border-red-900">
                    {errorMsg}
                  </div>
                )}
                {successMsg && (
                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 text-emerald-700 dark:text-emerald-400 text-xs font-medium border border-emerald-200 dark:border-emerald-900">
                    {successMsg}
                  </div>
                )}

                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setUploadOpen(false);
                      setErrorMsg("");
                      ai.reset();
                    }}
                    className="w-1/3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 py-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 cursor-pointer transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading || ai.running}
                    className="flex-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 font-semibold text-xs py-2.5 shadow-xs cursor-pointer disabled:bg-zinc-300 transition"
                  >
                    {uploading ? "Indexing & Storing PDF..." : "Submit to Repository"}
                  </button>
                </div>
              </div>

            </div>

          </form>

        </div>
      )}

      {/* 3. SEARCH & FILTER BENCH */}
      <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5 select-none" id="papers-filter-bench">
        
        {/* Search input */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search titles, authors, supervisors — and the text inside every PDF (English or বাংলা)…"
            className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 pl-10 pr-9 py-2.5 text-xs sm:text-sm text-zinc-900 dark:text-white outline-none focus:bg-white dark:focus:bg-zinc-900 focus:border-zinc-900 dark:focus:border-zinc-100 focus:ring-2 focus:ring-zinc-100 font-sans transition-all"
          />
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-400" />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-2.5 text-zinc-400 hover:text-zinc-600 font-sans text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Pills: Publication Types */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-medium text-zinc-500 mr-1">Type:</span>
          {publicationTypes.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`rounded-full px-3 py-1 text-xs font-sans transition-all cursor-pointer ${
                selectedType === type
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold shadow-xs"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              {type}
            </button>
          ))}

          {/* Research Areas / Category dropdown */}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-zinc-500 hidden sm:inline">Track:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-1 text-xs text-zinc-800 dark:text-zinc-200 outline-none focus:border-zinc-900"
            >
              <option value="All">All Research Areas</option>
              {topics.map((t) => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-1 text-xs text-zinc-800 dark:text-zinc-200 outline-none focus:border-zinc-900"
            >
              {uniqueYears.map((yr) => (
                <option key={yr} value={yr}>{yr === "All" ? "All Years" : yr}</option>
              ))}
            </select>

            <select
              value={popularitySort}
              onChange={(e) => setPopularitySort(e.target.value)}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-1 text-xs text-zinc-800 dark:text-zinc-200 outline-none focus:border-zinc-900"
            >
              <option value="Newest">Newest First</option>
              <option value="Oldest">Oldest First</option>
            </select>
          </div>
        </div>

      </section>

      {/* 4. PAPERS DIRECTORY LIST */}
      <section className="space-y-4">
        <div className="flex items-center justify-between text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 select-none px-1">
          <span className="font-medium flex items-center gap-2">
            Showing {filteredPapers.length} indexed publications
            {fullTextLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {searchQuery.trim().length >= 2 && !fullTextLoading && fullText && (
              <span className="hidden sm:inline text-zinc-400">• searched inside PDFs too</span>
            )}
          </span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:underline cursor-pointer"
            >
              Clear search filter
            </button>
          )}
        </div>

        {filteredPapers.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center" id="empty-papers">
            <BookOpen className="mx-auto h-12 w-12 text-zinc-300 dark:text-zinc-600 mb-3" />
            <h3 className="font-serif text-lg font-bold text-zinc-800 dark:text-zinc-200">
              No matching academic publications found
            </h3>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
              No papers matched the keyword "{searchQuery}". Try adjusting your filters or upload a new thesis manuscript.
            </p>
          </div>
        ) : (
          <div className="space-y-4" id="papers-list">
            {filteredPapers.map((paper) => {
              const isSaved = currentUser && currentUser.bookmarks.includes(paper.id);

              return (
                <article
                  key={paper.id}
                  className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl p-6 hover:border-zinc-400 dark:hover:border-zinc-600 transition-all"
                  id={`paper-card-${paper.id}`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
                    
                    <div className="space-y-2.5 flex-1">
                      
                      {/* Meta: Type, Year, Pages, Category */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2.5 py-0.5 text-xs font-medium text-zinc-800 dark:text-zinc-200">
                          {paper.publicationType || "Academic Paper"}
                        </span>
                        <span className="text-zinc-300 dark:text-zinc-700">•</span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1 font-medium">
                          <Calendar className="h-3.5 w-3.5" />
                          {paper.year}
                        </span>
                        {paper.pages && (
                          <>
                            <span className="text-zinc-300 dark:text-zinc-700">•</span>
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">
                              {paper.pages} pages
                            </span>
                          </>
                        )}
                        {paper.categories && paper.categories.length > 0 && (
                          <>
                            <span className="text-zinc-300 dark:text-zinc-700">•</span>
                            <span className="text-xs text-zinc-600 dark:text-zinc-300 font-sans">
                              {paper.categories.join(", ")}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Paper Title */}
                      <h3 
                        onClick={() => handleOpenPaper(paper, false)}
                        className="font-serif text-lg sm:text-xl font-bold text-zinc-900 dark:text-white hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer transition-colors leading-snug"
                      >
                        {paper.title}
                      </h3>

                      {/* Student Author(s) */}
                      <div className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">
                        <span className="font-semibold text-zinc-500 dark:text-zinc-400">Author(s): </span>
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">{paper.authors.join(", ")}</span>
                      </div>

                      {/* Supervisor (Prominently displayed) */}
                      {paper.supervisor && (
                        <div className="flex items-center gap-2 text-xs text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 rounded-lg inline-flex mt-0.5">
                          <UserCheck className="h-4 w-4 text-zinc-600 dark:text-zinc-400 shrink-0" />
                          <span>
                            <strong className="font-semibold text-zinc-900 dark:text-zinc-100">Supervisor:</strong>{" "}
                            <span className="font-medium">{paper.supervisor}</span>
                            {paper.coSupervisor && (
                              <span className="text-zinc-500 dark:text-zinc-400"> (Co-Supervisor: {paper.coSupervisor})</span>
                            )}
                          </span>
                        </div>
                      )}

                      {/* Summary Abstract */}
                      {paper.summary && (
                        <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 line-clamp-2 leading-relaxed font-sans pt-1">
                          {paper.summary}
                        </p>
                      )}

                      {/* Keyword Tags */}
                      {paper.keywords && paper.keywords.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-xs text-zinc-400 font-medium">Keywords:</span>
                          {paper.keywords.map((kw, idx) => (
                            <button
                              key={idx}
                              onClick={() => setSearchQuery(kw)}
                              className="rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-2.5 py-0.5 text-xs font-mono transition-colors cursor-pointer border border-transparent"
                            >
                              #{kw}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Matches found inside the PDF */}
                      {searchQuery.trim() && (fullTextMap.get(paper.id)?.hits.length || 0) > 0 && (
                        <div className="mt-2 space-y-1.5 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/10 p-2.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                            <FileSearch className="h-3.5 w-3.5" />
                            Found inside the PDF
                          </div>
                          {fullTextMap.get(paper.id)!.hits.map((h) => (
                            <button
                              key={h.page}
                              onClick={() => handleOpenPaper(paper, true, h.page)}
                              className="block w-full text-left text-xs leading-relaxed text-zinc-700 dark:text-zinc-300 hover:bg-amber-100/60 dark:hover:bg-amber-900/20 rounded-md px-1.5 py-1 cursor-pointer transition"
                              title={`Open the PDF at page ${h.page}`}
                            >
                              <span className="font-mono font-semibold text-amber-700 dark:text-amber-400 mr-1.5">p.{h.page}</span>
                              <Highlighted text={h.snippet} ranges={h.highlights} />
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Text extraction still running: inside-PDF search not complete yet */}
                      {(paper.textStatus === "pending" || paper.textStatus === "processing") && (
                        <div className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 pt-1" title="The text of this PDF is being extracted (OCR). Searching inside it will work when this finishes.">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {paper.textStatus === "pending"
                            ? "Waiting for text extraction"
                            : `Reading PDF text: ${paper.textPagesDone || 0}/${paper.textPagesTotal || "?"} pages`}
                        </div>
                      )}

                    </div>

                    {/* Actions on the right */}
                    <div className="flex sm:flex-col items-center sm:items-end gap-2.5 shrink-0 pt-2 sm:pt-0">
                      
                      <button
                        onClick={() => handleOpenPaper(paper, true)}
                        className="flex items-center gap-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 px-4 py-2 text-xs font-semibold shadow-xs transition-all cursor-pointer"
                        title="Read & Inspect PDF Document"
                      >
                        <Eye className="h-4 w-4" />
                        <span>View PDF</span>
                      </button>

                      <button
                        onClick={() => setCitePaper(paper)}
                        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer"
                        title="Generate BibTeX, APA, IEEE Citation"
                      >
                        <Quote className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400" />
                        <span>Cite</span>
                      </button>

                      <a
                        href={api.downloadUrl(paper.id)}
                        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer"
                        title="Download PDF"
                      >
                        <Download className="h-3.5 w-3.5 text-zinc-500" />
                        <span>Download</span>
                      </a>

                      <button
                        onClick={(e) => handleBookmarkToggle(paper.id, e)}
                        className={`p-2 rounded-lg border transition-all cursor-pointer ${
                          isSaved 
                            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100" 
                            : "border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:bg-zinc-50"
                        }`}
                        title={isSaved ? "Remove from bookmarks" : "Save to bookmarks"}
                      >
                        <Bookmark className={`h-3.5 w-3.5 ${isSaved ? "fill-current" : ""}`} />
                      </button>

                      {canDeletePaper(paper) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPaperToDelete(paper);
                            setDeleteError("");
                          }}
                          className="p-2 rounded-lg border border-red-200 dark:border-red-900/50 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all cursor-pointer"
                          title="Delete Paper"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}

                    </div>

                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* 5. INTEGRATED INSTANT PDF VIEWER & DETAILS MODAL */}
      {selectedPaper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-zinc-950/70 backdrop-blur-xs select-none" id="paper-details-modal">
          <div className="relative w-full max-w-4xl max-h-[94vh] rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="sticky top-0 bg-zinc-50 dark:bg-zinc-800/90 p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-zinc-200 dark:bg-zinc-700 px-3 py-0.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  {selectedPaper.publicationType || "Academic Manuscript"}
                </span>
                <span className="text-zinc-400">•</span>
                <span className="text-xs text-zinc-600 dark:text-zinc-300 font-medium">
                  PUST CSE Department • {selectedPaper.year}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewPdfModal(!viewPdfModal)}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition cursor-pointer"
                >
                  {viewPdfModal ? "View Abstract & Details" : "Switch to PDF Reader"}
                </button>

                <button
                  onClick={() => {
                    setSelectedPaper(null);
                    setViewPdfModal(false);
                    setPdfPage(undefined);
                  }}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-800 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              
              {viewPdfModal ? (
                /* Interactive PDF Viewer Embed */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-serif text-sm sm:text-base font-bold text-zinc-900 dark:text-white">
                      Viewing: {selectedPaper.title}{pdfPage ? ` (page ${pdfPage})` : ""}
                    </span>
                    <a
                      href={api.fileUrl(selectedPaper.id, pdfPage)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-zinc-900 dark:text-zinc-100 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <span>Open in new tab</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>

                  <div className="h-[62vh] w-full rounded-xl border border-zinc-300 dark:border-zinc-700 overflow-hidden bg-zinc-100 dark:bg-zinc-950 shadow-inner">
                    <iframe
                      key={`${selectedPaper.id}-${pdfPage || 0}`}
                      src={api.fileUrl(selectedPaper.id, pdfPage)}
                      title={selectedPaper.title}
                      className="w-full h-full border-none"
                    />
                  </div>
                </div>
              ) : (
                /* Paper Metadata and Abstract View */
                <div className="space-y-5 select-text">
                  
                  <h2 className="font-serif text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white leading-snug">
                    {selectedPaper.title}
                  </h2>

                  {/* Authors & Supervisor Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-y border-zinc-200 dark:border-zinc-800 py-3.5 text-xs sm:text-sm">
                    <div>
                      <span className="block text-xs uppercase font-bold text-zinc-400">
                        Student Author(s)
                      </span>
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100 mt-1">
                        {selectedPaper.authors.join(", ")}
                      </p>
                    </div>

                    <div>
                      <span className="block text-xs uppercase font-bold text-zinc-400">
                        Faculty Supervisor
                      </span>
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100 mt-1">
                        {selectedPaper.supervisor || "Department Faculty"}
                        {selectedPaper.coSupervisor && (
                          <span className="block text-zinc-500 font-normal mt-0.5">Co-Supervisor: {selectedPaper.coSupervisor}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Abstract Section */}
                  <div className="space-y-2 bg-zinc-50 dark:bg-zinc-800/60 p-5 rounded-xl border border-zinc-200 dark:border-zinc-700">
                    <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                      Abstract & Executive Summary
                    </h4>
                    <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed font-sans text-justify">
                      {selectedPaper.summary}
                    </p>
                  </div>

                  {/* Keywords */}
                  {selectedPaper.keywords && selectedPaper.keywords.length > 0 && (
                    <div className="space-y-2">
                      <span className="block text-xs uppercase font-bold text-zinc-400">
                        Indexed Keywords
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedPaper.keywords.map((kw, i) => (
                          <span key={i} className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-3 py-1 text-xs font-mono text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                            #{kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-zinc-50 dark:bg-zinc-800/90 p-4 sm:p-5 border-t border-zinc-200 dark:border-zinc-700 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                PUST CSE Repository • Open Digital Access
              </span>

              <div className="flex items-center gap-2">
                {canDeletePaper(selectedPaper) && (
                  <button
                    onClick={() => {
                      setPaperToDelete(selectedPaper);
                      setDeleteError("");
                    }}
                    className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 px-3.5 py-2 text-xs font-semibold hover:bg-red-100 transition cursor-pointer flex items-center gap-1.5"
                    title="Delete this manuscript"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete</span>
                  </button>
                )}

                <button
                  onClick={() => setCitePaper(selectedPaper)}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  <Quote className="h-3.5 w-3.5 inline mr-1 text-zinc-600 dark:text-zinc-400" />
                  Cite
                </button>

                <button
                  onClick={(e) => handleBookmarkToggle(selectedPaper.id, e)}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  <Bookmark className="h-3.5 w-3.5 inline mr-1" />
                  Save
                </button>

                <a
                  href={api.downloadUrl(selectedPaper.id)}
                  className="flex items-center gap-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 px-4 py-2 text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  <span>Download PDF</span>
                </a>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 6. CITATION GENERATOR MODAL (BibTeX, APA, IEEE) */}
      {citePaper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-xs select-none">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-7 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Quote className="h-5 w-5 text-zinc-900 dark:text-zinc-100" />
                <h3 className="font-serif text-lg font-bold text-zinc-900 dark:text-white">
                  Export Citation
                </h3>
              </div>
              <button
                onClick={() => setCitePaper(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 font-sans">
              Cite this manuscript: <strong className="text-zinc-900 dark:text-white">{citePaper.title}</strong>
            </p>

            {/* APA 7th */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  APA (7th edition)
                </span>
                <button
                  onClick={() => handleCopyCitation(getAPA(citePaper), "apa")}
                  className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:underline px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 cursor-pointer"
                >
                  {copiedCitation === "apa" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedCitation === "apa" ? "Copied" : "Copy APA"}</span>
                </button>
              </div>
              <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/80 p-3.5 border border-zinc-200 dark:border-zinc-700 text-xs sm:text-sm font-serif text-zinc-800 dark:text-zinc-200 select-text leading-relaxed">
                {getAPA(citePaper)}
              </div>
            </div>

            {/* IEEE */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  IEEE Format
                </span>
                <button
                  onClick={() => handleCopyCitation(getIEEE(citePaper), "ieee")}
                  className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:underline px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 cursor-pointer"
                >
                  {copiedCitation === "ieee" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedCitation === "ieee" ? "Copied" : "Copy IEEE"}</span>
                </button>
              </div>
              <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/80 p-3.5 border border-zinc-200 dark:border-zinc-700 text-xs sm:text-sm font-serif text-zinc-800 dark:text-zinc-200 select-text leading-relaxed">
                {getIEEE(citePaper)}
              </div>
            </div>

            {/* BibTeX */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  BibTeX
                </span>
                <button
                  onClick={() => handleCopyCitation(getBibTeX(citePaper), "bibtex")}
                  className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:underline px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 cursor-pointer"
                >
                  {copiedCitation === "bibtex" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedCitation === "bibtex" ? "Copied" : "Copy BibTeX"}</span>
                </button>
              </div>
              <pre className="rounded-xl bg-zinc-900 text-zinc-100 p-3.5 text-xs font-mono overflow-x-auto select-text leading-relaxed">
                {getBibTeX(citePaper)}
              </pre>
            </div>

          </div>
        </div>
      )}

      {/* Confirmation Modal for Paper Deletion */}
      {paperToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-xs select-none">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-start gap-3 text-red-600 dark:text-red-400">
              <div className="p-2.5 bg-red-100 dark:bg-red-950/50 rounded-xl shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-base text-zinc-900 dark:text-zinc-100">
                  Confirm Paper Deletion
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Are you sure you want to permanently delete this paper from the archive?
                </p>
              </div>
            </div>

            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                PAPER TITLE
              </span>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-2">
                {paperToDelete.title}
              </p>
            </div>

            {deleteError && (
              <div className="p-2.5 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-lg text-xs font-medium">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={deleteLoading}
                onClick={() => {
                  setPaperToDelete(null);
                  setDeleteError("");
                }}
                className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={confirmDeletePaper}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer shadow-xs transition flex items-center gap-1.5"
              >
                {deleteLoading ? (
                  <span>Deleting...</span>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Paper</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
