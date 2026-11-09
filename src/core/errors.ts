export type ErrorCode =
  | "INVALID_URL"
  | "CHROME_NOT_FOUND"
  | "BROWSER_LAUNCH_FAILED"
  | "TIMEOUT"
  | "LIGHTHOUSE_ERROR"
  | "INVALID_RESULT"
  | "UNKNOWN_METRIC";

/** An error with a stable code and a message written for the person reading the chat. */
export class PerfLensError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "PerfLensError";
  }
}

/** Plain-English hints for Lighthouse's own error codes (core/lib/lh-error.js). */
const LIGHTHOUSE_HINTS: Record<string, string> = {
  DNS_FAILURE: "The domain name could not be resolved. Check the URL for typos and that the site is online.",
  FAILED_DOCUMENT_REQUEST: "Chrome could not load the page. Check that the URL is reachable from this machine (VPN, firewall, local server running).",
  ERRORED_DOCUMENT_REQUEST: "The page responded with an HTTP error status. Audit a URL that returns 200.",
  NO_DOCUMENT_REQUEST: "Chrome did not request the page. Check the URL and any redirects.",
  INSECURE_DOCUMENT_REQUEST: "The page failed a TLS/certificate check.",
  CHROME_INTERSTITIAL_ERROR:
    "Chrome showed its own error page instead of the site. Usually the domain does not resolve, the certificate is invalid, or the site is unreachable from this machine.",
  NOT_HTML: "The URL did not return an HTML page. Audit a web page, not a file or API endpoint.",
  NO_FCP: "The page never painted any content. It may be blank, blocked for automated browsers, or require login.",
  NO_LCP: "The page never produced a Largest Contentful Paint. It may be blank or blocked for automated browsers.",
  PAGE_HUNG: "The page stopped responding during the audit.",
  TARGET_CRASHED: "The browser tab crashed while loading the page.",
  PROTOCOL_TIMEOUT: "Chrome stopped responding during the audit. Try again.",
  INVALID_URL: "Lighthouse rejected the URL as invalid.",
};

export function lighthouseErrorMessage(code: string, message: string): string {
  const hint = LIGHTHOUSE_HINTS[code];
  return hint ? `${hint} (Lighthouse ${code})` : `Lighthouse could not audit the page (${code}): ${message}`;
}

/** Message safe to return to the MCP client for any thrown value. */
export function toUserMessage(err: unknown): string {
  if (err instanceof PerfLensError) return err.message;
  if (err instanceof Error) return `Unexpected error: ${err.message}`;
  return `Unexpected error: ${String(err)}`;
}
