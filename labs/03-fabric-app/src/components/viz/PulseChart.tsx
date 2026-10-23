import { useMemo, useState } from "react";
import * as d3 from "d3";

import type { MonthPoint } from "@/queries/overview";
import { C, Tooltip, fmtEurShort, monthLong, useWidth, type TooltipState } from "./common";

/**
 * Monthly net sales (bars) against budget (yellow line), 2021–2022, with a lower panel
 * showing the cumulative gap to budget within each year.
 */
export function PulseChart({ data }: { data: MonthPoint[] }) {
    const [ref, width] = useWidth<HTMLDivElement>(820);
    const [tip, setTip] = useState<TooltipState | null>(null);

    const m = { l: 52, r: 12, t: 10 };
    const hTop = 170, hGap = 70, between = 18;
    const height = m.t + hTop + between + hGap + 22;

    const series = useMemo(() => {
        const withActual = data.filter((d) => d.month < new Date("2022-09-01T00:00:00Z"));
        let cum = 0, year = 0;
        return withActual.map((d) => {
            if (d.month.getUTCFullYear() !== year) { year = d.month.getUTCFullYear(); cum = 0; }
            const partial = d.month.getUTCFullYear() === 2022 && d.month.getUTCMonth() === 7;
            if (!partial) cum += d.net - d.budget;
            return { ...d, cum, partial };
        });
    }, [data]);

    const x = d3.scaleBand<Date>().domain(series.map((d) => d.month)).range([m.l, width - m.r]).padding(0.18);
    const y = d3.scaleLinear().domain([0, d3.max(series, (d) => Math.max(d.net, d.budget))! * 1.08]).nice().range([m.t + hTop, m.t]);
    const cumExt = d3.extent(series, (d) => d.cum) as [number, number];
    const yc = d3.scaleLinear().domain([Math.min(0, cumExt[0]), Math.max(0, cumExt[1])]).nice().range([m.t + hTop + between + hGap, m.t + hTop + between]);

    const line = d3.line<(typeof series)[number]>().x((d) => x(d.month)! + x.bandwidth() / 2).y((d) => y(d.budget)).curve(d3.curveMonotoneX);
    const area = d3.area<(typeof series)[number]>().x((d) => x(d.month)! + x.bandwidth() / 2).y0(yc(0)).y1((d) => yc(d.cum)).curve(d3.curveMonotoneX);
    const years = d3.groups(series, (d) => d.month.getUTCFullYear());

    return (
        <div ref={ref} className="relative" onMouseLeave={() => setTip(null)}>
            <svg width={width} height={height} role="img" aria-label="Monthly net sales against budget, with cumulative gap">
                {y.ticks(4).map((t) => (
                    <g key={t}>
                        <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} className="stroke-border" strokeDasharray="2 4" />
                        <text x={m.l - 6} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground font-numeric text-100">{fmtEurShort(t)}</text>
                    </g>
                ))}
                {series.map((d) => (
                    <rect key={+d.month} x={x(d.month)} y={y(d.net)} width={x.bandwidth()} height={y(0) - y(d.net)} rx={2}
                        fill={d.net >= d.budget ? C.blue : C.blueSoft} opacity={d.partial ? 0.35 : d.net >= d.budget ? 0.95 : 0.55}
                        onMouseMove={(e) => {
                            const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                            setTip({
                                x: e.clientX - box.left, y: e.clientY - box.top,
                                content: (
                                    <div>
                                        <div className="font-semibold">{monthLong(d.month)}{d.partial ? " (to 21 Aug)" : ""}</div>
                                        <div>Net sales {fmtEurShort(d.net)}</div>
                                        <div>Budget {fmtEurShort(d.budget)}</div>
                                        <div className={d.net < d.budget ? "text-destructive" : "text-brand-foreground"}>
                                            {((d.net / d.budget - 1) * 100).toFixed(1)}% vs budget
                                        </div>
                                    </div>
                                ),
                            });
                        }} />
                ))}
                <path d={line(series) ?? ""} fill="none" stroke={C.yellow} strokeWidth={2.5} />
                {series.map((d) => <circle key={+d.month} cx={x(d.month)! + x.bandwidth() / 2} cy={y(d.budget)} r={2.5} fill={C.yellow} />)}

                {/* cumulative gap */}
                <line x1={m.l} x2={width - m.r} y1={yc(0)} y2={yc(0)} className="stroke-border" />
                {years.map(([yr, pts]) => (
                    <g key={yr}>
                        <path d={area(pts.filter((p) => !p.partial)) ?? ""} fill={(pts.filter((p) => !p.partial).at(-1)?.cum ?? 0) < 0 ? C.red : C.blue} opacity={0.35} />
                        <text x={x(pts[0].month)} y={m.t + hTop + between - 4} className="fill-muted-foreground font-monospace text-100">
                            {yr} cumulative gap {fmtEurShort(pts.filter((p) => !p.partial).at(-1)?.cum ?? 0)}
                        </text>
                    </g>
                ))}
                {yc.ticks(2).map((t) => (
                    <text key={t} x={m.l - 6} y={yc(t) + 3} textAnchor="end" className="fill-muted-foreground font-numeric text-100">{fmtEurShort(t)}</text>
                ))}
                {series.filter((d) => d.month.getUTCMonth() % 3 === 0).map((d) => (
                    <text key={+d.month} x={x(d.month)! + x.bandwidth() / 2} y={height - 6} textAnchor="middle" className="fill-muted-foreground font-monospace text-100">
                        {d.month.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" })}
                    </text>
                ))}
            </svg>
            <Tooltip tip={tip} />
        </div>
    );
}
