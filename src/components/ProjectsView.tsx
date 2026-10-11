import React, { useState, useEffect, useRef } from "react";
import { 
  Laptop, Cpu, Sparkles, Search, Filter, Plus, Image as ImageIcon,
  ExternalLink, Github, Eye, ThumbsUp, Trash2, Edit3, X, Check,
  ChevronRight, ChevronLeft, Upload, Layers, User, Calendar, Award,
  AlertCircle, ShieldCheck, Tag, Info, FolderGit2, BookOpen
} from "lucide-react";
import { Project, ProjectCategory, User as UserType } from "../types";
import { api } from "../lib/api";

interface ProjectsViewProps {
  currentUser: UserType | null;
  onNavigateToAuth: (tab: "signin" | "register") => void;
}

export default function ProjectsView({ currentUser, onNavigateToAuth }: ProjectsViewProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedBatch, setSelectedBatch] = useState<string>("All");
  const [selectedStatus, setSelectedStatus] = useState<string>("All");

  // Active Project Detail Modal & Gallery
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>("");

  // Form State
  const [title, setTitle] = useState<string>("");
  const [category, setCategory] = useState<ProjectCategory>("Software");
  const [teamMembersInput, setTeamMembersInput] = useState<string>("");
  const [supervisor, setSupervisor] = useState<string>("");
  const [batch, setBatch] = useState<string>("");
  const [academicYear, setAcademicYear] = useState<number>(new Date().getFullYear());
  const [description, setDescription] = useState<string>("");
  const [techStackInput, setTechStackInput] = useState<string>("");
  const [demoImages, setDemoImages] = useState<string[]>([]);
  const [coverImage, setCoverImage] = useState<string>("");
  const [githubUrl, setGithubUrl] = useState<string>("");
  const [liveDemoUrl, setLiveDemoUrl] = useState<string>("");
  const [documentationUrl, setDocumentationUrl] = useState<string>("");
  const [status, setStatus] = useState<'Completed' | 'Ongoing' | 'Prototype'>("Completed");

  // Image Uploading State
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // In-app Deletion Modal State
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteSuccess, setDeleteSuccess] = useState("");

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await api.getProjects({
        q: searchQuery,
        category: selectedCategory !== "All" ? selectedCategory : undefined,
        status: selectedStatus !== "All" ? selectedStatus : undefined,
        batch: selectedBatch !== "All" ? selectedBatch : undefined,
      });
      setProjects(data);
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [searchQuery, selectedCategory, selectedBatch, selectedStatus]);

  const handleOpenAddModal = () => {
    if (!currentUser) {
      onNavigateToAuth("signin");
      return;
    }
    setEditingProject(null);
    setTitle("");
    setCategory("Software");
    setTeamMembersInput(currentUser.name ? `${currentUser.name}` : "");
    setSupervisor("Prof. Dr. Mohammad Tariqul Islam");
    setBatch("Batch 20 (Session 2020-21)");
    setAcademicYear(new Date().getFullYear());
    setDescription("");
    setTechStackInput("React, TypeScript, Node.js");
    setDemoImages([]);
    setCoverImage("");
    setGithubUrl("");
    setLiveDemoUrl("");
    setDocumentationUrl("");
    setStatus("Completed");
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (proj: Project) => {
    setEditingProject(proj);
    setTitle(proj.title);
    setCategory(proj.category);
    setTeamMembersInput(proj.teamMembers.join(", "));
    setSupervisor(proj.supervisor || "");
    setBatch(proj.batch || "");
    setAcademicYear(proj.academicYear || new Date().getFullYear());
    setDescription(proj.description);
    setTechStackInput(proj.techStack.join(", "));
    setDemoImages(proj.demoImages || []);
    setCoverImage(proj.coverImage || (proj.demoImages && proj.demoImages[0]) || "");
    setGithubUrl(proj.githubUrl || "");
    setLiveDemoUrl(proj.liveDemoUrl || "");
    setDocumentationUrl(proj.documentationUrl || "");
    setStatus(proj.status as any || "Completed");
    setFormError("");
    setIsModalOpen(true);
  };

  // Image Upload handler (supports multiple images)
  const handleImageFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!currentUser) {
      setFormError("Please log in to upload demo images.");
      return;
    }

    setUploadingImage(true);
    setFormError("");

    try {
      const uploadedUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith("image/")) {
          continue;
        }

        // Upload file directly via multipart/form-data
        const res = await api.uploadFile(file);
        if (res.fileUrl) {
          uploadedUrls.push(res.fileUrl);
        }
      }

      if (uploadedUrls.length > 0) {
        setDemoImages(prev => {
          const combined = [...prev, ...uploadedUrls];
          if (!coverImage && combined.length > 0) {
            setCoverImage(combined[0]);
          }
          return combined;
        });
      }
    } catch (err: any) {
      console.error("Image upload error:", err);
      setFormError(err.message || "Failed to upload demo images.");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setDemoImages(prev => {
      const updated = prev.filter((_, idx) => idx !== indexToRemove);
      if (coverImage === prev[indexToRemove]) {
        setCoverImage(updated.length > 0 ? updated[0] : "");
      }
      return updated;
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError("Project title is required.");
      return;
    }
    if (!description.trim()) {
      setFormError("Project description is required.");
      return;
    }

    setFormSubmitting(true);
    setFormError("");

    try {
      const team = teamMembersInput.split(",").map(t => t.trim()).filter(Boolean);
      const tech = techStackInput.split(",").map(t => t.trim()).filter(Boolean);
      const selectedCover = coverImage || (demoImages.length > 0 ? demoImages[0] : "");

      const payload: Partial<Project> = {
        title: title.trim(),
        category,
        teamMembers: team.length > 0 ? team : [currentUser?.name || "CSE Student"],
        supervisor: supervisor.trim() || undefined,
        batch: batch.trim() || undefined,
        academicYear: Number(academicYear),
        description: description.trim(),
        techStack: tech,
        demoImages: demoImages.length > 0 ? demoImages : (selectedCover ? [selectedCover] : []),
        coverImage: selectedCover || undefined,
        githubUrl: githubUrl.trim() || undefined,
        liveDemoUrl: liveDemoUrl.trim() || undefined,
        documentationUrl: documentationUrl.trim() || undefined,
        status
      };

      if (editingProject) {
        await api.updateProject(editingProject.id, payload);
      } else {
        await api.createProject(payload);
      }

      setIsModalOpen(false);
      loadProjects();
    } catch (err: any) {
      console.error("Project submit failed:", err);
      setFormError(err.message || "Failed to save project.");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteProject = (proj: Project, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setProjectToDelete(proj);
    setDeleteError("");
  };

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;
    setDeleteLoading(true);
    setDeleteError("");
    try {
      await api.deleteProject(projectToDelete.id);
      if (activeProject?.id === projectToDelete.id) {
        setActiveProject(null);
      }
      const deletedTitle = projectToDelete.title;
      setProjectToDelete(null);
      setDeleteSuccess(`Project "${deletedTitle}" deleted successfully.`);
      setTimeout(() => setDeleteSuccess(""), 4000);
      loadProjects();
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete project.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleLike = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await api.likeProject(id);
      setProjects(prev => prev.map(p => p.id === id ? { ...p, likes: res.likes } : p));
      if (activeProject && activeProject.id === id) {
        setActiveProject(prev => prev ? { ...prev, likes: res.likes } : null);
      }
    } catch (err) {
      console.warn("Could not like project:", err);
    }
  };

  const handleOpenDetail = async (proj: Project) => {
    setActiveProject(proj);
    setActiveImageIndex(0);
    api.viewProject(proj.id).then(res => {
      if (res.views) {
        setProjects(prev => prev.map(p => p.id === proj.id ? { ...p, views: res.views } : p));
      }
    }).catch(() => {});
  };

  const isUserAuthorizedToEdit = (proj: Project) => {
    if (!currentUser) return false;
    if (currentUser.role === "admin" || currentUser.role === "editor") return true;
    if (proj.createdBy && proj.createdBy === currentUser.id) return true;
    if (proj.teamMembers && proj.teamMembers.some(m => currentUser.name && m.toLowerCase().includes(currentUser.name.toLowerCase()))) return true;
    if (proj.teamMembers && proj.teamMembers.some(m => currentUser.email && m.toLowerCase().includes(currentUser.email.split("@")[0].toLowerCase()))) return true;
    return false;
  };

  // Batches list for filter
  const uniqueBatches = Array.from(new Set(projects.map(p => p.batch).filter(Boolean))) as string[];

  return (
    <div className="space-y-8" id="projects-showcase-view">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-300/80 dark:border-zinc-700">
              <Laptop className="h-3.5 w-3.5 text-zinc-700 dark:text-zinc-300" />
              Department of CSE, PUST
            </span>
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-serif font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
            Software & Hardware Projects Showcase
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 max-w-3xl">
            Explore capstone software applications, hardware robotics prototypes, IoT sensor nodes, and research systems engineered by students and faculty of the CSE Department.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 px-4 py-2.5 text-xs font-semibold shadow-xs transition cursor-pointer"
            id="btn-add-project"
          >
            <Plus className="h-4 w-4" />
            <span>Add New Project</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by project name, tech stack (ESP32, React, PyTorch), student roll, or supervisor..."
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 pl-10 pr-4 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-zinc-900 dark:focus:border-zinc-100 focus:outline-none focus:bg-white dark:focus:bg-zinc-800"
              id="projects-search-input"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            {["All", "Software", "Hardware", "Hybrid / IoT"].map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                    active
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  {cat === "All" && "All Projects"}
                  {cat === "Software" && "💻 Software"}
                  {cat === "Hardware" && "⚡ Hardware"}
                  {cat === "Hybrid / IoT" && "🤖 Hybrid / IoT"}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sub-Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 dark:text-zinc-400 font-medium">Batch:</span>
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none"
            >
              <option value="All">All Batches</option>
              {uniqueBatches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-zinc-500 dark:text-zinc-400 font-medium">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="Completed">Completed</option>
              <option value="Ongoing">Ongoing</option>
              <option value="Prototype">Prototype</option>
            </select>
          </div>

          <div className="ml-auto text-zinc-500 dark:text-zinc-400">
            Showing <strong className="text-zinc-900 dark:text-zinc-100">{projects.length}</strong> project{projects.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-800 dark:border-zinc-200 border-t-transparent"></div>
          <span className="mt-3 text-xs text-zinc-500">Loading CSE Projects Catalog...</span>
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 p-8">
          <Laptop className="h-10 w-10 mx-auto text-zinc-400 mb-3" />
          <h3 className="font-serif text-base font-semibold text-zinc-800 dark:text-zinc-200">No Projects Found</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
            No software or hardware projects matched your current filters. Try changing your search keywords or upload a new project.
          </p>
          <button
            onClick={handleOpenAddModal}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 text-white dark:text-zinc-900 px-3.5 py-2 text-xs font-semibold cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Project Now</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="projects-card-grid">
          {projects.map((proj) => {
            const hasMultipleImages = proj.demoImages && proj.demoImages.length > 1;
            const coverImg = proj.coverImage || (proj.demoImages && proj.demoImages[0]) || "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80";

            return (
              <div
                key={proj.id}
                onClick={() => handleOpenDetail(proj)}
                className="group flex flex-col bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition cursor-pointer"
                id={`project-card-${proj.id}`}
              >
                {/* Cover Image & Category Pill */}
                <div className="relative h-48 w-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <img
                    src={coverImg}
                    alt={proj.title}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      // Fallback image if broken
                      (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80";
                    }}
                  />
                  
                  {/* Category Pill */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-zinc-900/85 text-white backdrop-blur-xs shadow-xs">
                      {proj.category === "Hardware" && "⚡ Hardware"}
                      {proj.category === "Software" && "💻 Software"}
                      {proj.category === "Hybrid / IoT" && "🤖 Hybrid / IoT"}
                    </span>

                    {proj.featured && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/90 text-white backdrop-blur-xs">
                        Featured
                      </span>
                    )}
                  </div>

                  {/* Multi-Image indicator */}
                  {hasMultipleImages && (
                    <div className="absolute bottom-3 right-3 px-2 py-1 rounded bg-black/60 text-white text-[11px] font-medium flex items-center gap-1 backdrop-blur-xs">
                      <ImageIcon className="h-3 w-3" />
                      <span>{proj.demoImages.length} photos</span>
                    </div>
                  )}

                  {/* Status Badge */}
                  <div className="absolute top-3 right-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider backdrop-blur-xs ${
                      proj.status === "Completed"
                        ? "bg-emerald-800/80 text-emerald-100"
                        : proj.status === "Ongoing"
                        ? "bg-blue-800/80 text-blue-100"
                        : "bg-amber-800/80 text-amber-100"
                    }`}>
                      {proj.status}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    {/* Batch & Year */}
                    <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                      <span>{proj.batch || "PUST CSE"}</span>
                      {proj.academicYear && (
                        <>
                          <span>•</span>
                          <span>Year {proj.academicYear}</span>
                        </>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="mt-1 font-serif text-base font-bold text-zinc-900 dark:text-zinc-100 line-clamp-2 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition">
                      {proj.title}
                    </h3>

                    {/* Description excerpt */}
                    <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 line-clamp-3 leading-relaxed">
                      {proj.description}
                    </p>
                  </div>

                  {/* Tech Stack Chips */}
                  <div>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {proj.techStack.slice(0, 4).map((tech, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                        >
                          {tech}
                        </span>
                      ))}
                      {proj.techStack.length > 4 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                          +{proj.techStack.length - 4}
                        </span>
                      )}
                    </div>

                    {/* Team Members & Supervisor */}
                    <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                      <div className="truncate max-w-[65%]">
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">Team: </span>
                        <span>{proj.teamMembers.join(", ")}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={(e) => handleLike(proj.id, e)}
                          className="flex items-center gap-1 hover:text-red-500 transition cursor-pointer"
                          title="Like project"
                        >
                          <ThumbsUp className="h-3.5 w-3.5" />
                          <span>{proj.likes || 0}</span>
                        </button>
                        <span className="flex items-center gap-1">
                          <Eye className="h-3.5 w-3.5" />
                          <span>{proj.views || 0}</span>
                        </span>
                        {isUserAuthorizedToEdit(proj) && (
                          <button
                            onClick={(e) => handleDeleteProject(proj, e)}
                            className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer"
                            title="Delete project"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PROJECT DETAILS & DEMO GALLERY MODAL */}
      {activeProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs overflow-y-auto" id="project-detail-modal">
          <div className="relative w-full max-w-4xl bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
                  {activeProject.category}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {activeProject.batch} • {activeProject.academicYear}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {isUserAuthorizedToEdit(activeProject) && (
                  <>
                    <button
                      onClick={() => {
                        const p = activeProject;
                        setActiveProject(null);
                        handleOpenEditModal(p);
                      }}
                      className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition cursor-pointer"
                      title="Edit Project"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteProject(activeProject)}
                      className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer flex items-center gap-1 text-xs font-semibold"
                      title="Delete Project"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="hidden sm:inline">Delete</span>
                    </button>
                  </>
                )}
                <button
                  onClick={() => setActiveProject(null)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              
              {/* Title & Info */}
              <div>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-zinc-900 dark:text-zinc-50">
                  {activeProject.title}
                </h2>
                {activeProject.supervisor && (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    <strong className="text-zinc-700 dark:text-zinc-300">Supervisor / Advisor: </strong>
                    {activeProject.supervisor}
                  </p>
                )}
              </div>

              {/* Multi-Image Demo Gallery */}
              {activeProject.demoImages && activeProject.demoImages.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    <span className="flex items-center gap-1.5">
                      <ImageIcon className="h-4 w-4" />
                      Demo Screenshots & Hardware Photos ({activeProject.demoImages.length})
                    </span>
                    <span>
                      Photo {activeImageIndex + 1} of {activeProject.demoImages.length}
                    </span>
                  </div>

                  {/* Main Displayed Image with Carousel Controls */}
                  <div className="relative rounded-xl overflow-hidden bg-zinc-950 flex items-center justify-center max-h-[420px] border border-zinc-800">
                    <img
                      src={activeProject.demoImages[activeImageIndex]}
                      alt={`${activeProject.title} demo`}
                      referrerPolicy="no-referrer"
                      className="max-h-[420px] w-auto max-w-full object-contain"
                    />

                    {activeProject.demoImages.length > 1 && (
                      <>
                        <button
                          onClick={() => setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : activeProject.demoImages.length - 1))}
                          className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white transition backdrop-blur-xs cursor-pointer"
                          title="Previous Image"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => setActiveImageIndex((prev) => (prev < activeProject.demoImages.length - 1 ? prev + 1 : 0))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white transition backdrop-blur-xs cursor-pointer"
                          title="Next Image"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Thumbnail Row */}
                  {activeProject.demoImages.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {activeProject.demoImages.map((img, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActiveImageIndex(idx)}
                          className={`relative h-16 w-24 rounded-lg overflow-hidden border-2 flex-shrink-0 transition cursor-pointer ${
                            activeImageIndex === idx
                              ? "border-zinc-900 dark:border-white opacity-100"
                              : "border-transparent opacity-60 hover:opacity-100"
                          }`}
                        >
                          <img
                            src={img}
                            alt="thumbnail"
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Project Overview & Technical Details
                </h4>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
                  {activeProject.description}
                </p>
              </div>

              {/* Tech Stack Chips */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Technologies, Hardware & Frameworks
                </h4>
                <div className="flex flex-wrap gap-2">
                  {activeProject.techStack.map((tech, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>

              {/* Team Members */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Student Developers / Project Team
                </h4>
                <div className="flex flex-wrap gap-2">
                  {activeProject.teamMembers.map((member, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-800 dark:text-zinc-200"
                    >
                      <User className="h-3.5 w-3.5 text-zinc-500" />
                      <span>{member}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Links & Stats */}
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  {activeProject.githubUrl && (
                    <a
                      href={activeProject.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs transition"
                    >
                      <Github className="h-4 w-4" />
                      <span>Source Code / Schematics</span>
                    </a>
                  )}

                  {activeProject.liveDemoUrl && (
                    <a
                      href={activeProject.liveDemoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-800 dark:text-zinc-200 transition"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>Live Deployment / Demo</span>
                    </a>
                  )}

                  {activeProject.documentationUrl && (
                    <a
                      href={activeProject.documentationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-800 dark:text-zinc-200 transition"
                    >
                      <BookOpen className="h-4 w-4" />
                      <span>Project Report / Docs</span>
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                  <button
                    onClick={() => handleLike(activeProject.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                  >
                    <ThumbsUp className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
                    <span>{activeProject.likes || 0} Likes</span>
                  </button>
                  <span className="flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    <span>{activeProject.views || 0} Views</span>
                  </span>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT PROJECT MODAL WITH DEMO IMAGE UPLOAD */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs overflow-y-auto" id="project-form-modal">
          <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50">
              <h3 className="font-serif text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {editingProject ? "Edit Department Project" : "Add CSE Software / Hardware Project"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleFormSubmit} className="p-6 overflow-y-auto space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Project Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Smart IoT Agriculture System / Exam Hall Automation Portal"
                  required
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-900"
                />
              </div>

              {/* Category & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Project Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ProjectCategory)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  >
                    <option value="Software">💻 Software Project</option>
                    <option value="Hardware">⚡ Hardware Project</option>
                    <option value="Hybrid / IoT">🤖 Hybrid / IoT / Embedded</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Project Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  >
                    <option value="Completed">Completed</option>
                    <option value="Ongoing">Ongoing</option>
                    <option value="Prototype">Prototype</option>
                  </select>
                </div>
              </div>

              {/* Batch & Year */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Student Batch / Session
                  </label>
                  <input
                    type="text"
                    value={batch}
                    onChange={(e) => setBatch(e.target.value)}
                    placeholder="e.g. Batch 20 (Session 2020-21)"
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Academic Year
                  </label>
                  <input
                    type="number"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(Number(e.target.value))}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  />
                </div>
              </div>

              {/* Team Members & Supervisor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Team Members (Names & Rolls, comma separated) *
                  </label>
                  <input
                    type="text"
                    value={teamMembersInput}
                    onChange={(e) => setTeamMembersInput(e.target.value)}
                    placeholder="e.g. Sakib (1904018), Mehedi (1904022)"
                    required
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Faculty Supervisor / Advisor
                  </label>
                  <input
                    type="text"
                    value={supervisor}
                    onChange={(e) => setSupervisor(e.target.value)}
                    placeholder="e.g. Prof. Dr. Mohammad Tariqul Islam"
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  />
                </div>
              </div>

              {/* Tech Stack */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Technologies / Hardware Components (comma-separated)
                </label>
                <input
                  type="text"
                  value={techStackInput}
                  onChange={(e) => setTechStackInput(e.target.value)}
                  placeholder="e.g. ESP32, Arduino C++, LoRa, React 19, PyTorch, STM32"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Project Description & Overview *
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explain the problem solved, architectural design, circuit components, software features, and experimental results..."
                  required
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none leading-relaxed"
                />
              </div>

              {/* DEMO IMAGES UPLOAD SECTION */}
              <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Demo Images / Hardware Photos & Schematics
                  </label>
                  <span className="text-[11px] text-zinc-500">PNG, JPG, WEBP, GIF</span>
                </div>

                {/* File Upload Dropzone / Button */}
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    accept="image/*"
                    onChange={handleImageFilesSelected}
                    className="hidden"
                    id="project-demo-image-upload"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="flex items-center gap-2 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-900 dark:hover:border-zinc-300 bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 px-4 py-3 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition cursor-pointer w-full justify-center"
                  >
                    {uploadingImage ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-transparent"></div>
                    ) : (
                      <Upload className="h-4 w-4 text-zinc-500" />
                    )}
                    <span>{uploadingImage ? "Uploading demo image..." : "Upload Demo Screenshots / Hardware Photos"}</span>
                  </button>
                </div>

                {/* Uploaded Images List with Set Cover and Delete */}
                {demoImages.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 pt-2">
                    {demoImages.map((imgUrl, idx) => {
                      const isCover = coverImage === imgUrl;
                      return (
                        <div
                          key={idx}
                          className={`relative group rounded-lg overflow-hidden border-2 bg-zinc-100 dark:bg-zinc-800 h-24 ${
                            isCover ? "border-emerald-600 dark:border-emerald-400 ring-2 ring-emerald-500/20" : "border-zinc-200 dark:border-zinc-700"
                          }`}
                        >
                          <img
                            src={imgUrl}
                            alt="demo item"
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                          
                          {/* Overlay buttons */}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-1.5">
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(idx)}
                              className="self-end p-1 rounded bg-red-600 text-white hover:bg-red-700 transition"
                              title="Delete photo"
                            >
                              <X className="h-3 w-3" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setCoverImage(imgUrl)}
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded text-center ${
                                isCover ? "bg-emerald-600 text-white" : "bg-white/90 text-zinc-900 hover:bg-white"
                              }`}
                            >
                              {isCover ? "Cover Photo" : "Set as Cover"}
                            </button>
                          </div>

                          {isCover && (
                            <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-bold">
                              Cover
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* External Links */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    GitHub / Schematics URL
                  </label>
                  <input
                    type="url"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder="https://github.com/..."
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Live Demo / Video URL
                  </label>
                  <input
                    type="url"
                    value={liveDemoUrl}
                    onChange={(e) => setLiveDemoUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Report / Documentation URL
                  </label>
                  <input
                    type="url"
                    value={documentationUrl}
                    onChange={(e) => setDocumentationUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  />
                </div>
              </div>

              {/* Form Action Footer */}
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex items-center gap-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 px-5 py-2 text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  {formSubmitting ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white dark:border-zinc-900 border-t-transparent"></div>
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  <span>{editingProject ? "Update Project" : "Publish Project"}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Project Deletion */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-start gap-3 text-red-600 dark:text-red-400">
              <div className="p-2.5 bg-red-100 dark:bg-red-950/50 rounded-xl shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-base text-zinc-900 dark:text-zinc-100">
                  Confirm Project Deletion
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Are you sure you want to permanently delete this project? This will remove it from the showcase archive.
                </p>
              </div>
            </div>

            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                PROJECT TITLE
              </span>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-2">
                {projectToDelete.title}
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
                  setProjectToDelete(null);
                  setDeleteError("");
                }}
                className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={confirmDeleteProject}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer shadow-xs transition flex items-center gap-1.5"
              >
                {deleteLoading ? (
                  <span>Deleting...</span>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Project</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Notification Toast */}
      {deleteSuccess && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-3 shadow-lg flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2">
          <Check className="h-4 w-4 text-emerald-400 dark:text-emerald-600" />
          <span>{deleteSuccess}</span>
        </div>
      )}
    </div>
  );
}
