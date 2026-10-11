import React from "react";
import { 
  GraduationCap, LogOut, ShieldAlert, User, PlusCircle,
  FileText, BookOpen, Laptop, Sparkles
} from "lucide-react";
import { User as UserType, SiteBranding } from "../types";

interface NavbarProps {
  currentTab: string;
  onChangeTab: (tab: string) => void;
  currentUser: UserType | null;
  onLogout: () => void;
  branding: SiteBranding | null;
  theme?: "light" | "dark";
  onToggleTheme?: () => void;
  onOpenUpload?: () => void;
  aiEnabled?: boolean;
}

export default function Navbar({
  currentTab,
  onChangeTab,
  currentUser,
  onLogout,
  branding,
  theme = "light",
  onToggleTheme,
  onOpenUpload,
  aiEnabled = false
}: NavbarProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const menuItems = [
    { id: "home", label: "Home", icon: BookOpen },
    { id: "papers", label: "Papers Library", icon: FileText },
    { id: "projects", label: "Projects Showcase", icon: Laptop },
    ...(aiEnabled ? [{ id: "ask", label: "Ask AI", icon: Sparkles }] : []),
  ];

  const adminMenuVisible = currentUser && (currentUser.role === "admin" || currentUser.role === "editor");

  const siteTitle = branding?.siteName || "CSE EduDocs";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200/80 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md transition-colors" id="archive-navbar">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          
          {/* Academic Logo & Institution Heading */}
          <div className="flex items-center gap-8">
            <button
              onClick={() => {
                onChangeTab("home");
                setMobileOpen(false);
              }}
              className="flex items-center gap-3 text-left transition-opacity hover:opacity-90 cursor-pointer group"
              id="navbar-logo"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs">
                <GraduationCap className="h-5 w-5" />
              </div>
              
              <div>
                <span className="block font-serif text-lg font-bold text-zinc-900 dark:text-white tracking-tight leading-tight">
                  {siteTitle}
                </span>
                <span className="block font-sans text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                  Pabna University of Science & Technology
                </span>
              </div>
            </button>

            {/* Desktop Navigation */}
            <div className="hidden md:flex md:items-center md:gap-1">
              {menuItems.map((item) => {
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    id={`nav-tab-${item.id}`}
                    onClick={() => {
                      onChangeTab(item.id);
                      setMobileOpen(false);
                    }}
                    className={`flex items-center gap-2 rounded-lg px-3.5 py-2 font-sans text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-200"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}

              {adminMenuVisible && (
                <button
                  id="nav-tab-admin"
                  onClick={() => {
                    onChangeTab("admin");
                    setMobileOpen(false);
                  }}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 font-sans text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition`}
                >
                  <ShieldAlert className="h-4 w-4 text-amber-600" />
                  <span>Admin</span>
                </button>
              )}
            </div>
          </div>

          {/* User Section, Quick Upload Action & Theme */}
          <div className="flex items-center gap-3">
            
            {/* Quick Upload CTA */}
            <button
              onClick={() => {
                if (onOpenUpload) {
                  onOpenUpload();
                } else {
                  onChangeTab("papers");
                }
              }}
              className="hidden sm:flex items-center gap-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 px-4 py-2 text-xs font-semibold shadow-xs transition-all cursor-pointer select-none"
              title="Upload Scanned Thesis or Paper"
              id="navbar-upload-btn"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Upload Paper</span>
            </button>

            {currentUser ? (
              <div className="hidden items-center gap-2 md:flex">
                <button
                  id="nav-profile-btn"
                  onClick={() => onChangeTab("profile")}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 border text-xs font-medium transition-all cursor-pointer ${
                    currentTab === "profile" 
                      ? "bg-zinc-100 text-zinc-900 border-zinc-300 dark:bg-zinc-800 dark:text-white" 
                      : "border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                  title="My Bookmarks & Uploads"
                >
                  <User className="h-3.5 w-3.5 text-zinc-500" />
                  <span>{currentUser.name.split(" ")[0]}</span>
                  <span className="text-[10px] font-sans font-semibold uppercase text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                    {currentUser.role}
                  </span>
                </button>

                <button
                  id="btn-signout"
                  onClick={onLogout}
                  className="rounded-lg p-2 text-zinc-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 transition-all border border-transparent cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="hidden items-center gap-2 md:flex">
                <button
                  id="nav-btn-signin"
                  onClick={() => onChangeTab("signin")}
                  className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  id="nav-btn-register"
                  onClick={() => onChangeTab("register")}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-3.5 py-2 font-sans text-xs font-semibold text-zinc-900 dark:text-zinc-100 transition-all cursor-pointer"
                >
                  Register
                </button>
              </div>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="rounded-lg p-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 md:hidden transition-all cursor-pointer"
              id="mobile-menu-toggle"
            >
              {mobileOpen ? <span className="font-sans text-base font-bold">✕</span> : <span className="font-sans text-base font-bold">☰</span>}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 md:hidden space-y-2 shadow-lg" id="mobile-menu-drawer">
          {menuItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onChangeTab(item.id);
                  setMobileOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold"
                    : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          })}

          <button
            onClick={() => {
              if (onOpenUpload) onOpenUpload();
              else onChangeTab("papers");
              setMobileOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 px-3.5 py-2.5 text-xs font-semibold shadow-xs cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Upload Paper / Thesis</span>
          </button>

          {adminMenuVisible && (
            <button
              onClick={() => {
                onChangeTab("admin");
                setMobileOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 px-3.5 py-2 text-xs font-semibold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 cursor-pointer"
            >
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              <span>Admin Management</span>
            </button>
          )}

          <hr className="my-2 border-zinc-100 dark:border-zinc-800" />

          {currentUser ? (
            <div className="space-y-2">
              <button
                onClick={() => {
                  onChangeTab("profile");
                  setMobileOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-lg bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2 text-xs text-zinc-800 dark:text-zinc-200 cursor-pointer"
              >
                <span className="font-semibold">{currentUser.name}</span>
                <span className="text-[10px] font-mono uppercase bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 px-1.5 py-0.5 rounded">{currentUser.role}</span>
              </button>

              <button
                onClick={() => {
                  onLogout();
                  setMobileOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => {
                  onChangeTab("signin");
                  setMobileOpen(false);
                }}
                className="rounded-lg border border-zinc-200 dark:border-zinc-700 py-2 text-center text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 cursor-pointer"
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  onChangeTab("register");
                  setMobileOpen(false);
                }}
                className="rounded-lg bg-zinc-900 dark:bg-zinc-100 py-2 text-center text-xs font-semibold text-white dark:text-zinc-900 cursor-pointer shadow-xs"
              >
                Register
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
