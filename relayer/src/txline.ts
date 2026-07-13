import fs from "fs";
import path from "path";

export type Outcome = "yes" | "no" | "void";

/**
 * Resolve a match to our binary "Home to win?" proposition:
 *   home win  -> "yes"
 *   draw/away -> "no"
 *   not finished / unknown -> "void"
 *
 * Uses the live TxLINE API when TXLINE_BASE_URL + TXLINE_API_KEY are configured,
 * otherwise falls back to fixtures/txline.sample.json so the demo works offline.
 *
 * NOTE: adjust the request path + response shape to the real TxLINE schema once you
 * have the sponsor's API docs (ask in Telegram). This is the single place to change.
 */
export async function resolveOutcome(
  matchId: number,
  opts?: { fixture?: boolean }
): Promise<Outcome> {
  const base = process.env.TXLINE_BASE_URL;
  const key = process.env.TXLINE_API_KEY;

  if (!opts?.fixture && base && key && key !== "replace_me") {
    const res = await fetch(`${base}/matches/${matchId}/result`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`TxLINE request failed: ${res.status}`);
    const data: any = await res.json();
    if (data.status !== "finished") return "void";
    return data.homeScore > data.awayScore ? "yes" : "no";
  }

  const fxPath = path.resolve(__dirname, "../fixtures/txline.sample.json");
  const fx: any[] = JSON.parse(fs.readFileSync(fxPath, "utf-8"));
  const m = fx.find((x) => x.matchId === matchId);
  if (!m || m.status !== "finished") return "void";
  return m.homeScore > m.awayScore ? "yes" : "no";
}
