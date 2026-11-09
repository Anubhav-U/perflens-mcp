import { existsSync } from "node:fs";
import { join } from "node:path";
import { Launcher } from "chrome-launcher";
import { PerfLensError } from "../core/errors.js";

export interface BrowserInfo {
  path: string;
  source: "CHROME_PATH" | "chrome" | "edge";
}

export interface FinderDeps {
  env: NodeJS.ProcessEnv;
  platform: NodeJS.Platform;
  exists: (path: string) => boolean;
  /** chrome-launcher's own Chrome/Chromium discovery. */
  findChrome: () => string | undefined;
}

const defaultDeps: FinderDeps = {
  env: process.env,
  platform: process.platform,
  exists: existsSync,
  findChrome: () => {
    try {
      return Launcher.getFirstInstallation();
    } catch {
      return undefined;
    }
  },
};

/** Microsoft Edge is Chromium-based and works with Lighthouse; many Windows machines have it but not Chrome. */
function edgeCandidates(env: NodeJS.ProcessEnv, platform: NodeJS.Platform): string[] {
  if (platform === "win32") {
    const suffix = join("Microsoft", "Edge", "Application", "msedge.exe");
    return [env["PROGRAMFILES(X86)"], env.PROGRAMFILES, env.LOCALAPPDATA]
      .filter((dir): dir is string => !!dir)
      .map((dir) => join(dir, suffix));
  }
  if (platform === "darwin") return ["/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"];
  return ["/usr/bin/microsoft-edge", "/usr/bin/microsoft-edge-stable"];
}

export const BROWSER_NOT_FOUND_MESSAGE =
  "No Chrome, Chromium or Edge installation was found. Install Google Chrome, or set the CHROME_PATH " +
  "environment variable in your MCP server config to the browser executable.";

/** Finds a Chromium-based browser: CHROME_PATH, then Chrome/Chromium, then Edge. */
export function findBrowser(deps: FinderDeps = defaultDeps): BrowserInfo {
  const override = deps.env.CHROME_PATH?.trim();
  if (override) {
    if (!deps.exists(override)) {
      throw new PerfLensError("CHROME_NOT_FOUND", `CHROME_PATH is set to "${override}", but that file does not exist.`);
    }
    return { path: override, source: "CHROME_PATH" };
  }

  const chrome = deps.findChrome();
  if (chrome) return { path: chrome, source: "chrome" };

  const edge = edgeCandidates(deps.env, deps.platform).find((p) => deps.exists(p));
  if (edge) return { path: edge, source: "edge" };

  throw new PerfLensError("CHROME_NOT_FOUND", BROWSER_NOT_FOUND_MESSAGE);
}
