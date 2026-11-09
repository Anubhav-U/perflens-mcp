import { PerfLensError, lighthouseErrorMessage } from "./errors.js";
import type { Lhr, LhrAudit } from "./lhr.js";
import { LAB_METRICS, METRICS, rate, type Device } from "./metrics.js";
import type { AuditSummary, Evidence, MetricResult, Opportunity, Savings } from "./schema.js";
import { formatMetricValue, round, truncate } from "./units.js";

/** Lighthouse treats audits scoring >= 0.9 as passed. */
const PASS_SCORE = 0.9;
const SCORED_MODES = new Set(["metricSavings", "numeric", "binary"]);

/** Scored audits that duplicate a metric rather than describe a fix. */
const NOT_OPPORTUNITIES = new Set(["interactive", "max-potential-fid"]);

/**
 * Lighthouse 12 reports most problems twice: a legacy audit and a newer "insight" audit
 * (Lighthouse 13 keeps only insights). The two can disagree (e.g. dom-size-insight passes while
 * dom-size fails with TBT savings), so a legacy twin is dropped only when its insight also fails,
 * and its savings and evidence are folded into the insight so no estimate is lost.
 */
export const INSIGHT_REPLACES: Record<string, string[]> = {
  "cache-insight": ["uses-long-cache-ttl"],
  "cls-culprits-insight": ["layout-shifts", "unsized-images"],
  "document-latency-insight": ["server-response-time", "redirects", "uses-text-compression"],
  "dom-size-insight": ["dom-size"],
  "duplicated-javascript-insight": ["duplicated-javascript"],
  "font-display-insight": ["font-display"],
  "image-delivery-insight": [
    "modern-image-formats",
    "uses-optimized-images",
    "uses-responsive-images",
    "efficient-animated-content",
  ],
  "lcp-breakdown-insight": ["largest-contentful-paint-element"],
  "lcp-discovery-insight": ["prioritize-lcp-image", "lcp-lazy-loaded"],
  "legacy-javascript-insight": ["legacy-javascript"],
  "modern-http-insight": ["uses-http2"],
  "network-dependency-tree-insight": ["critical-request-chains"],
  "render-blocking-insight": ["render-blocking-resources"],
  "third-parties-insight": ["third-party-summary"],
  "viewport-insight": ["viewport"],
};

const SAVINGS_KEYS = ["LCP", "FCP", "TBT", "CLS", "INP"] as const;
const MAX_EVIDENCE = 3;
const MAX_LABEL = 160;

export interface SummarizeOptions {
  /** Maximum number of opportunities to keep (ranked by impact). Default 10. */
  maxOpportunities?: number;
}

export function summarizeLhr(lhr: Lhr, options: SummarizeOptions = {}): AuditSummary {
  const maxOpportunities = options.maxOpportunities ?? 10;

  if (lhr.runtimeError) {
    const { code, message } = lhr.runtimeError;
    throw new PerfLensError("LIGHTHOUSE_ERROR", lighthouseErrorMessage(code, message), message);
  }
  const perf = lhr.categories.performance;
  if (!perf) {
    throw new PerfLensError("INVALID_RESULT", "The Lighthouse result has no performance category.");
  }

  const device: Device = lhr.configSettings.formFactor === "desktop" ? "desktop" : "mobile";
  const warnings = [...(lhr.runWarnings ?? [])];

  const metrics: MetricResult[] = [];
  for (const id of LAB_METRICS) {
    const info = METRICS[id];
    const audit = info.auditId ? lhr.audits[info.auditId] : undefined;
    if (!audit || typeof audit.numericValue !== "number") {
      warnings.push(`${info.name} was not measured in this run.`);
      continue;
    }
    const value = info.unit === "ms" ? Math.round(audit.numericValue) : round(audit.numericValue, 3);
    metrics.push({
      id,
      name: info.name,
      value,
      displayValue: formatMetricValue(value, info.unit),
      rating: rate(id, value, device),
      lighthouseScore: audit.score === null ? null : Math.round(audit.score * 100),
    });
  }

  const failing = new Map<string, LhrAudit>();
  let passedAuditCount = 0;
  for (const ref of perf.auditRefs) {
    const audit = lhr.audits[ref.id];
    if (ref.group === "metrics" || !audit || NOT_OPPORTUNITIES.has(ref.id)) continue;
    if (!SCORED_MODES.has(audit.scoreDisplayMode) || audit.score === null) continue;
    if (audit.score >= PASS_SCORE) passedAuditCount++;
    else failing.set(ref.id, audit);
  }

  // Pair failing insights with their failing legacy twins.
  const twinsOf = new Map<string, LhrAudit[]>();
  for (const [id] of failing) {
    const twins = (INSIGHT_REPLACES[id] ?? []).map((t) => failing.get(t)).filter((a): a is LhrAudit => !!a);
    if (twins.length) twinsOf.set(id, twins);
  }
  const replaced = new Set([...twinsOf.values()].flat().map((a) => a.id));

  const opportunities: Opportunity[] = [];
  for (const [id, audit] of failing) {
    if (replaced.has(id)) continue;
    opportunities.push(toOpportunity(audit, twinsOf.get(id) ?? [], metrics, device));
  }

  opportunities.sort((x, y) => y.impact - x.impact || (x.score ?? 0) - (y.score ?? 0));

  return {
    url: lhr.requestedUrl ?? lhr.finalUrl ?? "",
    finalUrl: lhr.finalDisplayedUrl ?? lhr.finalUrl ?? lhr.requestedUrl ?? "",
    device,
    fetchTime: lhr.fetchTime,
    lighthouseVersion: lhr.lighthouseVersion,
    performanceScore: perf.score === null ? null : Math.round(perf.score * 100),
    metrics,
    opportunities: opportunities.slice(0, maxOpportunities),
    passedAuditCount,
    warnings,
  };
}

function toOpportunity(audit: LhrAudit, twins: LhrAudit[], metrics: MetricResult[], device: Device): Opportunity {
  const sources = [audit, ...twins];
  const metricSavings: Savings = {};
  for (const key of SAVINGS_KEYS) {
    const v = Math.max(0, ...sources.map((a) => num(a.metricSavings?.[key]) ?? 0));
    if (v > 0) metricSavings[key] = key === "CLS" ? round(v, 3) : Math.round(v);
  }
  const bytes = Math.max(0, ...sources.map((a) => num(a.details?.overallSavingsBytes) ?? 0));
  const savingsBytes = bytes > 0 ? Math.round(bytes) : undefined;
  const evidence = sources.map(extractEvidence).find((e) => e.length) ?? [];
  return {
    id: audit.id,
    title: audit.title,
    displayValue: audit.displayValue || twins.find((t) => t.displayValue)?.displayValue || undefined,
    score: Math.min(...sources.map((a) => a.score ?? 1)),
    metricSavings,
    savingsBytes,
    impact: estimateImpact(metricSavings, savingsBytes, metrics, device),
    evidence,
  };
}

/**
 * Rough score points at stake. For each metric the audit would improve:
 *   (points this metric currently loses) × (share of its gap to "good" the savings would close)
 * where points lost = weight × (1 − Lighthouse metric score). Savings across audits overlap,
 * so this is for ranking only, never a promise of the final score.
 */
export function estimateImpact(
  savings: Savings,
  savingsBytes: number | undefined,
  metrics: MetricResult[],
  device: Device,
): number {
  let impact = 0;
  for (const key of ["LCP", "FCP", "TBT", "CLS"] as const) {
    const saved = savings[key];
    const current = metrics.find((m) => m.id === key);
    if (!saved || !current) continue;
    const gap = current.value - METRICS[key].thresholds[device].good;
    if (gap <= 0) continue;
    const pointsLost = METRICS[key].weight * (1 - (current.lighthouseScore ?? 0) / 100);
    impact += pointsLost * Math.min(1, saved / gap);
  }
  if (impact === 0 && savingsBytes) {
    // Byte savings with no modeled metric effect: small, capped bump so they still rank.
    impact = Math.min(3, savingsBytes / (1024 * 1024));
  }
  // Failing audits with no estimate still deserve a place at the bottom of the list.
  return round(Math.max(impact, 0.5), 1);
}

type Item = Record<string, unknown>;

const isObject = (v: unknown): v is Item => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);

function flattenItems(items: unknown[] | undefined): Item[] {
  const out: Item[] = [];
  for (const item of items ?? []) {
    if (!isObject(item)) continue;
    // "list" details nest tables; checklists and other shapes carry no per-resource evidence.
    if (item.type === "table" && Array.isArray(item.items)) out.push(...flattenItems(item.items));
    else if (typeof item.type !== "string") out.push(item);
  }
  return out;
}

function labelOf(item: Item): string | undefined {
  const entity = item.entity;
  const node = isObject(item.node) ? item.node : undefined;
  const source = isObject(item.source) ? item.source : undefined;
  return (
    str(item.url) ??
    str(entity) ??
    (isObject(entity) ? str(entity.text) : undefined) ??
    str(node?.selector) ??
    str(node?.nodeLabel) ??
    str(source?.url) ??
    str(item.groupLabel) ??
    str(item.label)
  );
}

export function extractEvidence(audit: LhrAudit): Evidence[] {
  const evidence: Evidence[] = [];
  for (const item of flattenItems(audit.details?.items)) {
    const label = labelOf(item);
    if (!label) continue;
    if (label === "Unattributable") continue;
    const wastedBytes = num(item.wastedBytes);
    // Wasted, blocking or CPU time, depending on the audit.
    const timeMs = num(item.wastedMs) ?? num(item.blockingTime) ?? num(item.total) ?? num(item.duration);
    const totalBytes = num(item.totalBytes) ?? num(item.transferSize);
    evidence.push({
      label: truncate(label, MAX_LABEL),
      ...(wastedBytes !== undefined && { wastedBytes: Math.round(wastedBytes) }),
      ...(timeMs !== undefined && { timeMs: Math.round(timeMs) }),
      ...(totalBytes !== undefined && { totalBytes: Math.round(totalBytes) }),
    });
    if (evidence.length === MAX_EVIDENCE) break;
  }
  return evidence;
}
