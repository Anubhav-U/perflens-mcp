import { describe, expect, it } from "vitest";
import { compareSummaries, pickMedianRun } from "../src/core/diff.js";
import { ComparisonSchema } from "../src/core/schema.js";
import { summarizeLhr } from "../src/core/summarize.js";
import { loadFixture, makeSummary, metric, opportunity, withMetric } from "./helpers.js";

describe("compareSummaries", () => {
  it("treats identical runs as unchanged", () => {
    const s = makeSummary();
    const c = compareSummaries(s, s);
    expect(c.score.change).toBe("unchanged");
    expect(c.metrics.every((m) => m.change === "unchanged")).toBe(true);
    expect(c.verdict).toMatch(/within run-to-run noise/);
    expect(c.verdict).toMatch(/No metric moved beyond noise/);
  });

  it("marks changes within noise tolerance as unchanged", () => {
    const a = withMetric(makeSummary(), metric("LCP", 3000, 80));
    const b = withMetric(makeSummary(), metric("LCP", 3250, 78)); // +250 ms < 10% of 3000
    expect(compareSummaries(a, b).metrics.find((m) => m.id === "LCP")!.change).toBe("unchanged");
  });

  it("classifies lower values as better and higher as worse", () => {
    const a = withMetric(withMetric(makeSummary({ performanceScore: 60 }), metric("LCP", 5000, 30)), metric("TBT", 100, 99));
    const b = withMetric(withMetric(makeSummary({ performanceScore: 75 }), metric("LCP", 2400, 92)), metric("TBT", 900, 30));
    const c = compareSummaries(a, b);
    const lcp = c.metrics.find((m) => m.id === "LCP")!;
    expect(lcp).toMatchObject({ delta: -2600, change: "better", ratingA: "poor", ratingB: "good", percentChange: -52 });
    expect(c.metrics.find((m) => m.id === "TBT")!.change).toBe("worse");
    expect(c.score).toEqual({ a: 60, b: 75, delta: 15, change: "better" });
    expect(c.verdict).toBe("B scores 15 points higher. Better in B: LCP 5.0 s → 2.4 s. Worse in B: TBT 100 ms → 900 ms.");
  });

  it("uses an absolute tolerance for CLS", () => {
    const a = withMetric(makeSummary(), metric("CLS", 0.05, 100));
    expect(compareSummaries(a, withMetric(makeSummary(), metric("CLS", 0.065, 99))).metrics.find((m) => m.id === "CLS")!.change).toBe("unchanged");
    expect(compareSummaries(a, withMetric(makeSummary(), metric("CLS", 0.2, 60))).metrics.find((m) => m.id === "CLS")!.change).toBe("worse");
  });

  it("reports resolved and new opportunities by title", () => {
    const a = makeSummary({ opportunities: [opportunity("unused-javascript", 5), opportunity("dom-size", 2)] });
    const b = makeSummary({ opportunities: [opportunity("dom-size", 2), opportunity("render-blocking-insight", 3)] });
    const c = compareSummaries(a, b);
    expect(c.resolvedOpportunities).toEqual(["unused-javascript"]);
    expect(c.newOpportunities).toEqual(["render-blocking-insight"]);
  });

  it("warns when devices or Lighthouse versions differ", () => {
    const c = compareSummaries(makeSummary(), makeSummary({ device: "desktop", lighthouseVersion: "13.0.0" }));
    expect(c.warnings).toHaveLength(2);
    expect(c.warnings[0]).toMatch(/mobile run with a desktop run/);
  });

  it("handles a missing score and missing metrics", () => {
    const b = makeSummary({ performanceScore: null, metrics: makeSummary().metrics.filter((m) => m.id !== "SI") });
    const c = compareSummaries(makeSummary(), b);
    expect(c.score).toMatchObject({ delta: null, change: "unchanged" });
    expect(c.metrics.map((m) => m.id)).not.toContain("SI");
  });

  it("treats observed back-to-back variance on an unchanged page as noise", () => {
    // Real MDN re-run: TBT 104 → 0 ms, LCP 2.9 → 2.7 s.
    const a = withMetric(withMetric(makeSummary(), metric("TBT", 104, 98)), metric("LCP", 2900, 80));
    const b = withMetric(withMetric(makeSummary(), metric("TBT", 0, 100)), metric("LCP", 2714, 84));
    const c = compareSummaries(a, b);
    expect(c.metrics.find((m) => m.id === "TBT")!.change).toBe("unchanged");
    expect(c.metrics.find((m) => m.id === "LCP")!.change).toBe("unchanged");
  });

  it("compares two real runs and matches the public schema", () => {
    const c = compareSummaries(summarizeLhr(loadFixture("news-mobile")), summarizeLhr(loadFixture("mdn-mobile")));
    expect(() => ComparisonSchema.parse(c)).not.toThrow();
    expect(c.score.delta).toBe(77);
    expect(c.metrics.filter((m) => m.change === "better").length).toBe(5);
  });
});

describe("pickMedianRun", () => {
  const run = (performanceScore: number | null) => ({ performanceScore });

  it("returns the median-score run (lower middle for even counts)", () => {
    expect(pickMedianRun([run(90), run(70), run(80)]).performanceScore).toBe(80);
    expect(pickMedianRun([run(90), run(70), run(80), run(60)]).performanceScore).toBe(70);
    expect(pickMedianRun([run(50)]).performanceScore).toBe(50);
  });

  it("returns one of the original runs, not a synthetic average", () => {
    const runs = [run(91), run(87), run(95)];
    expect(runs).toContain(pickMedianRun(runs));
  });

  it("refuses an empty list", () => {
    expect(() => pickMedianRun([])).toThrow();
  });
});
