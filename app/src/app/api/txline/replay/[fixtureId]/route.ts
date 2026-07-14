import { NextResponse } from "next/server";
import { loadReplay } from "@/lib/replay/server";

/**
 * GET /api/txline/replay/[fixtureId] — server-only TxLINE replay proxy.
 *
 * With TXLINE_API_TOKEN set (server env, never exposed to the browser) this pulls the live devnet
 * replay and trims it; otherwise it serves the bundled Brazil–Norway fixture (18187298). Unknown
 * fixtures get a clean 404 JSON body. Responses are cached in-process (module Map in the loader).
 */

export const dynamic = "force-dynamic"; // resolves per-request (env token, in-process cache)

export async function GET(
  _req: Request,
  { params }: { params: { fixtureId: string } },
): Promise<NextResponse> {
  const fixtureId = Number(params.fixtureId);
  if (!Number.isInteger(fixtureId) || fixtureId <= 0) {
    return NextResponse.json({ error: "fixtureId must be a positive integer" }, { status: 400 });
  }

  const replay = await loadReplay(fixtureId);
  if (!replay) {
    return NextResponse.json({ error: `No replay available for fixture ${fixtureId}` }, { status: 404 });
  }
  return NextResponse.json(replay);
}
