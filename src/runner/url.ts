import { PerfLensError } from "../core/errors.js";

const MAX_URL_LENGTH = 2048;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const NON_WEB_SCHEME = /^(file|javascript|data|blob|about|chrome|chrome-extension|edge|view-source|ftp|ws|wss|mailto):/i;
const LOCAL_HOST = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])(:\d+)?(\/|$)/i;

/**
 * Validates and normalizes a URL to audit.
 * - Adds https:// when the scheme is missing (http:// for localhost, where dev servers rarely use TLS).
 * - Allows only http and https. Local and private addresses are allowed on purpose:
 *   auditing a local dev server is a core use case, and the server runs on the user's machine.
 * - Rejects embedded credentials, which would be sent to the page and could leak into chat logs.
 */
export function normalizeUrl(input: string): string {
  const raw = input.trim();
  if (!raw) throw new PerfLensError("INVALID_URL", "No URL was given. Pass a full URL such as https://example.com.");
  if (raw.length > MAX_URL_LENGTH) {
    throw new PerfLensError("INVALID_URL", `The URL is longer than ${MAX_URL_LENGTH} characters.`);
  }
  if (NON_WEB_SCHEME.test(raw)) {
    throw new PerfLensError("INVALID_URL", `Only http and https URLs can be audited, not "${raw.split(":")[0]}:".`);
  }

  const withScheme = HAS_SCHEME.test(raw) ? raw : `${LOCAL_HOST.test(raw) ? "http" : "https"}://${raw}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new PerfLensError("INVALID_URL", `"${raw}" is not a valid URL.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new PerfLensError("INVALID_URL", `Only http and https URLs can be audited, not "${url.protocol}".`);
  }
  if (!url.hostname) throw new PerfLensError("INVALID_URL", `"${raw}" has no host name.`);
  if (url.username || url.password) {
    throw new PerfLensError(
      "INVALID_URL",
      "Remove the username and password from the URL. Credentials in URLs are sent to the page and can end up in logs.",
    );
  }
  return url.href;
}
