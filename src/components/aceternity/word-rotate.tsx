import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Aceternity-style rotating word with a slide-up transition. */
export function WordRotate({
  words,
  interval = 2400,
  className,
}: {
  words: string[];
  interval?: number;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIndex((v) => (v + 1) % words.length), interval);
    return () => clearInterval(id);
  }, [words.length, interval]);
  return (
    <span className={cn("inline-grid overflow-hidden align-bottom", className)}>
      <span key={index} className="animate-word col-start-1 row-start-1">
        {words[index]}
      </span>
    </span>
  );
}
