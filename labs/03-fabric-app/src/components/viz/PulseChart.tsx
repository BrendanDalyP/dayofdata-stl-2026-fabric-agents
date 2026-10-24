import { useMemo, useState } from "react";
import * as d3 from "d3";

import type { MonthPoint } from "@/queries/overview";
import { C, GridLine, Tooltip, fmtEurShort, monthLong, useSize, type TooltipState } from "./common";

/**
 * Monthly net sales (bars) against budget (ink line), with a lower small multiple
 * showing the cumulative gap to budget within each year. Fills its container.
 */
export function PulseChart({ data, onSelect }: { data: MonthPoint[]; onSelect?: (m: MonthPoint) => void }) {
    const [ref, { width, height }] = useSize<HTMLDivElement>();
    const [tip, setTip] = useState<TooltipState | null>(null);

    const series = useMemo(() => {
        let cum = 0, year = 0;
        return data.filter((d) => d.month < new Date("2022-09-01T00:00:00Z")).map((d) => {
            if (d.month.getUTCFullYear() !== year) { year = d.month.getUTCFullYear(); cum = 0; }
            const partial = d.month.getUTCFullYear() === 2022 && d.month.getUTCMonth() === 7;
            if (!partial) cum += d.net - d.budget;
            return { ...d, cum, partial };
        });
    }, [data]);

    const m = { l: 56, r: 12, t: 22, b: 20 };
    const plotH = Math.max(120, height - m.t - m.b);
    const hTop = plotH * 0.68, gap = 22, hLow = plotH - hTop - gap;
    const x = d3.scaleBand<Date>().domain(series.map((d) => d.month)).range([m.l, width - m.r]).paddingInner(0.25).paddingOuter(0.1);
    const y = d3.scaleLinear().domain([0, (d3.max(series, (d) => Math.max(d.net, d.budget)) ?? 1) * 1.08]).nice(4).range([m.t + hTop, m.t]);
    const ext = d3.extent(series, (d) => d.cum) as [number, number];
    const yc = d3.scaleLinear().domain([Math.min(0, ext[0] ?? 0), Math.max(0, ext[1] ?? 0)]).nice(2).range([m.t + hTop + gap + hLow, m.t + hTop + gap]);
    const cx = (d: { month: Date }) => x(d.month)! + x.bandwidth() / 2;
    const line = d3.line<(typeof series)[number]>().x(cx).y((d) => y(d.budget)).curve(d3.curveMonotoneX);
    const years = d3.groups(series.filter((p) => !p.partial), (d) => d.month.getUTCFullYear());
    const r = Math.min(4, x.bandwidth() / 2);

    return (
        <div ref={ref} className="relative h-full min-h-0" onMouseLeave={() => setTip(null)}>
            <svg width={width} height={height} role="img" aria-label="Monthly net sales against budget, with cumulative gap">
                {/* legend */}
                <g transform={`translate(${m.l},10)`} className="text-100">
                    <rect width={10} height={10} y={-8} rx={2} fill={C.series} />
                    <text x={14} className="fill-foreground">Net sales</text>
                    <line x1={84} x2={100} y1={-3} y2={-3} stroke={C.plan} strokeWidth={2} />
                    <text x={104} className="fill-foreground">Budget</text>
                    <text x={160} className="fill-muted-foreground">Aug 2022 partial (to 21 Aug)</text>
                </g>
                {y.ticks(4).map((t) => <GridLine key={t} x1={m.l} x2={width - m.r} y={y(t)} label={fmtEurShort(t)} />)}
                {series.map((d) => {
                    const h = y(0) - y(d.net);
                    return (
                        <path key={+d.month}
                            d={`M${x(d.month)},${y(0)} v${-(h - r)} q0,${-r} ${r},${-r} h${x.bandwidth() - 2 * r} q${r},0 ${r},${r} v${h - r} z`}
                            fill={C.series} opacity={d.partial ? 0.35 : 1} className={onSelect ? "cursor-pointer" : undefined}
                            onClick={() => onSelect?.(d)}
                            onMouseMove={(e) => {
                                const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                                setTip({ x: e.clientX - box.left, y: e.clientY - box.top, content: (
                                    <div>
                                        <div className="font-semibold">{monthLong(d.month)}{d.partial ? " (to 21 Aug)" : ""}</div>
                                        <div className="tabular">Net sales {fmtEurShort(d.net)} · budget {fmtEurShort(d.budget)}</div>
                                        <div className="tabular font-semibold" style={{ color: d.net < d.budget ? C.below : C.above }}>
                                            {((d.net / d.budget - 1) * 100).toFixed(1)}% vs budget
                                        </div>
                                    </div>) });
                            }} />
                    );
                })}
                <path d={line(series) ?? ""} fill="none" stroke={C.plan} strokeWidth={2} />

                {/* cumulative gap small multiple */}
                <text x={m.l} y={m.t + hTop + gap - 6} className="fill-muted-foreground text-100">Cumulative gap to budget, within each year</text>
                <line x1={m.l} x2={width - m.r} y1={yc(0)} y2={yc(0)} stroke="var(--axis)" />
                {yc.ticks(2).map((t) => <GridLine key={`c${t}`} x1={m.l} x2={width - m.r} y={yc(t)} label={fmtEurShort(t)} />)}
                {years.map(([yr, pts]) => (
                    <g key={yr}>
                        {pts.map((p) => (
                            <rect key={+p.month} x={x(p.month)} width={x.bandwidth()} y={Math.min(yc(0), yc(p.cum))} height={Math.abs(yc(p.cum) - yc(0))}
                                fill={p.cum < 0 ? C.below : C.above} opacity={0.85} rx={1} />
                        ))}
                    </g>
                ))}
                {series.filter((d) => d.month.getUTCMonth() % 3 === 0).map((d) => (
                    <text key={+d.month} x={cx(d)} y={height - 4} textAnchor="middle" className="fill-muted-foreground text-100">
                        {d.month.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" })}
                    </text>
                ))}
            </svg>
            <Tooltip tip={tip} />
        </div>
    );
}
