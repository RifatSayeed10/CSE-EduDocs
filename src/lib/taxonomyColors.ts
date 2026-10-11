export interface ColorStyle {
  bg: string;
  text: string;
  border: string;
  badge: string; // High contrast filled badge background
  rawText: string; // Raw Tailwind text class for normal layout
}

const TAXONOMY_PALETTE: ColorStyle[] = [
  // 1. Red
  {
    bg: "bg-red-50 dark:bg-red-950/30",
    text: "text-red-800 dark:text-red-300",
    border: "border-red-200 dark:border-red-800/60",
    badge: "bg-red-600 text-white",
    rawText: "text-red-600"
  },
  // 2. Sky Blue
  {
    bg: "bg-sky-50 dark:bg-sky-950/30",
    text: "text-sky-800 dark:text-sky-300",
    border: "border-sky-200 dark:border-sky-800/60",
    badge: "bg-sky-600 text-white",
    rawText: "text-sky-600"
  },
  // 3. Purple
  {
    bg: "bg-purple-50 dark:bg-purple-950/30",
    text: "text-purple-800 dark:text-purple-300",
    border: "border-purple-200 dark:border-purple-800/60",
    badge: "bg-purple-600 text-white",
    rawText: "text-purple-600"
  },
  // 4. Emerald Green
  {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-800 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800/60",
    badge: "bg-emerald-600 text-white",
    rawText: "text-emerald-600"
  },
  // 5. Amber Yellow
  {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-800 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800/60",
    badge: "bg-amber-600 text-white",
    rawText: "text-amber-600"
  },
  // 6. Orange
  {
    bg: "bg-orange-50 dark:bg-orange-950/30",
    text: "text-orange-800 dark:text-orange-300",
    border: "border-orange-200 dark:border-orange-800/60",
    badge: "bg-orange-600 text-white",
    rawText: "text-orange-600"
  },
  // 7. Fuchsia Pink
  {
    bg: "bg-fuchsia-50 dark:bg-fuchsia-950/30",
    text: "text-fuchsia-800 dark:text-fuchsia-300",
    border: "border-fuchsia-200 dark:border-fuchsia-800/60",
    badge: "bg-fuchsia-600 text-white",
    rawText: "text-fuchsia-600"
  },
  // 8. Rose
  {
    bg: "bg-rose-50 dark:bg-rose-950/30",
    text: "text-rose-800 dark:text-rose-300",
    border: "border-rose-200 dark:border-rose-800/60",
    badge: "bg-rose-600 text-white",
    rawText: "text-rose-600"
  },
  // 9. Cyan
  {
    bg: "bg-cyan-50 dark:bg-cyan-950/30",
    text: "text-cyan-800 dark:text-cyan-300",
    border: "border-cyan-200 dark:border-cyan-800/60",
    badge: "bg-cyan-600 text-white",
    rawText: "text-cyan-600"
  }
];

const RESEARCHER_PALETTE: ColorStyle[] = [
  // Red theme
  {
    bg: "bg-red-500/10 dark:bg-red-500/20",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-500/30 dark:border-red-500/40",
    badge: "bg-red-500 text-white",
    rawText: "text-red-600"
  },
  // Sky theme
  {
    bg: "bg-sky-500/10 dark:bg-sky-500/20",
    text: "text-sky-700 dark:text-sky-300",
    border: "border-sky-500/30 dark:border-sky-500/40",
    badge: "bg-sky-500 text-white",
    rawText: "text-sky-600"
  },
  // Purple theme
  {
    bg: "bg-purple-500/10 dark:bg-purple-500/20",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-500/30 dark:border-purple-500/40",
    badge: "bg-purple-500 text-white",
    rawText: "text-purple-600"
  },
  // Emerald theme
  {
    bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-500/30 dark:border-emerald-500/40",
    badge: "bg-emerald-500 text-white",
    rawText: "text-emerald-600"
  },
  // Amber theme
  {
    bg: "bg-amber-500/10 dark:bg-amber-500/20",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-500/30 dark:border-amber-500/40",
    badge: "bg-amber-500 text-white",
    rawText: "text-amber-600"
  },
  // Orange theme
  {
    bg: "bg-orange-500/10 dark:bg-orange-500/20",
    text: "text-orange-700 dark:text-orange-300",
    border: "border-orange-500/30 dark:border-orange-500/40",
    badge: "bg-orange-500 text-white",
    rawText: "text-orange-600"
  },
  // Fuchsia theme
  {
    bg: "bg-fuchsia-500/10 dark:bg-fuchsia-500/20",
    text: "text-fuchsia-700 dark:text-fuchsia-300",
    border: "border-fuchsia-500/30 dark:border-fuchsia-500/40",
    badge: "bg-fuchsia-500 text-white",
    rawText: "text-fuchsia-600"
  },
  // Pink/Rose theme
  {
    bg: "bg-rose-500/10 dark:bg-rose-500/20",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-500/30 dark:border-rose-500/40",
    badge: "bg-rose-500 text-white",
    rawText: "text-rose-600"
  }
];

export function getTaxonomyColor(categoryName: string): ColorStyle {
  if (!categoryName) {
    return TAXONOMY_PALETTE[0];
  }
  const clean = categoryName.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % TAXONOMY_PALETTE.length;
  return TAXONOMY_PALETTE[index];
}

export function getResearcherColor(name: string): ColorStyle {
  if (!name) {
    return RESEARCHER_PALETTE[0];
  }
  const clean = name.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % RESEARCHER_PALETTE.length;
  return RESEARCHER_PALETTE[index];
}
