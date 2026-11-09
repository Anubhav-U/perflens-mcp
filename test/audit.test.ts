import { afterEach, describe, expect, it, vi } from "vitest";
import { PerfLensError } from "../src/core/errors.js";
import { createAuditRunner, resolveTimeout, type LighthouseFlags, type RunnerDeps } from "../src/runner/audit.js";
import { loadFixture } from "./helpers.js";

const browser = { path: "/usr/bin/chrome", source: "chrome" as const };

function setup(runLighthouse: RunnerDeps["runLighthouse"], extra: Partial<RunnerDeps> = {}) {
  const kill = vi.fn();
  const launch = vi.fn(async () => ({ port: 9222, kill }));
  const runner = createAuditRunner({
    findBrowser: () => browser,
    launch,
    runLighthouse,
    env: {},
    ...extra,
  });
  return { runner, kill, launch };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("createAuditRunner", () => {
  it("returns the result and always kills the browser", async () => {
    const lhr = loadFixture("example-mobile");
    const { runner, kill, launch } = setup(async () => ({ lhr }));
    const result = await runner.audit("https://example.com/", { device: "mobile" });
    expect(result.lhr).toBe(lhr);
    expect(result.browser).toEqual(browser);
    expect(launch).toHaveBeenCalledWith({
      chromePath: "/usr/bin/chrome",
      chromeFlags: expect.arrayContaining(["--headless=new"]),
    });
    expect(kill).toHaveBeenCalledTimes(1);
  });

  it("passes performance-only flags with a load budget under the timeout", async () => {
    let seen: LighthouseFlags | undefined;
    const { runner } = setup(async (_url, flags) => {
      seen = flags;
      return { lhr: loadFixture("example-mobile") };
    });
    await runner.audit("https://example.com/", { device: "desktop", timeoutMs: 40_000 });
    expect(seen).toMatchObject({ port: 9222, onlyCategories: ["performance"], maxWaitForLoad: 20_000, logLevel: "error" });
  });

  it("kills the browser and maps Lighthouse error codes when the run throws", async () => {
    const err = Object.assign(new Error("net::ERR_NAME_NOT_RESOLVED"), { code: "DNS_FAILURE" });
    const { runner, kill } = setup(async () => {
      throw err;
    });
    await expect(runner.audit("https://nope.invalid/", { device: "mobile" })).rejects.toThrow(
      /domain name could not be resolved.*\(Lighthouse DNS_FAILURE\)/,
    );
    expect(kill).toHaveBeenCalledTimes(1);
  });

  it("times out, kills the browser and explains what to do", async () => {
    vi.useFakeTimers();
    const { runner, kill } = setup(() => new Promise(() => undefined));
    const pending = runner.audit("https://slow.test/", { device: "mobile", timeoutMs: 20_000 });
    const assertion = expect(pending).rejects.toMatchObject({ code: "TIMEOUT", message: expect.stringMatching(/within 20 s/) });
    await vi.advanceTimersByTimeAsync(20_001);
    await assertion;
    expect(kill).toHaveBeenCalledTimes(1);
  });

  it("maps chrome-launcher's not-installed error", async () => {
    const { runner } = setup(async () => ({ lhr: {} }), {
      launch: async () => {
        throw Object.assign(new Error("No Chrome installations found."), { code: "ERR_LAUNCHER_NOT_INSTALLED" });
      },
    });
    await expect(runner.audit("https://example.com/", { device: "mobile" })).rejects.toMatchObject({ code: "CHROME_NOT_FOUND" });
  });

  it("reports other launch failures with the browser path", async () => {
    const { runner } = setup(async () => ({ lhr: {} }), {
      launch: async () => {
        throw new Error("spawn EACCES");
      },
    });
    await expect(runner.audit("https://example.com/", { device: "mobile" })).rejects.toThrow(
      "Could not start the browser at /usr/bin/chrome: spawn EACCES",
    );
  });

  it("propagates browser-not-found before launching", async () => {
    const launch = vi.fn();
    const runner = createAuditRunner({
      findBrowser: () => {
        throw new PerfLensError("CHROME_NOT_FOUND", "none");
      },
      launch,
      env: {},
    });
    await expect(runner.audit("https://example.com/", { device: "mobile" })).rejects.toMatchObject({ code: "CHROME_NOT_FOUND" });
    expect(launch).not.toHaveBeenCalled();
  });

  it("rejects an empty Lighthouse result", async () => {
    const { runner, kill } = setup(async () => undefined);
    await expect(runner.audit("https://example.com/", { device: "mobile" })).rejects.toMatchObject({ code: "INVALID_RESULT" });
    expect(kill).toHaveBeenCalledTimes(1);
  });

  it("runs audits one at a time, even when one fails", async () => {
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { runner } = setup(async (url) => {
      order.push(`start ${url}`);
      if (url === "a") await gate;
      order.push(`end ${url}`);
      if (url === "b") throw new Error("boom");
      return { lhr: loadFixture("example-mobile") };
    });
    const a = runner.audit("a", { device: "mobile" });
    const b = runner.audit("b", { device: "mobile" });
    const c = runner.audit("c", { device: "mobile" });
    await new Promise((r) => setTimeout(r, 20));
    // b and c must wait while a is still running.
    expect(order).toEqual(["start a"]);
    release();
    await a;
    await expect(b).rejects.toThrow(/boom/);
    await c;
    expect(order).toEqual(["start a", "end a", "start b", "end b", "start c", "end c"]);
  });
});

describe("resolveTimeout", () => {
  it("defaults to 90 s, honors the env var, and clamps to 15-300 s", () => {
    expect(resolveTimeout(undefined, {})).toBe(90_000);
    expect(resolveTimeout(undefined, { PERFLENS_TIMEOUT_MS: "120000" })).toBe(120_000);
    expect(resolveTimeout(undefined, { PERFLENS_TIMEOUT_MS: "abc" })).toBe(90_000);
    expect(resolveTimeout(60_000, { PERFLENS_TIMEOUT_MS: "120000" })).toBe(60_000);
    expect(resolveTimeout(1_000, {})).toBe(15_000);
    expect(resolveTimeout(10_000_000, {})).toBe(300_000);
  });
});
