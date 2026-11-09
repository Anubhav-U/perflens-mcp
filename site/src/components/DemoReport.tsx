"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import type { Device, DemoResults } from "@/lib/types";
import { FixList } from "./FixList";
import { MetricBar } from "./MetricBar";

const VIEWS = [
  { id: "result", label: "Before vs after" },
  { id: "found", label: "Fixes found" },
  { id: "after", label: "After" },
] as const;
type ViewId = (typeof VIEWS)[number]["id"];

function scoreTone(score: number | null) {
  const v = score ?? 0;
  return v >= 90 ? "text-night-good" : v >= 50 ? "text-night-needs" : "text-night-poor";
}

/** Square, high-contrast segmented control used for both view and device. */
function Segmented<T extends string>({
  label,
  role,
  options,
  value,
  onChange,
  idPrefix,
}: {
  label: string;
  role: "tablist" | "radiogroup";
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  idPrefix?: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const isTabs = role === "tablist";

  function onKey(e: KeyboardEvent<HTMLButtonElement>) {
    const i = options.findIndex((o) => o.id === value);
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = options[(i + step + options.length) % options.length]!;
    onChange(next.id);
    refs.current[next.id]?.focus();
  }

  return (
    <div role={role} aria-label={label} className="inline-flex border border-night-line">
      {options.map((o) => {
        const selected = value === o.id;
        return (
          <button
            key={o.id}
            ref={(el) => {
              refs.current[o.id] = el;
            }}
            type="button"
            role={isTabs ? "tab" : "radio"}
            id={idPrefix ? `${idPrefix}-${o.id}` : undefined}
            aria-selected={isTabs ? selected : undefined}
            aria-checked={isTabs ? undefined : selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.id)}
            onKeyDown={onKey}
            className={`whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
              selected ? "bg-night-ink text-night" : "text-night-dim hover:bg-night-2 hover:text-night-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function DemoReport({ data }: { data: DemoResults }) {
  const [device, setDevice] = useState<Device>("mobile");
  const [view, setView] = useState<ViewId>("result");
  const baseId = useId();
  const d = data.devices[device];
  const slow = d.slow.summary;
  const fast = d.fast.summary;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented label="Report view" role="tablist" options={VIEWS} value={view} onChange={setView} idPrefix={`${baseId}-tab`} />
        <Segmented
          label="Device"
          role="radiogroup"
          options={[
            { id: "mobile", label: "Mobile" },
            { id: "desktop", label: "Desktop" },
          ]}
          value={device}
          onChange={setDevice}
        />
      </div>

      {/* Scoreboard */}
      <div className="mt-8 grid grid-cols-2 border-y border-night-line sm:grid-cols-[1fr_1fr_2fr]">
        <div className="border-r border-night-line py-5 pr-4">
          <div className="font-mono text-[11px] uppercase text-night-dim">Score before</div>
          <div className={`display num mt-1 text-7xl sm:text-8xl ${scoreTone(slow.performanceScore)}`}>{slow.performanceScore}</div>
        </div>
        <div className="py-5 pl-4 sm:border-r sm:border-night-line sm:pr-4">
          <div className="font-mono text-[11px] uppercase text-night-dim">Score after</div>
          <div className={`display num mt-1 text-7xl sm:text-8xl ${scoreTone(fast.performanceScore)}`}>{fast.performanceScore}</div>
        </div>
        <p className="col-span-2 border-t border-night-line py-5 text-sm leading-relaxed text-night-dim sm:col-span-1 sm:border-t-0 sm:pl-6">
          Lighthouse performance score, out of 100, on a simulated {device === "mobile" ? "mid-range phone on 4G" : "desktop"}.
          90 and above is good. Real Lighthouse {data.lighthouseVersion} runs, median of {data.runsPerAudit}; lab results
          vary a little between runs.
        </p>
      </div>

      <div id={`${baseId}-panel`} role="tabpanel" aria-labelledby={`${baseId}-tab-${view}`} className="mt-6">
        {view === "result" ? (
          <div>
            <p className="font-mono text-xs text-night-dim">
              Thin bar: before. Thick bar: after. Shorter is better; ticks mark where “good” ends and “poor” begins.
            </p>
            <div className="mt-2 divide-y divide-night-line">
              {d.comparison.metrics.map((m) => (
                <MetricBar
                  key={m.id}
                  id={m.id}
                  device={device}
                  before={{ value: m.a, rating: m.ratingA }}
                  after={{ value: m.b, rating: m.ratingB }}
                />
              ))}
            </div>
          </div>
        ) : null}

        {view === "found" ? (
          <div>
            <p className="max-w-2xl text-sm leading-relaxed text-night-dim">
              What PerfLens told the assistant to fix on the slow page ({device}), best value first. Open one to see why it
              matters, the steps, and what it found on the page. These are the changes behind the fixed version.
            </p>
            <div className="mt-5">
              <FixList fixes={d.slow.fixes.fixes} />
            </div>
          </div>
        ) : null}

        {view === "after" ? (
          <div>
            <p className="max-w-2xl text-sm leading-relaxed text-night-dim">
              {d.fast.fixes.note ?? "Only minor suggestions remain."}
            </p>
            <div className="mt-2 divide-y divide-night-line">
              {fast.metrics.map((m) => (
                <MetricBar key={m.id} id={m.id} device={device} after={{ value: m.value, rating: m.rating }} />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href="/demo/slow.html"
          className="border border-night-line px-4 py-2 text-sm text-night-ink transition-colors hover:border-night-dim"
        >
          Open the slow page ↗
        </a>
        <a
          href="/demo/fast.html"
          className="border border-night-line px-4 py-2 text-sm text-night-ink transition-colors hover:border-night-dim"
        >
          Open the fixed page ↗
        </a>
      </div>
    </div>
  );
}
