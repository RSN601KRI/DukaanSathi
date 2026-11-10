import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Aceternity-style decorative spotlight glow + background grid,
 * plus a mouse-following spotlight card. All CSS-driven, SSR-safe.
 */

export function Spotlight({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute -top-32 left-1/2 -z-10 h-[560px] w-[900px] max-w-[120vw] -translate-x-1/2",
        className,
      )}
      style={{
        background:
          "radial-gradient(ellipse at center, oklch(0.62 0.22 285 / 0.28), oklch(0.56 0.22 330 / 0.12) 45%, transparent 70%)",
        filter: "blur(32px)",
      }}
    />
  );
}

export function BackgroundGrid({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none fixed inset-0 -z-10 opacity-60", className)}
      style={{
        backgroundImage:
          "linear-gradient(to right, oklch(0.98 0 0 / 0.05) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.98 0 0 / 0.05) 1px, transparent 1px)",
        backgroundSize: "64px 64px",
        maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)",
      }}
    />
  );
}

export function SpotlightCard({
  children,
  className,
  glow = "oklch(0.62 0.22 285 / 0.16)",
}: {
  children: ReactNode;
  className?: string;
  glow?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/60 bg-card transition-colors duration-300 hover:border-primary/40",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(320px circle at var(--mx, 50%) var(--my, 50%), ${glow}, transparent 70%)`,
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
