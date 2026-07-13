"use client";

import { useNow } from "@/hooks/useNow";
import { formatCountdown } from "@/lib/format";

/** Live match-clock countdown to a unix target. Renders `doneLabel` once passed. */
export function Countdown({
  targetUnix,
  doneLabel = "00:00",
  className,
}: {
  targetUnix: number;
  doneLabel?: string;
  className?: string;
}) {
  const now = useNow();
  const delta = targetUnix - now;
  return <span className={className}>{delta <= 0 ? doneLabel : formatCountdown(delta)}</span>;
}
