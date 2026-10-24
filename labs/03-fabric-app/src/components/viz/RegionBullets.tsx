import * as d3 from "d3";

import type { Subject } from "@/queries/overview";
import { C, fmtEurShort, useSize } from "./common";

/**
 * Bullet charts: Jan–Jul 2022 net sales (bar) against budget (ink tick) per region,
 * with a 90–110% band behind each bar. Rows share the container height.
 */
export function RegionBullets({ regions, onSelect }: { regions: Subject[]; onSelect: (s: Subject) => void }) {
    const [ref, { width, height }] = useSize<HTMLDivElement>();
    const rows = [...regions].sort((a, b) => b.budgetYtd - a.budgetYtd);
    const labelW = Math.min(132, width * 0.34);
    const valueW = 52;
    const rowH = Math.max(14, Math.min(24, height / Math.max(1, rows.length)));
    const max = d3.max(rows, (r) => Math.max(r.actualYtd, r.budgetYtd * 1.1)) ?? 1;
    const x = d3.scaleLinear().domain([0, max]).range([0, Math.max(40, width - labelW - valueW - 8)]);
    const barH = Math.max(4, rowH * 0.36);

    return (
        <div ref={ref} className="h-full min-h-0 overflow-hidden">
            <svg width={width} height={rows.length * rowH} role="img" aria-label="Net sales against budget by region, Jan–Jul 2022">
                {rows.map((r, i) => {
                    const g = (r.actualYtd / r.budgetYtd - 1) * 100;
                    return (
                        <g key={r.name} transform={`translate(0,${i * rowH})`} className="cursor-pointer" onClick={() => onSelect(r)}>
                            <title>{`${r.name}: ${fmtEurShort(r.actualYtd)} vs budget ${fmtEurShort(r.budgetYtd)} (${g.toFixed(1)}%)`}</title>
                            <rect x={0} y={0} width={width} height={rowH} fill="transparent" />
                            <text x={labelW - 8} y={rowH / 2 + 4} textAnchor="end" className="fill-foreground text-200">{r.name.replace(" Region", "")}</text>
                            <g transform={`translate(${labelW},0)`}>
                                <rect x={x(r.budgetYtd * 0.9)} y={rowH / 2 - barH} width={x(r.budgetYtd * 1.1) - x(r.budgetYtd * 0.9)} height={barH * 2} fill="var(--color-muted)" rx={2} />
                                <rect x={0} y={rowH / 2 - barH / 2} width={x(r.actualYtd)} height={barH} rx={2} fill={g < 0 ? C.below : C.series} />
                                <line x1={x(r.budgetYtd)} x2={x(r.budgetYtd)} y1={rowH / 2 - barH * 1.1} y2={rowH / 2 + barH * 1.1} stroke={C.plan} strokeWidth={2} />
                            </g>
                            <text x={width - 4} y={rowH / 2 + 4} textAnchor="end" className="tabular text-100 font-semibold" style={{ fill: g < 0 ? C.below : "var(--color-foreground)" }}>
                                {g >= 0 ? "+" : ""}{g.toFixed(1)}%
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}
