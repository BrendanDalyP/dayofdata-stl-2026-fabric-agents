import * as d3 from "d3";

import type { Subject } from "@/queries/overview";
import { C, fmtEurShort, useSize } from "./common";

/**
 * Regions sorted by gap to budget (Jan–Jul), diverging bars around zero.
 * Easier to read than per-region bullets when budgets vary this much between regions.
 */
export function RegionGaps({ regions, onSelect }: { regions: Subject[]; onSelect: (s: Subject) => void }) {
    const [ref, { width, height }] = useSize<HTMLDivElement>();
    const rows = [...regions].map((r) => ({ r, g: (r.actualYtd / r.budgetYtd - 1) * 100 })).sort((a, b) => a.g - b.g);
    const labelW = Math.min(150, width * 0.36);
    const valueW = 58;
    const rowH = Math.max(15, Math.min(26, height / Math.max(1, rows.length)));
    const lim = Math.min(100, d3.max(rows, (d) => Math.abs(d.g)) ?? 10);
    const x = d3.scaleLinear().domain([-lim, lim]).range([labelW, width - valueW]).clamp(true);

    return (
        <div ref={ref} className="h-full min-h-0">
            <svg width={width} height={rows.length * rowH} role="img" aria-label="Regions by gap to budget, Jan–Jul 2022">
                <line x1={x(0)} x2={x(0)} y1={0} y2={rows.length * rowH} stroke="var(--axis)" />
                {rows.map(({ r, g }, i) => (
                    <g key={r.name} transform={`translate(0,${i * rowH})`} className="cursor-pointer" onClick={() => onSelect(r)}>
                        <title>{`${r.name}: ${fmtEurShort(r.actualYtd)} net sales vs ${fmtEurShort(r.budgetYtd)} budget (${g.toFixed(1)}%)`}</title>
                        <rect x={0} y={0} width={width} height={rowH} fill="transparent" />
                        <text x={labelW - 8} y={rowH / 2 + 4} textAnchor="end" className="fill-foreground text-200">{r.name.replace(" Region", "")}</text>
                        <rect x={Math.min(x(0), x(g))} y={rowH * 0.22} width={Math.max(1.5, Math.abs(x(g) - x(0)))} height={rowH * 0.56} rx={3}
                            fill={g < 0 ? C.below : C.above} />
                        {Math.abs(g) > lim && <text x={g < 0 ? labelW + 2 : width - valueW - 2} y={rowH / 2 + 4} textAnchor={g < 0 ? "start" : "end"} className="fill-white text-100 font-semibold">»</text>}
                        <text x={width - 2} y={rowH / 2 + 4} textAnchor="end" className="tabular text-200 font-semibold" style={{ fill: g < 0 ? C.below : "var(--color-foreground)" }}>
                            {g >= 0 ? "+" : ""}{g.toFixed(1)}%
                        </text>
                    </g>
                ))}
            </svg>
        </div>
    );
}
