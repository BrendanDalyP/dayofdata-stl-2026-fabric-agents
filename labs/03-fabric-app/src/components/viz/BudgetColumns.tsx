import { useState } from "react";
import * as d3 from "d3";

import type { MonthPoint } from "@/queries/overview";
import { C, Tooltip, fmtEurShort, monthLong, useSize, type TooltipState } from "./common";

const FONT = 12;

/**
 * Actual vs budget for one year, built to be read from across a room
 * (see labs/03-fabric-app/docs/chart-principles.md):
 * - one column per month (actual), a short dark marker across it (budget);
 * - under each month, its gap to budget as a coloured number (blue above, red below);
 * - month names on the axis; the partial last month is lighter and marked "to 21st".
 */
export function BudgetColumns({ data, onSelect, year = 2022, label = "Monthly net sales against budget" }: {
    data: MonthPoint[]; onSelect?: (m: MonthPoint) => void; year?: number; label?: string;
}) {
    const [ref, { width, height }] = useSize<HTMLDivElement>();
    const [tip, setTip] = useState<TooltipState | null>(null);
    const pts = data
        .filter((d) => d.month.getUTCFullYear() === year && d.month < new Date("2022-09-01T00:00:00Z"))
        .map((d) => ({
            ...d,
            partial: d.month.getUTCFullYear() === 2022 && d.month.getUTCMonth() === 7,
            gap: d.budget ? (d.net / d.budget - 1) * 100 : 0,
        }));

    const m = { l: 60, r: 12, t: 26, b: 46 };
    const x = d3.scaleBand<Date>().domain(pts.map((d) => d.month)).range([m.l, width - m.r]).paddingInner(0.35).paddingOuter(0.15);
    const y = d3.scaleLinear().domain([0, (d3.max(pts, (d) => Math.max(d.net, d.budget)) ?? 1) * 1.08]).nice(4).range([height - m.b, m.t]);
    const bw = x.bandwidth();
    const cx = (d: { month: Date }) => x(d.month)! + bw / 2;

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
            <svg width={width} height={height} role="img" aria-label={label} style={{ fontSize: FONT }}>
                <g transform={`translate(${m.l},12)`}>
                    <rect width={12} height={12} y={-10} fill={C.series} /><text x={17} className="fill-foreground">Actual</text>
                    <line x1={74} x2={92} y1={-4} y2={-4} stroke={C.plan} strokeWidth={3} /><text x={98} className="fill-foreground">Budget</text>
                </g>
                {y.ticks(Math.max(2, Math.min(4, Math.floor((height - m.t - m.b) / 40)))).map((t) => (
                    <g key={t}>
                        <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
                        <text x={m.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="tabular fill-muted-foreground">{fmtEurShort(t)}</text>
                    </g>
                ))}
                {pts.map((d) => {
                    const x0 = x(d.month)!;
                    return (
                        <g key={+d.month} className={onSelect ? "cursor-pointer" : undefined} onClick={() => onSelect?.(d)} onMouseMove={(e) => show(e, d)}>
                            <rect x={x0 - (x.step() - bw) / 2} y={m.t} width={x.step()} height={height - m.t} fill="transparent" />
                            <rect x={x0} y={y(d.net)} width={bw} height={Math.max(0, y(0) - y(d.net))} fill={C.series} opacity={d.partial ? 0.4 : 1} />
                            <line x1={x0 - bw * 0.12} x2={x0 + bw * 1.12} y1={y(d.budget)} y2={y(d.budget)} stroke={C.plan} strokeWidth={3} />
                            <text x={cx(d)} y={height - m.b + 17} textAnchor="middle" className="fill-foreground">
                                {d.month.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}
                            </text>
                            <text x={cx(d)} y={height - m.b + 36} textAnchor="middle" className="tabular" fontWeight={600}
                                style={{ fill: d.partial ? "var(--color-muted-foreground)" : d.gap < 0 ? C.below : C.above }}>
                                {d.partial ? "to 21st" : `${d.gap >= 0 ? "+" : "−"}${Math.abs(d.gap).toFixed(1)}%`}
                            </text>
                        </g>
                    );
                })}
                <line x1={m.l} x2={width - m.r} y1={y(0)} y2={y(0)} stroke="var(--axis)" />
                <text x={m.l - 8} y={height - m.b + 36} textAnchor="end" className="fill-muted-foreground">vs budget</text>
            </svg>
            <Tooltip tip={tip} />
        </div>
    );
}
