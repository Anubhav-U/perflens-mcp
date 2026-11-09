import { formatBytes, formatValue } from "@/lib/metrics";
import type { DeviceResults } from "@/lib/types";

function Tool({ name, args }: { name: string; args: string }) {
  return (
    <p>
      <span className="bg-[#2a43e8] px-1.5 py-0.5 text-[11px] font-medium text-white">perflens</span>{" "}
      <span className="text-code-ink">{name}</span>
      <span className="text-code-dim">({args})</span>
    </p>
  );
}

/**
 * A chat in an AI coding assistant using PerfLens. The conversation is illustrative;
 * every number in the tool results comes from the real demo audits (mobile).
 */
export function Transcript({ results, heroBytes }: { results: DeviceResults; heroBytes: number }) {
  const slow = results.slow.summary;
  const fast = results.fast.summary;
  const metric = (id: string, s = slow) => s.metrics.find((m) => m.id === id)!;
  const top = results.slow.fixes.fixes.slice(0, 3);
  const lcp = metric("LCP");

  return (
    <figure className="border border-rule bg-code-bg text-code-ink">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 font-mono text-[11px] uppercase text-code-dim">
        <span>Chat · AI coding assistant</span>
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 bg-night-good" aria-hidden="true" />
          perflens connected
        </span>
      </div>
      <div className="space-y-4 px-4 py-5 font-mono text-[12.5px] leading-relaxed sm:px-5">
        <p className="text-code-ink">
          <span className="text-code-dim">&gt;</span> Why is /demo/slow.html so slow on phones? Fix the worst problems.
        </p>

        <div className="space-y-1">
          <Tool name="audit_url" args={`"/demo/slow.html", mobile`} />
          <p className="pl-3 text-code-dim">
            score <span className="text-night-poor">{slow.performanceScore}/100</span> · LCP{" "}
            <span className="text-night-poor">{lcp.displayValue}</span> · TBT{" "}
            <span className="text-night-poor">{metric("TBT").displayValue}</span> · CLS{" "}
            <span className="text-night-needs">{metric("CLS").displayValue}</span>
          </p>
        </div>

        <div className="space-y-1">
          <Tool name="suggest_fixes" args="audit" />
          <ol className="pl-3">
            {top.map((f) => (
              <li key={f.key}>
                <span className="text-code-dim">{f.rank}.</span> {f.title}{" "}
                <span className="text-code-dim">· {f.estimatedImpact}</span>
              </li>
            ))}
          </ol>
        </div>

        <p className="border-l-2 border-night-brand pl-3 font-sans text-[14px] leading-relaxed text-code-ink">
          On a phone, the main image shows up after <strong>{formatValue("LCP", lcp.value)}</strong>. It&apos;s a {formatBytes(heroBytes)}{" "}
          PNG that JavaScript adds late and lazy-loads. I&apos;ll put it in the HTML as a small AVIF with high priority,
          reserve space for the banner, and defer the blocking script…
        </p>

        <div className="space-y-1">
          <Tool name="compare_urls" args="before, after" />
          <p className="pl-3 text-code-dim">
            score {slow.performanceScore} → <span className="text-night-good">{fast.performanceScore}</span> · LCP{" "}
            {lcp.displayValue} → <span className="text-night-good">{metric("LCP", fast).displayValue}</span> · CLS{" "}
            {metric("CLS").displayValue} → <span className="text-night-good">{metric("CLS", fast).displayValue}</span>
          </p>
        </div>
      </div>
      <figcaption className="border-t border-white/10 px-4 py-2 text-[11px] text-code-dim sm:px-5">
        Illustrative chat. Tool results are the real audit numbers from the demo.
      </figcaption>
    </figure>
  );
}
