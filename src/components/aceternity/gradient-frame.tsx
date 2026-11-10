import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Aceternity-style animated gradient border: a slowly rotating conic
 * gradient peeks through a 1px frame around the content card.
 */
export function GradientFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-3xl p-px", className)}>
      <div aria-hidden className="frame-glow" />
      <div className="relative rounded-[calc(1.5rem-1px)] bg-card">{children}</div>
    </div>
  );
}
