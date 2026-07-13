"use client";

import { CONFIG, IS_PLACEHOLDER_PROGRAM, IS_PRINCIPAL_MINT_MISSING } from "@/lib/config";
import { shortAddr } from "@/lib/format";

/** Non-blocking setup hints when the app isn't fully wired to a deployment yet. */
export function ConfigBanner() {
  const problems: string[] = [];
  if (IS_PLACEHOLDER_PROGRAM)
    problems.push("NEXT_PUBLIC_PROGRAM_ID is still the placeholder — deploy on the Mac and set it.");
  if (IS_PRINCIPAL_MINT_MISSING)
    problems.push("NEXT_PUBLIC_PRINCIPAL_MINT is unset — create the mock-USDC mint and set it.");

  if (problems.length === 0) {
    return (
      <div className="rounded-xl border border-white/8 bg-pitch-800/50 px-4 py-2.5 text-xs text-mist">
        <span className="led text-chalk-dim">Program</span> {shortAddr(CONFIG.programId, 6, 6)} ·{" "}
        <span className="led text-chalk-dim">Mint</span> {shortAddr(CONFIG.principalMint, 6, 6)} ·{" "}
        {CONFIG.network}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-flood/25 bg-flood/[0.06] px-4 py-3 text-xs text-chalk-dim">
      <p className="kit-label mb-1 text-[11px] text-flood">Setup pending</p>
      <ul className="list-inside list-disc space-y-0.5">
        {problems.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <p className="mt-1.5 text-mist">
        The board still loads; markets and betting light up once these point at your devnet deployment.
      </p>
    </div>
  );
}
