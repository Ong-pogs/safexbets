import fs from "fs";
import path from "path";

export type Outcome = "yes" | "no" | "void";

// Devnet TxLINE endpoints (see docs/TXLINE-API.md). Overridable via env.
const API_BASE_URL = process.env.TXLINE_BASE_URL ?? "https://txline-dev.txodds.com/api";
const JWT_URL =
  process.env.TXLINE_JWT_URL ?? "https://txline-dev.txodds.com/auth/guest/start";

let cachedJwt: string | null = null;

async function guestJwt(): Promise<string> {
  if (cachedJwt) return cachedJwt;
  const res = await fetch(JWT_URL, { method: "POST" });
  if (!res.ok) throw new Error(`TxLINE guest JWT failed: ${res.status}`);
  const data: any = await res.json();
  cachedJwt = data.token;
  return cachedJwt!;
}

/**
 * Fetch a fixture's final score from TxLINE and map it to our "Home to win?" proposition.
 * Endpoint + auth mirror examples/devnet (txodds/tx-on-chain): guest JWT + a long-lived
 * X-Api-Token (activate one via the free-tier flow — see docs/TXLINE-API.md).
 */
async function fetchFinalScoreOutcome(fixtureId: number): Promise<Outcome> {
  const apiToken = process.env.TXLINE_API_TOKEN;
  if (!apiToken) {
    throw new Error(
      "TXLINE_API_TOKEN not set. Activate a free-tier token (docs/TXLINE-API.md), or pass --fixture."
    );
  }
  const jwt = await guestJwt();
  const res = await fetch(`${API_BASE_URL}/scores/historical/${fixtureId}`, {
    headers: { Authorization: `Bearer ${jwt}`, "X-Api-Token": apiToken },
  });
  if (res.status === 401) cachedJwt = null; // JWT expired — next call re-acquires
  if (!res.ok) throw new Error(`TxLINE scores request failed: ${res.status}`);

  const updates: any[] = await res.json();
  if (!Array.isArray(updates) || updates.length === 0) return "void";

  // Final update holds the final score. Field names vary by payload — try the common shapes
  // and fall back to void if we can't read them. Confirm against a live response.
  const last = updates[updates.length - 1];
  const home = last.homeScore ?? last.HomeScore ?? last.home ?? last.h;
  const away = last.awayScore ?? last.AwayScore ?? last.away ?? last.a;
  if (home == null || away == null) return "void";
  return Number(home) > Number(away) ? "yes" : "no";
}

/**
 * Resolve a match to our binary proposition. Uses the live TxLINE feed when TXLINE_API_TOKEN is
 * set (and not forced into fixture mode), else the offline fixture in fixtures/txline.sample.json.
 * `matchId` should equal the TxLINE fixtureId.
 */
export async function resolveOutcome(
  matchId: number,
  opts?: { fixture?: boolean }
): Promise<Outcome> {
  if (!opts?.fixture && process.env.TXLINE_API_TOKEN) {
    return fetchFinalScoreOutcome(matchId);
  }
  const fxPath = path.resolve(__dirname, "../fixtures/txline.sample.json");
  const fx: any[] = JSON.parse(fs.readFileSync(fxPath, "utf-8"));
  const m = fx.find((x) => x.matchId === matchId);
  if (!m || m.status !== "finished") return "void";
  return m.homeScore > m.awayScore ? "yes" : "no";
}
