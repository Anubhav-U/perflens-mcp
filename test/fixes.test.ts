import { describe, expect, it } from "vitest";
import { suggestFixes } from "../src/core/fixes.js";
import { PLAYBOOKS, playbookForAudit } from "../src/core/playbooks.js";
import { FixPlanSchema } from "../src/core/schema.js";
import { INSIGHT_REPLACES, summarizeLhr } from "../src/core/summarize.js";
import { loadFixture, makeSummary, metric, opportunity, withMetric } from "./helpers.js";

describe("suggestFixes on a slow page (news-mobile)", () => {
  const plan = suggestFixes(summarizeLhr(loadFixture("news-mobile")));

  it("matches the public schema and is ranked 1..n", () => {
    expect(() => FixPlanSchema.parse(plan)).not.toThrow();
    expect(plan.fixes.map((f) => f.rank)).toEqual(plan.fixes.map((_, i) => i + 1));
    expect(plan.fixes.length).toBe(8);
  });

  it("puts a high-impact, low-effort fix first", () => {
    expect(plan.fixes[0]).toMatchObject({ key: "lcp-element", priority: "high", effort: "low" });
    expect(plan.fixes[0]!.estimatedImpact).toBe("~7.0 s LCP");
  });

  it("merges audits that share a playbook into one fix", () => {
    const mainThread = plan.fixes.find((f) => f.key === "main-thread")!;
    expect(mainThread.sourceAudits).toEqual(expect.arrayContaining(["mainthread-work-breakdown", "bootup-time"]));
    expect(plan.fixes.filter((f) => f.key === "main-thread")).toHaveLength(1);
  });

  it("does not add a metric fallback when flagged audits already estimate savings for it", () => {
    // FCP is poor, but caching and unused-JS fixes carry FCP savings.
    expect(plan.fixes.map((f) => f.key)).not.toContain("server-response");
  });

  it("respects the limit option", () => {
    expect(suggestFixes(summarizeLhr(loadFixture("news-mobile")), { limit: 3 }).fixes).toHaveLength(3);
  });
});

describe("suggestFixes edge cases", () => {
  it("adds a fallback fix for a poor metric with no flagged cause", () => {
    const s = withMetric(makeSummary(), metric("CLS", 0.4, 20));
    const plan = suggestFixes(s);
    expect(plan.fixes).toHaveLength(1);
    expect(plan.fixes[0]).toMatchObject({ key: "layout-shifts", sourceAudits: ["cumulative-layout-shift"] });
    expect(plan.fixes[0]!.why).toMatch(/Cumulative Layout Shift is poor \(0\.4\)/);
    expect(plan.fixes[0]!.estimatedImpact).toMatch(/Targets a poor metric/);
  });

  it("falls back to a generic fix for audits without a playbook", () => {
    const plan = suggestFixes(makeSummary({ opportunities: [opportunity("some-new-audit", 4)] }));
    expect(plan.fixes[0]).toMatchObject({ key: "audit:some-new-audit", title: "some-new-audit", effort: "medium" });
  });

  it("prefers lower effort when impact is equal", () => {
    const plan = suggestFixes(
      makeSummary({ opportunities: [opportunity("dom-size", 6), opportunity("offscreen-images", 6)] }),
    );
    expect(plan.fixes.map((f) => f.key)).toEqual(["offscreen-images", "dom-size"]);
  });

  it("explains an empty plan for a healthy page", () => {
    const plan = suggestFixes(makeSummary());
    expect(plan.fixes).toEqual([]);
    expect(plan.note).toMatch(/field data/);
  });

  it("flags minor refinements on a healthy page", () => {
    const plan = suggestFixes(summarizeLhr(loadFixture("example-mobile")));
    expect(plan.fixes.every((f) => f.priority === "low")).toBe(true);
    expect(plan.note).toMatch(/minor refinements/);
  });
});

describe("playbooks", () => {
  it("have unique keys and map each audit id once", () => {
    const keys = PLAYBOOKS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    const audits = PLAYBOOKS.flatMap((p) => p.audits);
    expect(new Set(audits).size).toBe(audits.length);
  });

  it("send each insight and its legacy twins to the same playbook", () => {
    for (const [insight, legacy] of Object.entries(INSIGHT_REPLACES)) {
      const key = playbookForAudit(insight)?.key;
      expect(key, insight).toBeDefined();
      for (const id of legacy) {
        // document-latency-insight covers several legacy audits that all map to server-response.
        expect(playbookForAudit(id)?.key, `${insight} -> ${id}`).toBe(key);
      }
    }
  });

  it("cover every failing audit in the slow-page fixture", () => {
    const s = summarizeLhr(loadFixture("news-mobile"), { maxOpportunities: 50 });
    const missing = s.opportunities.filter((o) => !playbookForAudit(o.id)).map((o) => o.id);
    expect(missing).toEqual([]);
  });
});
