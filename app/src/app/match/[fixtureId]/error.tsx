"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";

/** Route-level error boundary for /match/* — recoverable, with a retry. */
export default function MatchError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="led text-4xl text-alert" aria-hidden>
        ⚠
      </span>
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-chalk">
        Match Center stumbled
      </h1>
      <p className="text-sm leading-relaxed text-mist">
        Something went wrong loading this fixture&apos;s replay.
        {error.digest && (
          <>
            {" "}
            <span className="led text-[11px] text-chalk-dim">ref {error.digest}</span>
          </>
        )}
      </p>
      <div className="flex items-center gap-3">
        <Button variant="flood" onClick={() => reset()}>
          Try again
        </Button>
        <Link
          href="/matches"
          className="kit-label rounded-xl border border-white/15 px-4 py-2.5 text-sm text-chalk transition hover:border-flood/60 hover:text-flood"
        >
          Back to matches
        </Link>
      </div>
    </main>
  );
}
