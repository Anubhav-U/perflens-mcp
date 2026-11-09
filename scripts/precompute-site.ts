// Runs real PerfLens audits on the site's demo pages and writes the results the landing page shows.
// The site must be running first:
//   cd site && npm run build && npx next start -p 3123
// Then, from the repo root:
//   npm run precompute            (or: npx tsx scripts/precompute-site.ts http://localhost:3123)
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { compareSummaries, pickMedianRun } from "../src/core/diff.js";
import { suggestFixes } from "../src/core/fixes.js";
import type { Device } from "../src/core/metrics.js";
import type { AuditSummary } from "../src/core/schema.js";
import { summarizeLhr } from "../src/core/summarize.js";
import { createAuditRunner } from "../src/runner/audit.js";

const BASE = (process.argv[2] ?? "http://localhost:3123").replace(/\/$/, "");
const RUNS = 3;
const OUT = "site/src/data/demo-results.json";
const PAGES = { slow: "/demo/slow.html", fast: "/demo/fast.html" } as const;

/** Show site-relative paths instead of the local origin the audits ran against. */
function relativize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value).split(BASE).join("")) as T;
}

async function main() {
  const runner = createAuditRunner();
  const devices: Device[] = ["mobile", "desktop"];
  const result: Record<string, unknown> = {};
  const singleRunMs: number[] = [];
  let lighthouseVersion = "";

  for (const device of devices) {
    const perPage: Partial<Record<keyof typeof PAGES, AuditSummary>> = {};
    for (const [key, path] of Object.entries(PAGES) as [keyof typeof PAGES, string][]) {
      const runs: AuditSummary[] = [];
      for (let i = 1; i <= RUNS; i++) {
        const { lhr, durationMs } = await runner.audit(`${BASE}${path}`, { device });
        singleRunMs.push(durationMs);
        const summary = summarizeLhr(lhr, { maxOpportunities: 20 });
        lighthouseVersion = summary.lighthouseVersion;
        runs.push(summary);
        console.log(`${device} ${key} run ${i}: score ${summary.performanceScore} (${(durationMs / 1000).toFixed(1)} s)`);
      }
      const median = pickMedianRun(runs);
      perPage[key] = {
        ...median,
        warnings: [`Median of ${RUNS} runs (scores: ${runs.map((r) => r.performanceScore).join(", ")}).`, ...median.warnings],
      };
    }
    const slow = perPage.slow!;
    const fast = perPage.fast!;
    result[device] = {
      slow: { summary: slow, fixes: suggestFixes(slow, { limit: 8 }) },
      fast: { summary: fast, fixes: suggestFixes(fast, { limit: 8 }) },
      comparison: compareSummaries(slow, fast),
    };
  }

  const avgSeconds = singleRunMs.reduce((a, b) => a + b, 0) / singleRunMs.length / 1000;
  const data = relativize({
    generatedAt: new Date().toISOString(),
    lighthouseVersion,
    runsPerAudit: RUNS,
    averageAuditSeconds: Math.round(avgSeconds * 10) / 10,
    devices: result,
  });
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`wrote ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
