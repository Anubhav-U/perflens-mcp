import { formatValue } from "@/lib/metrics";
import type { DeviceResults } from "@/lib/types";

/**
 * Hero visual: the slow and fixed demo pages "racing" to show their main content (LCP),
 * on a linear time axis. Linear on purpose: the gap is the message.
 */
export function LoadRace({ results }: { results: DeviceResults }) {
  const lcp = (s: DeviceResults["slow"]["summary"]) => s.metrics.find((m) => m.id === "LCP")!.value;
  const fcp = (s: DeviceResults["slow"]["summary"]) => s.metrics.find((m) => m.id === "FCP")!.value;
  const slowLcp = lcp(results.slow.summary);
  const fastLcp = lcp(results.fast.summary);
  const maxSeconds = Math.max(10, Math.ceil(slowLcp / 1000 / 5) * 5);
  const pct = (ms: number) => `${Math.min(100, (ms / (maxSeconds * 1000)) * 100)}%`;
  const ticks = Array.from({ length: maxSeconds / 5 + 1 }, (_, i) => i * 5);

  const lanes = [
    {
      key: "before",
      label: "Before",
      sub: `Score ${results.slow.summary.performanceScore}`,
      lcp: slowLcp,
      fcp: fcp(results.slow.summary),
      tone: "bg-poor",
      text: "text-poor",
      duration: "2.8s",
    },
    {
      key: "after",
      label: "After PerfLens fixes",
      sub: `Score ${results.fast.summary.performanceScore}`,
      lcp: fastLcp,
      fcp: fcp(results.fast.summary),
      tone: "bg-good",
      text: "text-good",
      duration: "0.5s",
    },
  ];

  return (
    <figure className="border-y border-rule">
      <div className="grid grid-cols-[1fr_auto] items-end gap-4 border-b border-hair py-3">
        <figcaption className="text-sm text-ink-2">
          <span className="font-semibold text-ink">Time until the main content appears</span> on a mid-range phone.
          Same page, before and after fixing what PerfLens found.
        </figcaption>
        <span className="hidden font-mono text-xs text-ink-3 sm:block">Lighthouse LCP · seconds</span>
      </div>

      <div className="space-y-5 py-6">
        {lanes.map((lane) => (
          <div key={lane.key} className="grid gap-2 sm:grid-cols-[150px_1fr] sm:items-center sm:gap-5">
            <div className="flex items-baseline justify-between sm:block">
              <div className="font-semibold leading-tight">{lane.label}</div>
              <div className="font-mono text-xs text-ink-3">{lane.sub}</div>
            </div>
            <div className="relative h-11">
              {/* track */}
              <div className="absolute inset-y-0 left-0 right-0 bg-bg-2" />
              {/* fill */}
              <div
                className={`lane-fill absolute inset-y-0 left-0 ${lane.tone}`}
                style={{ width: pct(lane.lcp), ["--lane-duration" as string]: lane.duration }}
              />
              {/* first paint tick */}
              <div
                className="absolute inset-y-0 w-0.5 bg-bg/70"
                style={{ left: pct(lane.fcp) }}
                title={`First content at ${formatValue("FCP", lane.fcp)}`}
              />
              {/* finish label: inside the end of a long bar, just past the end of a short one */}
              {lane.lcp / 1000 > maxSeconds * 0.6 ? (
                <div
                  className="lane-label display num absolute inset-y-0 flex items-center justify-end pr-3 text-3xl text-white sm:text-4xl"
                  style={{ width: pct(lane.lcp), ["--lane-duration" as string]: lane.duration }}
                >
                  {formatValue("LCP", lane.lcp)}
                </div>
              ) : (
                <div
                  className={`lane-label display num absolute inset-y-0 flex items-center pl-3 text-3xl sm:text-4xl ${lane.text}`}
                  style={{ left: pct(lane.lcp), ["--lane-duration" as string]: lane.duration }}
                >
                  {formatValue("LCP", lane.lcp)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-[150px_1fr] sm:gap-5">
        <div />
        <div className="relative h-6 border-t border-hair font-mono text-[11px] text-ink-3">
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute top-1 -translate-x-1/2 first:translate-x-0 last:-translate-x-full"
              style={{ left: `${(t / maxSeconds) * 100}%` }}
            >
              {t}s
            </span>
          ))}
        </div>
      </div>
    </figure>
  );
}
