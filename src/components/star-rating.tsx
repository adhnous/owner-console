"use client";

import { Star } from "lucide-react";
import React from "react";

export type StarRatingProps = {
  value: number; // 0..5
  onChange?: (next: number) => void;
  readOnly?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export default function StarRating({ value, onChange, readOnly = false, size = "md", className = "" }: StarRatingProps) {
  const dims = size === "lg" ? "h-6 w-6" : size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const stars = Array.from({ length: 5 }, (_, i) => i + 1);
  const interactive = !readOnly && typeof onChange === "function";

  return (
    <div
      role={interactive ? "radiogroup" : undefined}
      aria-label="rating"
      className={`flex items-center gap-1 ${className}`}
    >
      {stars.map((n) => (
        <button
          key={n}
          type="button"
          role={interactive ? "radio" : undefined}
          aria-checked={interactive ? (value >= n) : undefined}
          disabled={!interactive}
          onClick={() => interactive && onChange?.(n)}
          className={`disabled:cursor-default ${interactive ? "cursor-pointer" : "cursor-default"}`}
        >
          <Star
            className={`${dims} ${value >= n ? "text-yellow-500" : "text-muted-foreground"}`}
            fill={value >= n ? "currentColor" : "none"}
          />
        </button>
      ))}
    </div>
  );
}
