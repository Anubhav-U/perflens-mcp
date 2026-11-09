import { formatBytes } from "@/lib/metrics";
import type { Evidence, Fix } from "@/lib/types";

const PRIORITY: Record<Fix["priority"], string> = {
  high: "border-night-poor text-night-poor",
  medium: "border-night-needs text-night-needs",
  low: "border-night-line text-night-dim",
};

function evidenceDetail(e: Evidence): string | null {
  if (e.wastedBytes) return `${formatBytes(e.wastedBytes)} could be saved`;
  if (e.timeMs) return `${Math.round(e.timeMs)} ms`;
  if (e.totalBytes) return formatBytes(e.totalBytes);
  return null;
}

/** Ranked fixes on the dark band, as expandable rows with timing-board rank numbers. */
export function FixList({ fixes }: { fixes: Fix[] }) {
  return (
    <ol className="border-t border-night-line">
      {fixes.map((fix) => (
        <li key={fix.key} className="border-b border-night-line">
          <details className="group">
            <summary className="grid list-none grid-cols-[2.5rem_1fr_auto] items-center gap-x-4 py-4 transition-colors hover:bg-night-2 sm:grid-cols-[3.5rem_1fr_auto_auto]">
              <span className="display num text-4xl text-night-dim group-open:text-night-brand sm:text-5xl">
                {String(fix.rank).padStart(2, "0")}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold leading-snug text-night-ink">{fix.title}</span>
                <span className="mt-0.5 block font-mono text-xs text-night-dim">{fix.estimatedImpact}</span>
              </span>
              <span className={`hidden border px-2 py-0.5 font-mono text-[11px] uppercase sm:inline ${PRIORITY[fix.priority]}`}>
                {fix.priority}
              </span>
              <span className="grid size-7 place-items-center border border-night-line font-mono text-night-dim" aria-hidden="true">
                <span className="transition-transform group-open:rotate-45">+</span>
              </span>
            </summary>
            <div className="pb-6 pl-[3.5rem] pr-2 text-sm leading-relaxed text-night-dim sm:pl-[4.5rem]">
              <p className="text-night-ink/90">
                {fix.why}{" "}
                <span className="font-mono text-xs text-night-dim">
                  [{fix.priority} priority · {fix.effort} effort]
                </span>
              </p>
              <ol className="mt-3 space-y-1.5">
                {fix.steps.map((step, i) => (
                  <li key={step} className="grid grid-cols-[1.5rem_1fr]">
                    <span className="font-mono text-night-brand">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              {fix.evidence.length > 0 ? (
                <div className="mt-4 border-l-2 border-night-brand pl-3">
                  <div className="font-mono text-[11px] uppercase text-night-dim">Found on the page</div>
                  <ul className="mt-1 space-y-0.5">
                    {fix.evidence.map((e) => (
                      <li key={e.label} className="flex flex-wrap gap-x-2 font-mono text-xs">
                        <span className="break-all text-night-ink">{e.label}</span>
                        {evidenceDetail(e) ? <span>{evidenceDetail(e)}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </details>
        </li>
      ))}
    </ol>
  );
}
