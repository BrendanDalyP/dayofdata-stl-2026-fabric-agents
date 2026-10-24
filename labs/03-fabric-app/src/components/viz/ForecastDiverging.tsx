import * as d3 from "d3";

import type { ForecastRow } from "@/queries/overview";
import { C, fmtEurShort, useWidth } from "./common";

/** 2022 forecast against budget by product type: diverging bars around zero, euros and %. */
export function ForecastDiverging({ rows, onSelect }: { rows: ForecastRow[]; onSelect: (r: ForecastRow) => void }) {
    const [ref, width] = useWidth<HTMLDivElement>(420);
    const data = [...rows].map((r) => ({ ...r, gap: r.forecast - r.budget, pct: (r.forecast / r.budget - 1) * 100 })).sort((a, b) => a.gap - b.gap);
    const labelW = Math.min(130, width * 0.32);
    const rowH = 22;
    const max = d3.max(data, (d) => Math.abs(d.gap)) ?? 1;
    const x = d3.scaleLinear().domain([-max, max]).range([labelW, width - 8]);

    return (
        <div ref={ref}>
            <svg width={width} height={data.length * rowH + 6} role="img" aria-label="2022 forecast against budget by product type">
                <line x1={x(0)} x2={x(0)} y1={0} y2={data.length * rowH} className="stroke-border" />
                {data.map((d, i) => (
                    <g key={d.productType} transform={`translate(0,${i * rowH})`} className="cursor-pointer" onClick={() => onSelect(d)}>
                        <title>{`${d.productType}: forecast ${fmtEurShort(d.forecast)} vs budget ${fmtEurShort(d.budget)} (${d.pct.toFixed(1)}%)`}</title>
                        <text x={labelW - 6} y={rowH / 2 + 3} textAnchor="end" className="fill-foreground text-200">{d.productType}</text>
                        <rect x={Math.min(x(0), x(d.gap))} y={4} width={Math.abs(x(d.gap) - x(0))} height={rowH - 8} rx={2} fill={d.gap < 0 ? C.below : C.above} opacity={0.85} />
                        <text x={d.gap < 0 ? x(0) + 4 : x(0) - 4} y={rowH / 2 + 3} textAnchor={d.gap < 0 ? "start" : "end"} className="fill-muted-foreground font-numeric text-100">
                            {d.pct >= 0 ? "+" : ""}{d.pct.toFixed(1)}%
                        </text>
                    </g>
                ))}
            </svg>
        </div>
    );
}
