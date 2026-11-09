// Metric knowledge base: thresholds, score weights and plain-English explanations.
// Thresholds for LCP, FCP, CLS and INP are the Core Web Vitals / web.dev values and do not
// change by device. TBT and Speed Index have no field standard, so they use the Lighthouse
// scoring curve control points (p10 = "good", median = "poor"), which differ for mobile and desktop.

export type Device = "mobile" | "desktop";
export type MetricId = "LCP" | "FCP" | "CLS" | "TBT" | "SI" | "INP";
export type Rating = "good" | "needs-improvement" | "poor";

export interface Thresholds {
  /** Value at or below this is "good". */
  good: number;
  /** Value above this is "poor". */
  poor: number;
}

export interface MetricInfo {
  id: MetricId;
  name: string;
  /** Lighthouse audit id, or null when the metric isn't measured in a lab run. */
  auditId: string | null;
  unit: "ms" | "unitless";
  coreWebVital: boolean;
  /** Weight in the Lighthouse 12 performance score (0 when not scored). */
  weight: number;
  thresholds: Record<Device, Thresholds>;
  whatItMeasures: string;
  whyItMatters: string;
  commonCauses: string[];
  howToImprove: string[];
  labNote?: string;
}

const same = (good: number, poor: number): Record<Device, Thresholds> => ({
  mobile: { good, poor },
  desktop: { good, poor },
});

export const METRICS: Record<MetricId, MetricInfo> = {
  LCP: {
    id: "LCP",
    name: "Largest Contentful Paint",
    auditId: "largest-contentful-paint",
    unit: "ms",
    coreWebVital: true,
    weight: 25,
    thresholds: same(2500, 4000),
    whatItMeasures:
      "Time until the largest image or text block in the viewport is rendered. It approximates when the main content looks loaded.",
    whyItMatters:
      "It is the loading Core Web Vital. Users judge a page as slow or fast largely by when the main content appears.",
    commonCauses: [
      "Slow server response (high TTFB) delaying everything after it",
      "LCP image discovered late (CSS background, JS-inserted, or lazy-loaded)",
      "Large, unoptimized hero image (no modern format, no responsive sizes)",
      "Render-blocking CSS and synchronous scripts in the head",
      "Client-side rendering that waits for JS before showing content",
    ],
    howToImprove: [
      "Make the LCP image discoverable in the initial HTML and add fetchpriority=\"high\"",
      "Never lazy-load the LCP image",
      "Serve AVIF/WebP with srcset/sizes and a CDN",
      "Inline critical CSS and defer non-critical CSS and JS",
      "Server-render or statically generate above-the-fold content",
    ],
  },
  FCP: {
    id: "FCP",
    name: "First Contentful Paint",
    auditId: "first-contentful-paint",
    unit: "ms",
    coreWebVital: false,
    weight: 10,
    thresholds: same(1800, 3000),
    whatItMeasures: "Time until the browser renders the first text or image, so the user sees something happening.",
    whyItMatters: "A late FCP feels like a blank, broken page and raises bounce rates.",
    commonCauses: [
      "Slow server response or redirects",
      "Render-blocking stylesheets and scripts",
      "Web fonts hiding text while they load",
      "Large HTML documents or uncompressed responses",
    ],
    howToImprove: [
      "Reduce TTFB with caching or a CDN; remove redirect hops",
      "Inline critical CSS and defer the rest",
      "Use font-display: swap or optional",
      "Enable Brotli/gzip compression",
    ],
  },
  CLS: {
    id: "CLS",
    name: "Cumulative Layout Shift",
    auditId: "cumulative-layout-shift",
    unit: "unitless",
    coreWebVital: true,
    weight: 25,
    thresholds: same(0.1, 0.25),
    whatItMeasures:
      "How much visible content moves unexpectedly while the page is open (largest burst of layout shifts, unitless).",
    whyItMatters:
      "It is the visual-stability Core Web Vital. Shifts cause misclicks and make a page feel janky and untrustworthy.",
    commonCauses: [
      "Images, videos and iframes without width/height or aspect-ratio",
      "Ads, embeds and banners injected above existing content",
      "Web fonts swapping in with different metrics",
      "Content inserted after load (cookie banners, late API data) without reserved space",
    ],
    howToImprove: [
      "Set width and height (or aspect-ratio) on all media",
      "Reserve space for ads, embeds and late content with min-height or skeletons",
      "Use size-adjust / font metric overrides on fallback fonts",
      "Animate with transform instead of properties that trigger layout",
    ],
    labNote: "Lighthouse only sees shifts during load; field CLS also counts shifts after user interaction.",
  },
  TBT: {
    id: "TBT",
    name: "Total Blocking Time",
    auditId: "total-blocking-time",
    unit: "ms",
    coreWebVital: false,
    weight: 30,
    thresholds: { mobile: { good: 200, poor: 600 }, desktop: { good: 150, poor: 350 } },
    whatItMeasures:
      "Sum of the time beyond 50 ms of every long main-thread task between FCP and Time to Interactive.",
    whyItMatters:
      "It is the lab stand-in for INP. A blocked main thread cannot respond to taps and key presses.",
    commonCauses: [
      "Large JavaScript bundles parsed and executed at startup",
      "Heavy hydration of server-rendered pages",
      "Third-party scripts (ads, analytics, tag managers, chat widgets)",
      "Expensive layout and style recalculation on large DOMs",
    ],
    howToImprove: [
      "Code-split by route and lazy-load non-critical components",
      "Remove unused JavaScript and polyfills; ship modern bundles",
      "Defer or delay third-party scripts until after load or interaction",
      "Break up long tasks (yield with scheduler.yield or setTimeout)",
    ],
    labNote: "Lab-only metric. Field responsiveness is measured with INP.",
  },
  SI: {
    id: "SI",
    name: "Speed Index",
    auditId: "speed-index",
    unit: "ms",
    coreWebVital: false,
    weight: 10,
    thresholds: { mobile: { good: 3400, poor: 5800 }, desktop: { good: 1300, poor: 2300 } },
    whatItMeasures: "How quickly the visible part of the page fills in during load, computed from video frames.",
    whyItMatters: "It captures perceived loading progress, not just a single moment.",
    commonCauses: [
      "Same causes as slow FCP and LCP",
      "Content that renders in late, uneven chunks",
      "Long main-thread tasks delaying paints",
    ],
    howToImprove: [
      "Fix FCP and LCP first; Speed Index usually follows",
      "Render above-the-fold content server-side",
      "Reduce main-thread work during load",
    ],
  },
  INP: {
    id: "INP",
    name: "Interaction to Next Paint",
    auditId: null,
    unit: "ms",
    coreWebVital: true,
    weight: 0,
    thresholds: same(200, 500),
    whatItMeasures:
      "Latency from a user interaction (click, tap, key press) to the next frame painted, taken near the worst interaction of a visit.",
    whyItMatters: "It is the responsiveness Core Web Vital. Slow feedback makes an interface feel broken.",
    commonCauses: [
      "Long tasks already running when the user interacts",
      "Expensive event handlers (heavy state updates, large re-renders)",
      "Large DOM making style and layout recalculation slow",
      "Third-party scripts competing for the main thread",
    ],
    howToImprove: [
      "Keep event handlers short; defer non-urgent work after the next paint",
      "Avoid re-rendering large component trees on each interaction",
      "Reduce DOM size and use content-visibility for off-screen sections",
      "Use TBT in Lighthouse as the lab proxy while optimizing",
    ],
    labNote:
      "A Lighthouse navigation audit does not measure INP (there are no real interactions). Use field data (CrUX, RUM) and treat TBT as the lab proxy.",
  },
};

/** Metrics measured and scored in a Lighthouse navigation run, in display order. */
export const LAB_METRICS: MetricId[] = ["LCP", "FCP", "TBT", "CLS", "SI"];

export function rate(id: MetricId, value: number, device: Device): Rating {
  const t = METRICS[id].thresholds[device];
  if (value <= t.good) return "good";
  if (value > t.poor) return "poor";
  return "needs-improvement";
}

const ALIASES: Record<string, MetricId> = {
  lcp: "LCP",
  "largest contentful paint": "LCP",
  fcp: "FCP",
  "first contentful paint": "FCP",
  cls: "CLS",
  "cumulative layout shift": "CLS",
  tbt: "TBT",
  "total blocking time": "TBT",
  si: "SI",
  "speed index": "SI",
  inp: "INP",
  "interaction to next paint": "INP",
};

/** Resolves "lcp", "Largest Contentful Paint" or "largest-contentful-paint" to a metric id. */
export function findMetric(name: string): MetricInfo | undefined {
  const key = name.trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
  const id = ALIASES[key];
  return id ? METRICS[id] : undefined;
}

export const METRIC_NAMES = Object.keys(METRICS) as MetricId[];
