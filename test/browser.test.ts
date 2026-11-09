import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findBrowser, type FinderDeps } from "../src/runner/browser.js";

function deps(overrides: Partial<FinderDeps> & { files?: string[] } = {}): FinderDeps {
  const files = new Set(overrides.files ?? []);
  return {
    env: {},
    platform: "linux",
    exists: (p) => files.has(p),
    findChrome: () => undefined,
    ...overrides,
  };
}

describe("findBrowser", () => {
  it("prefers CHROME_PATH when it exists", () => {
    const d = deps({ env: { CHROME_PATH: "/opt/chrome" }, files: ["/opt/chrome"], findChrome: () => "/usr/bin/chrome" });
    expect(findBrowser(d)).toEqual({ path: "/opt/chrome", source: "CHROME_PATH" });
  });

  it("fails clearly when CHROME_PATH points nowhere", () => {
    expect(() => findBrowser(deps({ env: { CHROME_PATH: "/nope" } }))).toThrow(/CHROME_PATH is set to "\/nope"/);
  });

  it("uses chrome-launcher's discovery next", () => {
    expect(findBrowser(deps({ findChrome: () => "/usr/bin/google-chrome" }))).toEqual({
      path: "/usr/bin/google-chrome",
      source: "chrome",
    });
  });

  it("falls back to Edge on Windows", () => {
    const edge = join("C:\\Program Files (x86)", "Microsoft", "Edge", "Application", "msedge.exe");
    const d = deps({ platform: "win32", env: { "PROGRAMFILES(X86)": "C:\\Program Files (x86)" }, files: [edge] });
    expect(findBrowser(d)).toEqual({ path: edge, source: "edge" });
  });

  it("falls back to Edge on macOS", () => {
    const edge = "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge";
    expect(findBrowser(deps({ platform: "darwin", files: [edge] })).source).toBe("edge");
  });

  it("explains how to fix a machine with no browser", () => {
    expect(() => findBrowser(deps())).toThrow(/Install Google Chrome, or set the CHROME_PATH/);
  });
});
