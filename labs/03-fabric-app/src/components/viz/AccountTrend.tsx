import { useState } from "react";
import * as d3 from "d3";

import type { MonthPoint } from "@/queries/overview";
import { C, GridLine, Tooltip, fmtEurShort, monthLong, useSize, type TooltipState } from "./common";

/** One subject's monthly net sales (bars) against budget (ink line), 2021–Aug 2022. Fills its container. */
export function AccountTrend({ data, onSelect }: { data: MonthPoint[]; onSelect?: (m: MonthPoint) => void }) {
    const [ref, { width, height }] = useSize<HTMLDivElement>();
    const [tip, setTip] = useState<TooltipState | null>(null);
    const pts = data.filter((d) => d.month < new Date("2022-09-01T00:00:00Z"));
    const m = { l: 56, r: 10, t: 22, b: 20 };
    const x = d3.scaleBand<Date>().domain(pts.map((d) => d.month)).range([m.l, width - m.r]).paddingInner(0.25).paddingOuter(0.1);
    const y = d3.scaleLinear().domain([0, (d3.max(pts, (d) => Math.max(d.net, d.budget)) ?? 1) * 1.1]).nice(4).range([height - m.b, m.t]);
    const cx = (d: MonthPoint) => x(d.month)! + x.bandwidth() / 2;
    const line = d3.line<MonthPoint>().x(cx).y((d) => y(d.budget)).curve(d3.curveMonotoneX);
    const r = Math.min(4, x.bandwidth() / 2);
    return (
        <div ref={ref} className="relative h-full min-h-0" onMouseLeave={() => setTip(null)}>
            <svg width={width} height={height} role="img" aria-label="Monthly net sales against budget">
                <g transform={`translate(${m.l},10)`} className="text-100">
                    <rect width={10} height={10} y={-8} rx={2} fill={C.series} /><text x={14} className="fill-foreground">Net sales</text>
                    <line x1={84} x2={100} y1={-3} y2={-3} stroke={C.plan} strokeWidth={2} /><text x={104} className="fill-foreground">Budget</text>
                </g>
                {y.ticks(4).map((t) => <GridLine key={t} x1={m.l} x2={width - m.r} y={y(t)} label={fmtEurShort(t)} />)}
                {pts.map((d) => {
                    const h = y(0) - y(d.net);
                    const partial = d.month.getUTCFullYear() === 2022 && d.month.getUTCMonth() === 7;
                    const below = d.net < d.budget && !partial;
                    return (
                        <path key={+d.month}
                            d={h > r ? `M${x(d.month)},${y(0)} v${-(h - r)} q0,${-r} ${r},${-r} h${x.bandwidth() - 2 * r} q${r},0 ${r},${r} v${h - r} z` : `M${x(d.month)},${y(0)} h${x.bandwidth()} v${-h} h${-x.bandwidth()} z`}
                            fill={below ? C.below : C.series} opacity={partial ? 0.35 : 1} className={onSelect ? "cursor-pointer" : undefined}
                            onClick={() => onSelect?.(d)}
                            onMouseMove={(e) => {
                                const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                                setTip({ x: e.clientX - box.left, y: e.clientY - box.top, content: (
                                    <div>
                                        <div className="font-semibold">{monthLong(d.month)}{partial ? " (to 21 Aug)" : ""}</div>
                                        <div className="tabular">Net sales {fmtEurShort(d.net)} · budget {fmtEurShort(d.budget)}</div>
                                        <div className="tabular font-semibold" style={{ color: d.net < d.budget ? C.below : C.above }}>{((d.net / Math.max(1, d.budget) - 1) * 100).toFixed(1)}% vs budget</div>
                                    </div>) });
                            }} />
                    );
                })}
                <path d={line(pts) ?? ""} fill="none" stroke={C.plan} strokeWidth={2} />
                {pts.filter((d) => d.month.getUTCMonth() % 3 === 0).map((d) => (
                    <text key={+d.month} x={cx(d)} y={height - 4} textAnchor="middle" className="fill-muted-foreground text-100">
                        {d.month.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" })}
                    </text>
                ))}
            </svg>
            <Tooltip tip={tip} />
        </div>
    );
}
