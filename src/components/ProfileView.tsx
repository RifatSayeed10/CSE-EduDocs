import React from "react";
import { 
  User, Mail, KeyRound, Download, BookOpen, Bookmark, BadgeAlert, 
  ShieldCheck, ArrowUpRight, HelpCircle, Send, CheckCircle2, RefreshCw, 
  Receipt, Plus, Ticket, Landmark, Upload, FileText, Sparkles
} from "lucide-react";
import { Paper, User as UserType, Topic, Researcher, AiStatus, AiMetadataSuggestion } from "../types";
import { api } from "../lib/api";
import { useAiMetadata } from "../lib/useAiMetadata";
import AiAutofillPanel from "./AiAutofillPanel";
import { getTaxonomyColor } from "../lib/taxonomyColors";

interface ProfileViewProps {
  currentUser: UserType | null;
  onRefreshCurrentUser: () => void;
  papers: Paper[];
  topics?: Topic[];
  researchers?: Researcher[];
  onSelectPaper: (paper: Paper) => void;
  onNavigateToAuth: (tab: "signin" | "register") => void;
  aiStatus?: AiStatus | null;
}

export default function ProfileView({
  currentUser,
  onRefreshCurrentUser,
  papers,
  topics = [],
  researchers = [],
  onSelectPaper,
  onNavigateToAuth,
  aiStatus = null
}: ProfileViewProps) {
  const ai = useAiMetadata();
  
  const [activeProfileTab, setActiveProfileTab] = React.useState<"dashboard" | "security" | "upload" | "researcher">("dashboard");

  // Profile credentials form
  const [profileName, setProfileName] = React.useState("");
  const [profileEmail, setProfileEmail] = React.useState("");
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");

  // Paper Upload Form State
  const [submitTitle, setSubmitTitle] = React.useState("");
  const [submitAuthors, setSubmitAuthors] = React.useState("");
  const [submitSummary, setSubmitSummary] = React.useState("");
  const [submitYear, setSubmitYear] = React.useState("2026");
  const [submitPages, setSubmitPages] = React.useState("12");
  const [submitCategory, setSubmitCategory] = React.useState("");
  const [submitResearcherId, setSubmitResearcherId] = React.useState("");
  const [pdfFile, setPdfFile] = React.useState<File | null>(null);
  const [pdfBase64, setPdfBase64] = React.useState("");
  const [pdfName, setPdfName] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [dragActive, setDragActive] = React.useState(false);

  // Paper cover photo state variables
  const [coverPhotoFile, setCoverPhotoFile] = React.useState<File | null>(null);
  const [coverPhotoBase64, setCoverPhotoBase64] = React.useState("");
  const [coverPhotoName, setCoverPhotoName] = React.useState("");

  // Scholar/Researcher profile form states
  const [resName, setResName] = React.useState("");
  const [resAffiliation, setResAffiliation] = React.useState("");
  const [resPosition, setResPosition] = React.useState("");
  const [resBio, setResBio] = React.useState("");
  const [resEmail, setResEmail] = React.useState("");
  const [resWebsite, setResWebsite] = React.useState("");
  const [resPhotoFile, setResPhotoFile] = React.useState<File | null>(null);
  const [resPhotoBase64, setResPhotoBase64] = React.useState("");
  const [resPhotoName, setResPhotoName] = React.useState("");
  const [savingResearcher, setSavingResearcher] = React.useState(false);

  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState("");
  const [successMsg, setSuccessMsg] = React.useState("");

  React.useEffect(() => {
    if (currentUser) {
      setProfileName(currentUser.name);
      setProfileEmail(currentUser.email);
      // Prefill author field with current user's name
      if (!submitAuthors) {
        setSubmitAuthors(currentUser.name);
      }
    }
  }, [currentUser]);

  React.useEffect(() => {
    if (topics.length > 0 && !submitCategory) {
      setSubmitCategory(topics[0].name);
    }
  }, [topics]);

  const showFeedback = (msg: string, isErr = false) => {
    if (isErr) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(""), 4000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(""), 3000);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const updated = await api.updateProfile({
        name: profileName.trim(),
        email: profileEmail.trim(),
      });
      showFeedback("Profile details adjusted successfully!");
      onRefreshCurrentUser();
    } catch (err: any) {
      showFeedback(err.message || "Failed to update profile", true);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    if (newPassword.length < 6) {
      showFeedback("New passkey requirement: At least 6 characters.", true);
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      await api.updateProfile({
        currentPassword,
        newPassword
      });
      showFeedback("Passcode updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: any) {
      showFeedback(err.message || "Failed to alter password key", true);
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
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
      showFeedback("File restriction: Only PDF documents can be loaded.", true);
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      showFeedback("File is larger than 50MB.", true);
      return;
    }
    setPdfFile(file);
    setPdfName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      setPdfBase64(reader.result as string);
    };
    reader.onerror = () => {
      showFeedback("Failed to read binary stream of Document.", true);
    };
    reader.readAsDataURL(file);
  };

  const handleCoverPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith("image/")) {
        showFeedback("Only image files are allowed for paper covers.", true);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showFeedback("Image file must be under 5MB.", true);
        return;
      }
      setCoverPhotoFile(file);
      setCoverPhotoName(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        setCoverPhotoBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith("image/")) {
        showFeedback("Only image files are allowed for researcher photos.", true);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showFeedback("Image file must be under 5MB.", true);
        return;
      }
      setResPhotoFile(file);
      setResPhotoName(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        setResPhotoBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const myResearcherProfile = currentUser 
    ? researchers.find(r => r.userId === currentUser.id || (r.email && r.email.toLowerCase() === currentUser.email.toLowerCase()))
    : null;

  React.useEffect(() => {
    if (myResearcherProfile) {
      setResName(myResearcherProfile.name || "");
      setResAffiliation(myResearcherProfile.affiliation || "");
      setResPosition(myResearcherProfile.position || "Researcher");
      setResBio(myResearcherProfile.bio || "");
      setResEmail(myResearcherProfile.email || "");
      setResWebsite(myResearcherProfile.website || "");
      setResPhotoBase64(myResearcherProfile.profilePhoto || "");
    } else if (currentUser) {
      setResName(currentUser.name || "");
      setResEmail(currentUser.email || "");
      setResAffiliation("");
      setResPosition("Researcher");
      setResBio("");
      setResWebsite("");
      setResPhotoBase64("");
    }
  }, [myResearcherProfile, currentUser]);

  const handleSaveResearcherProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!resName || !resAffiliation) {
      showFeedback("Full Name and Affiliation are mandatory for Scholar profile.", true);
      return;
    }

    setSavingResearcher(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      let finalPhotoUrl = resPhotoBase64;
      // If a new photo is chosen, upload it directly via multipart
      if (resPhotoFile) {
        const uploadRes = await api.uploadFile(resPhotoFile);
        finalPhotoUrl = uploadRes.fileUrl;
      }

      const payload: Partial<Researcher> = {
        name: resName.trim(),
        affiliation: resAffiliation.trim(),
        position: resPosition.trim() || "Researcher",
        bio: resBio.trim(),
        email: resEmail.trim(),
        website: resWebsite.trim(),
        profilePhoto: finalPhotoUrl || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
        userId: currentUser.id
      };

      if (myResearcherProfile) {
        await api.updateResearcher(myResearcherProfile.id, payload);
        showFeedback("Scholar Profile updated successfully!");
      } else {
        await api.createResearcher(payload);
        showFeedback("Scholar Profile registered successfully!");
      }
      
      onRefreshCurrentUser();
    } catch (err: any) {
      showFeedback(err.message || "Failed to save researcher profile.", true);
    } finally {
      setSavingResearcher(false);
    }
  };

  const applyAiSuggestion = (s: AiMetadataSuggestion) => {
    if (s.title) setSubmitTitle(s.title);
    if (s.authors?.length) setSubmitAuthors(s.authors.join(", "));
    if (s.abstract) setSubmitSummary(s.abstract);
    if (s.year) setSubmitYear(String(s.year));
    if (s.pages) setSubmitPages(String(s.pages));
    if (s.category && topics.some(t => t.name === s.category)) setSubmitCategory(s.category);
  };

  const handlePaperUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!submitTitle || !submitAuthors || !submitSummary) {
      showFeedback("All mandatory metadata must be specified.", true);
      return;
    }
    if (!pdfBase64) {
      showFeedback("Please drag & drop or select a PDF manuscript file first.", true);
      return;
    }

    setUploading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      if (!pdfFile) {
        showFeedback("Please select a PDF file first.", true);
        setUploading(false);
        return;
      }

      // Reuses the upload made by the AI assistant, if any
      const fileUrl = await ai.ensureUploaded(pdfFile);

      // Handle custom cover image upload if selected
      let customCoverUrl = undefined;
      if (coverPhotoFile) {
        const coverRes = await api.uploadFile(coverPhotoFile);
        customCoverUrl = coverRes.fileUrl;
      }

      const parsedAuthors = submitAuthors.split(",").map(a => a.trim()).filter(Boolean);

      const payload: Partial<Paper> = {
        title: submitTitle.trim(),
        authors: parsedAuthors,
        year: Number(submitYear),
        pages: Number(submitPages),
        status: "Active",
        categories: [submitCategory || (topics[0]?.name || "Unassigned")],
        summary: submitSummary.trim(),
        fileUrl: fileUrl,
      };

      if (customCoverUrl) {
        payload.coverImage = customCoverUrl;
      }

      if (submitResearcherId) {
        payload.researcherId = submitResearcherId;
      } else if (myResearcherProfile) {
        payload.researcherId = myResearcherProfile.id;
      }

      await api.createPaper(payload);
      
      showFeedback("Academic paper uploaded & indexed successfully!");
      
      // Reset form fields
      setSubmitTitle("");
      setSubmitSummary("");
      setPdfFile(null);
      setPdfBase64("");
      setPdfName("");
      setCoverPhotoFile(null);
      setCoverPhotoBase64("");
      setCoverPhotoName("");
      ai.reset();
      
      // Trigger live refresh
      onRefreshCurrentUser();
    } catch (err: any) {
      showFeedback(err.message || "Failed to catalog paper indexing on the platform.", true);
    } finally {
      setUploading(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-lg p-12 text-center" id="profile-unauthorized">
        <Bookmark className="mx-auto h-12 w-12 text-stone-350 mb-3" />
        <h2 className="font-serif text-lg font-bold text-stone-900">User Dashboard</h2>
        <p className="text-stone-500 text-xs mt-1 font-light">Please sign in to see your uploads and bookmarks.</p>
        <button
          onClick={() => onNavigateToAuth("signin")}
          className="mt-4 rounded-sm bg-brand-500 px-5.5 py-2.5 text-xs font-bold text-white shadow-3xs cursor-pointer hover:bg-brand-600 transition"
        >
          Proceed to Login
        </button>
      </div>
    );
  }

  // Filter bookmarked publications list
  const savedPapersList = papers.filter(p => currentUser.bookmarks.includes(p.id));

  // Papers this user uploaded
  const myUploadedPapers = papers.filter(p => p.uploaderId === currentUser.id);

  return (
    <div className="space-y-8 pb-16 page-transition-enter page-transition-enter-active text-left">
      
      {/* Page Title */}
      <div className="border-b border-stone-200 pb-5 select-none bg-stone-50 p-5 rounded-sm border">
        <h1 className="font-serif text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900 flex items-center gap-2.5">
          <Landmark className="h-8 w-8 text-brand-600" />
          Scholar Profile Dashboard
        </h1>
        <p className="text-xs sm:text-sm text-stone-600 mt-1.5 font-sans">
          Manage your account, see the papers you uploaded and your bookmarks, and upload new papers.
        </p>
      </div>

      {/* Sub Tabs rail with exciting vibrant active gradient styling */}
      <div className="flex bg-stone-100 p-1 border border-stone-200 rounded-sm select-none max-w-2xl overflow-x-auto">
        {[
          { id: "dashboard", label: "My Uploads & Saved", icon: Bookmark },
          { id: "security", label: "Profile Credentials", icon: User },
          { id: "researcher", label: "My Scholar Profile", icon: Sparkles },
          { id: "upload", label: "Upload & Publish Paper", icon: Upload },
        ].map((tab) => {
          const isActive = activeProfileTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveProfileTab(tab.id as any);
                setErrorMsg("");
                setSuccessMsg("");
              }}
              className={`flex-1 flex items-center justify-center gap-2 rounded-sm py-2.5 px-3 font-sans text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
                isActive 
                  ? "bg-brand-500 text-white shadow-3xs" 
                  : "text-stone-500 hover:text-stone-900 hover:bg-stone-200/50"
              }`}
            >
              <tab.icon className={`h-4 w-4 ${isActive ? "text-white" : "text-stone-400"}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Warnings & Success alerts */}
      {errorMsg && (
        <div className="flex items-start gap-2 rounded-sm bg-red-50 p-3 text-red-750 font-semibold text-xs" id="profile-error">
          <BadgeAlert className="h-4.5 w-4.5 mt-0.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="flex items-start gap-2 rounded-sm bg-green-50 p-3 text-green-755 font-semibold text-xs" id="profile-success">
          <CheckCircle2 className="h-4.5 w-4.5 mt-0.5 text-green-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tab Workspaces */}
      <div className="bg-white border border-stone-200 rounded-sm p-5 sm:p-7 shadow-3xs">
        
        {/* SUBTAB 1: USER DASHBOARD (Downloads summary + saved bookmarks) */}
        {activeProfileTab === "dashboard" && (
          <div className="space-y-8" id="profile-subtab-dashboard">
            
            {/* MY UPLOADED PAPERS */}
            <div className="space-y-4">
              <div className="select-none text-left">
                <h3 className="font-serif text-base font-bold text-stone-900 flex items-center gap-1.5">
                  <FileText className="h-5 w-5 text-brand-600" />
                  My Uploaded Papers
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">Theses and papers you have submitted to the archive.</p>
              </div>

              {myUploadedPapers.length === 0 ? (
                <div className="rounded-sm border border-dashed border-stone-250 p-8 text-center text-stone-400 text-xs font-light select-none bg-stone-50/50">
                  You have not uploaded any papers yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 select-none">
                  {myUploadedPapers.map((paper) => (
                    <div key={paper.id} className="rounded-sm border border-stone-200 bg-stone-50/40 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3.5">
                      <div className="text-left space-y-1.5 min-w-0 max-w-full sm:max-w-[70%]">
                        <span className={`inline-block font-mono text-[8px] leading-none uppercase tracking-widest px-2 py-0.5 rounded-sm font-bold border ${paper.status === "Active" ? "bg-emerald-50 text-emerald-700 border-emerald-250" : "bg-amber-50 text-amber-700 border-amber-250"}`}>
                          {paper.status === "Active" ? "Published" : "Hidden by admin"}
                        </span>
                        <h4 className="font-sans text-xs font-bold text-stone-850 truncate leading-snug">
                          {paper.title}
                        </h4>
                        <span className="block font-mono text-[10px] text-stone-450">
                          {paper.year} • {paper.views} views • {paper.downloadsCount || 0} downloads
                        </span>
                      </div>

                      <div className="flex gap-2 shrink-0 max-w-full w-full sm:w-auto">
                        <button
                          onClick={() => onSelectPaper(paper)}
                          className="rounded-sm border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 px-3.5 py-2 font-sans text-[11px] font-bold cursor-pointer"
                        >
                          Details
                        </button>
                        <a
                          href={api.downloadUrl(paper.id)}
                          className="flex items-center gap-1.5 rounded-sm bg-brand-500 hover:bg-brand-600 text-white font-bold text-[11px] px-3.5 py-2 cursor-pointer transition-all"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* DEVIED BOOKMARKS DIRECTORY */}
            <div className="space-y-4 pt-4 border-t border-stone-150">
              <div className="select-none text-left">
                <h3 className="font-serif text-base font-bold text-stone-900 flex items-center gap-1.5">
                  <Bookmark className="h-5 w-5 text-brand-600" />
                  Saved Bookmark Index Records
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">Quickly query details across manuscripts you bookmarked.</p>
              </div>

              {savedPapersList.length === 0 ? (
                <div className="rounded-sm border border-dashed border-stone-250 p-8 text-center text-stone-400 text-xs font-light select-none bg-stone-50/50">
                  Your bookmarks collection is empty. Browse publications and bookmark elements.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {savedPapersList.map((paper) => (
                    <div key={paper.id} className="rounded-sm border border-stone-200 p-4.5 bg-white text-left space-y-3.5 hover:border-brand-300 transition-all flex flex-col justify-between">
                      <div className="space-y-1.5">
                        {(() => {
                          const col = getTaxonomyColor(paper.categories[0]);
                          return (
                            <span className={`font-mono text-[9px] font-bold block uppercase mb-1.5 px-2 py-0.5 rounded-sm border inline-block ${col.bg} ${col.text} ${col.border}`}>
                              {paper.categories[0]}
                            </span>
                          );
                        })()}
                        <h4 className="font-sans text-xs font-bold text-stone-850 leading-snug line-clamp-2">
                          {paper.title}
                        </h4>
                        <span className="block text-[10px] text-stone-500 truncate">
                          By {paper.authors.join(", ")}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between pt-2 border-t border-stone-150">
                        <span className="text-[10px] font-mono text-stone-450">{paper.year} • {paper.pages} pages</span>
                        
                        <button
                          onClick={() => onSelectPaper(paper)}
                          className="rounded-sm bg-stone-900 border border-stone-900 hover:bg-stone-800 text-white font-bold text-[10px] px-3.5 py-1.5 cursor-pointer"
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* SUBTAB 2: PROFILE CREDENTIALS (name change, check and modify passcode) */}
        {activeProfileTab === "security" && (
          <div className="grid grid-cols-1 gap-10 md:grid-cols-2" id="profile-subtab-security">
            
            {/* Form A: General Node details */}
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <h4 className="font-serif text-xs font-bold text-stone-700 uppercase tracking-wider border-b border-stone-200 pb-2 flex items-center gap-1 bg-transparent select-none">
                Query Account Identity
              </h4>

              <div>
                <label className="block text-[10px] font-semibold text-stone-500 uppercase mb-1 font-mono">Scholar Display Name</label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    required
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full rounded-sm border border-stone-300 pl-10 pr-3 py-2.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  />
                  <User className="absolute left-3 top-3 h-4.5 w-4.5 text-stone-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-stone-500 uppercase mb-1 font-mono">Credentials Email address</label>
                <div className="relative flex items-center">
                  <input
                    type="email"
                    required
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    className="w-full rounded-sm border border-stone-300 pl-10 pr-3 py-2.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 font-sans"
                  />
                  <Mail className="absolute left-3 top-3 h-4.5 w-4.5 text-stone-400 pointer-events-none" />
                </div>
              </div>

              <div className="pt-2 select-none">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-sm bg-stone-950 text-white font-bold text-xs px-5 py-2.5 hover:bg-stone-800 disabled:bg-stone-300 transition-all cursor-pointer"
                >
                  {loading ? "Re-saving identity..." : "Update Identity details"}
                </button>
              </div>
            </form>

            {/* Form B: Passkey Override checks */}
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <h4 className="font-serif text-xs font-bold text-stone-700 uppercase tracking-wider border-b border-stone-200 pb-2 select-none">
                Security Password Change
              </h4>

              <div>
                <label className="block text-[10px] font-semibold text-stone-500 uppercase mb-1 font-mono">Current Password *</label>
                <div className="relative flex items-center">
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Provide your current passcode"
                    className="w-full rounded-sm border border-stone-300 pl-10 pr-3 py-2.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  />
                  <KeyRound className="absolute left-3 top-3 h-4.5 w-4.5 text-stone-400" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-stone-500 uppercase mb-1 font-mono">New Security Password *</label>
                <div className="relative flex items-center">
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full rounded-sm border border-stone-300 pl-10 pr-3 py-2.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  />
                  <KeyRound className="absolute left-3 top-3 h-4.5 w-4.5 text-stone-400" />
                </div>
              </div>

              <div className="pt-2 select-none">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-sm bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs px-5 py-2.5 transition disabled:bg-slate-300 cursor-pointer"
                >
                  {loading ? "Overriding passkey..." : "Change Password"}
                </button>
              </div>
            </form>

          </div>
        )}

        {/* SUBTAB 3: PAPER UPLOAD & SELF-PUBLISHING WIZARD */}
        {activeProfileTab === "upload" && (
          <div className="space-y-6" id="profile-subtab-upload">
            <div className="border-b border-stone-200 pb-3 flex items-center justify-between">
              <div>
                <h3 className="font-serif text-sm sm:text-base font-extrabold text-stone-900 flex items-center gap-2">
                  <Upload className="h-5 w-5 text-brand-600" />
                  Self-Publish New Research Paper
                </h3>
                <p className="text-[11px] sm:text-xs text-stone-500 mt-1">
                  Upload your scientific manuscript as a PDF and provide structural catalog metadata. Both students and teachers can publish papers freely.
                </p>
              </div>
              <Sparkles className="h-5 w-5 text-brand-500" />
            </div>

            <form onSubmit={handlePaperUpload} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Column: Metadata Details (7/12) */}
              <div className="lg:col-span-7 space-y-5 bg-stone-50/50 p-5 sm:p-7 rounded-sm border border-stone-200">
                <h4 className="font-serif text-xs font-bold text-stone-800 uppercase tracking-wider select-none border-b border-stone-200 pb-2">
                  1. Manuscript Index Specifications
                </h4>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1 font-mono">Research/Paper Title *</label>
                    <input
                      type="text"
                      required
                      value={submitTitle}
                      onChange={(e) => setSubmitTitle(e.target.value)}
                      placeholder="e.g. Adaptive Quantum Cryptography in Decentralized Ledger Platforms"
                      className="w-full rounded-sm border border-stone-300 bg-white px-3.5 py-2.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1 font-mono">Authors (Comma separated) *</label>
                      <input
                        type="text"
                        required
                        value={submitAuthors}
                        onChange={(e) => setSubmitAuthors(e.target.value)}
                        placeholder="e.g. Dr. Al-Amin, Rafat Ahmed"
                        className="w-full rounded-sm border border-stone-300 bg-white px-3.5 py-2.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1 font-mono">Primary Category / Topic *</label>
                      <select
                        value={submitCategory}
                        onChange={(e) => setSubmitCategory(e.target.value)}
                        className="w-full rounded-sm border border-stone-300 bg-white px-3 py-2.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 font-sans"
                      >
                        {topics.map((top) => (
                          <option key={top.id} value={top.name}>{top.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1 font-mono">Publishing Year *</label>
                      <input
                        type="number"
                        required
                        value={submitYear}
                        onChange={(e) => setSubmitYear(e.target.value)}
                        className="w-full rounded-sm border border-stone-300 bg-white px-3 py-2.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1 font-mono">Manuscript Pages *</label>
                      <input
                        type="number"
                        required
                        value={submitPages}
                        onChange={(e) => setSubmitPages(e.target.value)}
                        className="w-full rounded-sm border border-stone-300 bg-white px-3 py-2.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1 font-mono">Associated Researcher Profile affiliation</label>
                    <select
                      value={submitResearcherId}
                      onChange={(e) => setSubmitResearcherId(e.target.value)}
                      className="w-full rounded-sm border border-stone-300 bg-white px-3 py-2.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 font-sans"
                    >
                      <option value="">-- No Direct Co-author Profile Mapping --</option>
                      {researchers.map((res) => (
                        <option key={res.id} value={res.id}>{res.name} ({res.affiliation})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1 font-mono">Abstract / summary Overview *</label>
                    <textarea
                      rows={5}
                      required
                      value={submitSummary}
                      onChange={(e) => setSubmitSummary(e.target.value)}
                      placeholder="Write a brief overview describing findings, research query methodology, and conclusions..."
                      className="w-full rounded-sm border border-stone-300 bg-white px-3 py-2.5 text-xs outline-none resize-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 font-sans leading-relaxed"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: PDF File Drop Zone (5/12) */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-white p-5 rounded-sm border border-stone-200 shadow-3xs space-y-4">
                  <h4 className="font-serif text-xs font-bold text-stone-800 uppercase tracking-wider select-none border-b border-stone-150 pb-2 flex items-center justify-between">
                    <span>2. Select PDF Document</span>
                    <span className="text-[10px] text-stone-400 capitalize font-mono font-bold">50MB Max Limit</span>
                  </h4>

                  {/* Drag and Drop Zone */}
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`relative rounded-sm border-2 border-dashed p-8 text-center transition-all flex flex-col items-center justify-center min-h-[220px] cursor-pointer ${
                      dragActive
                        ? "border-brand-500 bg-stone-100 animate-pulse"
                        : pdfFile
                        ? "border-emerald-500 bg-emerald-50/10"
                        : "border-stone-300 bg-stone-50/50 hover:bg-stone-100/50"
                    }`}
                  >
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileSelect}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      id="profile-pdf-picker"
                    />

                    {pdfFile ? (
                      <div className="space-y-3 pointer-events-none select-none">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-sm bg-emerald-100 text-emerald-600">
                          <FileText className="h-7 w-7" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-stone-800 line-clamp-1">{pdfName}</p>
                          <p className="text-[10px] text-stone-500 font-mono mt-0.5">{(pdfFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to Upload</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 pointer-events-none select-none">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-sm bg-stone-100 text-stone-600">
                          <Upload className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-stone-750">Drag & Drop your PDF here</p>
                          <p className="text-[10px] text-stone-400 mt-1">or click to browse local folders</p>
                        </div>
                      </div>
                    )}
                  </div>
                  {aiStatus?.enabled && aiStatus.pdfTextAvailable && (
                    <AiAutofillPanel ai={ai} file={pdfFile} onApply={applyAiSuggestion} />
                  )}
                </div>

                {/* Featured Cover Image Upload (Optional) */}
                <div className="bg-white p-5 rounded-sm border border-stone-200 shadow-3xs space-y-4">
                  <h4 className="font-serif text-xs font-bold text-stone-800 uppercase tracking-wider select-none border-b border-stone-150 pb-2 flex items-center justify-between">
                    <span>3. Paper Cover Photo (Optional)</span>
                    <span className="text-[10px] text-stone-400 capitalize font-mono font-bold">Featured Visual</span>
                  </h4>

                  <div className="relative rounded-sm border-2 border-dashed border-stone-300 hover:border-brand-400 bg-stone-50/50 hover:bg-stone-100/30 p-4 text-center transition-all flex flex-col items-center justify-center min-h-[140px] cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCoverPhotoSelect}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      id="profile-cover-picker"
                    />

                    {coverPhotoBase64 ? (
                      <div className="space-y-2 pointer-events-none select-none flex flex-col items-center">
                        <img 
                          src={coverPhotoBase64} 
                          alt="Paper Cover Preview" 
                          className="h-20 w-32 rounded-sm object-cover border border-stone-200 shadow-3xs"
                        />
                        <div>
                          <p className="text-[11px] font-bold text-stone-850 line-clamp-1">{coverPhotoName}</p>
                          <p className="text-[9px] text-brand-600 font-bold mt-0.5">Click to replace photo</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 pointer-events-none select-none flex flex-col items-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-stone-100 text-stone-600">
                          <Upload className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-stone-700">Choose custom cover image</p>
                          <p className="text-[9px] text-stone-400 mt-0.5">Leave blank for abstract art patterns</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={uploading || ai.running}
                  className="w-full rounded-sm bg-brand-500 hover:bg-brand-600 font-sans text-xs font-bold text-white py-3.5 transition-all cursor-pointer flex items-center justify-center gap-2 select-none disabled:bg-stone-300"
                >
                  {uploading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Uploading Manuscript & Indexing...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4" />
                      <span>Finalize and Publish Paper</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        )}

        {/* SUBTAB 4: SCHOLASTIC / RESEARCHER PROFILE CREATION & UPDATE */}
        {activeProfileTab === "researcher" && (
          <div className="space-y-6" id="profile-subtab-researcher">
            <div className="border-b border-stone-200 pb-3 flex items-center justify-between">
              <div>
                <h3 className="font-serif text-sm sm:text-base font-extrabold text-stone-900 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-brand-600" />
                  My Scholar & Researcher Portfolio
                </h3>
                <p className="text-[11px] sm:text-xs text-stone-500 mt-1">
                  SetUp or update your professional Scholar Directory credentials including your institutional affiliation, biography, and profile photo.
                </p>
              </div>
              <User className="h-5 w-5 text-brand-500" />
            </div>

            <form onSubmit={handleSaveResearcherProfile} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column Fields */}
              <div className="lg:col-span-7 space-y-4 bg-stone-50/50 p-5 sm:p-7 rounded-sm border border-stone-200">
                <h4 className="font-serif text-xs font-bold text-stone-800 uppercase tracking-wider select-none border-b border-stone-200 pb-2">
                  Scholar Profile Details
                </h4>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1 font-mono">Academic Full Name *</label>
                    <input
                      type="text"
                      required
                      value={resName}
                      onChange={(e) => setResName(e.target.value)}
                      placeholder="e.g. Rafat Ahmed"
                      className="w-full rounded-sm border border-stone-300 bg-white px-3.5 py-2.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1 font-mono">Institutional Affiliation *</label>
                      <input
                        type="text"
                        required
                        value={resAffiliation}
                        onChange={(e) => setResAffiliation(e.target.value)}
                        placeholder="e.g. Dhaka University of Engineering & Tech"
                        className="w-full rounded-sm border border-stone-300 bg-white px-3.5 py-2.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1 font-mono">Professional designation *</label>
                      <input
                        type="text"
                        required
                        value={resPosition}
                        onChange={(e) => setResPosition(e.target.value)}
                        placeholder="e.g. Student Researcher, Assistant Professor, etc."
                        className="w-full rounded-sm border border-stone-300 bg-white px-3.5 py-2.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1 font-mono">Contact Email *</label>
                      <input
                        type="email"
                        required
                        value={resEmail}
                        onChange={(e) => setResEmail(e.target.value)}
                        placeholder="e.g. rafat@duet.ac.bd"
                        className="w-full rounded-sm border border-stone-300 bg-white px-3.5 py-2.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1 font-mono">Personal Website / Portfolio (Optional)</label>
                      <input
                        type="url"
                        value={resWebsite}
                        onChange={(e) => setResWebsite(e.target.value)}
                        placeholder="https://scholar.google.com/..."
                        className="w-full rounded-sm border border-stone-300 bg-white px-3.5 py-2.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1 font-mono">Scholastic Bio & Research Interests *</label>
                    <textarea
                      rows={4}
                      required
                      value={resBio}
                      onChange={(e) => setResBio(e.target.value)}
                      placeholder="Share a short bio summarizing your key studies, scientific publications, and areas of engineering interest..."
                      className="w-full rounded-sm border border-stone-300 bg-white px-3.5 py-2.5 text-xs outline-none resize-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 font-sans leading-relaxed"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column Profile Image Upload */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-white p-5 rounded-sm border border-stone-200 shadow-3xs space-y-4">
                  <h4 className="font-serif text-xs font-bold text-stone-800 uppercase tracking-wider select-none border-b border-stone-150 pb-2">
                    Profile Photo / Avatar
                  </h4>

                  <div className="relative rounded-sm border border-stone-200 hover:border-brand-400 bg-stone-50/50 hover:bg-stone-100/30 p-8 text-center transition-all flex flex-col items-center justify-center min-h-[180px] cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleResPhotoSelect}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      id="profile-resphoto-picker"
                    />

                    {resPhotoBase64 ? (
                      <div className="space-y-3 pointer-events-none select-none flex flex-col items-center">
                        <img 
                          src={resPhotoBase64} 
                          alt="Profile Preview" 
                          className="h-24 w-24 rounded-full object-cover border border-stone-100 shadow-3xs"
                        />
                        <div>
                          <p className="text-xs font-bold text-stone-850 line-clamp-1">{resPhotoName || "Personal photo linked"}</p>
                          <p className="text-[10px] text-brand-600 font-bold mt-1">Click to browse another picture</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 pointer-events-none select-none flex flex-col items-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 text-stone-600">
                          <User className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-stone-700">Upload your professional photo</p>
                          <p className="text-[10px] text-stone-400 mt-1">or click to browse local files</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingResearcher}
                  className="w-full rounded-sm bg-brand-500 hover:bg-brand-600 font-sans text-xs font-bold text-white py-3.5 transition-all cursor-pointer flex items-center justify-center gap-2 select-none disabled:bg-stone-300"
                >
                  {savingResearcher ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Saving Portfolio details...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{myResearcherProfile ? "Adjust Scholar Portfolio" : "Activate Scholar Portfolio"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

      </div>

    </div>
  );
}
