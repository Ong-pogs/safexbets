/**
 * Normalizer sanity check (design spec §8): compiles the pure replay normalizer with the
 * project's own TypeScript, runs it over the bundled Brazil–Norway replay, and asserts the
 * decided facts — final score 1–2, goal steps with correct sides, silent corrections.
 *
 *   npm run check:replay
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const appDir = dirname(dirname(fileURLToPath(import.meta.url)));
const tscBin = join(appDir, "node_modules", "typescript", "bin", "tsc");
const outDir = mkdtempSync(join(tmpdir(), "safexbets-normalizer-"));

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

try {
  // The normalizer is pure and only type-imports its sibling, so it compiles standalone.
  execFileSync(process.execPath, [
    tscBin,
    join(appDir, "src", "lib", "replay", "normalize.ts"),
    join(appDir, "src", "lib", "replay", "types.ts"),
    "--outDir", outDir,
    "--module", "esnext",
    "--target", "es2020",
    "--moduleResolution", "bundler",
    "--skipLibCheck",
  ]);

  const { normalizeReplay } = await import(pathToFileURL(join(outDir, "normalize.js")).href);
  const replay = JSON.parse(
    readFileSync(join(appDir, "src", "fixtures", "replay-18187298.json"), "utf8"),
  );
  const timeline = normalizeReplay(replay);
  const { steps, goalIndices, finalScore } = timeline;

  console.log(`replay: ${replay.meta.home} vs ${replay.meta.away} (fixture ${replay.meta.fixtureId})`);
  console.log(`events: ${replay.events.length} -> steps: ${steps.length}, goal banners: ${goalIndices.length}`);

  check(
    "finalScore is home 1 – away 2",
    finalScore.home === 1 && finalScore.away === 2,
    JSON.stringify(finalScore),
  );

  const banners = goalIndices.map((i) => steps[i]);
  check(">= 2 goal-banner steps", banners.length >= 2, `${banners.length} banners`);
  banners.forEach((s, n) =>
    console.log(`  banner ${n + 1}: [${s.minuteLabel}] ${s.kind} -> ${s.goalSide} · "${s.label}"`),
  );

  // The decided story: an overturned VAR goal (away, later silently corrected away), Norway's
  // two real goals on `goal` events, Brazil's penalty on `penalty_outcome`.
  const goalKindBanners = banners.filter((s) => s.kind === "goal");
  check(
    "both confirmed Norway goals are `goal` steps sided away",
    goalKindBanners.length === 2 && goalKindBanners.every((s) => s.goalSide === "away"),
  );
  check(
    "Brazil's penalty banner is sided home",
    banners.some((s) => s.kind === "penalty_outcome" && s.goalSide === "home"),
  );
  check(
    "overturned VAR goal fires an away banner (increment), then folds out silently",
    banners[0]?.kind === "var_end" && banners[0]?.goalSide === "away",
  );

  // Correction check: after the overturned goal's banner, a later snapshot decrements the score
  // back to 0–0 — folded silently (no banner fires on a decrement).
  const corrected = steps.find(
    (s) => s.ts > banners[0].ts && s.stats.score.home === 0 && s.stats.score.away === 0,
  );
  check(
    "score corrected back to 0–0 without a banner",
    !!corrected && !corrected.isGoal,
    corrected ? `[${corrected.minuteLabel}] ${corrected.label}` : "no corrected step found",
  );

  const last = steps[steps.length - 1];
  check("timeline ends at full-time", last.kind === "game_finalised" && last.minuteLabel === "FT");
  check(
    "folded totals: corners 5–5, yellows 1–0 to Brazil",
    last.stats.corners.home === 5 &&
      last.stats.corners.away === 5 &&
      last.stats.yellows.home === 1 &&
      last.stats.yellows.away === 0,
    JSON.stringify({ corners: last.stats.corners, yellows: last.stats.yellows }),
  );
  check(
    "synthetic minutes are monotonic within the in-play span",
    steps
      .filter((s) => /^\d+'$/.test(s.minuteLabel))
      .every((s, i, arr) => i === 0 || parseInt(s.minuteLabel) >= parseInt(arr[i - 1].minuteLabel)),
  );
  check(
    "every step carries folded stats + intensity in [0,1]",
    steps.every((s) => s.stats && s.intensity >= 0 && s.intensity <= 1),
  );
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nnormalizer sanity: all checks passed");
