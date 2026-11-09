import { METRICS, type MetricId } from "./metrics.js";
import { PLAYBOOKS, playbookForAudit, type Playbook } from "./playbooks.js";
import type { AuditSummary, Effort, Evidence, Fix, FixPlan, Opportunity, Savings } from "./schema.js";
import { formatBytes, formatMs, round } from "./units.js";

const EFFORT_COST: Record<Effort, number> = { low: 1, medium: 1.5, high: 2.5 };
const MAX_EVIDENCE = 3;

/** When a metric is poor but no failing audit explains it, fall back to its main playbook. */
const METRIC_FALLBACK: Partial<Record<MetricId, string>> = {
  LCP: "lcp-element",
  FCP: "server-response",
  TBT: "main-thread",
  CLS: "layout-shifts",
};

interface Group {
  playbook: Playbook;
  impact: number;
  savings: Savings;
  savingsBytes: number;
  evidence: Evidence[];
  sourceAudits: string[];
  fallbackReason?: string;
}

export interface SuggestOptions {
  /** Maximum fixes to return. Default 8. */
  limit?: number;
}

export function suggestFixes(summary: AuditSummary, options: SuggestOptions = {}): FixPlan {
  const limit = options.limit ?? 8;
  const groups = new Map<string, Group>();

  for (const opp of summary.opportunities) {
    const playbook = playbookForAudit(opp.id) ?? genericPlaybook(opp);
    const group = groups.get(playbook.key);
    if (group) mergeInto(group, opp);
    else groups.set(playbook.key, newGroup(playbook, opp));
  }

  // Poor metrics that no flagged audit addresses still deserve a fix. A metric counts as
  // addressed if a fix's playbook targets it or any flagged audit estimates savings for it.
  const covered = new Set<string>(
    [...groups.values()].flatMap((g) => [
      ...g.playbook.metrics,
      ...Object.keys(g.savings).filter((k) => (g.savings[k as keyof Savings] ?? 0) > 0),
    ]),
  );
  for (const metric of summary.metrics) {
    if (metric.rating !== "poor" || covered.has(metric.id)) continue;
    const key = METRIC_FALLBACK[metric.id];
    const playbook = key && PLAYBOOKS.find((p) => p.key === key);
    if (!playbook || groups.has(playbook.key)) continue;
    const scoreLoss = metric.lighthouseScore === null ? 0.5 : 1 - metric.lighthouseScore / 100;
    groups.set(playbook.key, {
      playbook,
      impact: round(METRICS[metric.id].weight * scoreLoss, 1),
      savings: {},
      savingsBytes: 0,
      evidence: [],
      sourceAudits: [METRICS[metric.id].auditId ?? metric.id],
      fallbackReason: `${metric.name} is poor (${metric.displayValue}) but no specific audit pinpointed the cause.`,
    });
  }

  const ranked = [...groups.values()].sort(
    (x, y) => y.impact / EFFORT_COST[y.playbook.effort] - x.impact / EFFORT_COST[x.playbook.effort],
  );

  const fixes: Fix[] = ranked.slice(0, limit).map((g, i) => ({
    rank: i + 1,
    key: g.playbook.key,
    title: g.playbook.title,
    priority: g.impact >= 8 ? "high" : g.impact >= 3 ? "medium" : "low",
    effort: g.playbook.effort,
    estimatedImpact: describeImpact(g),
    why: g.fallbackReason ? `${g.fallbackReason} ${g.playbook.why}` : g.playbook.why,
    steps: g.playbook.steps,
    evidence: g.evidence,
    sourceAudits: g.sourceAudits,
  }));

  return {
    url: summary.finalUrl || summary.url,
    device: summary.device,
    performanceScore: summary.performanceScore,
    fixes,
    ...(planNote(summary, fixes) && { note: planNote(summary, fixes) }),
  };
}

function planNote(summary: AuditSummary, fixes: Fix[]): string | undefined {
  const allGood = summary.metrics.every((m) => m.rating === "good");
  if (fixes.length === 0) {
    return allGood
      ? "All lab metrics are good and no audits failed. Check field data (CrUX/RUM), especially INP, before optimizing further."
      : "No failing audits were found to base fixes on.";
  }
  if (allGood && fixes.every((f) => f.priority === "low")) {
    return "All lab metrics are already good; these are minor refinements, not urgent work.";
  }
  return undefined;
}

function newGroup(playbook: Playbook, opp: Opportunity): Group {
  return {
    playbook,
    impact: opp.impact,
    savings: { ...opp.metricSavings },
    savingsBytes: opp.savingsBytes ?? 0,
    evidence: opp.evidence.slice(0, MAX_EVIDENCE),
    sourceAudits: [opp.id],
  };
}

/** Audits sharing a playbook overlap heavily, so take maxima rather than sums. */
function mergeInto(group: Group, opp: Opportunity): void {
  group.impact = Math.max(group.impact, opp.impact);
  for (const [key, value] of Object.entries(opp.metricSavings) as [keyof Savings, number | undefined][]) {
    if (value !== undefined) group.savings[key] = Math.max(group.savings[key] ?? 0, value);
  }
  group.savingsBytes = Math.max(group.savingsBytes, opp.savingsBytes ?? 0);
  for (const e of opp.evidence) {
    if (group.evidence.length >= MAX_EVIDENCE) break;
    if (!group.evidence.some((x) => x.label === e.label)) group.evidence.push(e);
  }
  group.sourceAudits.push(opp.id);
}

function genericPlaybook(opp: Opportunity): Playbook {
  return {
    key: `audit:${opp.id}`,
    title: opp.title,
    effort: "medium",
    why: "Lighthouse flagged this audit as failing.",
    steps: [`Look up the Lighthouse "${opp.id}" audit documentation for specific guidance.`],
    audits: [opp.id],
    metrics: [],
  };
}

function describeImpact(g: Group): string {
  const parts: string[] = [];
  for (const key of ["LCP", "FCP", "TBT", "INP"] as const) {
    const v = g.savings[key];
    if (v) parts.push(`~${formatMs(v)} ${key}`);
  }
  if (g.savings.CLS) parts.push(`~${g.savings.CLS} CLS`);
  if (g.savingsBytes > 0) parts.push(formatBytes(g.savingsBytes));
  if (parts.length) return parts.join(", ");
  return g.fallbackReason ? "Targets a poor metric; no per-audit estimate" : "No estimate from Lighthouse";
}
