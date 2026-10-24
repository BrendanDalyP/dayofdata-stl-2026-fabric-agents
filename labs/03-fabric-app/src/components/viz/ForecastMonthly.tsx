import * as d3 from "d3";

import { C, fmtEurShort, monthShort, useSize } from "./common";

export interface PlanMonth { month: Date; forecast: number; budget: number; actual?: number }

/**
 * 2022 by month, one euro axis: forecast as bars, budget as a solid ink line, actual net sales as dots
 * (Jan–Aug; August is partial). Legend on top. Click a month to ask Planning.
 */
export function ForecastMonthly({ data, onSelect }: { data: PlanMonth[]; onSelect: (d: PlanMonth) => void }) {
    const [ref, { width, height }] = useSize<HTMLDivElement>({ width: 600, height: 260 });
    const m = { l: 56, r: 12, t: 26, b: 20 };
    const x = d3.scaleBand<Date>().domain(data.map((d) => d.month)).range([m.l, width - m.r]).padding(0.28);
    const max = d3.max(data, (d) => Math.max(d.forecast, d.budget, d.actual ?? 0)) ?? 1;
    const y = d3.scaleLinear().domain([0, max * 1.08]).range([height - m.b, m.t]).nice();
    const cx = (d: PlanMonth) => x(d.month)! + x.bandwidth() / 2;
    const line = d3.line<PlanMonth>().x(cx).y((d) => y(d.budget)).curve(d3.curveMonotoneX);
    const partial = (d: PlanMonth) => d.month.getUTCMonth() === 7;

    return (
        <div ref={ref} className="h-full min-h-0 overflow-hidden">
            <svg width={width} height={height} role="img" aria-label="2022 forecast, budget and actual net sales by month">
                <g transform={`translate(${m.l},6)`} className="text-100">
                    <rect width={10} height={10} rx={2} fill={C.seriesSoft} /><text x={14} y={9} className="fill-muted-foreground">Forecast</text>
                    <line x1={78} x2={96} y1={5} y2={5} stroke={C.plan} strokeWidth={2} /><text x={100} y={9} className="fill-muted-foreground">Budget</text>
                    <circle cx={160} cy={5} r={4} fill={C.series} /><text x={168} y={9} className="fill-muted-foreground">Actual net sales (Aug to the 21st)</text>
                </g>
                {y.ticks(4).map((t) => (
                    <g key={t}>
                        <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
                        <text x={m.l - 6} y={y(t)} dy="0.35em" textAnchor="end" className="tabular fill-muted-foreground text-100">{fmtEurShort(t)}</text>
                    </g>
                ))}
                {data.map((d) => (
                    <rect key={+d.month} x={x(d.month)} y={y(d.forecast)} width={x.bandwidth()} height={Math.max(0, y(0) - y(d.forecast))} rx={3} fill={C.seriesSoft} />
                ))}
                <path d={line(data) ?? ""} fill="none" stroke={C.plan} strokeWidth={2} />
                {data.filter((d) => d.actual !== undefined).map((d) => (
                    <circle key={+d.month} cx={cx(d)} cy={y(d.actual!)} r={4.5} fill={partial(d) ? "var(--color-card)" : C.series} stroke={C.series} strokeWidth={2} />
                ))}
                {data.map((d) => (
                    <g key={`h${+d.month}`} className="cursor-pointer" onClick={() => onSelect(d)}>
                        <title>{`${monthShort(d.month)} 2022: forecast ${fmtEurShort(d.forecast)} · budget ${fmtEurShort(d.budget)} (${((d.forecast / d.budget - 1) * 100).toFixed(1)}%)${d.actual !== undefined ? ` · actual ${fmtEurShort(d.actual)}${partial(d) ? " to 21 Aug" : ""}` : ""}`}</title>
                        <rect x={x(d.month)! - (x.step() - x.bandwidth()) / 2} y={m.t} width={x.step()} height={height - m.t - m.b} fill="transparent" className="hover:fill-[var(--grid)] hover:opacity-40" />
                        <text x={cx(d)} y={height - 4} textAnchor="middle" className="fill-muted-foreground text-100">{monthShort(d.month)}</text>
                    </g>
                ))}
            </svg>
        </div>
    );
}
