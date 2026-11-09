// Generates the assets for the two demo pages (public/demo/slow.html and fast.html).
// The slow page uses deliberately heavy, unoptimized assets; the fast page uses the fixes
// PerfLens suggests. Output is deterministic (seeded), and is git-ignored: it runs before dev/build.
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "demo");
const slowDir = join(root, "slow");
const fastDir = join(root, "fast");
mkdirSync(slowDir, { recursive: true });
mkdirSync(fastDir, { recursive: true });

// Small seeded PRNG so every build produces identical files.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** A photo-like image: soft color bands (sky, sea, sand) with grain, so PNG compresses badly like a real photo. */
function photo(width, height, seed, palette) {
  const rand = rng(seed);
  const data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    const t = y / height;
    const band = t < 0.45 ? palette[0] : t < 0.7 ? palette[1] : palette[2];
    const wave = Math.sin((y / height) * 9 + seed) * 10;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      const shade = Math.sin(x / (width / 6) + seed) * 12 + wave;
      const grain = (rand() - 0.5) * 34;
      for (let c = 0; c < 3; c++) data[i + c] = Math.max(0, Math.min(255, band[c] + shade + grain));
    }
  }
  return sharp(data, { raw: { width, height, channels: 3 } });
}

const HERO = [
  [126, 170, 205],
  [40, 92, 120],
  [214, 190, 150],
];
const PRODUCTS = [
  [
    [92, 60, 40],
    [140, 96, 64],
    [230, 220, 205],
  ],
  [
    [60, 70, 52],
    [120, 132, 96],
    [236, 228, 212],
  ],
  [
    [110, 44, 38],
    [170, 92, 70],
    [240, 232, 220],
  ],
];

async function write(path, pipeline) {
  await pipeline.toFile(path);
}

async function main() {
  const marker = join(fastDir, "hero-1200.avif");
  if (existsSync(marker) && !process.argv.includes("--force")) {
    console.log("demo assets already generated (use --force to rebuild)");
    return;
  }

  // Hero: 2400x1500 PNG for the slow page; AVIF/WebP at two widths for the fast page.
  const heroRaw = await photo(2400, 1500, 7, HERO).png().toBuffer();
  await write(join(slowDir, "hero.png"), sharp(heroRaw).png({ compressionLevel: 6 }));
  for (const w of [800, 1200]) {
    await write(join(fastDir, `hero-${w}.avif`), sharp(heroRaw).resize(w).avif({ quality: 55 }));
    await write(join(fastDir, `hero-${w}.webp`), sharp(heroRaw).resize(w).webp({ quality: 72 }));
  }

  // Product shots below the fold: 1600x1200 PNG (slow) vs 600x450 WebP (fast).
  for (let i = 0; i < PRODUCTS.length; i++) {
    const raw = await photo(1600, 1200, 20 + i, PRODUCTS[i]).png().toBuffer();
    await write(join(slowDir, `product-${i + 1}.png`), sharp(raw).png());
    await write(join(fastDir, `product-${i + 1}.webp`), sharp(raw).resize(600).webp({ quality: 72 }));
  }

  // Slow page CSS: the few rules the page uses, buried in ~150 KB of rules it never uses.
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

  writeFileSync(join(fastDir, "app.js"), FAST_JS);
  console.log("demo assets generated in public/demo");
}

const PAGE_CSS = `
body{margin:0;font:16px/1.5 Georgia,serif;color:#1d232a;background:#f7f4ef}
header{display:flex;justify-content:space-between;align-items:center;padding:16px 24px;background:#fff;border-bottom:1px solid #e3ddd3}
.brand{font-weight:700;letter-spacing:.02em}
.promo{background:#1d4f66;color:#fff;padding:18px 24px;font-family:system-ui,sans-serif}
.hero{position:relative}
.hero img{width:100%;height:auto;display:block}
.hero h1{position:absolute;left:24px;bottom:24px;margin:0;color:#fff;font-size:clamp(28px,6vw,56px);text-shadow:0 2px 12px rgba(0,0,0,.4)}
main{max-width:960px;margin:0 auto;padding:24px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px}
.card img{width:100%;height:auto;display:block;border-radius:6px}
.demo-note{font:13px/1.4 system-ui,sans-serif;background:#fff6d6;border-bottom:1px solid #e8d78f;padding:8px 24px}
.demo-note a{color:inherit}
`;

// Blocks the main thread at startup (counts toward TBT), then injects the hero image late,
// lazy-loaded and without dimensions: a late-discovered LCP element.
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
    img.alt = "Coastline at dawn";
    hero.insertBefore(img, hero.firstChild);
    setTimeout(function(){
      var promo = document.createElement("div");
      promo.className = "promo";
      promo.textContent = "Free shipping on orders over $40. Today only.";
      document.body.insertBefore(promo, document.querySelector(".hero"));
    }, 900);
  });
})();
`;

const FAST_JS = `
// Non-critical behavior only; loaded with defer.
document.querySelectorAll(".card").forEach(function(card){
  card.addEventListener("click", function(){ card.classList.toggle("picked"); });
});
`;

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
