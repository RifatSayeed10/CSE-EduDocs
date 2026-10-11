import { Paper, Project, Topic, Researcher, User, Ticket, ContactMessage, FAQItem, SiteBranding, SearchResult, AiStatus, AiMetadataJob, AiAnswer } from "../types";

async function errorFrom(res: Response, fallback: string): Promise<Error> {
  const body = await res.json().catch(() => null);
  return new Error(body?.error || fallback);
}

const getHeaders = () => {
  const token = localStorage.getItem("research_archive_token");
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
};

export const api = {
  // AUTH
  async login(credentials: any) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Login validation failed");
    }
    return res.json(); // returns { user, token }
  },

  async register(details: any) {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(details),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Registration validation failed");
    }
    return res.json(); // returns { user, token }
  },

  async getMe() {
    const res = await fetch("/api/users/me", {
      headers: getHeaders(),
    });
    if (!res.ok) {
      throw new Error("Session expired or invalid");
    }
    return res.json();
  },

  async getCurrentUser() {
    return this.getMe();
  },

  async updateProfile(profileData: { name?: string; email?: string; currentPassword?: string; newPassword?: string }) {
    const res = await fetch("/api/users/profile", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(profileData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to update profile statistics");
    }
    return res.json();
  },

  async forgotPassword(email: string) {
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to issue reset challenge");
    }
    return res.json();
  },

  async resetPassword(resetData: any) {
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(resetData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to reset security keys");
    }
    return res.json();
  },

  // PAPERS
  async getPapers(searchParams?: { q?: string; topic?: string; researcher?: string; status?: string }) {
    let url = "/api/papers";
    const params = new URLSearchParams();
    if (searchParams) {
      if (searchParams.q) params.append("q", searchParams.q);
      if (searchParams.topic) params.append("topic", searchParams.topic);
      if (searchParams.researcher) params.append("researcher", searchParams.researcher);
      if (searchParams.status) params.append("status", searchParams.status);
    }
    const token = localStorage.getItem("research_archive_token");
    if (token) {
      // Send auth headers even for reading, so admin/editor can read active+inactive status
      const res = await fetch(url + (params.toString() ? `?${params.toString()}` : ""), {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error("Failed to load cataloged publications");
      return res.json() as Promise<Paper[]>;
    } else {
      const res = await fetch(url + (params.toString() ? `?${params.toString()}` : ""));
      if (!res.ok) throw new Error("Failed to load publications");
      return res.json() as Promise<Paper[]>;
    }
  },

  async createPaper(paperData: Partial<Paper>) {
    const res = await fetch("/api/papers", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(paperData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to catalog paper");
    }
    return res.json() as Promise<Paper>;
  },

  async updatePaper(id: string, paperData: Partial<Paper>) {
    const res = await fetch(`/api/papers/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(paperData),
    });
    if (!res.ok) throw new Error("Failed to update paper");
    return res.json() as Promise<Paper>;
  },

  async deletePaper(id: string) {
    const res = await fetch(`/api/papers/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Failed to delete paper" }));
      throw new Error(err.error || "Failed to delete paper");
    }
    return res.json();
  },

  // Inline PDF (for the preview iframe / "open in new tab"), optionally at a page
  fileUrl(paperId: string, page?: number) {
    return `/api/papers/${encodeURIComponent(paperId)}/file` + (page && page > 0 ? `#page=${page}` : "");
  },

  // Forced download (also counts the download)
  downloadUrl(paperId: string) {
    return `/api/papers/${encodeURIComponent(paperId)}/file?download=1`;
  },

  async likePaper(id: string) {
    const res = await fetch(`/api/papers/${id}/like`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Failed to like paper");
    return res.json();
  },

  async viewPaper(id: string) {
    const res = await fetch(`/api/papers/${id}/view`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Failed to view paper");
    return res.json();
  },

  async bookmarkPaper(id: string) {
    const res = await fetch(`/api/papers/${id}/bookmark`, {
      method: "POST",
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to bookmark paper");
    return res.json();
  },

  async unbookmarkPaper(id: string) {
    const res = await fetch(`/api/papers/${id}/unbookmark`, {
      method: "POST",
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to unbookmark paper");
    return res.json();
  },

  // TOPICS
  async getTopics() {
    const res = await fetch("/api/topics");
    if (!res.ok) throw new Error("Failed to fetch topics");
    return res.json() as Promise<Topic[]>;
  },

  async createTopic(topicData: { name: string; description: string }) {
    const res = await fetch("/api/topics", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(topicData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to create topic");
    }
    return res.json() as Promise<Topic>;
  },

  async updateTopic(id: string, topicData: { name: string; description: string }) {
    const res = await fetch(`/api/topics/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(topicData),
    });
    if (!res.ok) throw new Error("Failed to update topic");
    return res.json() as Promise<Topic>;
  },

  async deleteTopic(id: string) {
    const res = await fetch(`/api/topics/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete topic");
    return res.json();
  },

  // RESEARCHERS
  async getResearchers() {
    const res = await fetch("/api/researchers");
    if (!res.ok) throw new Error("Failed to fetch researchers");
    return res.json() as Promise<Researcher[]>;
  },

  async createResearcher(researcherData: Partial<Researcher>) {
    const res = await fetch("/api/researchers", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(researcherData),
    });
    if (!res.ok) {
      let errorMessage = "Failed to create researcher card";
      try {
        const err = await res.json();
        errorMessage = err.error || errorMessage;
      } catch {
        errorMessage = `Server responded with status ${res.status}: ${res.statusText}`;
      }
      throw new Error(errorMessage);
    }
    return res.json() as Promise<Researcher>;
  },

  async updateResearcher(id: string, researcherData: Partial<Researcher>) {
    const res = await fetch(`/api/researchers/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(researcherData),
    });
    if (!res.ok) throw new Error("Failed to update researcher profile");
    return res.json() as Promise<Researcher>;
  },

  async deleteResearcher(id: string) {
    const res = await fetch(`/api/researchers/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete researcher");
    return res.json();
  },

  // BRANDING & SETTINGS
  async getBranding() {
    const res = await fetch("/api/branding");
    if (!res.ok) throw new Error("Failed to fetch branding assets");
    return res.json() as Promise<SiteBranding>;
  },

  async updateBranding(data: Partial<SiteBranding>) {
    const res = await fetch("/api/admin/branding", {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to adjust portal branding layout");
    }
    return res.json() as Promise<SiteBranding>;
  },

  // FAQS
  async getFaqs() {
    const res = await fetch("/api/faqs");
    if (!res.ok) throw new Error("Failed to load official FAQs list");
    return res.json() as Promise<FAQItem[]>;
  },

  async createFaq(data: { question: string; answer: string }) {
    const res = await fetch("/api/admin/faqs", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to generate archive FAQ element");
    return res.json() as Promise<FAQItem>;
  },

  async updateFaq(id: string, data: { question: string; answer: string }) {
    const res = await fetch(`/api/admin/faqs/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to adjust archive FAQ details");
    return res.json() as Promise<FAQItem>;
  },

  async deleteFaq(id: string) {
    const res = await fetch(`/api/admin/faqs/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete archive FAQ element");
    return res.json();
  },

  // CONTACTS
  async sendContactMessage(name: string, email: string, message: string) {
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, message }),
    });
    if (!res.ok) throw new Error("Failed to commit messaging query");
    return res.json() as Promise<{ success: boolean; item: ContactMessage }>;
  },

  async getAdminContactMessages() {
    const res = await fetch("/api/admin/contact", {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch contact requests");
    return res.json() as Promise<ContactMessage[]>;
  },

  async replyContactMessage(id: string, reply: string, status: "open" | "resolved") {
    const res = await fetch(`/api/admin/contact/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify({ reply, status }),
    });
    if (!res.ok) throw new Error("Failed to update message details");
    return res.json() as Promise<ContactMessage>;
  },

  // TICKETS
  async getTickets() {
    const res = await fetch("/api/tickets", {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to sync personal ticket logs");
    return res.json() as Promise<Ticket[]>;
  },

  async createTicket(subject: string, message: string) {
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ subject, message }),
    });
    if (!res.ok) throw new Error("Failed to register ticket");
    return res.json() as Promise<Ticket>;
  },

  async getAdminTickets() {
    const res = await fetch("/api/admin/tickets", {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch administrative ticket systems");
    return res.json() as Promise<Ticket[]>;
  },

  async replyTicket(id: string, reply: string, status: "open" | "resolved") {
    const res = await fetch(`/api/admin/tickets/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify({ reply, status }),
    });
    if (!res.ok) throw new Error("Failed to adjust ticket status");
    return res.json() as Promise<Ticket>;
  },

  // ADMIN USER CONTROLS
  async getAdminUsers() {
    const res = await fetch("/api/admin/users", {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch users");
    return res.json() as Promise<User[]>;
  },

  async deleteAdminUser(id: string) {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete user");
    return res.json();
  },

  async blockUser(id: string) {
    const res = await fetch(`/api/admin/users/${id}/block`, {
      method: "POST",
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to block user profile detail");
    return res.json();
  },

  async unblockUser(id: string) {
    const res = await fetch(`/api/admin/users/${id}/unblock`, {
      method: "POST",
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to unblock user profile detail");
    return res.json();
  },

  async updateUserRole(id: string, role: "student" | "teacher" | "editor" | "admin" | "user") {
    const res = await fetch(`/api/admin/users/${id}/role`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to adjust user coordinate role settings");
    }
    return res.json();
  },

  // UPLOAD (MULTIPART/FORM-DATA)
  async uploadFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const token = localStorage.getItem("research_archive_token");
    const headers: HeadersInit = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch("/api/upload", {
      method: "POST",
      headers,
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "File upload failed" }));
      throw new Error(err.error || "File upload failed");
    }
    return res.json() as Promise<{
      success: boolean;
      fileUrl: string;
      fileName: string;
      originalName: string;
      size: number;
      mimetype: string;
    }>;
  },

  // FULL-TEXT SEARCH (inside PDFs)
  async search(q: string, limit = 50) {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=${limit}`, { headers: getHeaders() });
    if (!res.ok) throw await errorFrom(res, "Search failed");
    return res.json() as Promise<SearchResult[]>;
  },

  // AI
  async getAiStatus() {
    const res = await fetch("/api/ai/status", { headers: getHeaders() });
    if (!res.ok) throw await errorFrom(res, "Could not load AI status");
    return res.json() as Promise<AiStatus>;
  },

  async startMetadataExtraction(fileUrl: string) {
    const res = await fetch("/api/ai/extract-metadata", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ fileUrl }),
    });
    if (!res.ok) throw await errorFrom(res, "Could not start the AI assistant");
    return res.json() as Promise<AiMetadataJob>;
  },

  async getMetadataJob(jobId: string) {
    const res = await fetch(`/api/ai/extract-metadata/${encodeURIComponent(jobId)}`, { headers: getHeaders() });
    if (!res.ok) throw await errorFrom(res, "Could not check the AI assistant");
    return res.json() as Promise<AiMetadataJob>;
  },

  async askAI(question: string, history: { role: "user" | "assistant"; content: string }[]) {
    const res = await fetch("/api/ai/ask", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ question, history }),
    });
    if (!res.ok) throw await errorFrom(res, "The AI could not answer");
    return res.json() as Promise<AiAnswer>;
  },

  async reprocessPaper(id: string, force = false) {
    const res = await fetch(`/api/admin/papers/${encodeURIComponent(id)}/reprocess`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ force }),
    });
    if (!res.ok) throw await errorFrom(res, "Could not restart text extraction");
    return res.json();
  },

  // HEALTH CHECK
  async getHealth() {
    const res = await fetch("/api/health");
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Health check degraded" }));
      return err;
    }
    return res.json();
  },

  // CHATS API Client Methods
  async getChatUsers() {
    const res = await fetch("/api/chats/users", {
      headers: getHeaders(),
    });
    if (!res.ok) {
      throw new Error("Failed to fetch chat user directory");
    }
    return res.json() as Promise<Array<{ id: string; name: string; role: string; email: string }>>;
  },

  async getChats() {
    const res = await fetch("/api/chats", {
      headers: getHeaders(),
    });
    if (!res.ok) {
      throw new Error("Failed to fetch chat history");
    }
    return res.json() as Promise<any[]>;
  },

  async sendChatMessage(receiverId: string, message: string) {
    const res = await fetch("/api/chats", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ receiverId, message }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to deliver chat message");
    }
    return res.json();
  },

  // PROJECTS (SOFTWARE & HARDWARE PROJECTS)
  async getProjects(params?: { q?: string; category?: string; status?: string; batch?: string }) {
    let url = "/api/projects";
    const searchParams = new URLSearchParams();
    if (params) {
      if (params.q) searchParams.append("q", params.q);
      if (params.category) searchParams.append("category", params.category);
      if (params.status) searchParams.append("status", params.status);
      if (params.batch) searchParams.append("batch", params.batch);
    }
    const res = await fetch(url + (searchParams.toString() ? `?${searchParams.toString()}` : ""));
    if (!res.ok) throw new Error("Failed to load department projects");
    return res.json() as Promise<Project[]>;
  },

  async getProjectById(id: string) {
    const res = await fetch(`/api/projects/${id}`);
    if (!res.ok) throw new Error("Failed to load project details");
    return res.json() as Promise<Project>;
  },

  async createProject(projectData: Partial<Project>) {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(projectData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to register project");
    }
    return res.json() as Promise<Project>;
  },

  async updateProject(id: string, projectData: Partial<Project>) {
    const res = await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(projectData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to update project details");
    }
    return res.json() as Promise<Project>;
  },

  async deleteProject(id: string) {
    const res = await fetch(`/api/projects/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Failed to delete project" }));
      throw new Error(err.error || "Failed to delete project");
    }
    return res.json();
  },

  async likeProject(id: string) {
    const res = await fetch(`/api/projects/${id}/like`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Failed to like project");
    return res.json();
  },

  async viewProject(id: string) {
    const res = await fetch(`/api/projects/${id}/view`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Failed to view project");
    return res.json();
  }
};
