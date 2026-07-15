import type { Metadata } from "next";
import { MyBets } from "@/components/bets/MyBets";

export const metadata: Metadata = {
  title: "My Bets — SafeXBets",
  description:
    "Track your no-loss positions: open calls, claimable winnings, and locked principal with its recovery countdown. Principal always comes back — only yield is at play.",
};

/** /my-bets — the wallet's betslips: Open / Settled tabs, claims, withdrawals, lock countdowns. */
export default function MyBetsPage() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-8 sm:px-6 sm:py-10">
      <header>
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-chalk sm:text-4xl">
          My Bets
        </h1>
        <p className="mt-1 max-w-xl text-sm leading-relaxed text-mist">
          Every position, betslip-style. Losing only locks your principal for the lock window — it
          always comes back in full.
        </p>
      </header>
      <MyBets />
    </main>
  );
}
