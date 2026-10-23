import * as d3 from "d3";

import type { Subject } from "@/queries/overview";
import { C, fmtEurShort, useWidth } from "./common";

/**
 * Bullet charts: Jan–Jul 2022 net sales (bar) against budget (tick) per region,
 * with 90% / 100% / 110% budget bands behind each bar.
 */
export function RegionBullets({ regions, focus, onSelect }: { regions: Subject[]; focus?: string; onSelect: (s: Subject) => void }) {
    const [ref, width] = useWidth<HTMLDivElement>(420);
    const rows = [...regions].sort((a, b) => b.budgetYtd - a.budgetYtd);
    const labelW = Math.min(150, width * 0.36);
    const valueW = 58;
    const rowH = 24;
    const max = d3.max(rows, (r) => Math.max(r.actualYtd, r.budgetYtd * 1.1)) ?? 1;
    const x = d3.scaleLinear().domain([0, max]).range([0, width - labelW - valueW - 8]);

    return (
        <div ref={ref}>
            <svg width={width} height={rows.length * rowH + 4} role="img" aria-label="Net sales against budget by region, Jan–Jul 2022">
                {rows.map((r, i) => {
                    const y = i * rowH;
                    const g = (r.actualYtd / r.budgetYtd - 1) * 100;
                    const isFocus = focus === r.name;
                    return (
                        <g key={r.name} transform={`translate(0,${y})`} className="cursor-pointer" onClick={() => onSelect(r)}>
                            <title>{`${r.name}: ${fmtEurShort(r.actualYtd)} vs budget ${fmtEurShort(r.budgetYtd)} (${g.toFixed(1)}%)`}</title>
                            <text x={labelW - 6} y={rowH / 2 + 3} textAnchor="end" className={isFocus ? "fill-emphasis-foreground text-200 font-semibold" : "fill-foreground text-200"}>
                                {r.name.replace(" Region", "")}
                            </text>
                            <g transform={`translate(${labelW},0)`}>
                                <rect x={0} y={4} width={x(r.budgetYtd * 1.1)} height={rowH - 8} className="fill-muted" rx={2} />
                                <rect x={0} y={4} width={x(r.budgetYtd)} height={rowH - 8} className="fill-muted" opacity={0.9} rx={2} />
                                <rect x={0} y={4} width={x(r.budgetYtd * 0.9)} height={rowH - 8} className="fill-border" opacity={0.6} rx={2} />
                                <rect x={0} y={8} width={x(r.actualYtd)} height={rowH - 16} fill={g < 0 ? C.red : C.blue} rx={1} />
                                <line x1={x(r.budgetYtd)} x2={x(r.budgetYtd)} y1={3} y2={rowH - 3} stroke={C.yellow} strokeWidth={2.5} />
                                <text x={width - labelW - 4} y={rowH / 2 + 3} textAnchor="end"
                                    className={g < 0 ? "fill-destructive font-numeric text-100" : "fill-brand-foreground font-numeric text-100"}>
                                    {g >= 0 ? "+" : ""}{g.toFixed(1)}%
                                </text>
                            </g>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}
