import { describe, expect, it } from "vitest";
import { METRICS, findMetric, rate } from "../src/core/metrics.js";

describe("rate", () => {
  it("uses inclusive good and exclusive poor boundaries", () => {
    expect(rate("LCP", 2500, "mobile")).toBe("good");
    expect(rate("LCP", 2501, "mobile")).toBe("needs-improvement");
    expect(rate("LCP", 4000, "mobile")).toBe("needs-improvement");
    expect(rate("LCP", 4001, "mobile")).toBe("poor");
    expect(rate("CLS", 0.1, "desktop")).toBe("good");
    expect(rate("CLS", 0.26, "desktop")).toBe("poor");
  });

  it("applies device-specific thresholds for lab-only metrics", () => {
    expect(rate("TBT", 180, "mobile")).toBe("good");
    expect(rate("TBT", 180, "desktop")).toBe("needs-improvement");
    expect(rate("SI", 2500, "mobile")).toBe("good");
    expect(rate("SI", 2500, "desktop")).toBe("poor");
  });

  it("keeps Core Web Vitals thresholds the same on both devices", () => {
    for (const id of ["LCP", "CLS", "INP"] as const) {
      expect(METRICS[id].thresholds.mobile).toEqual(METRICS[id].thresholds.desktop);
    }
  });
});

describe("findMetric", () => {
  it.each([
    ["lcp", "LCP"],
    ["LCP", "LCP"],
    ["Largest Contentful Paint", "LCP"],
    ["largest-contentful-paint", "LCP"],
    ["  total_blocking_time ", "TBT"],
    ["inp", "INP"],
    ["Speed Index", "SI"],
  ])("resolves %j", (input, id) => {
    expect(findMetric(input)?.id).toBe(id);
  });

  it("returns undefined for unknown names", () => {
    expect(findMetric("ttfb")).toBeUndefined();
    expect(findMetric("")).toBeUndefined();
  });

  it("explains that INP is not measured in the lab", () => {
    expect(METRICS.INP.auditId).toBeNull();
    expect(METRICS.INP.labNote).toMatch(/does not measure INP/);
  });

  it("weights sum to 100 for scored metrics", () => {
    expect(Object.values(METRICS).reduce((sum, m) => sum + m.weight, 0)).toBe(100);
  });
});
