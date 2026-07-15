import Link from "next/link";
import { BUNDLED_FIXTURE_ID } from "@/lib/replay/server";

/** No replay exists for this fixture id (mirrors the API's 404). */
export default function MatchNotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <svg width="56" height="56" viewBox="0 0 32 32" aria-hidden className="opacity-60">
        <circle cx="16" cy="16" r="12" fill="none" stroke="#78A188" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M16 10l4.5 3.2-1.7 5.3h-5.6L11.5 13.2z" fill="none" stroke="#78A188" strokeWidth="1.5" />
      </svg>
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-chalk">
        No replay for this fixture
      </h1>
      <p className="text-sm leading-relaxed text-mist">
        TxLINE has no stored replay for this fixture id on devnet. The demo fixture{" "}
        <Link href={`/match/${BUNDLED_FIXTURE_ID}`} className="led text-flood underline-offset-2 hover:underline">
          #{BUNDLED_FIXTURE_ID}
        </Link>{" "}
        (Brazil vs Norway) ships with the app and always works.
      </p>
      <Link
        href="/matches"
        className="kit-label rounded-xl bg-flood px-5 py-3 text-sm text-pitch-900 transition hover:shadow-[0_10px_26px_-10px_rgba(203,255,62,0.6)]"
      >
        Back to matches
      </Link>
    </main>
  );
}
