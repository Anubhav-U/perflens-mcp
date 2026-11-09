import { METRICS, type MetricInfo, type Rating } from "./metrics.js";
import type { AuditSummary, Comparison, Evidence, FixPlan } from "./schema.js";
import { formatBytes, formatMetricValue, formatMs } from "./units.js";

const RATING_LABEL: Record<Rating, string> = {
  good: "good",
  "needs-improvement": "needs improvement",
  poor: "poor",
};

function evidenceLine(e: Evidence): string {
  const bits: string[] = [];
  if (e.timeMs) bits.push(formatMs(e.timeMs));
  if (e.wastedBytes) bits.push(`${formatBytes(e.wastedBytes)} wasted`);
  else if (e.totalBytes) bits.push(formatBytes(e.totalBytes));
  return bits.length ? `\`${e.label}\` (${bits.join(", ")})` : `\`${e.label}\``;
}

export function formatSummary(s: AuditSummary): string {
  const lines: string[] = [];
  lines.push(`## Lighthouse performance: ${s.performanceScore ?? "n/a"}/100 (${s.device})`);
  lines.push(`${s.finalUrl} · Lighthouse ${s.lighthouseVersion} · ${s.fetchTime}`);
  lines.push("");
  lines.push("| Metric | Value | Rating |");
  lines.push("|---|---|---|");
  for (const m of s.metrics) lines.push(`| ${m.name} (${m.id}) | ${m.displayValue} | ${RATING_LABEL[m.rating]} |`);
  lines.push("");
  lines.push("INP is not measured in a lab run; TBT is its lab proxy.");

  if (s.opportunities.length) {
    lines.push("");
    lines.push("### Top opportunities");
    s.opportunities.forEach((o, i) => {
      const est = o.displayValue ? ` (${o.displayValue})` : "";
      lines.push(`${i + 1}. **${o.title}**${est} · impact ${o.impact}`);
      for (const e of o.evidence) lines.push(`   - ${evidenceLine(e)}`);
    });
  } else {
    lines.push("");
    lines.push("No failing performance audits.");
  }
  if (s.warnings.length) {
    lines.push("");
    lines.push("### Warnings");
    for (const w of s.warnings) lines.push(`- ${w}`);
  }
  return lines.join("\n");
}

export function formatComparison(c: Comparison): string {
  const lines: string[] = [];
  lines.push("## Performance comparison (A → B)");
  lines.push(`A: ${c.a.url} (${c.a.device})`);
  lines.push(`B: ${c.b.url} (${c.b.device})`);
  lines.push("");
  lines.push(c.verdict);
  lines.push("");
  lines.push("| Metric | A | B | Change |");
  lines.push("|---|---|---|---|");
  const sign = (n: number | null) => (n === null ? "" : n > 0 ? `+${n}` : `${n}`);
  lines.push(`| Score | ${c.score.a ?? "n/a"} | ${c.score.b ?? "n/a"} | ${sign(c.score.delta)} (${c.score.change}) |`);
  for (const m of c.metrics) {
    const unit = METRICS[m.id].unit;
    const delta = unit === "ms" ? `${m.delta > 0 ? "+" : m.delta < 0 ? "-" : ""}${formatMs(Math.abs(m.delta))}` : sign(m.delta);
    lines.push(`| ${m.id} | ${formatMetricValue(m.a, unit)} | ${formatMetricValue(m.b, unit)} | ${delta} (${m.change}) |`);
  }
  if (c.resolvedOpportunities.length) {
    lines.push("");
    lines.push(`Resolved in B: ${c.resolvedOpportunities.join("; ")}`);
  }
  if (c.newOpportunities.length) {
    lines.push("");
    lines.push(`New in B: ${c.newOpportunities.join("; ")}`);
  }
  if (c.warnings.length) {
    lines.push("");
    for (const w of c.warnings) lines.push(`Warning: ${w}`);
  }
  lines.push("");
  lines.push("Changes within run-to-run noise are marked unchanged. Run each audit 3+ times for decisions.");
  return lines.join("\n");
}

export function formatFixPlan(p: FixPlan): string {
  const lines: string[] = [];
  lines.push(`## Suggested fixes for ${p.url} (${p.device}, score ${p.performanceScore ?? "n/a"})`);
  if (p.note) {
    lines.push("");
    lines.push(p.note);
  }
  for (const f of p.fixes) {
    lines.push("");
    lines.push(`### ${f.rank}. ${f.title}`);
    lines.push(`Priority: ${f.priority} · Effort: ${f.effort} · Estimated impact: ${f.estimatedImpact}`);
    lines.push("");
    lines.push(f.why);
    lines.push("");
    f.steps.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
    if (f.evidence.length) {
      lines.push("");
      lines.push("Evidence:");
      for (const e of f.evidence) lines.push(`- ${evidenceLine(e)}`);
    }
  }
  return lines.join("\n");
}

export function formatExplanation(m: MetricInfo): string {
  const fmt = (v: number) => formatMetricValue(v, m.unit);
  const t = m.thresholds;
  const sameForDevices = t.mobile.good === t.desktop.good && t.mobile.poor === t.desktop.poor;
  const lines: string[] = [];
  lines.push(`## ${m.name} (${m.id})${m.coreWebVital ? " · Core Web Vital" : ""}`);
  lines.push("");
  lines.push(m.whatItMeasures);
  lines.push("");
  lines.push(`**Why it matters:** ${m.whyItMatters}`);
  lines.push("");
  lines.push("**Thresholds:**");
  const row = (label: string, d: { good: number; poor: number }) =>
    `- ${label}good ≤ ${fmt(d.good)}, needs improvement up to ${fmt(d.poor)}, poor > ${fmt(d.poor)}`;
  if (sameForDevices) lines.push(row("", t.mobile));
  else {
    lines.push(row("Mobile: ", t.mobile));
    lines.push(row("Desktop: ", t.desktop));
  }
  if (m.weight) lines.push(`- Weight in the Lighthouse performance score: ${m.weight}%`);
  lines.push("");
  lines.push("**Common causes:**");
  for (const c of m.commonCauses) lines.push(`- ${c}`);
  lines.push("");
  lines.push("**How to improve:**");
  for (const h of m.howToImprove) lines.push(`- ${h}`);
  if (m.labNote) {
    lines.push("");
    lines.push(`Note: ${m.labNote}`);
  }
  return lines.join("\n");
}
