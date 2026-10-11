import React, { useState, useEffect } from "react";
import { 
  ShieldAlert, BookOpen, Laptop, Users, Settings, 
  Trash2, Edit3, Search, Check, AlertCircle, Plus, 
  Star, UserCheck, Ban, HelpCircle, RefreshCw, X, FileText,
  BarChart2, ExternalLink
} from "lucide-react";
import { User, Paper, Topic, Project, FAQItem, SiteBranding } from "../types";
import { api } from "../lib/api";

interface AdminViewProps {
  currentUser: User | null;
  papers: Paper[];
  topics: Topic[];
  onRefreshData: () => void;
  branding: SiteBranding | null;
  onRefreshBranding: () => void;
}

type AdminTab = "papers" | "projects" | "users" | "branding" | "overview";

export default function AdminView({
  currentUser,
  papers = [],
  topics = [],
  onRefreshData,
  branding,
  onRefreshBranding
}: AdminViewProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("papers");

  // Data states
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Notifications
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Filters
  const [paperSearch, setPaperSearch] = useState("");
  const [paperTypeFilter, setPaperTypeFilter] = useState("All");

  const [projectSearch, setProjectSearch] = useState("");
  const [projectCategoryFilter, setProjectCategoryFilter] = useState("All");

  const [userSearch, setUserSearch] = useState("");

  // Deletion Modal State
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "paper" | "project" | "user" | "faq";
    id: string;
    title: string;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteModalError, setDeleteModalError] = useState("");

  // Edit Paper Modal State
  const [editingPaper, setEditingPaper] = useState<Paper | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAuthors, setEditAuthors] = useState("");
  const [editSupervisor, setEditSupervisor] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editStatus, setEditStatus] = useState<"Active" | "Inactive">("Active");
  const [editSaving, setEditSaving] = useState(false);

  // Branding State
  const [siteName, setSiteName] = useState(branding?.siteName || "CSE EduDocs");
  const [siteTagline, setSiteTagline] = useState(
    branding?.siteTagline || "Research Papers, Theses & Student Projects Archive"
  );
  const [brandingSaving, setBrandingSaving] = useState(false);

  // FAQ Modal / Form State
  const [editingFaq, setEditingFaq] = useState<FAQItem | null>(null);
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [faqSaving, setFaqSaving] = useState(false);

  // Load Projects
  const loadProjects = async () => {
    try {
      const data = await api.getProjects();
      setProjects(data);
    } catch (err) {
      console.warn("Failed to load projects for admin:", err);
    }
  };

  // Load Users
  const loadUsers = async () => {
    try {
      const data = await api.getAdminUsers();
      setUsers(data);
    } catch (err) {
      console.warn("Failed to load users for admin:", err);
    }
  };

  // Load FAQs
  const loadFaqs = async () => {
    try {
      const data = await api.getFaqs();
      setFaqs(data);
    } catch (err) {
      console.warn("Failed to load faqs:", err);
    }
  };

  useEffect(() => {
    loadProjects();
    loadUsers();
    loadFaqs();
  }, []);

  useEffect(() => {
    if (branding) {
      setSiteName(branding.siteName || "CSE EduDocs");
      setSiteTagline(branding.siteTagline || "Research Papers, Theses & Student Projects Archive");
    }
  }, [branding]);

  const notify = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(""), 5000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(""), 4000);
    }
  };

  // Check admin authorization
  const isAuthorized = currentUser && (currentUser.role === "admin" || currentUser.role === "editor");

  if (!isAuthorized) {
    return (
      <div className="py-16 text-center space-y-4">
        <ShieldAlert className="h-12 w-12 text-amber-500 mx-auto" />
        <h2 className="text-xl font-serif font-bold text-zinc-900 dark:text-zinc-100">
          Administrator Access Required
        </h2>
        <p className="text-sm text-zinc-500 max-w-md mx-auto">
          You must be signed in with an administrator or faculty editor account to view and manage archive assets.
        </p>
      </div>
    );
  }

  // EXECUTE DELETE TARGET
  const executeDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteModalError("");

    try {
      if (deleteTarget.type === "paper") {
        await api.deletePaper(deleteTarget.id);
        onRefreshData();
        notify(`Paper "${deleteTarget.title}" deleted successfully.`);
      } else if (deleteTarget.type === "project") {
        await api.deleteProject(deleteTarget.id);
        await loadProjects();
        notify(`Project "${deleteTarget.title}" deleted successfully.`);
      } else if (deleteTarget.type === "user") {
        await api.deleteAdminUser(deleteTarget.id);
        await loadUsers();
        notify(`User account "${deleteTarget.title}" deleted.`);
      } else if (deleteTarget.type === "faq") {
        await api.deleteFaq(deleteTarget.id);
        await loadFaqs();
        notify(`FAQ item deleted.`);
      }

      setDeleteTarget(null);
    } catch (err: any) {
      setDeleteModalError(err.message || "Deletion failed. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Re-run text extraction / OCR for one paper
  const handleReprocess = async (p: Paper, force: boolean) => {
    try {
      await api.reprocessPaper(p.id, force);
      notify(`${force ? "Full OCR" : "Text extraction"} queued for "${p.title}".`);
      onRefreshData();
    } catch (err: any) {
      notify(err.message || "Could not queue text extraction", true);
    }
  };

  // EDIT PAPER
  const handleOpenEditPaper = (p: Paper) => {
    setEditingPaper(p);
    setEditTitle(p.title);
    setEditAuthors(p.authors.join(", "));
    setEditSupervisor(p.supervisor || "");
    setEditSummary(p.summary || "");
    setEditStatus(p.status || "Active");
  };

  const handleSaveEditPaper = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPaper) return;
    setEditSaving(true);
    try {
      await api.updatePaper(editingPaper.id, {
        title: editTitle.trim(),
        authors: editAuthors.split(",").map(a => a.trim()).filter(Boolean),
        supervisor: editSupervisor.trim(),
        summary: editSummary.trim(),
        status: editStatus,
      });
      setEditingPaper(null);
      onRefreshData();
      notify("Paper metadata updated successfully.");
    } catch (err: any) {
      notify(err.message || "Failed to update paper", true);
    } finally {
      setEditSaving(false);
    }
  };

  // TOGGLE FEATURED PROJECT
  const handleToggleFeaturedProject = async (proj: Project) => {
    try {
      await api.updateProject(proj.id, { featured: !proj.featured });
      await loadProjects();
      notify(`Project "${proj.title}" featured status updated.`);
    } catch (err: any) {
      notify(err.message || "Failed to update project", true);
    }
  };

  // USER MANAGEMENT
  const handleUserRoleChange = async (userId: string, newRole: "student" | "teacher" | "editor" | "admin") => {
    try {
      await api.updateUserRole(userId, newRole);
      await loadUsers();
      notify(`Role updated to ${newRole}`);
    } catch (err: any) {
      notify(err.message || "Failed to update role", true);
    }
  };

  const handleToggleBlockUser = async (u: User) => {
    try {
      if (u.isBlocked) {
        await api.unblockUser(u.id);
        notify(`Unblocked ${u.name}`);
      } else {
        await api.blockUser(u.id);
        notify(`Suspended ${u.name}`);
      }
      await loadUsers();
    } catch (err: any) {
      notify(err.message || "Failed to toggle status", true);
    }
  };

  // SAVE BRANDING
  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setBrandingSaving(true);
    try {
      await api.updateBranding({
        siteName: siteName.trim(),
        siteTagline: siteTagline.trim(),
      });
      onRefreshBranding();
      notify("Site branding updated successfully!");
    } catch (err: any) {
      notify(err.message || "Failed to update branding", true);
    } finally {
      setBrandingSaving(false);
    }
  };

  // FAQ SUBMIT
  const handleSaveFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!faqQuestion || !faqAnswer) return;
    setFaqSaving(true);
    try {
      if (editingFaq) {
        await api.updateFaq(editingFaq.id, { question: faqQuestion.trim(), answer: faqAnswer.trim() });
        notify("FAQ updated successfully.");
      } else {
        await api.createFaq({ question: faqQuestion.trim(), answer: faqAnswer.trim() });
        notify("New FAQ added.");
      }
      setShowFaqModal(false);
      setEditingFaq(null);
      setFaqQuestion("");
      setFaqAnswer("");
      await loadFaqs();
    } catch (err: any) {
      notify(err.message || "Failed to save FAQ", true);
    } finally {
      setFaqSaving(false);
    }
  };

  // Filtered Papers
  const filteredPapers = papers.filter(p => {
    const matchesSearch = 
      p.title.toLowerCase().includes(paperSearch.toLowerCase()) ||
      p.authors.some(a => a.toLowerCase().includes(paperSearch.toLowerCase())) ||
      (p.supervisor && p.supervisor.toLowerCase().includes(paperSearch.toLowerCase()));
    const matchesType = paperTypeFilter === "All" || p.publicationType === paperTypeFilter;
    return matchesSearch && matchesType;
  });

  // Filtered Projects
  const filteredProjects = projects.filter(p => {
    const matchesSearch = 
      p.title.toLowerCase().includes(projectSearch.toLowerCase()) ||
      p.teamMembers.some(m => m.toLowerCase().includes(projectSearch.toLowerCase())) ||
      (p.supervisor && p.supervisor.toLowerCase().includes(projectSearch.toLowerCase())) ||
      (p.techStack && p.techStack.some(t => t.toLowerCase().includes(projectSearch.toLowerCase())));
    const matchesCat = projectCategoryFilter === "All" || p.category === projectCategoryFilter;
    return matchesSearch && matchesCat;
  });

  // Filtered Users
  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-16 font-sans">
      
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300">
              Department Admin
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Signed in as <strong className="text-zinc-900 dark:text-zinc-100">{currentUser.name}</strong> ({currentUser.role})
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
            CSE EduDocs Control Panel
          </h1>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
            Manage research papers, student engineering project showcases, user roles, and archive settings.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              onRefreshData();
              loadProjects();
              loadUsers();
              notify("Archive assets re-synchronized.");
            }}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-3.5 text-xs font-semibold text-red-800 dark:text-red-300 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Simplified Navigation Subtabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab("papers")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === "papers"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs"
              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          <BookOpen className="h-4 w-4" />
          <span>Research Papers & Theses</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-zinc-200/60 dark:bg-zinc-700/60 text-current">
            {papers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("projects")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === "projects"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs"
              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          <Laptop className="h-4 w-4" />
          <span>Student Projects</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-zinc-200/60 dark:bg-zinc-700/60 text-current">
            {projects.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === "users"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs"
              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          <Users className="h-4 w-4" />
          <span>User Accounts</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-zinc-200/60 dark:bg-zinc-700/60 text-current">
            {users.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("branding")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === "branding"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs"
              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          <Settings className="h-4 w-4" />
          <span>Settings & FAQs</span>
        </button>

        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === "overview"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs"
              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          <BarChart2 className="h-4 w-4" />
          <span>Archive Overview</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* 1. PAPERS MANAGEMENT TAB */}
      {/* ========================================================= */}
      {activeTab === "papers" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={paperSearch}
                onChange={e => setPaperSearch(e.target.value)}
                placeholder="Search papers by title, author, or supervisor..."
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 pl-9 pr-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">Type:</span>
              <select
                value={paperTypeFilter}
                onChange={e => setPaperTypeFilter(e.target.value)}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 outline-none cursor-pointer"
              >
                <option value="All">All Types ({papers.length})</option>
                <option value="Undergraduate Thesis">Undergraduate Theses</option>
                <option value="Master's Thesis">Master's Theses</option>
                <option value="Conference Paper">Conference Papers</option>
                <option value="Journal Article">Journal Articles</option>
              </select>
            </div>
          </div>

          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Showing <strong>{filteredPapers.length}</strong> of {papers.length} indexed manuscripts
          </div>

          {/* Papers Table */}
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400">
                <tr>
                  <th className="py-3 px-4 font-semibold">Manuscript / Paper Title</th>
                  <th className="py-3 px-4 font-semibold hidden md:table-cell">Type</th>
                  <th className="py-3 px-4 font-semibold hidden lg:table-cell">Authors</th>
                  <th className="py-3 px-4 font-semibold hidden sm:table-cell">Year</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filteredPapers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-zinc-500">
                      No manuscripts matched your search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredPapers.map(p => (
                    <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition">
                      <td className="py-3 px-4 max-w-xs">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-1 block">
                          {p.title}
                        </span>
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block truncate">
                          Supervisor: {p.supervisor || "Dept. Faculty"}
                        </span>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                          {p.publicationType}
                        </span>
                      </td>
                      <td className="py-3 px-4 hidden lg:table-cell text-zinc-600 dark:text-zinc-400 max-w-[180px] truncate">
                        {p.authors.join(", ")}
                      </td>
                      <td className="py-3 px-4 hidden sm:table-cell font-mono text-zinc-600 dark:text-zinc-400">
                        {p.year}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          p.status === "Inactive"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                        }`}>
                          {p.status || "Active"}
                        </span>
                        {p.textStatus && p.textStatus !== "unavailable" && (
                          <span
                            className={`block mt-1 text-[10px] font-medium ${
                              p.textStatus === "failed" ? "text-red-600" : p.textStatus === "done" ? "text-zinc-400" : "text-violet-600"
                            }`}
                            title={p.textError || "Text extraction / OCR status (used for searching inside PDFs and by the AI)"}
                          >
                            {p.textStatus === "done" && "Text ✓"}
                            {p.textStatus === "pending" && "OCR queued"}
                            {p.textStatus === "processing" && `OCR ${p.textPagesDone || 0}/${p.textPagesTotal || "?"}`}
                            {p.textStatus === "failed" && "OCR failed"}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditPaper(p)}
                            className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                            title="Edit metadata"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>

                          {p.textStatus && p.textStatus !== "unavailable" && (
                            <button
                              onClick={(e) => handleReprocess(p, e.shiftKey)}
                              className="p-1.5 rounded-lg text-zinc-600 hover:text-violet-700 dark:text-zinc-400 dark:hover:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition cursor-pointer"
                              title="Re-read the PDF text (Shift+click: force OCR on every page, e.g. for Bijoy-font PDFs whose text comes out garbled)"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </button>
                          )}
                          
                          {/* DELETE PAPER BUTTON */}
                          <button
                            onClick={() => {
                              setDeleteTarget({
                                type: "paper",
                                id: p.id,
                                title: p.title
                              });
                              setDeleteModalError("");
                            }}
                            className="p-1.5 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer"
                            title="Delete paper permanently"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. STUDENT PROJECTS MANAGEMENT TAB */}
      {/* ========================================================= */}
      {activeTab === "projects" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={projectSearch}
                onChange={e => setProjectSearch(e.target.value)}
                placeholder="Search student projects by title, team, supervisor, or tech..."
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 pl-9 pr-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">Category:</span>
              <select
                value={projectCategoryFilter}
                onChange={e => setProjectCategoryFilter(e.target.value)}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 outline-none cursor-pointer"
              >
                <option value="All">All Categories ({projects.length})</option>
                <option value="Software">Software</option>
                <option value="Hardware">Hardware</option>
                <option value="Hybrid / IoT">Hybrid / IoT</option>
              </select>
            </div>
          </div>

          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Showing <strong>{filteredProjects.length}</strong> of {projects.length} student projects
          </div>

          {/* Projects Table */}
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400">
                <tr>
                  <th className="py-3 px-4 font-semibold">Project Title & Batch</th>
                  <th className="py-3 px-4 font-semibold hidden md:table-cell">Category</th>
                  <th className="py-3 px-4 font-semibold hidden lg:table-cell">Team Members</th>
                  <th className="py-3 px-4 font-semibold hidden sm:table-cell">Status</th>
                  <th className="py-3 px-4 font-semibold">Featured</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filteredProjects.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-zinc-500">
                      No student projects matched your search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredProjects.map(proj => (
                    <tr key={proj.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition">
                      <td className="py-3 px-4 max-w-xs">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-1 block">
                          {proj.title}
                        </span>
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block truncate">
                          {proj.batch} • Supervisor: {proj.supervisor}
                        </span>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                          {proj.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 hidden lg:table-cell text-zinc-600 dark:text-zinc-400 max-w-[180px] truncate">
                        {proj.teamMembers.join(", ")}
                      </td>
                      <td className="py-3 px-4 hidden sm:table-cell">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          proj.status === "Completed"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
                        }`}>
                          {proj.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleFeaturedProject(proj)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
                            proj.featured
                              ? "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300"
                              : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
                          }`}
                          title="Toggle Featured on homepage"
                        >
                          <Star className={`h-3 w-3 ${proj.featured ? "fill-amber-500 text-amber-500" : ""}`} />
                          <span>{proj.featured ? "Featured" : "Standard"}</span>
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* DELETE PROJECT BUTTON */}
                          <button
                            onClick={() => {
                              setDeleteTarget({
                                type: "project",
                                id: proj.id,
                                title: proj.title
                              });
                              setDeleteModalError("");
                            }}
                            className="p-1.5 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer"
                            title="Delete project permanently"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. USER MANAGEMENT TAB */}
      {/* ========================================================= */}
      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Search users by name or email..."
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 pl-9 pr-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
              />
            </div>
          </div>

          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Showing <strong>{filteredUsers.length}</strong> registered user accounts
          </div>

          <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400">
                <tr>
                  <th className="py-3 px-4 font-semibold">User Name & Email</th>
                  <th className="py-3 px-4 font-semibold">Role</th>
                  <th className="py-3 px-4 font-semibold hidden sm:table-cell">Account Status</th>
                  <th className="py-3 px-4 font-semibold hidden md:table-cell">Joined</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filteredUsers.map(u => {
                  const isCurrent = u.id === currentUser?.id;
                  return (
                    <tr key={u.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition">
                      <td className="py-3 px-4">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100 block">
                          {u.name} {isCurrent && <span className="text-emerald-600 font-normal">(You)</span>}
                        </span>
                        <span className="text-[11px] text-zinc-500 font-mono">
                          {u.email}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          disabled={isCurrent}
                          value={u.role}
                          onChange={e => handleUserRoleChange(u.id, e.target.value as any)}
                          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-xs text-zinc-800 dark:text-zinc-200 outline-none cursor-pointer disabled:opacity-50"
                        >
                          <option value="student">student</option>
                          <option value="teacher">teacher</option>
                          <option value="editor">editor</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 hidden sm:table-cell">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.isBlocked
                            ? "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                        }`}>
                          {u.isBlocked ? "Suspended" : "Active"}
                        </span>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell text-zinc-500 font-mono text-[11px]">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "Recent"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!isCurrent && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleToggleBlockUser(u)}
                              className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                              title={u.isBlocked ? "Unblock account" : "Suspend account"}
                            >
                              {u.isBlocked ? <UserCheck className="h-4 w-4 text-emerald-600" /> : <Ban className="h-4 w-4 text-amber-600" />}
                            </button>
                            <button
                              onClick={() => {
                                setDeleteTarget({
                                  type: "user",
                                  id: u.id,
                                  title: `${u.name} (${u.email})`
                                });
                                setDeleteModalError("");
                              }}
                              className="p-1.5 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer"
                              title="Delete user account"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. SETTINGS & FAQS TAB */}
      {/* ========================================================= */}
      {activeTab === "branding" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Site Branding Form */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xs space-y-4">
            <div>
              <h3 className="font-serif font-bold text-base text-zinc-900 dark:text-zinc-100">
                Portal Identity & Branding
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Update the official portal heading, metadata, and description.
              </p>
            </div>

            <form onSubmit={handleSaveBranding} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Portal Name / Heading
                </label>
                <input
                  type="text"
                  required
                  value={siteName}
                  onChange={e => setSiteName(e.target.value)}
                  placeholder="e.g. CSE EduDocs"
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Archive Tagline
                </label>
                <input
                  type="text"
                  required
                  value={siteTagline}
                  onChange={e => setSiteTagline(e.target.value)}
                  placeholder="e.g. Research Papers, Theses & Student Projects Archive"
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={brandingSaving}
                  className="rounded-xl bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 px-5 py-2.5 text-xs font-semibold shadow-xs transition cursor-pointer flex items-center gap-2"
                >
                  {brandingSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  <span>Save Portal Identity</span>
                </button>
              </div>
            </form>
          </div>

          {/* FAQs Manager */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif font-bold text-base text-zinc-900 dark:text-zinc-100">
                  Official FAQs
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Frequently asked questions displayed on the portal.
                </p>
              </div>

              <button
                onClick={() => {
                  setEditingFaq(null);
                  setFaqQuestion("");
                  setFaqAnswer("");
                  setShowFaqModal(true);
                }}
                className="flex items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 px-3 py-1.5 text-xs font-semibold transition cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add FAQ</span>
              </button>
            </div>

            <div className="space-y-2.5 pt-2 max-h-96 overflow-y-auto pr-1">
              {faqs.map(faq => (
                <div key={faq.id} className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                      {faq.question}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          setEditingFaq(faq);
                          setFaqQuestion(faq.question);
                          setFaqAnswer(faq.answer);
                          setShowFaqModal(true);
                        }}
                        className="p-1 rounded text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer"
                        title="Edit FAQ"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setDeleteTarget({
                            type: "faq",
                            id: faq.id,
                            title: faq.question
                          });
                          setDeleteModalError("");
                        }}
                        className="p-1 rounded text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer"
                        title="Delete FAQ"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ========================================================= */}
      {/* 5. ARCHIVE OVERVIEW TAB */}
      {/* ========================================================= */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs text-center">
              <BookOpen className="h-5 w-5 text-zinc-500 mx-auto mb-2" />
              <div className="font-serif text-3xl font-bold text-zinc-900 dark:text-zinc-100">{papers.length}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-medium">Total Research Papers</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs text-center">
              <Laptop className="h-5 w-5 text-zinc-500 mx-auto mb-2" />
              <div className="font-serif text-3xl font-bold text-zinc-900 dark:text-zinc-100">{projects.length}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-medium">Student Projects</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs text-center">
              <Users className="h-5 w-5 text-zinc-500 mx-auto mb-2" />
              <div className="font-serif text-3xl font-bold text-zinc-900 dark:text-zinc-100">{users.length}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-medium">Registered Accounts</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs text-center">
              <FileText className="h-5 w-5 text-zinc-500 mx-auto mb-2" />
              <div className="font-serif text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                {papers.filter(p => p.publicationType?.toLowerCase().includes("thesis")).length}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-medium">Theses & Dissertations</div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xs space-y-3">
            <h3 className="font-serif font-bold text-base text-zinc-900 dark:text-zinc-100">
              Department Repository Summary
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              <strong>CSE EduDocs</strong> preserves academic manuscripts, MSc & undergraduate theses, faculty journal publications, and innovative student software & hardware projects produced by the Department of Computer Science & Engineering at Pabna University of Science and Technology.
            </p>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* UNIVERSAL DELETE CONFIRMATION MODAL */}
      {/* ========================================================= */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-xs select-none">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
            
            <div className="flex items-start gap-3 text-red-600 dark:text-red-400">
              <div className="p-2.5 bg-red-100 dark:bg-red-950/50 rounded-xl shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-base text-zinc-900 dark:text-zinc-100">
                  Confirm Permanent Deletion
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Are you sure you want to delete this {deleteTarget.type}? This action cannot be reversed.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                {deleteTarget.type.toUpperCase()} TITLE / IDENTIFIER
              </span>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-2">
                {deleteTarget.title}
              </p>
            </div>

            {deleteModalError && (
              <div className="p-2.5 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 rounded-xl text-xs font-medium">
                {deleteModalError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={deleteLoading}
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteModalError("");
                }}
                className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={executeDelete}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer shadow-xs transition flex items-center gap-1.5"
              >
                {deleteLoading ? (
                  <span>Deleting...</span>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* EDIT PAPER METADATA MODAL */}
      {/* ========================================================= */}
      {editingPaper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="font-serif font-bold text-base text-zinc-900 dark:text-zinc-100">
                Edit Paper Metadata
              </h3>
              <button
                onClick={() => setEditingPaper(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditPaper} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Authors (comma separated)
                </label>
                <input
                  type="text"
                  required
                  value={editAuthors}
                  onChange={e => setEditAuthors(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Supervisor
                </label>
                <input
                  type="text"
                  value={editSupervisor}
                  onChange={e => setEditSupervisor(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Summary / Abstract
                </label>
                <textarea
                  rows={3}
                  value={editSummary}
                  onChange={e => setEditSummary(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Status
                </label>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value as any)}
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 outline-none cursor-pointer"
                >
                  <option value="Active">Active (Visible)</option>
                  <option value="Inactive">Inactive (Hidden)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingPaper(null)}
                  className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-semibold shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  {editSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ADD / EDIT FAQ MODAL */}
      {/* ========================================================= */}
      {showFaqModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="font-serif font-bold text-base text-zinc-900 dark:text-zinc-100">
                {editingFaq ? "Edit FAQ Item" : "Create New FAQ"}
              </h3>
              <button
                onClick={() => setShowFaqModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFaq} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Question
                </label>
                <input
                  type="text"
                  required
                  value={faqQuestion}
                  onChange={e => setFaqQuestion(e.target.value)}
                  placeholder="e.g. How do I submit my thesis?"
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Answer
                </label>
                <textarea
                  required
                  rows={3}
                  value={faqAnswer}
                  onChange={e => setFaqAnswer(e.target.value)}
                  placeholder="Provide clear guidance..."
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowFaqModal(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={faqSaving}
                  className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  {faqSaving ? "Saving..." : (editingFaq ? "Update FAQ" : "Save FAQ")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
