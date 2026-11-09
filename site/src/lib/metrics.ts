import type { Device, MetricId, Rating } from "./types";

// Same thresholds as the MCP server (src/core/metrics.ts): Core Web Vitals values for LCP, FCP and
// CLS; Lighthouse scoring control points for TBT and Speed Index, which differ by device.
export const THRESHOLDS: Record<MetricId, Record<Device, { good: number; poor: number }>> = {
  LCP: { mobile: { good: 2500, poor: 4000 }, desktop: { good: 2500, poor: 4000 } },
  FCP: { mobile: { good: 1800, poor: 3000 }, desktop: { good: 1800, poor: 3000 } },
  CLS: { mobile: { good: 0.1, poor: 0.25 }, desktop: { good: 0.1, poor: 0.25 } },
  TBT: { mobile: { good: 200, poor: 600 }, desktop: { good: 150, poor: 350 } },
  SI: { mobile: { good: 3400, poor: 5800 }, desktop: { good: 1300, poor: 2300 } },
};

/** Plain-English labels for people who don't know the acronyms. */
export const PLAIN: Record<MetricId, { name: string; question: string }> = {
  LCP: { name: "Largest Contentful Paint", question: "When does the main content appear?" },
  FCP: { name: "First Contentful Paint", question: "When does anything appear?" },
  TBT: { name: "Total Blocking Time", question: "How long is the page frozen while loading?" },
  CLS: { name: "Cumulative Layout Shift", question: "How much does the layout jump around?" },
  SI: { name: "Speed Index", question: "How quickly does the screen fill in?" },
};

export const RATING_LABEL: Record<Rating, string> = {
  good: "Good",
  "needs-improvement": "Needs work",
  poor: "Poor",
};

export function formatValue(id: MetricId, value: number): string {
  if (id === "CLS") return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)} s`;
  return `${Math.round(value)} ms`;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
