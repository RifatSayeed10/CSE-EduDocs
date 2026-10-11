import React from "react";

// Render text with <mark> around the given [start, end) ranges (no innerHTML)
export function Highlighted({ text, ranges }: { text: string; ranges: [number, number][] }) {
  const parts: React.ReactNode[] = [];
  let pos = 0;
  [...ranges].sort((a, b) => a[0] - b[0]).forEach(([s, e], i) => {
    if (s < pos) return;
    if (s > pos) parts.push(text.slice(pos, s));
    parts.push(
      <mark key={i} className="bg-amber-200/70 dark:bg-amber-500/30 text-inherit rounded-sm px-0.5">
        {text.slice(s, e)}
      </mark>
    );
    pos = e;
  });
  if (pos < text.length) parts.push(text.slice(pos));
  return <>{parts}</>;
}
