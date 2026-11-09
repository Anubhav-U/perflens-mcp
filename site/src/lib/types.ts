// Shapes of site/src/data/demo-results.json, written by scripts/precompute-site.ts at the repo root.
// They mirror the MCP server's public output schemas (src/core/schema.ts).

export type Device = "mobile" | "desktop";
export type MetricId = "LCP" | "FCP" | "CLS" | "TBT" | "SI";
export type Rating = "good" | "needs-improvement" | "poor";

export interface MetricResult {
  id: MetricId;
  name: string;
  value: number;
  displayValue: string;
  rating: Rating;
  lighthouseScore: number | null;
}

export interface Evidence {
  label: string;
  wastedBytes?: number;
  timeMs?: number;
  totalBytes?: number;
}

export interface Opportunity {
  id: string;
  title: string;
  displayValue?: string;
  impact: number;
  evidence: Evidence[];
}

export interface AuditSummary {
  url: string;
  device: Device;
  fetchTime: string;
  lighthouseVersion: string;
  performanceScore: number | null;
  metrics: MetricResult[];
  opportunities: Opportunity[];
  warnings: string[];
}

export interface Fix {
  rank: number;
  key: string;
  title: string;
  priority: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  estimatedImpact: string;
  why: string;
  steps: string[];
  evidence: Evidence[];
}

export interface FixPlan {
  fixes: Fix[];
  note?: string;
}

export interface MetricDelta {
  id: MetricId;
  a: number;
  b: number;
  change: "better" | "worse" | "unchanged";
  ratingA: Rating;
  ratingB: Rating;
}

export interface Comparison {
  score: { a: number | null; b: number | null; delta: number | null };
  metrics: MetricDelta[];
  resolvedOpportunities: string[];
  verdict: string;
}

export interface DeviceResults {
  slow: { summary: AuditSummary; fixes: FixPlan };
  fast: { summary: AuditSummary; fixes: FixPlan };
  comparison: Comparison;
}

export interface DemoResults {
  generatedAt: string;
  lighthouseVersion: string;
  runsPerAudit: number;
  averageAuditSeconds: number;
  devices: Record<Device, DeviceResults>;
}
