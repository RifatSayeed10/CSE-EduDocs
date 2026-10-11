import React, { useState } from "react";
import { 
  Search, BookOpen, FileText, UserCheck, Calendar,
  ArrowRight, Download, Eye, Tag, PlusCircle, CheckCircle,
  Sparkles, Filter, ExternalLink, Bookmark
} from "lucide-react";
import { Paper, Topic } from "../types";
import { api } from "../lib/api";

interface HomeViewProps {
  papers: Paper[];
  topics?: Topic[];
  onSearch: (query: string) => void;
  onSelectPaper: (paper: Paper) => void;
  onNavigateToAuth?: (tab: "signin" | "register") => void;
  onOpenUpload?: () => void;
}

export default function HomeView({
  papers,
  onSearch,
  onSelectPaper,
  onNavigateToAuth,
  onOpenUpload
}: HomeViewProps) {
  const [localSearch, setLocalSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string>("All");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (localSearch.trim()) {
      onSearch(localSearch.trim());
    }
  };

  const handleQuickKeyword = (kw: string) => {
    setLocalSearch(kw);
    onSearch(kw);
  };

  const activePapers = papers.filter(p => p.status === "Active");

  // Calculate academic counts
  const totalCount = activePapers.length;
  const ugThesisCount = activePapers.filter(p => p.publicationType?.toLowerCase().includes("undergraduate") || p.publicationType?.toLowerCase().includes("thesis")).length;
  const confCount = activePapers.filter(p => p.publicationType?.toLowerCase().includes("conference")).length;
  const journalCount = activePapers.filter(p => p.publicationType?.toLowerCase().includes("journal")).length;

  const publicationTypes = [
    "All",
    "Undergraduate Thesis",
    "Master's Thesis",
    "Conference Paper",
    "Journal Article"
  ];

  const filteredPapers = selectedType === "All" 
    ? activePapers 
    : activePapers.filter(p => p.publicationType?.toLowerCase() === selectedType.toLowerCase());

  return (
    <div className="space-y-12 pb-16 font-sans">
      
      {/* 1. ACADEMIC HEADER & SEARCH HERO */}
      <section className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-2xl p-6 sm:p-12 shadow-xs relative">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-zinc-900 dark:text-white font-bold tracking-tight">
            Research Papers, Theses & Student Projects Archive
          </h1>

          <p className="text-zinc-600 dark:text-zinc-400 text-sm sm:text-base max-w-2xl mx-auto font-sans leading-relaxed">
            Department of Computer Science & Engineering digital archive for research publications, undergraduate & MSc theses, and innovative student engineering projects.
          </p>

          {/* Unified Keyword Search Form */}
          <form onSubmit={handleSearchSubmit} className="pt-4 max-w-2xl mx-auto" id="academic-search-form">
            <div className="flex items-center border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 rounded-xl p-1.5 focus-within:border-zinc-900 dark:focus-within:border-zinc-100 focus-within:bg-white dark:focus-within:bg-zinc-900 focus-within:ring-2 focus-within:ring-zinc-200 dark:focus-within:ring-zinc-800 transition-all shadow-xs">
              <div className="pl-3.5 text-zinc-400">
                <Search className="h-5 w-5" />
              </div>
              <input
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Search by title, student author/roll (e.g. 190601), supervisor, or topic..."
                className="w-full bg-transparent border-none outline-none text-xs sm:text-sm font-sans text-zinc-900 dark:text-white placeholder-zinc-400 pl-3 pr-2 py-2.5"
                id="search-keyword-input"
              />
              <button
                type="submit"
                className="rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 px-5 py-2.5 text-xs sm:text-sm font-semibold shadow-xs transition-all shrink-0 cursor-pointer"
              >
                Search Papers
              </button>
            </div>
          </form>

          {/* Publication Type Filter Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-3">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mr-1">Filter Type:</span>
            {publicationTypes.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-sans transition-all cursor-pointer ${
                  selectedType === type
                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold shadow-xs"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                {type}
              </button>
            ))}
          </div>

        </div>

        {/* Academic Repository Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10 pt-8 border-t border-zinc-100 dark:border-zinc-800 text-center">
          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800">
            <div className="font-serif text-3xl font-bold text-zinc-900 dark:text-white">{totalCount}</div>
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-1">Total Manuscripts</div>
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800">
            <div className="font-serif text-3xl font-bold text-zinc-900 dark:text-white">{ugThesisCount}</div>
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-1">Undergraduate & MSc Theses</div>
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800">
            <div className="font-serif text-3xl font-bold text-zinc-900 dark:text-white">{confCount}</div>
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-1">Conference Proceedings</div>
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800">
            <div className="font-serif text-3xl font-bold text-zinc-900 dark:text-white">{journalCount}</div>
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-1">Journal Publications</div>
          </div>
        </div>
      </section>

      {/* 2. RECENT CSE MANUSCRIPTS & PAPERS */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
          <div>
            <h2 className="font-serif text-xl sm:text-2xl text-zinc-900 dark:text-white font-bold">
              Department Manuscripts & Publications
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              Showing {filteredPapers.length} {selectedType === "All" ? "recent items" : selectedType} with assigned faculty supervisors
            </p>
          </div>
          <button
            onClick={() => onSearch("")}
            className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white cursor-pointer self-start sm:self-auto"
          >
            <span>View Complete Library</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Papers List */}
        <div className="space-y-4">
          {filteredPapers.slice(0, 6).map((paper) => {
            return (
              <article
                key={paper.id}
                className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl p-6 hover:border-zinc-400 dark:hover:border-zinc-600 hover:shadow-xs transition-all"
                id={`paper-card-${paper.id}`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
                  
                  <div className="space-y-2.5 flex-1">
                    
                    {/* Publication Type & Year meta */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-block rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2.5 py-0.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
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
                      onClick={() => onSelectPaper(paper)}
                      className="font-serif text-lg sm:text-xl font-bold text-zinc-900 dark:text-white hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer transition-colors leading-snug"
                    >
                      {paper.title}
                    </h3>

                    {/* Student Authors */}
                    <div className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">
                      <span className="font-semibold text-zinc-500 dark:text-zinc-400">Author(s): </span>
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{paper.authors.join(", ")}</span>
                    </div>

                    {/* Supervisor (Prominently displayed) */}
                    {paper.supervisor && (
                      <div className="flex items-center gap-2 text-xs text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 rounded-lg inline-flex mt-1">
                        <UserCheck className="h-4 w-4 text-zinc-500 shrink-0" />
                        <span>
                          <strong className="font-semibold text-zinc-900 dark:text-zinc-100">Supervisor:</strong>{" "}
                          <span className="font-medium">{paper.supervisor}</span>
                          {paper.coSupervisor && (
                            <span className="text-zinc-600 dark:text-zinc-400"> (Co-Supervisor: {paper.coSupervisor})</span>
                          )}
                        </span>
                      </div>
                    )}

                    {/* Abstract Summary */}
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
                            onClick={() => handleQuickKeyword(kw)}
                            className="rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-2 py-0.5 text-xs font-mono transition-colors cursor-pointer border border-zinc-200 dark:border-zinc-700"
                          >
                            #{kw}
                          </button>
                        ))}
                      </div>
                    )}

                  </div>

                  {/* Actions (View PDF, Download) */}
                  <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0 pt-2 sm:pt-0">
                    <button
                      onClick={() => onSelectPaper(paper)}
                      className="flex items-center gap-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 px-4 py-2 text-xs font-semibold shadow-xs transition-all cursor-pointer"
                      title="Read & Inspect PDF"
                    >
                      <Eye className="h-4 w-4" />
                      <span>View PDF</span>
                    </button>
                    
                    <a
                      href={api.downloadUrl(paper.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-4 py-2 text-xs font-medium transition-colors cursor-pointer"
                      title="Download PDF file"
                    >
                      <Download className="h-4 w-4 text-zinc-500" />
                      <span>Download</span>
                    </a>
                  </div>

                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 3. UPLOAD & ARCHIVE GUIDELINES CALLOUT */}
      <section className="border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-850/80 rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-2xl">
            <h3 className="font-serif text-lg sm:text-xl font-bold text-zinc-900 dark:text-white">
              Department Research Submission Portal
            </h3>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Are you a CSE student submitting an undergraduate or master's thesis, or a faculty member uploading conference proceedings and journal articles? Submit your formatted PDF alongside supervisor details, student rolls, and indexed keywords.
            </p>
          </div>
          <button
            onClick={() => {
              if (onOpenUpload) onOpenUpload();
              else onSearch("");
            }}
            className="flex items-center gap-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 px-5 py-2.5 text-xs sm:text-sm font-semibold shadow-xs transition-all cursor-pointer shrink-0"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Upload Thesis / Manuscript</span>
          </button>
        </div>
      </section>

    </div>
  );
}
