// Generates the assets for the two demo pages (public/demo/slow.html and fast.html).
// Both pages show the same illustrated images and design. The slow page gets them the way many
// real sites do (huge grainy PNGs, a bloated stylesheet, a blocking script); the fast page gets
// the fixes PerfLens suggests (right-sized AVIF/WebP, inline critical CSS, deferred script).
// Output is deterministic (seeded) and git-ignored: it runs before `dev` and `build`.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

/** Bump when the generated assets change, so stale copies are rebuilt automatically. */
const ASSET_VERSION = "4";

const siteDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = join(siteDir, "public", "demo");
const slowDir = join(root, "slow");
const fastDir = join(root, "fast");
const manifestPath = join(fastDir, "manifest.json");
mkdirSync(slowDir, { recursive: true });
mkdirSync(fastDir, { recursive: true });

/**
 * The fixed page's assets are served with `Cache-Control: immutable` (next.config.ts), so their
 * URLs must change whenever their content does. Each file is written as name.<content hash>.ext.
 * (Lesson learned: with fixed names, browsers kept serving stale images for a year-long cache.)
 */
function writeHashed(assets, name, buffer) {
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 10);
  const dot = name.lastIndexOf(".");
  const file = `${name.slice(0, dot)}.${hash}${name.slice(dot)}`;
  writeFileSync(join(fastDir, file), buffer);
  assets[name] = `/demo/fast/${file}`;
}

/** Renders demo-src/fast.html to public/demo/fast.html with the hashed asset URLs. */
function renderFastPage(assets) {
  const template = readFileSync(join(siteDir, "demo-src", "fast.html"), "utf8");
  const html = template.replace(/\{\{([\w.-]+)\}\}/g, (_, name) => {
    if (!assets[name]) throw new Error(`demo-src/fast.html references unknown asset "${name}"`);
    return assets[name];
  });
  writeFileSync(join(root, "fast.html"), html);
}

// Small seeded PRNG so every build produces identical files.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/**
 * Renders an SVG illustration and adds film grain, so the PNG weighs what a real photo would.
 * Returns a raw RGB buffer pipeline that each output format is encoded from.
 */
async function illustrate(svg, width, height, seed, grain = 22) {
  const { data } = await sharp(Buffer.from(svg)).resize(width, height).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rand = rng(seed);
  for (let i = 0; i < data.length; i += 3) {
    const n = (rand() - 0.5) * grain;
    data[i] = Math.max(0, Math.min(255, data[i] + n));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
  }
  return () => sharp(data, { raw: { width, height, channels: 3 } });
}

// ---------- Illustrations ----------

function heroSvg() {
  const r = rng(11);
  const waves = Array.from({ length: 28 }, (_, i) => {
    const y = 960 + i * 19 + r() * 8;
    const x = r() * 2200;
    const w = 120 + r() * 380;
    return `<path d="M${x} ${y} q ${w / 4} -7 ${w / 2} 0 t ${w / 2} 0" stroke="#fff" stroke-opacity="${0.08 + r() * 0.14}" stroke-width="3" fill="none"/>`;
  }).join("");
  const glints = Array.from({ length: 22 }, (_, i) => {
    const y = 950 + i * 20;
    const w = 260 - i * 9 + r() * 40;
    return `<rect x="${1650 - w / 2 + (r() - 0.5) * 60}" y="${y}" width="${w}" height="5" rx="2.5" fill="#ffe7c4" fill-opacity="${0.55 - i * 0.022}"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1500" viewBox="0 0 2400 1500">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#9fb4c4"/><stop offset="0.35" stop-color="#e8c3a6"/>
      <stop offset="0.62" stop-color="#f3a77f"/><stop offset="0.64" stop-color="#f09a72"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#fff4dc" stop-opacity="0.95"/><stop offset="0.35" stop-color="#ffd9a8" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#ffb685" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8a8f9a"/><stop offset="0.25" stop-color="#5d7383"/><stop offset="1" stop-color="#26394a"/>
    </linearGradient>
  </defs>
  <rect width="2400" height="1500" fill="url(#sky)"/>
  <circle cx="1650" cy="900" r="520" fill="url(#glow)"/>
  <circle cx="1650" cy="905" r="120" fill="#fff1d8"/>
  <path d="M0 860 C 260 800 420 760 640 790 C 820 815 960 760 1180 800 C 1320 826 1420 860 1500 935 L0 935 Z" fill="#b98d86" fill-opacity="0.75"/>
  <path d="M0 900 C 180 840 360 850 520 880 C 700 912 860 870 1000 905 C 1100 930 1160 935 1220 940 L0 940 Z" fill="#8c6464"/>
  <rect y="935" width="2400" height="565" fill="url(#sea)"/>
  ${glints}${waves}
  <path d="M0 1500 L0 1180 C 120 1150 220 1120 330 1150 C 420 1172 470 1240 600 1270 C 700 1295 760 1380 860 1500 Z" fill="#2a2321"/>
  <path d="M0 1500 L0 1300 C 140 1270 260 1300 380 1340 C 470 1370 520 1440 560 1500 Z" fill="#1c1716"/>
  <g transform="translate(2010 1010)">
    <rect x="-260" y="70" width="430" height="14" fill="#3a2d29"/>
    ${[-240, -170, -100, -30, 40, 110].map((x) => `<rect x="${x}" y="84" width="10" height="70" fill="#2b221f"/>`).join("")}
    <rect x="0" y="-60" width="150" height="130" fill="#4a3832"/>
    <path d="M-16 -56 L75 -128 L166 -56 Z" fill="#33251f"/>
    <rect x="22" y="-20" width="34" height="40" fill="#ffc77d"/><rect x="92" y="-20" width="34" height="40" fill="#ffb867"/>
    <rect x="58" y="22" width="34" height="48" fill="#2b201c"/>
  </g>
  <rect width="2400" height="1500" fill="#1d1410" fill-opacity="0.08"/>
</svg>`;
}

const ROASTS = [
  { bg: ["#e9dccb", "#d9c6ae"], label: "#2f5d62", accent: "#e8b04b", seed: 21 },
  { bg: ["#dfe3d6", "#c8d0bd"], label: "#6b8f71", accent: "#f2e8cf", seed: 22 },
  { bg: ["#ecd6cc", "#dcbcae"], label: "#8c3b2f", accent: "#f0c987", seed: 23 },
];

function productSvg({ bg, label, accent, seed }) {
  const r = rng(seed);
  const beans = Array.from({ length: 14 }, () => {
    const side = r() < 0.5 ? r() * 420 + 120 : r() * 420 + 1060;
    const y = 900 + r() * 230;
    const rot = r() * 180;
    return `<g transform="translate(${side} ${y}) rotate(${rot})">
      <ellipse rx="44" ry="30" fill="#4a2c20"/><ellipse rx="44" ry="30" fill="#000" fill-opacity="0.18" transform="translate(4 6)"/>
      <path d="M-34 0 C -14 -10 14 10 34 0" stroke="#2a170f" stroke-width="5" fill="none"/></g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient>
    <linearGradient id="kraft" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#b98f63"/><stop offset="0.45" stop-color="#d4ae82"/><stop offset="1" stop-color="#a97f55"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="1200" fill="url(#bg)"/>
  <ellipse cx="800" cy="1050" rx="420" ry="46" fill="#000" fill-opacity="0.16"/>
  <path d="M560 300 L1040 300 L1100 1040 L500 1040 Z" fill="url(#kraft)"/>
  <path d="M560 300 L520 360 L560 300 Z M1040 300 L1080 360" fill="none"/>
  <rect x="548" y="220" width="504" height="100" fill="#a07a50"/>
  <path d="M548 220 ${Array.from({ length: 21 }, (_, i) => `L${548 + i * 25.2} ${i % 2 ? 206 : 220}`).join(" ")} L1052 220 Z" fill="#a07a50"/>
  <rect x="548" y="300" width="504" height="10" fill="#000" fill-opacity="0.12"/>
  <rect x="610" y="470" width="380" height="430" fill="${label}"/>
  <circle cx="800" cy="600" r="72" fill="none" stroke="${accent}" stroke-width="10"/>
  <path d="M742 612 q 29 -26 58 0 t 58 0" stroke="${accent}" stroke-width="10" fill="none"/>
  <rect x="680" y="712" width="240" height="18" fill="${accent}"/>
  <rect x="710" y="752" width="180" height="10" fill="${accent}" fill-opacity="0.6"/>
  <rect x="725" y="778" width="150" height="10" fill="${accent}" fill-opacity="0.6"/>
  <rect x="760" y="830" width="80" height="34" fill="none" stroke="${accent}" stroke-width="5"/>
  <path d="M500 1040 L1100 1040 L1096 990 L504 990 Z" fill="#000" fill-opacity="0.08"/>
  ${beans}
</svg>`;
}

// ---------- Stylesheet shared by both pages ----------
// The fast page inlines the same rules (plus its fixes) in fast.html; keep the two in sync.

const PAGE_CSS = `
*{box-sizing:border-box}
body{margin:0;font:17px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;color:#2b211c;background:#f7f1e8}
h1,h2,h3,.brand{font-family:"Iowan Old Style","Palatino Linotype",Georgia,serif}
a{color:inherit}
.demo-note{font:13px/1.4 system-ui,sans-serif;background:#fff3cf;border-bottom:1px solid #e6d28f;padding:8px 6vw}
header{display:flex;justify-content:space-between;align-items:center;gap:24px;padding:18px 6vw;background:#f7f1e8;border-bottom:1px solid #e3d6c3}
.brand{font-size:26px;font-weight:700;letter-spacing:.01em;line-height:1;text-decoration:none}
.brand small{display:block;font:600 10px/1.6 system-ui,sans-serif;letter-spacing:.32em;color:#8a6f5c;margin-top:4px}
nav{display:flex;gap:26px;font-size:15px}
nav a{text-decoration:none}
.promo{background:#1f4f5c;color:#f7f1e8;text-align:center;padding:12px 6vw;font-size:15px}
.hero{position:relative;min-height:220px;background:#d9b9a0;color:#fff}
.hero img{width:100%;height:auto;max-height:78vh;object-fit:cover;display:block}
.hero-copy{position:absolute;inset:auto 0 0 0;padding:72px 6vw 56px;background:linear-gradient(transparent,rgba(24,16,12,.72))}
.eyebrow{font-size:13px;font-weight:600;letter-spacing:.24em;text-transform:uppercase;opacity:.9}
.hero h1{margin:10px 0 12px;font-size:clamp(34px,5.5vw,68px);line-height:1.05;max-width:14ch}
.hero p{margin:0 0 22px;max-width:46ch;font-size:18px;opacity:.92}
.btn{display:inline-block;background:#f7f1e8;color:#2b211c;padding:13px 24px;border-radius:999px;font-weight:600;text-decoration:none}
.btn-dark{background:#1f4f5c;color:#f7f1e8}
main{max-width:1120px;margin:0 auto;padding:72px 6vw}
.section-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:end;gap:12px 24px;margin-bottom:28px}
.section-head h2{margin:0;font-size:clamp(28px,3.4vw,40px)}
.section-head p{margin:0;color:#7a6455;max-width:38ch}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:28px}
.card{background:#fffaf2;border:1px solid #eadfcd;border-radius:14px;overflow:hidden}
.card img{width:100%;height:auto;display:block}
.card-body{padding:18px 20px 22px}
.card h3{margin:0;font-size:24px}
.origin{margin:2px 0 10px;color:#8a6f5c;font-size:14px}
.notes{margin:0 0 16px}
.buy{display:flex;justify-content:space-between;align-items:center}
.price{font-weight:700;font-size:18px;color:#8c3b2f}
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:28px;margin-top:80px;padding-top:40px;border-top:1px solid #e3d6c3}
.fact strong{display:block;font-family:"Iowan Old Style",Georgia,serif;font-size:44px;line-height:1;color:#1f4f5c}
.fact span{color:#6d5849}
footer{background:#2b211c;color:#d9cbb8;padding:40px 6vw;font-size:14px;display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px}
`;

async function main() {
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : null;
  if (manifest?.version === ASSET_VERSION && !process.argv.includes("--force")) {
    renderFastPage(manifest.assets); // cheap; picks up template edits
    console.log("demo assets up to date (use --force to rebuild); fast.html re-rendered");
    return;
  }

  // Start clean so old hashed files don't pile up.
  rmSync(fastDir, { recursive: true, force: true });
  mkdirSync(fastDir, { recursive: true });
  const assets = {};

  // Hero: 2400x1500 grainy PNG for the slow page; AVIF/WebP at two widths for the fast page.
  const hero = await illustrate(heroSvg(), 2400, 1500, 7);
  await hero().png({ compressionLevel: 6 }).toFile(join(slowDir, "hero.png"));
  for (const w of [800, 1200]) {
    writeHashed(assets, `hero-${w}.avif`, await hero().resize(w).avif({ quality: 50 }).toBuffer());
    writeHashed(assets, `hero-${w}.webp`, await hero().resize(w).webp({ quality: 70 }).toBuffer());
  }

  // Product shots below the fold: 1600x1200 PNG (slow) vs 600x450 WebP (fast).
  for (let i = 0; i < ROASTS.length; i++) {
    const shot = await illustrate(productSvg(ROASTS[i]), 1600, 1200, 30 + i);
    await shot().png().toFile(join(slowDir, `product-${i + 1}.png`));
    writeHashed(assets, `product-${i + 1}.webp`, await shot().resize(600).webp({ quality: 72 }).toBuffer());
  }

  // Slow page CSS: the rules the page uses, buried in ~300 KB of rules it never uses.
  const unusedCss = Array.from(
    { length: 2600 },
    (_, i) =>
      `.legacy-widget-${i} .panel__item--state-${i % 7}{margin:${i % 13}px ${i % 9}px;padding:${i % 5}px;border:1px solid #${(i * 2654435761).toString(16).slice(-6)};box-shadow:0 ${i % 4}px ${i % 11}px rgba(0,0,0,.${i % 9})}`,
  ).join("\n");
  writeFileSync(join(slowDir, "styles.css"), `${PAGE_CSS}\n/* Legacy theme bundle */\n${unusedCss}\n`);

  // Slow page JS: a synchronous "vendor bundle" with lots of unused code and blocking startup work.
  const unusedJs = Array.from(
    { length: 1800 },
    (_, i) =>
      `function legacyFeature${i}(input){var cfg={id:${i},label:"feature-${i}-${"x".repeat(i % 40)}",weights:[${[1, 2, 3, 4, 5].map((n) => n * i).join(",")}]};return input&&input.length>${i % 17}?cfg.weights.reduce(function(a,b){return a+b*input.length},0):cfg.label}`,
  ).join("\n");
  writeFileSync(join(slowDir, "vendor.js"), `${unusedJs}\n${SLOW_STARTUP_JS}\n`);

  writeHashed(assets, "app.js", Buffer.from(FAST_JS));
  writeFileSync(manifestPath, `${JSON.stringify({ version: ASSET_VERSION, assets }, null, 2)}\n`);
  renderFastPage(assets);
  console.log("demo assets generated in public/demo");
}

// Blocks the main thread at startup (counts toward TBT), then injects the hero image late,
// lazy-loaded and without dimensions (a late-discovered LCP element), and pushes a promo
// banner in above the hero after load (a layout shift).
const SLOW_STARTUP_JS = `
(function(){
  var start = performance.now();
  var acc = 0;
  while (performance.now() - start < 350) { acc += Math.sqrt(acc + 1); }
  window.__startupResult = acc;
  document.addEventListener("DOMContentLoaded", function(){
    var hero = document.getElementById("hero");
    var img = document.createElement("img");
    img.src = "/demo/slow/hero.png";
    img.loading = "lazy";
    img.alt = "A boathouse on the coast at dawn";
    hero.insertBefore(img, hero.firstChild);
    setTimeout(function(){
      var promo = document.createElement("div");
      promo.className = "promo";
      promo.textContent = "Free shipping on orders over $40 this week.";
      document.body.insertBefore(promo, document.querySelector(".hero"));
    }, 900);
  });
})();
`;

const FAST_JS = `
// Non-critical behavior only; loaded with defer.
document.querySelectorAll(".add").forEach(function(btn){
  btn.addEventListener("click", function(e){ e.preventDefault(); btn.textContent = "Added"; });
});
`;

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
