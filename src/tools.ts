import { z } from "zod";
import { compareSummaries, pickMedianRun } from "./core/diff.js";
import { PerfLensError, toUserMessage } from "./core/errors.js";
import { suggestFixes } from "./core/fixes.js";
import { formatComparison, formatExplanation, formatFixPlan, formatSummary } from "./core/format.js";
import { METRIC_NAMES, findMetric, type Device } from "./core/metrics.js";
import {
  AuditSummarySchema,
  ComparisonSchema,
  DeviceSchema,
  FixPlanSchema,
  MetricExplanationSchema,
  type AuditSummary,
} from "./core/schema.js";
import { summarizeLhr } from "./core/summarize.js";
import { MAX_TIMEOUT_MS, MIN_TIMEOUT_MS, type AuditRunner } from "./runner/audit.js";
import { normalizeUrl } from "./runner/url.js";

// ---------- Input schemas (raw shapes, as the MCP SDK expects) ----------

const timeoutMs = z
  .number()
  .int()
  .min(MIN_TIMEOUT_MS)
  .max(MAX_TIMEOUT_MS)
  .optional()
  .describe("Per-audit timeout in milliseconds (default 90000)");

const runs = z
  .number()
  .int()
  .min(1)
  .max(5)
  .default(1)
  .describe("Lighthouse runs per URL; the median-score run is used. 3+ reduces noise but multiplies audit time.");

const device = DeviceSchema.default("mobile").describe(
  "Lighthouse device profile: 'mobile' (throttled mid-tier phone, Lighthouse default) or 'desktop'",
);

export const auditUrlInput = {
  url: z.string().describe("Page to audit, e.g. https://example.com or localhost:3000"),
  device,
  maxOpportunities: z.number().int().min(1).max(20).default(8).describe("How many ranked opportunities to return"),
  runs,
  timeoutMs,
};

/**
 * A previous audit_url result passed back in. The published JSON schema is a loose object on
 * purpose: repeating the full summary schema in every tool's input bloats the tool list that
 * clients load into the model's context, and the audit_url output carries extra fields
 * (auditDurationMs). It is validated against AuditSummarySchema in the handler instead.
 */
const previousAudit = (description: string) => z.object({}).loose().optional().describe(description);

function parseAudit(value: unknown, field: string): AuditSummary {
  const parsed = AuditSummarySchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? ` at ${issue.path.join(".")}` : "";
    throw new PerfLensError(
      "INVALID_RESULT",
      `${field} is not a valid audit_url result${where}: ${issue?.message ?? "invalid"}. Pass the structured result of audit_url unchanged.`,
    );
  }
  return parsed.data;
}

export const compareUrlsInput = {
  urlA: z.string().describe("First URL (A). With no urlB, this URL is re-audited and compared with its earlier audit."),
  urlB: z.string().optional().describe("Second URL (B) to compare against A"),
  device,
  baseline: previousAudit(
    "Earlier audit_url structured result to use as A (the 'before'). Without it, the last audit of urlA in this session is used.",
  ),
  runs,
  timeoutMs,
};

export const explainMetricInput = {
  name: z.string().describe("Metric name or abbreviation: LCP, FCP, CLS, TBT, SI, INP"),
};

export const suggestFixesInput = {
  url: z.string().optional().describe("Page to audit and suggest fixes for"),
  audit: previousAudit("A previous audit_url structured result, to avoid re-running the audit"),
  device,
  limit: z.number().int().min(1).max(15).default(8).describe("Maximum number of fixes"),
  timeoutMs,
};

// ---------- Output schemas ----------

export const auditUrlOutput = AuditSummarySchema.extend({
  auditDurationMs: z.number().describe("Wall-clock time of the Lighthouse run"),
});

export const compareUrlsOutput = ComparisonSchema.extend({
  mode: z.enum(["two-urls", "before-after"]),
});

export const explainMetricOutput = MetricExplanationSchema;
export const suggestFixesOutput = FixPlanSchema;

// ---------- Handlers ----------

type Args<T extends z.ZodRawShape> = z.infer<z.ZodObject<T>>;

export interface ToolResult {
  [key: string]: unknown;
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export type ProgressFn = (message: string) => void;

function ok(text: string, structured: object): ToolResult {
  return { content: [{ type: "text", text }], structuredContent: structured as Record<string, unknown> };
}

function fail(err: unknown): ToolResult {
  if (!(err instanceof PerfLensError)) console.error("perflens-mcp: unexpected error", err);
  return { content: [{ type: "text", text: toUserMessage(err) }], isError: true };
}

const storeKey = (url: string, d: Device) => `${d} ${url}`;

export function createTools(runner: AuditRunner) {
  /** Latest summary per URL and device, so "before/after" comparisons work within a session. */
  const lastAudit = new Map<string, AuditSummary>();

  interface RunOptions {
    device: Device;
    timeoutMs?: number;
    maxOpportunities: number;
    runs?: number;
  }

  async function runAudit(rawUrl: string, opts: RunOptions, progress: ProgressFn) {
    const url = normalizeUrl(rawUrl);
    const count = opts.runs ?? 1;
    const results: AuditSummary[] = [];
    let durationMs = 0;
    for (let i = 1; i <= count; i++) {
      progress(`Running Lighthouse (${opts.device}) on ${url}${count > 1 ? ` (run ${i}/${count})` : ""}`);
      const run = await runner.audit(url, { device: opts.device, timeoutMs: opts.timeoutMs });
      results.push(summarizeLhr(run.lhr, { maxOpportunities: opts.maxOpportunities }));
      durationMs += run.durationMs;
    }
    const median = pickMedianRun(results);
    const summary: AuditSummary =
      count > 1
        ? {
            ...median,
            warnings: [
              `Median of ${count} runs (scores: ${results.map((r) => r.performanceScore ?? "n/a").join(", ")}).`,
              ...median.warnings,
            ],
          }
        : median;
    lastAudit.set(storeKey(url, opts.device), summary);
    return { summary, durationMs };
  }

  return {
    async auditUrl(args: Args<typeof auditUrlInput>, progress: ProgressFn = () => {}): Promise<ToolResult> {
      try {
        const { summary, durationMs } = await runAudit(args.url, args, progress);
        const text = `${formatSummary(summary)}\n\nAudit took ${(durationMs / 1000).toFixed(1)} s.`;
        return ok(text, { ...summary, auditDurationMs: durationMs });
      } catch (err) {
        return fail(err);
      }
    },

    async compareUrls(args: Args<typeof compareUrlsInput>, progress: ProgressFn = () => {}): Promise<ToolResult> {
      try {
        let a: AuditSummary;
        let b: AuditSummary;
        let mode: "two-urls" | "before-after";
        const opts: RunOptions = { ...args, maxOpportunities: 20 };
        if (args.urlB) {
          mode = "two-urls";
          a = (await runAudit(args.urlA, opts, progress)).summary;
          b = (await runAudit(args.urlB, opts, progress)).summary;
        } else {
          mode = "before-after";
          const url = normalizeUrl(args.urlA);
          const before = args.baseline ? parseAudit(args.baseline, "baseline") : lastAudit.get(storeKey(url, args.device));
          if (!before) {
            throw new PerfLensError(
              "INVALID_RESULT",
              `There is no earlier ${args.device} audit of ${url} in this session to compare against. ` +
                "Run audit_url first (then make your change), pass urlB, or pass a previous result as baseline.",
            );
          }
          a = before;
          b = (await runAudit(url, opts, progress)).summary;
        }
        const comparison = { ...compareSummaries(a, b), mode };
        return ok(formatComparison(comparison), comparison);
      } catch (err) {
        return fail(err);
      }
    },

    explainMetric(args: Args<typeof explainMetricInput>): ToolResult {
      const info = findMetric(args.name);
      if (!info) {
        return fail(
          new PerfLensError(
            "UNKNOWN_METRIC",
            `Unknown metric "${args.name}". Known metrics: ${METRIC_NAMES.join(", ")} (full names work too).`,
          ),
        );
      }
      const { auditId: _auditId, ...explanation } = info;
      return ok(formatExplanation(info), explanation);
    },

    async suggestFixes(args: Args<typeof suggestFixesInput>, progress: ProgressFn = () => {}): Promise<ToolResult> {
      try {
        if (!!args.url === !!args.audit) {
          throw new PerfLensError("INVALID_URL", "Pass either url (to run a new audit) or audit (a previous audit_url result), not both or neither.");
        }
        const summary = args.audit
          ? parseAudit(args.audit, "audit")
          : (await runAudit(args.url!, { ...args, maxOpportunities: 20 }, progress)).summary;
        const plan = suggestFixes(summary, { limit: args.limit });
        return ok(formatFixPlan(plan), plan);
      } catch (err) {
        return fail(err);
      }
    },
  };
}

export type Tools = ReturnType<typeof createTools>;
