import { PerfLensError, lighthouseErrorMessage } from "../core/errors.js";
import type { Lhr } from "../core/lhr.js";
import type { Device } from "../core/metrics.js";
import { BROWSER_NOT_FOUND_MESSAGE, findBrowser, type BrowserInfo } from "./browser.js";

export const DEFAULT_TIMEOUT_MS = 90_000;
export const MIN_TIMEOUT_MS = 15_000;
export const MAX_TIMEOUT_MS = 300_000;

export interface AuditOptions {
  device: Device;
  timeoutMs?: number;
}

export interface AuditResult {
  lhr: Lhr;
  durationMs: number;
  browser: BrowserInfo;
}

export interface LaunchedBrowser {
  port: number;
  kill: () => unknown;
}

export interface LighthouseFlags {
  port: number;
  output: "json";
  logLevel: "error";
  onlyCategories: string[];
  maxWaitForLoad: number;
  maxWaitForFcp: number;
}

export interface RunnerDeps {
  findBrowser: () => BrowserInfo;
  launch: (opts: { chromePath: string; chromeFlags: string[] }) => Promise<LaunchedBrowser>;
  runLighthouse: (url: string, flags: LighthouseFlags, device: Device) => Promise<{ lhr: unknown } | undefined>;
  now: () => number;
  env: NodeJS.ProcessEnv;
}

const defaultDeps: RunnerDeps = {
  findBrowser: () => findBrowser(),
  launch: async (opts) => {
    const { launch } = await import("chrome-launcher");
    return launch({ ...opts, logLevel: "silent" });
  },
  // Lighthouse is imported lazily: it is large, and the server should start instantly
  // and answer explain_metric without loading it.
  runLighthouse: async (url, flags, device) => {
    const lighthouse = await import("lighthouse");
    const config = device === "desktop" ? lighthouse.desktopConfig : undefined;
    return lighthouse.default(url, flags, config);
  },
  now: () => Date.now(),
  env: process.env,
};

export function resolveTimeout(requested: number | undefined, env: NodeJS.ProcessEnv): number {
  const fromEnv = Number(env.PERFLENS_TIMEOUT_MS);
  const value = requested ?? (Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_TIMEOUT_MS);
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.round(value)));
}

function chromeFlags(env: NodeJS.ProcessEnv): string[] {
  const extra = env.PERFLENS_CHROME_FLAGS?.split(/\s+/).filter(Boolean) ?? [];
  return ["--headless=new", "--no-first-run", "--no-default-browser-check", ...extra];
}

async function safeKill(browser: LaunchedBrowser): Promise<void> {
  try {
    await browser.kill();
  } catch {
    // Already gone; nothing to clean up.
  }
}

function hasCode(err: unknown): err is { code: string; message?: string; friendlyMessage?: string } {
  return typeof err === "object" && err !== null && typeof (err as { code?: unknown }).code === "string";
}

/**
 * Runs Lighthouse audits one at a time (Lighthouse is not safe to run concurrently in one
 * process), with a hard timeout and guaranteed browser cleanup.
 */
export function createAuditRunner(overrides: Partial<RunnerDeps> = {}) {
  const deps: RunnerDeps = { ...defaultDeps, ...overrides };
  let tail: Promise<unknown> = Promise.resolve();

  function serialize<T>(task: () => Promise<T>): Promise<T> {
    const run = tail.then(task, task);
    tail = run.catch(() => undefined);
    return run;
  }

  async function runOnce(url: string, options: AuditOptions): Promise<AuditResult> {
    const timeoutMs = resolveTimeout(options.timeoutMs, deps.env);
    const browser = deps.findBrowser();
    const started = deps.now();

    let launched: LaunchedBrowser;
    try {
      launched = await deps.launch({ chromePath: browser.path, chromeFlags: chromeFlags(deps.env) });
    } catch (err) {
      if (hasCode(err) && err.code === "ERR_LAUNCHER_NOT_INSTALLED") {
        throw new PerfLensError("CHROME_NOT_FOUND", BROWSER_NOT_FOUND_MESSAGE);
      }
      const reason = err instanceof Error ? err.message : String(err);
      throw new PerfLensError("BROWSER_LAUNCH_FAILED", `Could not start the browser at ${browser.path}: ${reason}`);
    }

    // Let Lighthouse give up on slow loads before the hard timeout, so a slow page
    // still yields a (partial) result instead of a timeout.
    const loadBudget = Math.max(10_000, Math.min(45_000, timeoutMs - 20_000));
    const flags: LighthouseFlags = {
      port: launched.port,
      output: "json",
      logLevel: "error",
      onlyCategories: ["performance"],
      maxWaitForLoad: loadBudget,
      maxWaitForFcp: Math.min(30_000, loadBudget),
    };

    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new PerfLensError(
              "TIMEOUT",
              `The audit did not finish within ${Math.round(timeoutMs / 1000)} s. The page may be very slow or hanging; ` +
                "try again, pass a larger timeoutMs, or set PERFLENS_TIMEOUT_MS.",
            ),
          ),
        timeoutMs,
      );
    });

    const run = deps.runLighthouse(url, flags, options.device);
    run.catch(() => undefined); // Rejections after a timeout are expected once the browser is killed.

    try {
      const result = await Promise.race([run, timeout]);
      if (!result?.lhr) throw new PerfLensError("INVALID_RESULT", "Lighthouse finished without returning a result.");
      return { lhr: result.lhr as Lhr, durationMs: deps.now() - started, browser };
    } catch (err) {
      if (err instanceof PerfLensError) throw err;
      if (hasCode(err)) {
        throw new PerfLensError("LIGHTHOUSE_ERROR", lighthouseErrorMessage(err.code, err.friendlyMessage ?? err.message ?? ""));
      }
      throw new PerfLensError("LIGHTHOUSE_ERROR", `Lighthouse failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      clearTimeout(timer);
      await safeKill(launched);
    }
  }

  return {
    audit: (url: string, options: AuditOptions) => serialize(() => runOnce(url, options)),
  };
}

export type AuditRunner = ReturnType<typeof createAuditRunner>;
