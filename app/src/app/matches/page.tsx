import type { Metadata } from "next";
import { MatchesLobby } from "@/components/lobby/MatchesLobby";

export const metadata: Metadata = {
  title: "Matches — SafeXBets",
  description:
    "The World Cup slate on SafeXBets: TxLINE fixtures with kickoff countdowns and their no-loss on-chain markets. Markets open automatically before kickoff and settle from TxLINE results.",
};

/** /matches — the lobby: every fixture on the slate, grouped by day, linked to its Match Center. */
export default function MatchesPage() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <MatchesLobby />
    </main>
  );
}
