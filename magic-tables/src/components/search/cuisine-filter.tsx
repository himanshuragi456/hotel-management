"use client";

import { cn } from "@/lib/utils";
import type { CuisineFilter } from "@/types";

const FILTERS: { label: CuisineFilter; icon: string }[] = [
  { label: "All", icon: "✦" },
  { label: "Restaurant", icon: "🍽" },
  { label: "Cafe", icon: "☕" },
  { label: "Bakery", icon: "🥐" },
  { label: "Fast Food", icon: "🍔" },
  { label: "Desserts", icon: "🍰" },
  { label: "Bar & Grill", icon: "🥩" },
];

interface CuisineFilterProps {
  selected: CuisineFilter;
  onChange: (filter: CuisineFilter) => void;
}

export function CuisineFilterBar({ selected, onChange }: CuisineFilterProps) {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
      role="tablist"
      aria-label="Filter by cuisine type"
    >
      {FILTERS.map(({ label, icon }) => (
        <button
          key={label}
          role="tab"
          aria-selected={selected === label}
          onClick={() => onChange(label)}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-150 cursor-pointer flex-shrink-0",
            selected === label
              ? "bg-rose-600 text-white shadow-sm shadow-rose-200"
              : "bg-white border border-stone-200 text-stone-600 hover:border-rose-300 hover:text-rose-600"
          )}
        >
          <span aria-hidden="true">{icon}</span>
          {label}
        </button>
      ))}
    </div>
  );
}
