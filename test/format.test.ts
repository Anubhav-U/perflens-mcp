import { describe, expect, it } from "vitest";
import { compareSummaries } from "../src/core/diff.js";
import { suggestFixes } from "../src/core/fixes.js";
import { formatComparison, formatExplanation, formatFixPlan, formatSummary } from "../src/core/format.js";
import { METRICS } from "../src/core/metrics.js";
import { summarizeLhr } from "../src/core/summarize.js";
import { formatBytes, formatMetricValue, formatMs, truncate } from "../src/core/units.js";
import { loadFixture, makeSummary } from "./helpers.js";

describe("units", () => {
  it("formats durations, bytes and CLS", () => {
    expect(formatMs(980)).toBe("980 ms");
    expect(formatMs(2840)).toBe("2.8 s");
    expect(formatMs(14_800)).toBe("15 s");
    expect(formatBytes(800)).toBe("800 B");
    expect(formatBytes(37_846)).toBe("37 KB");
    expect(formatBytes(2_376_389)).toBe("2.3 MB");
    expect(formatMetricValue(0.197, "unitless")).toBe("0.197");
    expect(formatMetricValue(0, "unitless")).toBe("0");
    expect(formatMetricValue(0.1, "unitless")).toBe("0.1");
  });

  it("truncates with an ellipsis", () => {
    expect(truncate("abcdef", 4)).toBe("abc…");
    expect(truncate("abc", 4)).toBe("abc");
  });
});

describe("formatSummary", () => {
  const text = formatSummary(summarizeLhr(loadFixture("news-mobile")));

  it("leads with score and device and renders a metrics table", () => {
    expect(text.split("\n")[0]).toBe("## Lighthouse performance: 16/100 (mobile)");
    expect(text).toContain("| Largest Contentful Paint (LCP) | 9.4 s | poor |");
    expect(text).toContain("| Cumulative Layout Shift (CLS) | 0.197 | needs improvement |");
  });

  it("notes that INP is not measured and lists opportunities with evidence", () => {
    expect(text).toContain("INP is not measured in a lab run");
    expect(text).toMatch(/1\. \*\*Minimize main-thread work\*\*/);
    expect(text).toContain("- `cnn.io` (932 ms, 3.5 MB)");
  });

  it("says so when there are no opportunities", () => {
    expect(formatSummary(makeSummary())).toContain("No failing performance audits.");
  });
});

describe("formatComparison", () => {
  it("renders the verdict and a delta table", () => {
    const text = formatComparison(compareSummaries(summarizeLhr(loadFixture("mdn-mobile")), summarizeLhr(loadFixture("mdn-desktop"))));
    expect(text).toContain("B scores 6 points higher.");
    expect(text).toContain("| Score | 93 | 99 | +6 (better) |");
    expect(text).toContain("| LCP | 2.8 s | 980 ms | -1.9 s (better) |");
    expect(text).toContain("| TBT | 0 ms | 0 ms | 0 ms (unchanged) |");
    expect(text).toContain("Warning: Comparing a mobile run with a desktop run");
  });
});

describe("formatFixPlan", () => {
  it("renders numbered fixes with priority, steps and evidence", () => {
    const text = formatFixPlan(suggestFixes(summarizeLhr(loadFixture("news-mobile"))));
    expect(text).toContain("### 1. Load the LCP element sooner");
    expect(text).toContain("Priority: high · Effort: low · Estimated impact: ~7.0 s LCP");
    expect(text).toMatch(/\n1\. Identify the LCP element/);
    expect(text).toContain("Evidence:");
  });

  it("shows the note for an empty plan", () => {
    expect(formatFixPlan(suggestFixes(makeSummary()))).toMatch(/All lab metrics are good/);
  });
});

describe("formatExplanation", () => {
  it("shows one threshold row for Core Web Vitals", () => {
    const text = formatExplanation(METRICS.LCP);
    expect(text).toContain("## Largest Contentful Paint (LCP) · Core Web Vital");
    expect(text).toContain("- good ≤ 2.5 s, needs improvement up to 4.0 s, poor > 4.0 s");
    expect(text).toContain("Weight in the Lighthouse performance score: 25%");
  });

  it("shows per-device thresholds for TBT and the lab note", () => {
    const text = formatExplanation(METRICS.TBT);
    expect(text).toContain("- Mobile: good ≤ 200 ms");
    expect(text).toContain("- Desktop: good ≤ 150 ms");
    expect(text).toContain("Note: Lab-only metric.");
  });

  it("omits the weight line for unscored INP", () => {
    expect(formatExplanation(METRICS.INP)).not.toContain("Weight in the Lighthouse");
  });
});
