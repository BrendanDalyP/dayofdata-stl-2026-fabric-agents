import { useState } from "react";
import * as d3 from "d3";

import type { MonthPoint } from "@/queries/overview";
import { C, Tooltip, fmtEurShort, monthLong, useSize, type TooltipState } from "./common";

/**
 * Actual vs budget, consulting style (see labs/03-fabric-app/docs/chart-principles.md):
 * - columns = actual; the focus year in the series colour, earlier years in grey;
 * - budget = a short dark marker across each column (no connecting line, no smoothing);
 * - a variance row underneath: % above (blue) or below (red) budget per complete month;
 * - month initials on the axis with the year under each group; August 2022 is partial and marked so.
 */
export function BudgetColumns({ data, onSelect, focusYear = 2022, label = "Monthly net sales against budget" }: {
    data: MonthPoint[]; onSelect?: (m: MonthPoint) => void; focusYear?: number; label?: string;
}) {
    const [ref, { width, height }] = useSize<HTMLDivElement>();
    const [tip, setTip] = useState<TooltipState | null>(null);
    const pts = data.filter((d) => d.month < new Date("2022-09-01T00:00:00Z")).map((d) => ({
        ...d,
        partial: d.month.getUTCFullYear() === 2022 && d.month.getUTCMonth() === 7,
        gap: d.budget ? (d.net / d.budget - 1) * 100 : 0,
    }));

    const m = { l: 56, r: 8, t: 24, b: 34 };
    const varH = Math.max(36, Math.min(64, (height - m.t - m.b) * 0.24));
    const gapH = 18;
    const top = m.t, bottom = height - m.b - varH - gapH;
    const x = d3.scaleBand<Date>().domain(pts.map((d) => d.month)).range([m.l, width - m.r]).paddingInner(0.28).paddingOuter(0.12);
    const y = d3.scaleLinear().domain([0, (d3.max(pts, (d) => Math.max(d.net, d.budget)) ?? 1) * 1.06]).nice(4).range([bottom, top]);
    const vTop = bottom + gapH, vBottom = vTop + varH, vMid = (vTop + vBottom) / 2;
    const vLim = Math.max(10, Math.ceil((d3.max(pts.filter((p) => !p.partial), (p) => Math.abs(p.gap)) ?? 10) / 5) * 5);
    const yv = d3.scaleLinear().domain([-vLim, vLim]).range([vBottom, vTop]);
    const bw = x.bandwidth();
    const years = d3.groups(pts, (d) => d.month.getUTCFullYear());
    const showVarLabels = bw >= 22;

    const show = (e: React.MouseEvent, d: (typeof pts)[number]) => {
        const box = ((e.currentTarget as SVGElement).ownerSVGElement as SVGSVGElement).getBoundingClientRect();
        setTip({ x: e.clientX - box.left, y: e.clientY - box.top, content: (
            <div>
                <div className="font-semibold">{monthLong(d.month)}{d.partial ? " (to 21 Aug)" : ""}</div>
                <div className="tabular">Actual {fmtEurShort(d.net)} · budget {fmtEurShort(d.budget)}</div>
                {!d.partial && <div className="tabular font-semibold" style={{ color: d.gap < 0 ? C.below : C.above }}>{d.gap >= 0 ? "+" : ""}{d.gap.toFixed(1)}% vs budget</div>}
            </div>) });
    };

    return (
        <div ref={ref} className="relative h-full min-h-0 overflow-hidden" onMouseLeave={() => setTip(null)}>
            <svg width={width} height={height} role="img" aria-label={label}>
                {/* legend: identity only, directly above the plot */}
                <g transform={`translate(${m.l},12)`} className="text-100">
                    <rect width={10} height={10} y={-8} fill={C.series} /><text x={14} className="fill-foreground">{focusYear} actual</text>
                    <rect x={92} width={10} height={10} y={-8} fill={C.context} /><text x={106} className="fill-foreground">{focusYear - 1} actual</text>
                    <line x1={184} x2={198} y1={-3} y2={-3} stroke={C.plan} strokeWidth={2.5} /><text x={204} className="fill-foreground">Budget</text>
                </g>
                {y.ticks(4).map((t) => (
                    <g key={t}>
                        <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
                        <text x={m.l - 6} y={y(t)} dy="0.32em" textAnchor="end" className="tabular fill-muted-foreground text-100">{fmtEurShort(t)}</text>
                    </g>
                ))}
                {pts.map((d) => {
                    const x0 = x(d.month)!;
                    const focus = d.month.getUTCFullYear() === focusYear;
                    return (
                        <g key={+d.month} className={onSelect ? "cursor-pointer" : undefined} onClick={() => onSelect?.(d)} onMouseMove={(e) => show(e, d)}>
                            <rect x={x0 - (x.step() - bw) / 2} y={top} width={x.step()} height={vBottom - top} fill="transparent" />
                            <rect x={x0} y={y(d.net)} width={bw} height={Math.max(0, y(0) - y(d.net))}
                                fill={focus ? C.series : C.context} opacity={d.partial ? 0.4 : 1} />
                            <line x1={x0 - bw * 0.18} x2={x0 + bw * 1.18} y1={y(d.budget)} y2={y(d.budget)} stroke={C.plan} strokeWidth={2.5} />
                        </g>
                    );
                })}
                {pts.filter((d) => d.partial).map((d) => (
                    <text key="p" x={x(d.month)! + bw / 2} y={y(d.net) - 6} textAnchor="middle" className="fill-muted-foreground text-100">to 21st</text>
                ))}
                <line x1={m.l} x2={width - m.r} y1={y(0)} y2={y(0)} stroke="var(--axis)" />

                {/* variance row */}
                <text x={m.l - 6} y={vMid} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-100">vs budget</text>
                <line x1={m.l} x2={width - m.r} y1={yv(0)} y2={yv(0)} stroke="var(--axis)" />
                {pts.filter((d) => !d.partial).map((d) => {
                    const g = Math.max(-vLim, Math.min(vLim, d.gap));
                    return (
                        <g key={`v${+d.month}`}>
                            <rect x={x(d.month)! + bw * 0.15} width={bw * 0.7} y={Math.min(yv(0), yv(g))} height={Math.max(1, Math.abs(yv(g) - yv(0)))}
                                fill={d.gap < 0 ? C.below : C.above} />
                            {showVarLabels && (
                                <text x={x(d.month)! + bw / 2} y={d.gap < 0 ? yv(0) - 4 : yv(0) + 11} textAnchor="middle" className="tabular fill-muted-foreground" style={{ fontSize: 10 }}>
                                    {d.gap >= 0 ? "+" : "−"}{Math.abs(d.gap).toFixed(0)}
                                </text>
                            )}
                        </g>
                    );
                })}

                {/* axis: month initials, then the year under each group with a divider between years */}
                {pts.map((d) => (
                    <text key={`m${+d.month}`} x={x(d.month)! + bw / 2} y={vBottom + 13} textAnchor="middle" className="fill-muted-foreground text-100">
                        {d.month.toLocaleDateString("en-GB", { month: "narrow", timeZone: "UTC" })}
                    </text>
                ))}
                {years.map(([yr, ys], i) => {
                    const a = x(ys[0].month)!, b = x(ys.at(-1)!.month)! + bw;
                    return (
                        <g key={yr}>
                            <text x={(a + b) / 2} y={vBottom + 28} textAnchor="middle" className="fill-foreground text-100 font-semibold">{yr}</text>
                            {i > 0 && <line x1={a - (x.step() - bw) / 2} x2={a - (x.step() - bw) / 2} y1={top} y2={vBottom + 30} stroke="var(--axis)" />}
                        </g>
                    );
                })}
            </svg>
            <Tooltip tip={tip} />
        </div>
    );
}
