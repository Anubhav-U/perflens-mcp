const NODES = [
  { name: "You", detail: "Ask in plain English: “why is this page slow?”", brand: false },
  { name: "Your AI assistant", detail: "Claude Code, Cursor or another MCP client calls PerfLens.", brand: false },
  { name: "PerfLens", detail: "Runs the test, keeps what matters, ranks the fixes.", brand: true },
  { name: "Chrome + Lighthouse", detail: "Google's speed test, in a hidden browser on your machine.", brand: false },
];

/** How a request travels, left to right; the short answer travels back. */
export function Flow() {
  return (
    <div>
      <ol className="grid gap-0 md:grid-cols-4">
        {NODES.map((n, i) => (
          <li key={n.name} className="relative flex md:block">
            <div
              className={`flex-1 border p-4 md:min-h-36 ${
                n.brand ? "relative border-brand bg-brand text-brand-ink" : "border-rule bg-bg"
              } ${i > 0 ? "-mt-px md:-ml-px md:mt-0" : ""}`}
            >
              <div className="display text-2xl uppercase">{n.name}</div>
              <p className={`mt-2 text-sm leading-snug ${n.brand ? "opacity-90" : "text-ink-2"}`}>{n.detail}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-3 font-mono text-xs text-ink-3">
        <span>request</span>
        <span className="relative h-px bg-ink-3">
          <span className="absolute -top-[3px] right-0 size-0 border-y-[3.5px] border-l-[6px] border-y-transparent border-l-ink-3" />
        </span>
        <span>audit</span>
      </div>
      <div className="mt-1 grid grid-cols-[auto_1fr_auto] items-center gap-3 font-mono text-xs text-ink-3">
        <span>short, ranked answer</span>
        <span className="relative h-px bg-ink-3">
          <span className="absolute -top-[3px] left-0 size-0 border-y-[3.5px] border-r-[6px] border-y-transparent border-r-ink-3" />
        </span>
        <span>results</span>
      </div>
    </div>
  );
}
