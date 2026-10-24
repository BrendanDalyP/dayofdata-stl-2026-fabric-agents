import * as d3 from "d3";

import { C, fmtEurShort, useSize } from "./common";

export interface GapRow<T = unknown> {
    key: string;
    label: string;
    /** Gap to plan: % by default, or euros when the chart's unit is "eur" (negative = below plan). */
    gap: number;
    /** Text after the bar; defaults to the signed % or euros. */
    value?: string;
    tip: string;
    item: T;
}

const ROW = 26;   // minimum row height, px
const FONT = 12;

/**
 * Diverging bars around zero, worst first, readable at any card size:
 * rows never shrink below 26px with 12px text. If they don't all fit, the largest gaps at both
 * ends are shown with a "… N more" line between them (hover still names every row shown).
 */
/** `fit`: "ends" keeps the largest gaps at both ends when rows don't fit; "top" keeps the first rows (for a list that is already a top-N). */
export function GapBars<T>({ rows, onSelect, label, unit = "pct", fit: mode = "ends" }: { rows: GapRow<T>[]; onSelect?: (item: T) => void; label: string; unit?: "pct" | "eur"; fit?: "ends" | "top" }) {
    const [ref, { width, height }] = useSize<HTMLDivElement>({ width: 400, height: 200 });
    const sorted = [...rows].sort((a, b) => a.gap - b.gap);
    const fit = Math.max(3, Math.floor(height / ROW));
    let shown: Array<GapRow<T> | { more: number }> = sorted;
    if (sorted.length > fit && mode === "top") {
        shown = sorted.slice(0, fit);
    } else if (sorted.length > fit) {
        const keep = fit - 1, low = Math.ceil(keep / 2), high = keep - low;
        shown = [...sorted.slice(0, low), { more: sorted.length - keep }, ...sorted.slice(sorted.length - high)];
    }
    const rowH = Math.min(36, height / shown.length);
    const labelW = Math.min(180, width * 0.38);
    const valueW = 72;
    const maxAbs = d3.max(shown, (d) => ("more" in d ? 0 : Math.abs(d.gap))) || 1;
    const lim = unit === "pct" ? Math.min(100, maxAbs) : maxAbs;
    const x = d3.scaleLinear().domain([-lim, lim]).range([labelW, width - valueW]).clamp(true);
    const barH = Math.min(16, rowH * 0.55);
    const fmt = (g: number) => (unit === "pct" ? `${g >= 0 ? "+" : "−"}${Math.abs(g).toFixed(1)}%` : `${g >= 0 ? "+" : ""}${fmtEurShort(g)}`);

    return (
        <div ref={ref} className="h-full min-h-0 overflow-hidden">
            <svg width={width} height={height} role="img" aria-label={label} style={{ fontSize: FONT }}>
                <line x1={x(0)} x2={x(0)} y1={0} y2={shown.length * rowH} stroke="var(--axis)" />
                {shown.map((d, i) => "more" in d ? (
                    <text key="more" x={labelW - 8} y={i * rowH + rowH / 2} dy="0.35em" textAnchor="end" className="fill-muted-foreground" fontStyle="italic">
                        … {d.more} more in between
                    </text>
                ) : (
                    <g key={d.key} transform={`translate(0,${i * rowH})`} className={onSelect ? "cursor-pointer" : undefined} onClick={() => onSelect?.(d.item)}>
                        <title>{d.tip}</title>
                        <rect x={0} y={0} width={width} height={rowH} fill="transparent" className="hover:fill-[var(--grid)]" />
                        <text x={labelW - 8} y={rowH / 2} dy="0.35em" textAnchor="end" className="fill-foreground">{d.label}</text>
                        <rect x={Math.min(x(0), x(d.gap))} y={(rowH - barH) / 2} width={Math.max(2, Math.abs(x(d.gap) - x(0)))} height={barH} rx={2}
                            fill={d.gap < 0 ? C.below : C.above} />
                        <text x={width - 2} y={rowH / 2} dy="0.35em" textAnchor="end" className="tabular" fontWeight={600}
                            style={{ fill: d.gap < 0 ? C.below : "var(--color-foreground)" }}>
                            {d.value ?? fmt(d.gap)}
                        </text>
                    </g>
                ))}
            </svg>
        </div>
    );
}
