import { PLAIN, RATING_LABEL, THRESHOLDS, formatValue } from "@/lib/metrics";
import type { Device, MetricId, Rating } from "@/lib/types";

const FILL: Record<Rating, string> = {
  good: "bg-night-good",
  "needs-improvement": "bg-night-needs",
  poor: "bg-night-poor",
};
const TEXT: Record<Rating, string> = {
  good: "text-night-good",
  "needs-improvement": "text-night-needs",
  poor: "text-night-poor",
};

interface Reading {
  value: number;
  rating: Rating;
}

/**
 * A metric as timing bars on the dark band: a thin "before" bar, a thick "after" bar,
 * and tick marks where "good" ends and "poor" begins. Lower is better for every metric.
 */
export function MetricBar({ id, device, before, after }: { id: MetricId; device: Device; before?: Reading; after: Reading }) {
  const t = THRESHOLDS[id][device];
  const max = Math.max(after.value, before?.value ?? 0, t.poor * 1.3);
  const pct = (v: number) => `${Math.max(0.6, (v / max) * 100)}%`;
  const plain = PLAIN[id];

  return (
    // Mobile: name and values on one row, bar below. Wider screens: name | bar | values.
    <div className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-3 py-4 sm:grid-cols-[200px_1fr_150px] sm:items-center">
      <div className="col-start-1 row-start-1">
        <div className="font-mono text-sm font-medium text-night-ink">{id}</div>
        <div className="text-sm leading-snug text-night-dim">{plain.question}</div>
      </div>

      <div
        className="relative col-span-2 row-start-2 mb-5 py-1 sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:mb-4"
        role="img"
        aria-label={`${plain.name}: ${before ? `before ${formatValue(id, before.value)} (${RATING_LABEL[before.rating]}), ` : ""}${
          before ? "after " : ""
        }${formatValue(id, after.value)} (${RATING_LABEL[after.rating]}). Good is ${formatValue(id, t.good)} or less.`}
      >
        {before ? (
          <div className="relative mb-1.5 h-1.5 bg-night-line">
            <div className={`absolute inset-y-0 left-0 opacity-60 ${FILL[before.rating]}`} style={{ width: pct(before.value) }} />
          </div>
        ) : null}
        <div className="relative h-3.5 bg-night-line">
          <div className={`absolute inset-y-0 left-0 ${FILL[after.rating]}`} style={{ width: pct(after.value) }} />
        </div>
        {/* threshold ticks; when the scale squeezes them together, one combined label */}
        {(() => {
          const close = ((t.poor - t.good) / max) * 100 < 22;
          const ticks = [
            { v: t.good, label: close ? `good ≤ ${formatValue(id, t.good)} · poor > ${formatValue(id, t.poor)}` : `good ≤ ${formatValue(id, t.good)}` },
            { v: t.poor, label: close ? "" : `poor > ${formatValue(id, t.poor)}` },
          ];
          return ticks.map((tick) => (
            <div key={tick.v} className="absolute -bottom-4 top-0 w-px bg-night-dim/60" style={{ left: `${(tick.v / max) * 100}%` }}>
              {tick.label ? (
                <span
                  className={`absolute top-full mt-0.5 whitespace-nowrap font-mono text-[10px] text-night-dim ${
                    (tick.v / max) * 100 < 12 ? "left-0" : "-translate-x-1/2"
                  }`}
                >
                  {tick.label}
                </span>
              ) : null}
            </div>
          ));
        })()}
      </div>

      <div className="col-start-2 row-start-1 flex items-baseline justify-end gap-2 self-center sm:col-start-3">
        {before ? (
          <span className={`num font-mono text-sm line-through decoration-1 opacity-70 ${TEXT[before.rating]}`}>
            {formatValue(id, before.value)}
          </span>
        ) : null}
        <span className={`display num text-3xl ${TEXT[after.rating]}`}>{formatValue(id, after.value)}</span>
      </div>
    </div>
  );
}
