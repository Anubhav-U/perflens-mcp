import { METRICS, type MetricId } from "./metrics.js";
import type { AuditSummary, Comparison, MetricDelta } from "./schema.js";
import { formatMetricValue, round } from "./units.js";

type Change = "better" | "worse" | "unchanged";

/**
 * Lighthouse lab runs vary between runs on the same page. Deltas smaller than these
 * tolerances are reported as "unchanged" so noise isn't presented as a regression.
 * `abs` is in the metric's unit; `pct` is relative to A's value. The larger one wins.
 * TBT and Speed Index are the noisiest metrics (observed: TBT 104 → 0 ms and SI 2.1 → 3.3 s
 * on back-to-back runs of an unchanged page), so they get wider bands. Use runs > 1 for decisions.
 */
export const NOISE: Record<MetricId, { abs: number; pct: number }> = {
  LCP: { abs: 200, pct: 0.1 },
  FCP: { abs: 150, pct: 0.1 },
  SI: { abs: 500, pct: 0.2 },
  TBT: { abs: 150, pct: 0.25 },
  CLS: { abs: 0.02, pct: 0 },
  INP: { abs: 50, pct: 0.15 },
};
export const SCORE_NOISE = 3;

/**
 * Picks the run with the median performance score, so the returned metrics and
 * opportunities all come from one real run (Lighthouse's own advice for variability).
 */
export function pickMedianRun<T extends { performanceScore: number | null }>(runs: T[]): T {
  if (runs.length === 0) throw new Error("pickMedianRun needs at least one run");
  const sorted = [...runs].sort((x, y) => (x.performanceScore ?? 0) - (y.performanceScore ?? 0));
  return sorted[Math.floor((sorted.length - 1) / 2)]!;
}

/** All metrics are lower-is-better. */
function classify(id: MetricId, a: number, b: number): Change {
  const { abs, pct } = NOISE[id];
  const tolerance = Math.max(abs, Math.abs(a) * pct);
  const delta = b - a;
  if (Math.abs(delta) <= tolerance) return "unchanged";
  return delta < 0 ? "better" : "worse";
}

export function compareSummaries(a: AuditSummary, b: AuditSummary): Comparison {
  const warnings: string[] = [];
  if (a.device !== b.device) {
    warnings.push(`Comparing a ${a.device} run with a ${b.device} run; device settings alone change the numbers a lot.`);
  }
  if (a.lighthouseVersion !== b.lighthouseVersion) {
    warnings.push(`Different Lighthouse versions (${a.lighthouseVersion} vs ${b.lighthouseVersion}); scoring may differ.`);
  }

  const metrics: MetricDelta[] = [];
  for (const ma of a.metrics) {
    const mb = b.metrics.find((m) => m.id === ma.id);
    if (!mb) continue;
    const decimals = METRICS[ma.id].unit === "unitless" ? 3 : 0;
    metrics.push({
      id: ma.id,
      name: ma.name,
      a: ma.value,
      b: mb.value,
      delta: round(mb.value - ma.value, decimals),
      percentChange: ma.value === 0 ? null : round(((mb.value - ma.value) / ma.value) * 100, 1),
      change: classify(ma.id, ma.value, mb.value),
      ratingA: ma.rating,
      ratingB: mb.rating,
    });
  }

  const scoreDelta =
    a.performanceScore === null || b.performanceScore === null ? null : b.performanceScore - a.performanceScore;
  const scoreChange: Change =
    scoreDelta === null || Math.abs(scoreDelta) <= SCORE_NOISE ? "unchanged" : scoreDelta > 0 ? "better" : "worse";

  const idsA = new Set(a.opportunities.map((o) => o.id));
  const idsB = new Set(b.opportunities.map((o) => o.id));

  return {
    a: { url: a.finalUrl || a.url, device: a.device, fetchTime: a.fetchTime },
    b: { url: b.finalUrl || b.url, device: b.device, fetchTime: b.fetchTime },
    score: { a: a.performanceScore, b: b.performanceScore, delta: scoreDelta, change: scoreChange },
    metrics,
    resolvedOpportunities: a.opportunities.filter((o) => !idsB.has(o.id)).map((o) => o.title),
    newOpportunities: b.opportunities.filter((o) => !idsA.has(o.id)).map((o) => o.title),
    verdict: buildVerdict(scoreDelta, scoreChange, metrics),
    warnings,
  };
}

function buildVerdict(scoreDelta: number | null, scoreChange: Change, metrics: MetricDelta[]): string {
  const better = metrics.filter((m) => m.change === "better");
  const worse = metrics.filter((m) => m.change === "worse");
  const describe = (m: MetricDelta) => {
    const unit = METRICS[m.id].unit;
    return `${m.id} ${formatMetricValue(m.a, unit)} → ${formatMetricValue(m.b, unit)}`;
  };

  const parts: string[] = [];
  if (scoreDelta !== null && scoreChange !== "unchanged") {
    parts.push(`B scores ${Math.abs(scoreDelta)} points ${scoreChange === "better" ? "higher" : "lower"}.`);
  } else {
    parts.push("Performance scores are within run-to-run noise.");
  }
  if (better.length) parts.push(`Better in B: ${better.map(describe).join(", ")}.`);
  if (worse.length) parts.push(`Worse in B: ${worse.map(describe).join(", ")}.`);
  if (!better.length && !worse.length) parts.push("No metric moved beyond noise.");
  return parts.join(" ");
}
