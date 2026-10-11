import React, { useState, useEffect } from "react";
import { HelpCircle } from "lucide-react";
import Navbar from "./components/Navbar";
import HomeView from "./components/HomeView";
import PapersView from "./components/PapersView";
import ProjectsView from "./components/ProjectsView";
import ProfileView from "./components/ProfileView";
import AuthView from "./components/AuthView";
import AdminView from "./components/AdminView";
import AboutView from "./components/AboutView";
import ChatView from "./components/ChatView";
import AskAIView from "./components/AskAIView";
import { Paper, Topic, Researcher, User, SiteBranding, AiStatus } from "./types";
import { api } from "./lib/api";

export default function App() {
  // Navigation & View state
  const [currentTab, setCurrentTab] = useState<string>("home");
  const [papersQuery, setPapersQuery] = useState<string>("");
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Core Data models
  const [papers, setPapers] = useState<Paper[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [researchers, setResearchers] = useState<Researcher[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [siteBranding, setSiteBranding] = useState<SiteBranding | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  // Request for the Papers page to open a PDF at a page (from AI citations)
  const [openRequest, setOpenRequest] = useState<{ paperId: string; page?: number; nonce: number } | null>(null);
  const [uploadRequest, setUploadRequest] = useState(0);

  const refreshAiStatus = () => {
    api.getAiStatus().then(setAiStatus).catch(() => setAiStatus(null));
  };

  const openPaperAt = (paperId: string, page?: number) => {
    setPapersQuery("");
    setOpenRequest({ paperId, page, nonce: Date.now() });
    setCurrentTab("papers");
  };

  // Initial load
  useEffect(() => {
    const initApp = async () => {
      try {
        setLoading(true);

        // Fetch User Session if Token present
        const token = localStorage.getItem("research_archive_token");
        if (token) {
          try {
            const user = await api.getCurrentUser();
            setCurrentUser(user);
          } catch (err) {
            console.warn("Session token expired or invalid", err);
            localStorage.removeItem("research_archive_token");
          }
        }

        // Fetch branding & Data
        const [papersData, topicsData, researchersData, brandingData] = await Promise.all([
          api.getPapers().catch(() => []),
          api.getTopics().catch(() => []),
          api.getResearchers().catch(() => []),
          api.getBranding().catch(() => null)
        ]);

        setPapers(papersData);
        setTopics(topicsData);
        setResearchers(researchersData);
        if (brandingData) {
          setSiteBranding(brandingData);
        }
        refreshAiStatus();

      } catch (err) {
        console.error("Initialization error", err);
      } finally {
        setLoading(false);
      }
    };

    initApp();
  }, []);

  // Sync theme
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  // Refresh helper
  const refreshData = async () => {
    try {
      const [papersData, topicsData, researchersData] = await Promise.all([
        api.getPapers(),
        api.getTopics(),
        api.getResearchers()
      ]);
      setPapers(papersData);
      setTopics(topicsData);
      setResearchers(researchersData);

      if (currentUser) {
        const updatedUser = await api.getCurrentUser();
        setCurrentUser(updatedUser);
      }
    } catch (err) {
      console.error("Could not refresh data:", err);
    }
  };

  const refreshBranding = async () => {
    try {
      const bData = await api.getBranding();
      if (bData) {
        setSiteBranding(bData);
      }
    } catch (err) {
      console.warn("Could not reload active brand settings", err);
    }
  };

  const handleHomeSearch = (query: string) => {
    setPapersQuery(query);
    setCurrentTab("papers");
  };

  const handleSelectPaperFromHome = (paper: Paper) => {
    setPapersQuery(paper.title);
    setCurrentTab("papers");
  };

  const handleAuthSuccess = (user: User, token: string) => {
    setCurrentUser(user);
    // Reload papers with the new token so editors/admins also see hidden papers
    refreshData();
    refreshAiStatus();
    setCurrentTab("profile");
  };

  const handleLogout = () => {
    localStorage.removeItem("research_archive_token");
    setCurrentUser(null);
    setCurrentTab("home");
    refreshAiStatus();
  };

  const handleNavigateToAuth = (tabName: "signin" | "register") => {
    setCurrentTab(tabName);
  };

  // Render view router helper
  const renderViewContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-center select-none" id="loading-spinner">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-800 dark:border-stone-200 border-t-transparent"></div>
          <span className="mt-4 font-mono text-xs text-stone-500 uppercase tracking-widest">
            Loading Academic Archive...
          </span>
        </div>
      );
    }

    switch (currentTab) {
      case "home":
        return (
          <HomeView
            papers={papers}
            topics={topics}
            onSearch={handleHomeSearch}
            onSelectPaper={handleSelectPaperFromHome}
            onNavigateToAuth={handleNavigateToAuth}
            onOpenUpload={() => {
              setPapersQuery("");
              setUploadRequest(Date.now());
              setCurrentTab("papers");
            }}
          />
        );
      case "papers":
        return (
          <PapersView
            papers={papers}
            topics={topics}
            researchers={researchers}
            currentUser={currentUser}
            initialQuery={papersQuery}
            onRefreshData={refreshData}
            onNavigateToAuth={handleNavigateToAuth}
            onUpdateCurrentUser={(usr) => setCurrentUser(usr)}
            aiStatus={aiStatus}
            openRequest={openRequest}
            uploadRequest={uploadRequest}
          />
        );
      case "projects":
        return (
          <ProjectsView
            currentUser={currentUser}
            onNavigateToAuth={handleNavigateToAuth}
          />
        );
      case "profile":
        return (
          <ProfileView
            currentUser={currentUser}
            onRefreshCurrentUser={refreshData}
            papers={papers}
            topics={topics}
            researchers={researchers}
            onSelectPaper={(p) => {
              setPapersQuery(p.title);
              setCurrentTab("papers");
            }}
            onNavigateToAuth={handleNavigateToAuth}
            aiStatus={aiStatus}
          />
        );
      case "ask":
        return (
          <AskAIView
            currentUser={currentUser}
            aiStatus={aiStatus}
            onOpenSource={openPaperAt}
            onNavigateToAuth={handleNavigateToAuth}
          />
        );
      case "chat":
        return <ChatView currentUser={currentUser} />;
      case "about":
        return <AboutView />;
      case "signin":
        return (
          <AuthView
            initialTab="signin"
            onAuthSuccess={handleAuthSuccess}
            onToggleTab={(tab) => setCurrentTab(tab)}
          />
        );
      case "register":
        return (
          <AuthView
            initialTab="register"
            onAuthSuccess={handleAuthSuccess}
            onToggleTab={(tab) => setCurrentTab(tab)}
          />
        );
      case "admin":
        return (
          <AdminView
            currentUser={currentUser}
            papers={papers}
            topics={topics}
            onRefreshData={refreshData}
            branding={siteBranding}
            onRefreshBranding={refreshBranding}
          />
        );
      default:
        return (
          <div className="py-12 text-center">
            <HelpCircle className="mx-auto h-10 w-10 text-zinc-400" />
            <h2 className="font-serif text-base font-semibold text-zinc-800 dark:text-zinc-200 mt-2">Invalid View Selected</h2>
            <button
              onClick={() => setCurrentTab("home")}
              className="mt-3 text-xs font-semibold text-zinc-900 dark:text-zinc-100 underline"
            >
              Return to Home
            </button>
          </div>
        );
    }
  };

  const currentSiteTitle = siteBranding?.siteName || "CSE EduDocs";

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      {/* Dynamic Header Navbar */}
      <Navbar
        currentTab={currentTab}
        onChangeTab={(tabId) => {
          if (tabId !== "papers") setPapersQuery("");
          if (tabId === "ask") refreshAiStatus();
          setCurrentTab(tabId);
        }}
        currentUser={currentUser}
        onLogout={handleLogout}
        branding={siteBranding}
        theme={theme}
        onToggleTheme={toggleTheme}
        aiEnabled={!!aiStatus?.enabled}
        onOpenUpload={() => {
          if (!currentUser) { setCurrentTab("signin"); return; }
          setPapersQuery("");
          setUploadRequest(Date.now());
          setCurrentTab("papers");
        }}
      />

      {/* Main Container */}
      <main className="flex-grow mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-8">
        {renderViewContent()}
      </main>

      {/* Academic Footer */}
      <footer className="bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 py-8 text-xs text-zinc-500 dark:text-zinc-400 font-sans" id="archive-footer">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          
          <div className="flex items-center gap-3 select-none">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-serif font-bold text-xs shadow-xs">
              PUST
            </div>
            <div className="text-left">
              <span className="font-serif font-bold text-zinc-900 dark:text-zinc-100 text-sm">{currentSiteTitle}</span>
              <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                Pabna University of Science and Technology • Pabna-6320, Bangladesh
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6 font-sans text-xs font-medium select-none">
            <button onClick={() => { setPapersQuery(""); setCurrentTab("home"); }} className="hover:text-zinc-900 dark:hover:text-zinc-100 transition cursor-pointer">Home</button>
            <button onClick={() => { setPapersQuery(""); setCurrentTab("papers"); }} className="hover:text-zinc-900 dark:hover:text-zinc-100 transition cursor-pointer">Research Archive</button>
            <button onClick={() => setCurrentTab("projects")} className="hover:text-zinc-900 dark:hover:text-zinc-100 transition cursor-pointer">Projects Showcase</button>
            <button onClick={() => setCurrentTab("about")} className="hover:text-zinc-900 dark:hover:text-zinc-100 transition cursor-pointer">About CSE</button>
            {currentUser && (
              <button onClick={() => setCurrentTab("profile")} className="hover:text-zinc-900 dark:hover:text-zinc-100 transition cursor-pointer">My Saved Theses</button>
            )}
          </div>

          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Open Access Academic Archive • Dept of CSE, PUST
          </div>

        </div>
      </footer>
    </div>
  );
}
