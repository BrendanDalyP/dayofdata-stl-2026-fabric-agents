import { useMemo, useState } from "react";
import * as d3 from "d3";

import type { Cell, Subject } from "@/queries/overview";
import { C, Tooltip, fmtEurShort, gapColor, monthLong, monthShort, useWidth, type TooltipState } from "./common";

interface Props {
    cells: Cell[];
    subjects: Subject[];
    focus?: string;
    onSelect: (subject: Subject, month?: Date) => void;
}

/**
 * Key account × month heatmap of net sales against budget, 2022.
 * Rows are sorted by year-to-date gap (worst first); the right-hand bars show that gap in euros.
 */
export function VarianceHeatmap({ cells, subjects, focus, onSelect }: Props) {
    const [ref, width] = useWidth<HTMLDivElement>(820);
    const [tip, setTip] = useState<TooltipState | null>(null);

    const { rows, months, byKey } = useMemo(() => {
        const ms = d3.sort(
            [...new Set(cells.filter((c) => c.month.getUTCFullYear() === 2022 && c.month.getUTCMonth() <= 7).map((c) => +c.month))],
        ).map((t) => new Date(t));
        const rows = [...subjects].sort((a, b) => (a.actualYtd - a.budgetYtd) - (b.actualYtd - b.budgetYtd));
        const byKey = new Map(cells.map((c) => [`${c.name}|${+c.month}`, c]));
        return { rows, months: ms, byKey };
    }, [cells, subjects]);

    const labelW = Math.min(170, width * 0.24);
    const barW = Math.min(150, width * 0.2);
    const gridW = Math.max(120, width - labelW - barW - 16);
    const cellW = gridW / Math.max(1, months.length);
    const rowH = 26;
    const top = 22;
    const height = top + rows.length * rowH + 4;

    const maxGap = d3.max(rows, (r) => Math.abs(r.actualYtd - r.budgetYtd)) ?? 1;
    const xBar = d3.scaleLinear().domain([-maxGap, maxGap]).range([0, barW - 8]);

    return (
        <div ref={ref} className="relative" onMouseLeave={() => setTip(null)}>
            <svg width={width} height={height} role="img" aria-label="Net sales against budget by key account and month, 2022">
                {months.map((m, j) => (
                    <text key={+m} x={labelW + j * cellW + cellW / 2} y={14} textAnchor="middle"
                        className="fill-muted-foreground font-monospace text-100">
                        {monthShort(m)}{m.getUTCMonth() === 7 ? "*" : ""}
                    </text>
                ))}
                <text x={labelW + gridW + 8 + (barW - 8) / 2} y={14} textAnchor="middle" className="fill-muted-foreground font-monospace text-100">
                    Gap Jan–Jul
                </text>

                {rows.map((r, i) => {
                    const y = top + i * rowH;
                    const gap = r.actualYtd - r.budgetYtd;
                    const isFocus = focus === r.name;
                    return (
                        <g key={r.name} className="cursor-pointer" onClick={() => onSelect(r)}>
                            <rect x={0} y={y} width={width} height={rowH - 2} rx={4}
                                fill={isFocus ? "rgba(242,200,17,0.18)" : "transparent"} />
                            <text x={labelW - 8} y={y + rowH / 2 + 3} textAnchor="end"
                                className={isFocus ? "fill-emphasis-foreground text-200 font-semibold" : "fill-foreground text-200"}>
                                {r.name.length > 24 ? r.name.slice(0, 23) + "…" : r.name}
                            </text>
                            {months.map((m, j) => {
                                const c = byKey.get(`${r.name}|${+m}`);
                                const g = c && c.budget > 0 ? (c.net / c.budget - 1) * 100 : 0;
                                const partial = m.getUTCMonth() === 7;
                                return (
                                    <rect key={+m} x={labelW + j * cellW + 1} y={y + 1} width={cellW - 2} height={rowH - 4} rx={3}
                                        fill={c ? gapColor(g) : "transparent"} opacity={partial ? 0.45 : 1}
                                        stroke={isFocus ? C.yellow : "none"} strokeWidth={isFocus ? 1 : 0}
                                        onClick={(e) => { e.stopPropagation(); onSelect(r, m); }}
                                        onMouseMove={(e) => {
                                            const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                                            setTip({
                                                x: e.clientX - box.left, y: e.clientY - box.top,
                                                content: (
                                                    <div>
                                                        <div className="font-semibold">{r.name} · {monthLong(m)}{partial ? " (to 21 Aug)" : ""}</div>
                                                        <div>Net sales {fmtEurShort(c?.net ?? 0)} · budget {fmtEurShort(c?.budget ?? 0)}</div>
                                                        <div className={g < 0 ? "text-destructive" : "text-brand-foreground"}>{g >= 0 ? "+" : ""}{g.toFixed(1)}% vs budget</div>
                                                        <div className="mt-1 text-muted-foreground">Click to ask the Sales Analyst</div>
                                                    </div>
                                                ),
                                            });
                                        }}
                                    />
                                );
                            })}
                            <g transform={`translate(${labelW + gridW + 8},0)`}>
                                <line x1={xBar(0)} x2={xBar(0)} y1={y} y2={y + rowH - 2} className="stroke-border" />
                                <rect x={Math.min(xBar(0), xBar(gap))} y={y + 6} width={Math.abs(xBar(gap) - xBar(0))} height={rowH - 14} rx={2}
                                    fill={gap < 0 ? C.red : C.blue} />
                                <text x={gap < 0 ? xBar(0) + 4 : xBar(0) - 4} y={y + rowH / 2 + 3} textAnchor={gap < 0 ? "start" : "end"}
                                    className="fill-muted-foreground font-numeric text-100">
                                    {fmtEurShort(gap)}
                                </text>
                            </g>
                        </g>
                    );
                })}
            </svg>
            <Tooltip tip={tip} />
        </div>
    );
}
