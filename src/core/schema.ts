import { z } from "zod";

export const DeviceSchema = z.enum(["mobile", "desktop"]);
export const MetricIdSchema = z.enum(["LCP", "FCP", "CLS", "TBT", "SI", "INP"]);
export const RatingSchema = z.enum(["good", "needs-improvement", "poor"]);

export const MetricResultSchema = z.object({
  id: MetricIdSchema,
  name: z.string(),
  value: z.number().describe("Milliseconds, or unitless for CLS"),
  displayValue: z.string(),
  rating: RatingSchema,
  lighthouseScore: z.number().min(0).max(100).nullable().describe("Lighthouse's 0-100 score for this metric"),
});

export const EvidenceSchema = z.object({
  label: z.string().describe("Resource URL, element selector or third-party name"),
  wastedBytes: z.number().optional(),
  timeMs: z.number().optional().describe("Wasted, blocking or CPU time attributed to this item"),
  totalBytes: z.number().optional(),
});

export const SavingsSchema = z.object({
  LCP: z.number().optional(),
  FCP: z.number().optional(),
  TBT: z.number().optional(),
  CLS: z.number().optional(),
  INP: z.number().optional(),
});

export const OpportunitySchema = z.object({
  id: z.string().describe("Lighthouse audit id"),
  title: z.string(),
  displayValue: z.string().optional(),
  score: z.number().nullable(),
  metricSavings: SavingsSchema.describe("Estimated per-metric savings (ms, or unitless for CLS)"),
  savingsBytes: z.number().optional(),
  impact: z.number().describe("Estimated performance-score points at stake (rough, for ranking)"),
  evidence: z.array(EvidenceSchema),
});

export const AuditSummarySchema = z.object({
  url: z.string(),
  finalUrl: z.string(),
  device: DeviceSchema,
  fetchTime: z.string(),
  lighthouseVersion: z.string(),
  performanceScore: z.number().min(0).max(100).nullable(),
  metrics: z.array(MetricResultSchema),
  opportunities: z.array(OpportunitySchema).describe("Failing audits ranked by estimated impact"),
  passedAuditCount: z.number(),
  warnings: z.array(z.string()),
});

export type MetricResult = z.infer<typeof MetricResultSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type Savings = z.infer<typeof SavingsSchema>;
export type Opportunity = z.infer<typeof OpportunitySchema>;
export type AuditSummary = z.infer<typeof AuditSummarySchema>;

export const ChangeSchema = z.enum(["better", "worse", "unchanged"]);

export const MetricDeltaSchema = z.object({
  id: MetricIdSchema,
  name: z.string(),
  a: z.number(),
  b: z.number(),
  delta: z.number().describe("b - a"),
  percentChange: z.number().nullable(),
  change: ChangeSchema.describe("From B's point of view; 'unchanged' when within run-to-run noise"),
  ratingA: RatingSchema,
  ratingB: RatingSchema,
});

export const ComparisonSchema = z.object({
  a: z.object({ url: z.string(), device: DeviceSchema, fetchTime: z.string() }),
  b: z.object({ url: z.string(), device: DeviceSchema, fetchTime: z.string() }),
  score: z.object({
    a: z.number().nullable(),
    b: z.number().nullable(),
    delta: z.number().nullable(),
    change: ChangeSchema,
  }),
  metrics: z.array(MetricDeltaSchema),
  resolvedOpportunities: z.array(z.string()).describe("Failing in A, not in B"),
  newOpportunities: z.array(z.string()).describe("Failing in B, not in A"),
  verdict: z.string(),
  warnings: z.array(z.string()),
});

export type MetricDelta = z.infer<typeof MetricDeltaSchema>;
export type Comparison = z.infer<typeof ComparisonSchema>;

export const EffortSchema = z.enum(["low", "medium", "high"]);
export const PrioritySchema = z.enum(["high", "medium", "low"]);

export const FixSchema = z.object({
  rank: z.number(),
  key: z.string(),
  title: z.string(),
  priority: PrioritySchema,
  effort: EffortSchema,
  estimatedImpact: z.string().describe("Human-readable estimate, e.g. '~950 ms LCP, 2.3 MB'"),
  why: z.string(),
  steps: z.array(z.string()),
  evidence: z.array(EvidenceSchema),
  sourceAudits: z.array(z.string()),
});

export const FixPlanSchema = z.object({
  url: z.string(),
  device: DeviceSchema,
  performanceScore: z.number().nullable(),
  fixes: z.array(FixSchema),
  note: z.string().optional(),
});

const ThresholdsSchema = z.object({ good: z.number(), poor: z.number() });

export const MetricExplanationSchema = z.object({
  id: MetricIdSchema,
  name: z.string(),
  coreWebVital: z.boolean(),
  unit: z.enum(["ms", "unitless"]),
  weight: z.number().describe("Weight in the Lighthouse performance score (0 = not scored)"),
  thresholds: z.object({ mobile: ThresholdsSchema, desktop: ThresholdsSchema }),
  whatItMeasures: z.string(),
  whyItMatters: z.string(),
  commonCauses: z.array(z.string()),
  howToImprove: z.array(z.string()),
  labNote: z.string().optional(),
});

export type MetricExplanation = z.infer<typeof MetricExplanationSchema>;
export type Effort = z.infer<typeof EffortSchema>;
export type Fix = z.infer<typeof FixSchema>;
export type FixPlan = z.infer<typeof FixPlanSchema>;
