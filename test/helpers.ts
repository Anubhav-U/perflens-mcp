import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Lhr } from "../src/core/lhr.js";
import { METRICS, rate, type Device, type MetricId } from "../src/core/metrics.js";
import type { AuditSummary, MetricResult, Opportunity } from "../src/core/schema.js";
import { formatMetricValue } from "../src/core/units.js";

export type FixtureName = "example-mobile" | "mdn-mobile" | "mdn-desktop" | "news-mobile";

/** Loads a real, trimmed Lighthouse result captured by scripts/capture-fixtures.mjs. */
export function loadFixture(name: FixtureName): Lhr {
  const path = fileURLToPath(new URL(`./fixtures/${name}.json`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as Lhr;
}

export function metric(id: MetricId, value: number, lighthouseScore: number, device: Device = "mobile"): MetricResult {
  return {
    id,
    name: METRICS[id].name,
    value,
    displayValue: formatMetricValue(value, METRICS[id].unit),
    rating: rate(id, value, device),
    lighthouseScore,
  };
}

export function opportunity(id: string, impact: number, extra: Partial<Opportunity> = {}): Opportunity {
  return { id, title: id, score: 0, metricSavings: {}, impact, evidence: [], ...extra };
}

/** A synthetic summary with all-good metrics; override what a test cares about. */
export function makeSummary(overrides: Partial<AuditSummary> = {}): AuditSummary {
  const device = overrides.device ?? "mobile";
  return {
    url: "https://site.test/",
    finalUrl: "https://site.test/",
    device,
    fetchTime: "2026-01-01T00:00:00.000Z",
    lighthouseVersion: "12.8.2",
    performanceScore: 95,
    metrics: [
      metric("LCP", 2000, 95, device),
      metric("FCP", 1200, 95, device),
      metric("TBT", 100, 95, device),
      metric("CLS", 0.02, 100, device),
      metric("SI", 2000, 95, device),
    ],
    opportunities: [],
    passedAuditCount: 30,
    warnings: [],
    ...overrides,
  };
}

export function withMetric(s: AuditSummary, m: MetricResult): AuditSummary {
  return { ...s, metrics: s.metrics.map((x) => (x.id === m.id ? m : x)) };
}
