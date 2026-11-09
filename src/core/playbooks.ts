import type { MetricId } from "./metrics.js";
import type { Effort } from "./schema.js";

export interface Playbook {
  key: string;
  title: string;
  effort: Effort;
  why: string;
  steps: string[];
  /** Lighthouse audit ids (legacy and insight) this playbook addresses. */
  audits: string[];
  /** Metrics this playbook mainly improves; used when a metric is poor but no audit flagged a cause. */
  metrics: MetricId[];
}

export const PLAYBOOKS: Playbook[] = [
  {
    key: "lcp-element",
    title: "Load the LCP element sooner",
    effort: "low",
    why: "The largest above-the-fold element is what users wait for. If the browser discovers or prioritizes it late, LCP suffers no matter how fast the rest is.",
    steps: [
      "Identify the LCP element (see evidence) and make sure it is in the initial HTML, not injected by JS or set as a CSS background.",
      "Remove loading=\"lazy\" from the LCP image and add fetchpriority=\"high\".",
      "If it comes from another origin, add <link rel=\"preconnect\"> for that origin, or <link rel=\"preload\" as=\"image\"> with imagesrcset.",
      "In Next.js, set priority (or fetchPriority=\"high\") on the hero <Image>.",
    ],
    audits: [
      "largest-contentful-paint-element",
      "lcp-breakdown-insight",
      "lcp-discovery-insight",
      "prioritize-lcp-image",
      "lcp-lazy-loaded",
    ],
    metrics: ["LCP"],
  },
  {
    key: "render-blocking",
    title: "Remove render-blocking CSS and scripts",
    effort: "medium",
    why: "Stylesheets and synchronous scripts in the <head> stop the browser from painting anything until they download and run.",
    steps: [
      "Add defer (or type=\"module\") to scripts in the <head>; use async only for independent scripts like analytics.",
      "Inline the critical above-the-fold CSS and load the rest with media attributes or after first paint.",
      "Split CSS per route so each page loads only what it uses.",
      "Self-host third-party CSS (e.g. font CSS) instead of chaining to another origin.",
    ],
    audits: ["render-blocking-resources", "render-blocking-insight"],
    metrics: ["FCP", "LCP"],
  },
  {
    key: "unused-javascript",
    title: "Ship less JavaScript (code-split and remove unused code)",
    effort: "medium",
    why: "Every kilobyte of JavaScript must be downloaded, parsed and executed, delaying rendering and blocking interaction.",
    steps: [
      "Run a bundle analyzer (e.g. source-map-explorer, @next/bundle-analyzer, rollup-plugin-visualizer) on the largest bundles in the evidence.",
      "Split code by route and lazy-load heavy components (dynamic import(), React.lazy, next/dynamic) that aren't needed for first render.",
      "Replace heavy dependencies with lighter ones or import only the functions you use.",
      "Load widgets such as video players, chat and maps only on interaction or when scrolled into view.",
    ],
    audits: ["unused-javascript"],
    metrics: ["TBT", "LCP"],
  },
  {
    key: "main-thread",
    title: "Reduce main-thread work and long tasks",
    effort: "high",
    why: "Long tasks block the main thread, so the page can't respond to input (high TBT in the lab, poor INP in the field).",
    steps: [
      "Profile the page in Chrome DevTools Performance panel with CPU throttling and find the longest tasks.",
      "Defer non-critical initialization until after load or idle time (requestIdleCallback).",
      "Break up long tasks by yielding to the main thread (scheduler.yield() or setTimeout chunks).",
      "Reduce hydration cost: hydrate less (islands, server components) or hydrate lazily below the fold.",
      "Move heavy computation to a Web Worker.",
    ],
    audits: ["mainthread-work-breakdown", "bootup-time", "long-tasks", "forced-reflow-insight"],
    metrics: ["TBT", "INP"],
  },
  {
    key: "third-parties",
    title: "Tame third-party scripts",
    effort: "medium",
    why: "Ads, tag managers, analytics and embeds often cost more main-thread time than your own code, and you don't control their size.",
    steps: [
      "Audit each third party in the evidence: remove the ones nobody uses.",
      "Load the rest after the page is interactive (defer, or a worker-based loader such as Partytown).",
      "Replace heavy embeds (video, maps, chat) with a lightweight facade that loads the real thing on click.",
      "Set a performance budget for third parties and review it with the teams that add tags.",
    ],
    audits: ["third-party-summary", "third-parties-insight", "third-party-facades"],
    metrics: ["TBT"],
  },
  {
    key: "image-delivery",
    title: "Serve smaller, modern images",
    effort: "low",
    why: "Images are usually the heaviest bytes on a page; oversized JPEG/PNG files slow LCP and waste data.",
    steps: [
      "Serve AVIF or WebP with a JPEG fallback (<picture> or an image CDN that negotiates formats).",
      "Generate several widths and use srcset/sizes so phones don't download desktop-sized images.",
      "Compress at quality 70-80; it is rarely visible.",
      "Replace animated GIFs with muted, looping <video> (MP4/WebM).",
      "In Next.js, use next/image, which handles formats and sizes.",
    ],
    audits: [
      "image-delivery-insight",
      "modern-image-formats",
      "uses-optimized-images",
      "uses-responsive-images",
      "efficient-animated-content",
    ],
    metrics: ["LCP"],
  },
  {
    key: "offscreen-images",
    title: "Lazy-load offscreen images",
    effort: "low",
    why: "Images below the fold compete for bandwidth with the content the user is actually looking at.",
    steps: [
      "Add loading=\"lazy\" and decoding=\"async\" to images below the fold.",
      "Keep the LCP/hero image eager; lazy-loading it makes LCP worse.",
      "Lazy-load iframes (loading=\"lazy\") as well.",
    ],
    audits: ["offscreen-images"],
    metrics: ["LCP"],
  },
  {
    key: "caching",
    title: "Cache static assets for longer",
    effort: "low",
    why: "Short cache lifetimes force repeat visitors to download the same files again.",
    steps: [
      "Serve fingerprinted assets (hashed filenames) with Cache-Control: public, max-age=31536000, immutable.",
      "Use short lifetimes plus revalidation (ETag) only for HTML and unversioned files.",
      "For third-party assets you can't control, consider self-hosting them.",
    ],
    audits: ["cache-insight", "uses-long-cache-ttl"],
    metrics: ["LCP"],
  },
  {
    key: "server-response",
    title: "Speed up the HTML document response",
    effort: "medium",
    why: "Nothing can start until the HTML arrives; a slow server, redirects or uncompressed HTML delay every other metric.",
    steps: [
      "Serve the page from a CDN edge or cache rendered HTML (static generation, ISR, stale-while-revalidate).",
      "Remove redirect hops (http→https→www→/en) by linking to the final URL.",
      "Enable Brotli or gzip compression for HTML, CSS and JS.",
      "Profile slow server work (database queries, API calls) on the critical path.",
    ],
    audits: ["document-latency-insight", "server-response-time", "redirects", "uses-text-compression"],
    metrics: ["FCP", "LCP"],
  },
  {
    key: "layout-shifts",
    title: "Prevent layout shifts",
    effort: "low",
    why: "Content that jumps while loading causes misclicks and hurts the CLS Core Web Vital.",
    steps: [
      "Give every image, video and iframe explicit width/height or a CSS aspect-ratio.",
      "Reserve space for ads, embeds and late-loading content with min-height or skeleton placeholders.",
      "Don't insert banners above existing content after load; overlay them or reserve their space.",
      "Match fallback font metrics (size-adjust, ascent-override) to reduce font-swap shifts.",
    ],
    audits: ["cls-culprits-insight", "layout-shifts", "unsized-images", "non-composited-animations"],
    metrics: ["CLS"],
  },
  {
    key: "fonts",
    title: "Show text while web fonts load",
    effort: "low",
    why: "Invisible text while fonts download delays FCP and makes the page feel blank.",
    steps: [
      "Add font-display: swap (or optional) to @font-face rules.",
      "Preload the one or two fonts used above the fold.",
      "Self-host fonts and subset them to the characters you need (WOFF2).",
    ],
    audits: ["font-display-insight", "font-display"],
    metrics: ["FCP"],
  },
  {
    key: "dom-size",
    title: "Reduce DOM size",
    effort: "high",
    why: "A large DOM makes style and layout work slower on every update, hurting responsiveness.",
    steps: [
      "Virtualize long lists and tables (render only visible rows).",
      "Render below-the-fold sections on demand, or use content-visibility: auto.",
      "Flatten unnecessary wrapper elements in components.",
    ],
    audits: ["dom-size-insight", "dom-size"],
    metrics: ["TBT", "INP"],
  },
  {
    key: "legacy-javascript",
    title: "Stop shipping legacy JavaScript to modern browsers",
    effort: "low",
    why: "Polyfills and transpiled code for old browsers add bytes and parse time for everyone.",
    steps: [
      "Update your browserslist target to modern browsers (e.g. \"defaults and fully supports es6-module\").",
      "Remove blanket polyfill imports (core-js/stable) and rely on usage-based polyfilling.",
      "Check dependencies that publish only ES5 builds.",
    ],
    audits: ["legacy-javascript-insight", "legacy-javascript"],
    metrics: ["TBT"],
  },
  {
    key: "duplicated-javascript",
    title: "Remove duplicated modules from bundles",
    effort: "medium",
    why: "The same library bundled twice (different versions or chunks) wastes bytes and parse time.",
    steps: [
      "Run npm ls <package> (or npm dedupe) to find multiple versions.",
      "Align dependency versions or use overrides/resolutions.",
      "Check your bundler's splitChunks / manualChunks so shared code lands in one chunk.",
    ],
    audits: ["duplicated-javascript-insight", "duplicated-javascript"],
    metrics: ["TBT"],
  },
  {
    key: "unused-css",
    title: "Remove unused CSS",
    effort: "medium",
    why: "Unused CSS still has to be downloaded and parsed before the page can render.",
    steps: [
      "Split CSS by route or component (CSS modules, per-page bundles).",
      "Purge unused utility classes (Tailwind does this by default when content paths are set correctly).",
      "Drop leftover styles from removed features and unused UI library themes.",
    ],
    audits: ["unused-css-rules"],
    metrics: ["FCP", "LCP"],
  },
  {
    key: "minify",
    title: "Minify CSS and JavaScript",
    effort: "low",
    why: "Unminified files send whitespace and comments over the network.",
    steps: [
      "Enable minification in your production build (it is on by default in Vite, Next.js and webpack production mode).",
      "Check that third-party or hand-included files are minified versions.",
    ],
    audits: ["unminified-css", "unminified-javascript"],
    metrics: ["FCP"],
  },
  {
    key: "request-chains",
    title: "Shorten critical request chains",
    effort: "medium",
    why: "Resources that are discovered only after other resources load (CSS → font, JS → API → image) delay rendering.",
    steps: [
      "Preload resources discovered late in the chain (fonts, hero images, key data).",
      "Preconnect to critical third-party origins.",
      "Inline small critical resources instead of chaining requests.",
    ],
    audits: ["network-dependency-tree-insight", "critical-request-chains", "uses-rel-preconnect"],
    metrics: ["LCP", "FCP"],
  },
  {
    key: "http2",
    title: "Serve assets over HTTP/2 or HTTP/3",
    effort: "low",
    why: "HTTP/1.1 limits parallel requests and adds connection overhead.",
    steps: ["Enable HTTP/2 (or HTTP/3) on your server or CDN; most CDNs do this by default."],
    audits: ["modern-http-insight", "uses-http2"],
    metrics: ["LCP"],
  },
  {
    key: "byte-weight",
    title: "Reduce total page weight",
    effort: "medium",
    why: "Heavy pages load slowly on mobile networks and cost users data.",
    steps: [
      "Start with the largest resources in the evidence.",
      "Apply the image, JavaScript and caching fixes above; they usually account for most of the weight.",
      "Set a page-weight budget and check it in CI.",
    ],
    audits: ["total-byte-weight"],
    metrics: [],
  },
  {
    key: "bf-cache",
    title: "Make the page eligible for the back/forward cache",
    effort: "medium",
    why: "Pages restored from the bfcache appear instantly on back/forward navigation.",
    steps: [
      "Replace unload handlers with pagehide or visibilitychange.",
      "Avoid Cache-Control: no-store on the HTML unless it is truly required.",
      "Close open connections (WebSocket, IndexedDB) on pagehide.",
    ],
    audits: ["bf-cache"],
    metrics: [],
  },
  {
    key: "viewport",
    title: "Add a mobile viewport meta tag",
    effort: "low",
    why: "Without it, mobile browsers render at desktop width and add tap delays.",
    steps: ['Add <meta name="viewport" content="width=device-width, initial-scale=1"> to the <head>.'],
    audits: ["viewport-insight", "viewport"],
    metrics: ["INP"],
  },
];

const BY_AUDIT = new Map<string, Playbook>();
for (const p of PLAYBOOKS) for (const id of p.audits) BY_AUDIT.set(id, p);

export function playbookForAudit(auditId: string): Playbook | undefined {
  return BY_AUDIT.get(auditId);
}
