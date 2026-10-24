import * as d3 from "d3";

import { C, useSize } from "./common";

export interface GapRow<T = unknown> {
    key: string;
    label: string;
    /** Gap in % (negative = below plan). */
    gap: number;
    /** Text after the bar; defaults to the signed %. */
    value?: string;
    tip: string;
    item: T;
}

/**
 * Diverging bars around zero, sorted worst first, that always fit their container:
 * row height = available height / rows (never overflowing the card). Labels shrink with the rows.
 */
export function GapBars<T>({ rows, onSelect, label }: { rows: GapRow<T>[]; onSelect?: (item: T) => void; label: string }) {
    const [ref, { width, height }] = useSize<HTMLDivElement>({ width: 400, height: 200 });
    const sorted = [...rows].sort((a, b) => a.gap - b.gap);
    const n = Math.max(1, sorted.length);
    const rowH = height / n;
    const font = Math.max(10, Math.min(13, rowH * 0.72));
    const labelW = Math.min(170, width * 0.38);
    const valueW = 60;
    const lim = Math.min(100, d3.max(sorted, (d) => Math.abs(d.gap)) ?? 10) || 10;
    const x = d3.scaleLinear().domain([-lim, lim]).range([labelW, width - valueW]).clamp(true);
    const barH = Math.max(3, Math.min(14, rowH * 0.58));

    return (
        <div ref={ref} className="h-full min-h-0 overflow-hidden">
            <svg width={width} height={height} role="img" aria-label={label}>
                <line x1={x(0)} x2={x(0)} y1={0} y2={height} stroke="var(--axis)" />
                {sorted.map((d, i) => (
                    <g key={d.key} transform={`translate(0,${i * rowH})`} className={onSelect ? "cursor-pointer" : undefined} onClick={() => onSelect?.(d.item)}>
                        <title>{d.tip}</title>
                        <rect x={0} y={0} width={width} height={rowH} fill="transparent" className="hover:fill-[var(--grid)]" />
                        <text x={labelW - 8} y={rowH / 2} dy="0.35em" textAnchor="end" className="fill-foreground" style={{ fontSize: font }}>{d.label}</text>
                        <rect x={Math.min(x(0), x(d.gap))} y={(rowH - barH) / 2} width={Math.max(1.5, Math.abs(x(d.gap) - x(0)))} height={barH} rx={Math.min(3, barH / 2)}
                            fill={d.gap < 0 ? C.below : C.above} />
                        <text x={width - 2} y={rowH / 2} dy="0.35em" textAnchor="end" className="tabular font-semibold"
                            style={{ fontSize: font, fill: d.gap < 0 ? C.below : "var(--color-foreground)" }}>
                            {d.value ?? `${d.gap >= 0 ? "+" : ""}${d.gap.toFixed(1)}%`}
                        </text>
                    </g>
                ))}
            </svg>
        </div>
    );
}
