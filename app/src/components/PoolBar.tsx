"use client";

/** Possession-bar style split of the Yes / No pools (Yes mint, No amber). */
export function PoolBar({ yesShare }: { yesShare: number }) {
  const yesPct = Math.max(0, Math.min(100, Math.round(yesShare * 100)));
  return (
    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/5 ring-1 ring-inset ring-white/5">
      <div
        className="absolute inset-y-0 left-0 bg-yes/90 transition-[width] duration-700 ease-out"
        style={{ width: `${yesPct}%` }}
      />
      <div
        className="absolute inset-y-0 right-0 bg-no/90 transition-[width] duration-700 ease-out"
        style={{ width: `${100 - yesPct}%` }}
      />
      {/* center chalk mark */}
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-pitch-900/50" />
    </div>
  );
}
