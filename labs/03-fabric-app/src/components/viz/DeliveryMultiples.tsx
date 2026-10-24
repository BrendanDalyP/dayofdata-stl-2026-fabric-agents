import * as d3 from "d3";

import { C, fmtEurShort, monthShort, useSize } from "./common";

export interface DeliveryMonth { month: Date; onTimePct: number; penalties: number }

const FONT = 12;

/**
 * Two small multiples sharing one x axis (no dual axis), labelled directly instead of with
 * y axes: on-time delivery % on top (a value over every point), late-delivery penalties in euros
 * below (a value over every bar). Click a month to ask about it.
 */
export function DeliveryMultiples({ data, color, onSelect }: { data: DeliveryMonth[]; color: string; onSelect: (d: DeliveryMonth) => void }) {
    const [ref, { width, height }] = useSize<HTMLDivElement>({ width: 420, height: 240 });
    const m = { l: 8, r: 8 };
    const titleH = 20, labelH = 18, gap = 14, axis = 20;
    const panelH = Math.max(30, (height - axis - gap - 2 * (titleH + labelH)) / 2);
    const x = d3.scaleBand<Date>().domain(data.map((d) => d.month)).range([m.l, width - m.r]).padding(0.35);
    const cx = (d: DeliveryMonth) => x(d.month)! + x.bandwidth() / 2;

    const top0 = titleH + labelH, top1 = top0 + panelH;
    const ext = d3.extent(data, (d) => d.onTimePct) as [number, number];
    const yo = d3.scaleLinear().domain([ext[0] - 1, ext[1] + 1]).range([top1, top0]);
    const bot0 = top1 + gap + titleH + labelH, bot1 = bot0 + panelH;
    const yp = d3.scaleLinear().domain([0, d3.max(data, (d) => d.penalties) ?? 1]).range([bot1, bot0]);
    const line = d3.line<DeliveryMonth>().x(cx).y((d) => yo(d.onTimePct));
    const partial = (d: DeliveryMonth) => d.month.getUTCMonth() === 7;

    return (
        <div ref={ref} className="h-full min-h-0 overflow-hidden">
            <svg width={width} height={height} role="img" aria-label="On-time delivery and late-delivery penalties by month, 2022" style={{ fontSize: FONT }}>
                <text x={m.l} y={14} className="fill-foreground" fontWeight={600}>On-time delivery, % of invoice lines</text>
                <path d={line(data) ?? ""} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
                {data.map((d) => (
                    <g key={`o${+d.month}`}>
                        <circle cx={cx(d)} cy={yo(d.onTimePct)} r={4} fill={color} />
                        <text x={cx(d)} y={yo(d.onTimePct) - 9} textAnchor="middle" className="tabular fill-foreground" fontWeight={d === data.at(-1) ? 700 : 400}>
                            {d.onTimePct.toFixed(1)}
                        </text>
                    </g>
                ))}

                <text x={m.l} y={top1 + gap + 14} className="fill-foreground" fontWeight={600}>Late-delivery penalties, €</text>
                {data.map((d) => (
                    <g key={`p${+d.month}`}>
                        <rect x={x(d.month)} y={yp(d.penalties)} width={x.bandwidth()} height={Math.max(1, yp(0) - yp(d.penalties))} fill={C.context} opacity={partial(d) ? 0.5 : 1} />
                        <text x={cx(d)} y={yp(d.penalties) - 5} textAnchor="middle" className="tabular fill-foreground">{fmtEurShort(d.penalties).replace("€", "")}</text>
                    </g>
                ))}
                <line x1={m.l} x2={width - m.r} y1={bot1} y2={bot1} stroke="var(--axis)" />

                {data.map((d) => (
                    <g key={`h${+d.month}`} className="cursor-pointer" onClick={() => onSelect(d)}>
                        <title>{`${monthShort(d.month)} 2022: ${d.onTimePct.toFixed(1)}% on time · ${fmtEurShort(d.penalties)} penalties${partial(d) ? " (to 21 Aug)" : ""}`}</title>
                        <rect x={x(d.month)! - (x.step() - x.bandwidth()) / 2} y={0} width={x.step()} height={height} fill="transparent" className="hover:fill-[var(--grid)] hover:opacity-40" />
                        <text x={cx(d)} y={height - 4} textAnchor="middle" className="fill-foreground">{monthShort(d.month)}</text>
                    </g>
                ))}
            </svg>
        </div>
    );
}
