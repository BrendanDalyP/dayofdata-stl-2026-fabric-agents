import * as d3 from "d3";

import type { DeliveryPoint } from "@/queries/overview";
import { C, fmtEurShort, monthLong, useWidth } from "./common";

/** On-time delivery % (line, left axis) over late-delivery penalties in euros (bars, right axis). */
export function DeliveryStrip({ data }: { data: DeliveryPoint[] }) {
    const [ref, width] = useWidth<HTMLDivElement>(420);
    const m = { l: 34, r: 44, t: 10, b: 20 };
    const height = 170;
    const x = d3.scaleBand<Date>().domain(data.map((d) => d.month)).range([m.l, width - m.r]).padding(0.25);
    const yp = d3.scaleLinear().domain([0, (d3.max(data, (d) => d.penalties) ?? 1) * 1.15]).range([height - m.b, m.t]);
    const ext = d3.extent(data, (d) => d.onTimePct) as [number, number];
    const yo = d3.scaleLinear().domain([Math.floor(ext[0] - 2), Math.ceil(ext[1] + 2)]).range([height - m.b, m.t]);
    const line = d3.line<DeliveryPoint>().x((d) => x(d.month)! + x.bandwidth() / 2).y((d) => yo(d.onTimePct)).curve(d3.curveMonotoneX);
    const last = data.at(-1);

    return (
        <div ref={ref}>
            <svg width={width} height={height} role="img" aria-label="On-time delivery and late-delivery penalties by month">
                {yo.ticks(4).map((t) => (
                    <g key={t}>
                        <line x1={m.l} x2={width - m.r} y1={yo(t)} y2={yo(t)} className="stroke-border" />
                        <text x={m.l - 4} y={yo(t) + 3} textAnchor="end" className="fill-muted-foreground font-numeric text-100">{t}%</text>
                    </g>
                ))}
                {yp.ticks(3).map((t) => (
                    <text key={t} x={width - m.r + 4} y={yp(t) + 3} className="fill-muted-foreground font-numeric text-100">{fmtEurShort(t)}</text>
                ))}
                {data.map((d) => (
                    <rect key={+d.month} x={x(d.month)} y={yp(d.penalties)} width={x.bandwidth()} height={yp(0) - yp(d.penalties)} fill={C.plan} opacity={0.55} rx={1}>
                        <title>{`${monthLong(d.month)}: ${d.onTimePct.toFixed(1)}% on time · penalties ${fmtEurShort(d.penalties)}`}</title>
                    </rect>
                ))}
                <path d={line(data) ?? ""} fill="none" stroke={C.series} strokeWidth={2.5} />
                {data.map((d) => <circle key={+d.month} cx={x(d.month)! + x.bandwidth() / 2} cy={yo(d.onTimePct)} r={2.5} fill={C.series} />)}
                {last && (
                    <text x={x(last.month)! + x.bandwidth() / 2} y={yo(last.onTimePct) - 8} textAnchor="end" className="fill-emphasis-foreground font-numeric text-200 font-semibold">
                        {last.onTimePct.toFixed(1)}%
                    </text>
                )}
                {data.filter((d) => d.month.getUTCMonth() % 4 === 0).map((d) => (
                    <text key={+d.month} x={x(d.month)! + x.bandwidth() / 2} y={height - 4} textAnchor="middle" className="fill-muted-foreground font-monospace text-100">
                        {d.month.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" })}
                    </text>
                ))}
            </svg>
        </div>
    );
}
