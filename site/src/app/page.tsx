import demo from "@/data/demo-results.json";
import { DemoReport } from "@/components/DemoReport";
import { Flow } from "@/components/Flow";
import { InstallTabs } from "@/components/InstallTabs";
import { LoadRace } from "@/components/LoadRace";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Transcript } from "@/components/Transcript";
import type { DemoResults } from "@/lib/types";

const data = demo as unknown as DemoResults;

const LINKS = {
  github: "https://github.com/Anubhav-U/perflens-mcp",
  npm: "https://www.npmjs.com/package/perflens-mcp",
  portfolio: "https://anubhav-u.vercel.app",
};

const TOOLS = [
  {
    name: "audit_url",
    ask: "How fast is localhost:3000 on mobile?",
    what: "Runs a Lighthouse speed test on any page, even one running on your own machine, and returns the score, the key measurements and the biggest problems with the files causing them.",
  },
  {
    name: "suggest_fixes",
    ask: "What should I fix first?",
    what: "A short to-do list: what to change, why, how much effort, and roughly how much it helps. Best value first.",
  },
  {
    name: "compare_urls",
    ask: "Did my change make it faster?",
    what: "Compares two pages, or one page before and after a change, and ignores differences small enough to be run-to-run noise.",
  },
  {
    name: "explain_metric",
    ask: "What is CLS and why is mine bad?",
    what: "Explains a speed measurement in plain English: what it means, what good looks like, and what usually causes problems.",
  },
];

const wrap = "mx-auto max-w-6xl px-4 sm:px-6";

export default function Home() {
  const mobile = data.devices.mobile;

  return (
    <>
      <header className={`${wrap} flex items-center justify-between py-4`}>
        <a href="#top" className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center bg-brand" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 32 32">
              <rect x="4" y="8" width="22" height="5" fill="#fff" opacity="0.4" />
              <rect x="4" y="19" width="8" height="5" fill="#fff" />
              <rect x="27" y="5" width="2.5" height="22" fill="#fff" />
            </svg>
          </span>
          <span className="display text-2xl uppercase">PerfLens</span>
        </a>
        <nav className="flex items-center gap-1 text-sm font-medium sm:gap-4">
          <a href="#demo" className="hidden px-1 py-1 hover:text-brand sm:inline">
            Demo
          </a>
          <a href="#install" className="hidden px-1 py-1 hover:text-brand sm:inline">
            Install
          </a>
          <a href={LINKS.github} className="px-2 py-1 hover:text-brand">
            GitHub
          </a>
          <ThemeToggle />
        </nav>
      </header>

      <main id="top">
        {/* Hero */}
        <section className={`${wrap} pb-16 pt-10 sm:pt-16`}>
          <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-end">
            <h1 className="display text-[3.4rem] uppercase sm:text-[5.5rem] lg:text-[7rem]">
              Why is my
              <br />
              site <span className="text-brand">slow?</span>
            </h1>
            <div className="lg:pb-3">
              <p className="text-lg leading-relaxed text-ink-2">
                Ask your AI coding assistant. <strong className="font-semibold text-ink">PerfLens</strong> lets Claude
                Code, Cursor and other AI assistants run Google&apos;s Lighthouse speed test, understand the results and
                fix what matters most, right from the chat.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href="#demo" className="bg-brand px-5 py-3 text-sm font-semibold text-brand-ink transition-opacity hover:opacity-90">
                  See it fix a slow page
                </a>
                <a href="#install" className="border border-rule px-5 py-[11px] text-sm font-semibold transition-colors hover:bg-bg-2">
                  Install free
                </a>
              </div>
            </div>
          </div>
          <div className="mt-12">
            <LoadRace results={mobile} />
          </div>
        </section>

        {/* How it works */}
        <section className="bg-bg-2 py-16">
          <div className={wrap}>
            <div className="grid gap-6 lg:grid-cols-[1fr_2fr] lg:items-end">
              <h2 className="display text-5xl uppercase sm:text-6xl">How it works</h2>
              <p className="max-w-2xl leading-relaxed text-ink-2">
                Slow pages lose visitors and rank lower in search. Google&apos;s Lighthouse explains why, but in a long
                technical report. PerfLens runs it for your AI assistant and hands back only what matters, ranked, so the
                assistant can explain it and make the changes.
              </p>
            </div>
            <div className="mt-10">
              <Flow />
            </div>
          </div>
        </section>

        {/* Demo on the dark timing band */}
        <section id="demo" className="scroll-mt-4 bg-night py-16 text-night-ink sm:py-20">
          <div className={wrap}>
            <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr] lg:items-end">
              <h2 className="display text-5xl uppercase sm:text-6xl">
                One page.
                <br />
                Audited. <span className="text-night-brand">Fixed.</span>
              </h2>
              <p className="leading-relaxed text-night-dim">
                I built a small coffee shop page with mistakes that are common on real sites: a huge hero image loaded late,
                heavy JavaScript, a banner that pushes content down. PerfLens audited it and ranked the fixes; the fixed
                version applies them. Same content, same design.
              </p>
            </div>
            <div className="mt-10">
              <DemoReport data={data} />
            </div>
          </div>
        </section>

        {/* In the editor */}
        <section className={`${wrap} py-16 sm:py-20`}>
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-14">
            <div>
              <h2 className="display text-5xl uppercase sm:text-6xl">In your editor</h2>
              <p className="mt-4 leading-relaxed text-ink-2">
                There&apos;s no dashboard to learn. PerfLens gives your assistant four tools, and you just ask questions.
              </p>
              <dl className="mt-8 border-t border-rule">
                {TOOLS.map((t) => (
                  <div key={t.name} className="border-b border-hair py-4">
                    <dt className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <span className="font-mono text-sm font-semibold text-brand">{t.name}</span>
                      <span className="text-sm italic text-ink-3">“{t.ask}”</span>
                    </dt>
                    <dd className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{t.what}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="lg:pt-2">
              <Transcript results={mobile} heroBytes={data.slowHeroBytes} />
            </div>
          </div>
        </section>

        {/* Install */}
        <section id="install" className="scroll-mt-4 border-t border-rule">
          <div className={`${wrap} grid gap-10 py-16 sm:py-20 lg:grid-cols-[1fr_1.4fr] lg:gap-14`}>
            <div>
              <h2 className="display text-5xl uppercase sm:text-6xl">Install</h2>
              <p className="mt-4 leading-relaxed text-ink-2">
                Free and open source. Runs on your own machine with no account or API key, and audits public sites and
                local development servers alike. Needs Node.js 20+ and Chrome, Chromium or Edge.
              </p>
              <p className="mt-4 text-sm text-ink-3">
                Then try: <em>“audit localhost:3000 on mobile and tell me what to fix first.”</em>
              </p>
            </div>
            <InstallTabs />
          </div>
        </section>
      </main>

      <footer className="border-t border-rule">
        <div className={`${wrap} flex flex-col gap-3 py-6 text-sm sm:flex-row sm:items-center sm:justify-between`}>
          <p className="text-ink-2">
            Built by{" "}
            <a href={LINKS.portfolio} className="font-semibold text-ink underline decoration-brand decoration-2 underline-offset-4">
              Anubhav Utkarsh
            </a>
            . MIT licensed.
          </p>
          <div className="flex gap-5 font-medium">
            <a href={LINKS.github} className="hover:text-brand">
              GitHub
            </a>
            <a href={LINKS.npm} className="hover:text-brand">
              npm
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
