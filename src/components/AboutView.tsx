import React from "react";
import { Terminal, Settings, Database, Key, HelpCircle, Code, ShieldCheck, Server, Play, Heart, GraduationCap } from "lucide-react";

export default function AboutView() {
  return (
    <div className="mx-auto max-w-4xl space-y-10 pb-16 font-sans">
      
      {/* Page Title */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
          System Overview & Technical Documentation
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Institutional research repository architecture for Dept of CSE, PUST.
        </p>
      </div>

      {/* Grid of system info */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-3 shadow-xs">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200">
            <Server className="h-6 w-6" />
          </div>
          <h3 className="font-serif text-base font-bold text-zinc-900 dark:text-white">
            Full-Stack Node.js & React Architecture
          </h3>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed font-sans">
            Client application rendered via React 19 and Tailwind CSS, backed by an Express REST API with durable disk persistence and MongoDB compatibility.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-3 shadow-xs">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h3 className="font-serif text-base font-bold text-zinc-900 dark:text-white">
            Role-Based Academic Security
          </h3>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed font-sans">
            Secure PBKDF2 cryptographic password hashing with JWT Bearer authentication, providing fine-grained access control for faculty supervisors, researchers, and administrators.
          </p>
        </div>
      </div>

      {/* Configuration environmental parameters */}
      <section className="space-y-4" id="env-documentation">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-zinc-900 dark:text-zinc-100" />
          <h2 className="font-serif text-lg font-bold text-zinc-900 dark:text-white">
            Environment & Server Configuration
          </h2>
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/60 font-sans font-semibold text-zinc-700 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-800 select-none">
                <th className="px-5 py-3.5">Environment Key</th>
                <th className="px-5 py-3.5">Default Fallback</th>
                <th className="px-5 py-3.5">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-600 dark:text-zinc-400 font-sans">
              <tr>
                <td className="px-5 py-3.5 font-mono font-semibold text-zinc-900 dark:text-zinc-100">JWT_SECRET</td>
                <td className="px-5 py-3.5 font-mono text-zinc-400">pust_cse_research_archive_secret</td>
                <td className="px-5 py-3.5">
                  High-entropy cryptographic token signing key for user authentication sessions.
                </td>
              </tr>
              <tr>
                <td className="px-5 py-3.5 font-mono font-semibold text-zinc-900 dark:text-zinc-100">MONGODB_URI</td>
                <td className="px-5 py-3.5 font-mono text-zinc-400">Local JSON Persistence</td>
                <td className="px-5 py-3.5">
                  Production MongoDB connection URI. Falls back safely to disk storage during standalone development.
                </td>
              </tr>
              <tr>
                <td className="px-5 py-3.5 font-mono font-semibold text-amber-600">PORT</td>
                <td className="px-5 py-3.5 font-mono text-zinc-400">3000</td>
                <td className="px-5 py-3.5">
                  Required server ingress port (hardcoded to port 3000 for container hosting).
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Development Terminal instructions */}
      <section className="space-y-4 font-sans text-xs">
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-zinc-900 dark:text-zinc-100" />
          <h2 className="font-serif text-lg font-bold text-zinc-900 dark:text-white">
            Build & Deployment Commands
          </h2>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-300 font-mono space-y-5 shadow-sm">
          <div className="space-y-2">
            <span className="block text-zinc-500 text-xs font-semibold uppercase tracking-wider select-none border-b border-zinc-800/80 pb-1">
              # Step 1: Install workspace packages
            </span>
            <span className="block text-zinc-300 font-medium">npm install</span>
          </div>

          <div className="space-y-2">
            <span className="block text-zinc-500 text-xs font-semibold uppercase tracking-wider select-none border-b border-zinc-800/80 pb-1">
              # Step 2: Set up environment parameters
            </span>
            <span className="block text-zinc-300 font-medium">cp .env.example .env</span>
          </div>

          <div className="space-y-2">
            <span className="block text-zinc-500 text-xs font-semibold uppercase tracking-wider select-none border-b border-zinc-800/80 pb-1">
              # Step 3: Run full-stack dev server (Express + Vite on port 3000)
            </span>
            <span className="block text-emerald-400 font-medium">npm run dev</span>
          </div>

          <div className="space-y-2">
            <span className="block text-zinc-500 text-xs font-semibold uppercase tracking-wider select-none border-b border-zinc-800/80 pb-1">
              # Step 4: Bundle for production
            </span>
            <span className="block text-zinc-300 font-medium">npm run build</span>
            <span className="block text-zinc-500 text-[11px] pl-3">
              - Vite builds static web bundle to /dist
            </span>
            <span className="block text-zinc-500 text-[11px] pl-3">
              - esbuild bundles Express server into dist/server.cjs
            </span>
          </div>
        </div>
      </section>

      {/* Core technologies section */}
      <section className="space-y-3 rounded-2xl bg-zinc-100/70 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 font-sans">
        <h4 className="font-serif text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-zinc-900 dark:text-zinc-100" />
          Dept of CSE, PUST
        </h4>
        <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans">
          Developed for the Department of Computer Science & Engineering (CSE) at PUST to provide a centralized digital library for undergraduate theses, graduate dissertations, faculty research papers, and citation metrics.
        </p>
      </section>
      
    </div>
  );
}
