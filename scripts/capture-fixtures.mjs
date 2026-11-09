// Captures real Lighthouse results (LHR) for unit-test fixtures.
// Usage: node scripts/capture-fixtures.mjs
// Heavy fields (screenshots, traces, i18n) are stripped and long item lists capped so fixtures stay small.
import { writeFileSync, mkdirSync } from "node:fs";
import * as chromeLauncher from "chrome-launcher";
import lighthouse, { desktopConfig } from "lighthouse";

const TARGETS = [
  { name: "example-mobile", url: "https://example.com/", device: "mobile" },
  { name: "mdn-mobile", url: "https://developer.mozilla.org/en-US/", device: "mobile" },
  { name: "mdn-desktop", url: "https://developer.mozilla.org/en-US/", device: "desktop" },
  { name: "news-mobile", url: "https://edition.cnn.com/", device: "mobile" },
];

// Optional filter: node scripts/capture-fixtures.mjs news-mobile
const only = process.argv.slice(2);

const DROP_DETAIL_TYPES = new Set(["screenshot", "filmstrip", "treemap-data", "debugdata"]);
const MAX_ITEMS = 8;

function trim(lhr) {
  delete lhr.i18n;
  delete lhr.timing;
  delete lhr.fullPageScreenshot;
  delete lhr.entities;
  for (const audit of Object.values(lhr.audits)) {
    const d = audit.details;
    if (!d) continue;
    if (DROP_DETAIL_TYPES.has(d.type)) {
      delete audit.details;
      continue;
    }
    if (Array.isArray(d.items)) d.items = d.items.slice(0, MAX_ITEMS);
    delete d.debugData;
  }
  return lhr;
}

async function main() {
  mkdirSync("test/fixtures", { recursive: true });
  for (const t of TARGETS.filter((x) => only.length === 0 || only.includes(x.name))) {
    const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless=new"] });
    try {
      const flags = { port: chrome.port, output: "json", logLevel: "error", onlyCategories: ["performance"] };
      const config = t.device === "desktop" ? desktopConfig : undefined;
      const result = await lighthouse(t.url, flags, config);
      if (!result) throw new Error(`No result for ${t.url}`);
      const lhr = trim(result.lhr);
      writeFileSync(`test/fixtures/${t.name}.json`, JSON.stringify(lhr, null, 1));
      console.log(`${t.name}: perf=${lhr.categories.performance.score}`);
    } finally {
      await chrome.kill();
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
