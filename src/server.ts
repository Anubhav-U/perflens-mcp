import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import pkg from "../package.json" with { type: "json" };
import { createAuditRunner, type AuditRunner } from "./runner/audit.js";
import {
  auditUrlInput,
  auditUrlOutput,
  compareUrlsInput,
  compareUrlsOutput,
  createTools,
  explainMetricInput,
  explainMetricOutput,
  suggestFixesInput,
  suggestFixesOutput,
  type ProgressFn,
} from "./tools.js";

export const SERVER_NAME = "perflens-mcp";
export const SERVER_VERSION: string = pkg.version;

export interface ServerDeps {
  runner?: AuditRunner;
}

type Extra = {
  _meta?: { progressToken?: string | number };
  sendNotification: (n: {
    method: "notifications/progress";
    params: { progressToken: string | number; progress: number; message?: string };
  }) => Promise<void>;
};

/** Sends MCP progress notifications when the client asked for them; audits take 10-60 s. */
function progressFor(extra: Extra): ProgressFn {
  const token = extra._meta?.progressToken;
  if (token === undefined) return () => {};
  let step = 0;
  return (message) => {
    step++;
    extra
      .sendNotification({ method: "notifications/progress", params: { progressToken: token, progress: step, message } })
      .catch(() => undefined);
  };
}

export function createServer(deps: ServerDeps = {}): McpServer {
  const tools = createTools(deps.runner ?? createAuditRunner());
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        "PerfLens runs Lighthouse performance audits in a local headless Chrome. Audits take roughly 10-60 seconds. " +
        "Prefer passing a previous audit_url result to suggest_fixes instead of re-auditing. Lab results vary between " +
        "runs; treat small differences as noise. INP is a field metric that Lighthouse cannot measure; TBT is its lab proxy.",
    },
  );

  const auditAnnotations = { readOnlyHint: true, openWorldHint: true, idempotentHint: false };

  server.registerTool(
    "audit_url",
    {
      title: "Audit page performance",
      description:
        "Run a Lighthouse performance audit on a URL (public site or local dev server) and return the performance " +
        "score, Core Web Vitals (LCP, CLS, TBT as INP proxy, FCP, Speed Index) with ratings, and the top opportunities " +
        "ranked by estimated impact, each with the offending resources.",
      inputSchema: auditUrlInput,
      outputSchema: auditUrlOutput,
      annotations: auditAnnotations,
    },
    (args, extra) => tools.auditUrl(args, progressFor(extra as Extra)),
  );

  server.registerTool(
    "compare_urls",
    {
      title: "Compare performance",
      description:
        "Compare two Lighthouse audits and report metric deltas, flagging changes within run-to-run noise as unchanged. " +
        "Pass urlA and urlB to compare two pages (e.g. production vs staging), or only urlA to re-audit a page and " +
        "compare it with its previous audit from this session (before/after a change). A previous result can also be passed as baseline.",
      inputSchema: compareUrlsInput,
      outputSchema: compareUrlsOutput,
      annotations: auditAnnotations,
    },
    (args, extra) => tools.compareUrls(args, progressFor(extra as Extra)),
  );

  server.registerTool(
    "explain_metric",
    {
      title: "Explain a web performance metric",
      description:
        "Explain a web performance metric in plain English: what it measures, why it matters, good/poor thresholds " +
        "(per device where they differ), its weight in the Lighthouse score, common causes and how to improve it. " +
        "Supports LCP, FCP, CLS, TBT, SI (Speed Index) and INP. Does not run an audit.",
      inputSchema: explainMetricInput,
      outputSchema: explainMetricOutput,
      annotations: { readOnlyHint: true, openWorldHint: false, idempotentHint: true },
    },
    (args) => tools.explainMetric(args),
  );

  server.registerTool(
    "suggest_fixes",
    {
      title: "Suggest performance fixes",
      description:
        "Return a prioritized list of concrete performance fixes (what to change, why, effort, estimated impact, and the " +
        "resources involved). Pass audit (a previous audit_url result) to reuse it, or url to run a new audit first.",
      inputSchema: suggestFixesInput,
      outputSchema: suggestFixesOutput,
      annotations: auditAnnotations,
    },
    (args, extra) => tools.suggestFixes(args, progressFor(extra as Extra)),
  );

  return server;
}
