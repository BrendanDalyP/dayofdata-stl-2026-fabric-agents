import * as d3 from "d3";

import { C, fmtEurShort, useSize } from "./common";

export interface PlanMonth { month: Date; forecast: number; budget: number; actual?: number }

/**
 * 2022 by month on one euro axis, consulting style:
 * forecast = a light column; actual (Jan–Aug, August partial) = a narrower solid column inside it;
 * budget = a short dark marker across each month. No connecting lines.
 */
export function ForecastMonthly({ data, onSelect }: { data: PlanMonth[]; onSelect: (d: PlanMonth) => void }) {
    const [ref, { width, height }] = useSize<HTMLDivElement>({ width: 600, height: 260 });
    const m = { l: 56, r: 8, t: 26, b: 22 };
    const x = d3.scaleBand<Date>().domain(data.map((d) => d.month)).range([m.l, width - m.r]).paddingInner(0.3).paddingOuter(0.12);
    const max = d3.max(data, (d) => Math.max(d.forecast, d.budget, d.actual ?? 0)) ?? 1;
    const y = d3.scaleLinear().domain([0, max * 1.06]).range([height - m.b, m.t]).nice(4);
    const bw = x.bandwidth();
    const partial = (d: PlanMonth) => d.month.getUTCMonth() === 7;

    return (
        <div ref={ref} className="h-full min-h-0 overflow-hidden">
            <svg width={width} height={height} role="img" aria-label="2022 forecast, budget and actual net sales by month">
                <g transform={`translate(${m.l},12)`} className="text-100">
                    <rect width={10} height={10} y={-8} fill={C.seriesSoft} /><text x={14} className="fill-foreground">Forecast</text>
                    <rect x={78} width={10} height={10} y={-8} fill={C.series} /><text x={92} className="fill-foreground">Actual</text>
                    <line x1={140} x2={154} y1={-3} y2={-3} stroke={C.plan} strokeWidth={2.5} /><text x={160} className="fill-foreground">Budget</text>
                </g>
                {y.ticks(4).map((t) => (
                    <g key={t}>
                        <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
                        <text x={m.l - 6} y={y(t)} dy="0.32em" textAnchor="end" className="tabular fill-muted-foreground text-100">{fmtEurShort(t)}</text>
                    </g>
                ))}
                {data.map((d) => {
                    const x0 = x(d.month)!;
                    return (
                        <g key={+d.month} className="cursor-pointer" onClick={() => onSelect(d)}>
                            <title>{`${d.month.toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" })} 2022: forecast ${fmtEurShort(d.forecast)} · budget ${fmtEurShort(d.budget)} (${((d.forecast / d.budget - 1) * 100).toFixed(1)}%)${d.actual !== undefined ? ` · actual ${fmtEurShort(d.actual)}${partial(d) ? " to 21 Aug" : ""}` : ""}`}</title>
                            <rect x={x0 - (x.step() - bw) / 2} y={m.t} width={x.step()} height={height - m.t - m.b} fill="transparent" />
                            <rect x={x0} y={y(d.forecast)} width={bw} height={Math.max(0, y(0) - y(d.forecast))} fill={C.seriesSoft} />
                            {d.actual !== undefined && (
                                <rect x={x0 + bw * 0.22} y={y(d.actual)} width={bw * 0.56} height={Math.max(0, y(0) - y(d.actual))} fill={C.series} opacity={partial(d) ? 0.45 : 1} />
                            )}
                            <line x1={x0 - bw * 0.15} x2={x0 + bw * 1.15} y1={y(d.budget)} y2={y(d.budget)} stroke={C.plan} strokeWidth={2.5} />
                            <text x={x0 + bw / 2} y={height - 6} textAnchor="middle" className="fill-muted-foreground text-100">
                                {d.month.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}
                            </text>
                        </g>
                    );
                })}
                <line x1={m.l} x2={width - m.r} y1={y(0)} y2={y(0)} stroke="var(--axis)" />
            </svg>
        </div>
    );
}
