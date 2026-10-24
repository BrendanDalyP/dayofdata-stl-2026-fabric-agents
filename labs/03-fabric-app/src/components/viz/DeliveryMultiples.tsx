import * as d3 from "d3";

import { C, fmtEurShort, monthShort, useSize } from "./common";

export interface DeliveryMonth { month: Date; onTimePct: number; penalties: number }

/**
 * Two small multiples sharing one x axis (no dual axis): on-time delivery % on top,
 * late-delivery penalties in euros below. Click a month to ask about it.
 */
export function DeliveryMultiples({ data, color, onSelect }: { data: DeliveryMonth[]; color: string; onSelect: (d: DeliveryMonth) => void }) {
    const [ref, { width, height }] = useSize<HTMLDivElement>({ width: 420, height: 240 });
    const m = { l: 52, r: 12 };
    const gap = 26, axis = 18, titleH = 16;
    const panelH = (height - gap - axis - titleH * 2) / 2;
    const x = d3.scaleBand<Date>().domain(data.map((d) => d.month)).range([m.l, width - m.r]).padding(0.3);
    const cx = (d: DeliveryMonth) => x(d.month)! + x.bandwidth() / 2;

    const ext = d3.extent(data, (d) => d.onTimePct) as [number, number];
    const top0 = titleH, top1 = top0 + panelH;
    const yo = d3.scaleLinear().domain([Math.floor((ext[0] - 3) / 5) * 5, Math.ceil((ext[1] + 3) / 5) * 5]).range([top1, top0]).nice();
    const bot0 = top1 + gap + titleH, bot1 = bot0 + panelH;
    const yp = d3.scaleLinear().domain([0, (d3.max(data, (d) => d.penalties) ?? 1) * 1.1]).range([bot1, bot0]).nice();
    const line = d3.line<DeliveryMonth>().x(cx).y((d) => yo(d.onTimePct));
    const last = data.at(-1);

    return (
        <div ref={ref} className="h-full min-h-0 overflow-hidden">
            <svg width={width} height={height} role="img" aria-label="On-time delivery and late-delivery penalties by month, 2022">
                <text x={m.l} y={11} className="fill-muted-foreground text-100 font-semibold">On-time delivery, % of invoice lines</text>
                {yo.ticks(3).map((t) => (
                    <g key={`o${t}`}>
                        <line x1={m.l} x2={width - m.r} y1={yo(t)} y2={yo(t)} stroke="var(--grid)" />
                        <text x={m.l - 6} y={yo(t)} dy="0.35em" textAnchor="end" className="tabular fill-muted-foreground text-100">{t}%</text>
                    </g>
                ))}
                <path d={line(data) ?? ""} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
                {data.map((d) => <circle key={+d.month} cx={cx(d)} cy={yo(d.onTimePct)} r={3} fill={color} />)}
                {data[0] && <text x={cx(data[0])} y={yo(data[0].onTimePct) - 9} textAnchor="middle" className="tabular fill-muted-foreground text-100">{data[0].onTimePct.toFixed(1)}%</text>}
                {last && <text x={cx(last)} y={yo(last.onTimePct) - 9} textAnchor="middle" className="tabular fill-foreground text-200 font-semibold">{last.onTimePct.toFixed(1)}%</text>}

                <text x={m.l} y={bot0 - 5} className="fill-muted-foreground text-100 font-semibold">Late-delivery penalties, €</text>
                {yp.ticks(3).map((t) => (
                    <g key={`p${t}`}>
                        <line x1={m.l} x2={width - m.r} y1={yp(t)} y2={yp(t)} stroke="var(--grid)" />
                        <text x={m.l - 6} y={yp(t)} dy="0.35em" textAnchor="end" className="tabular fill-muted-foreground text-100">{fmtEurShort(t)}</text>
                    </g>
                ))}
                {data.map((d) => (
                    <rect key={+d.month} x={x(d.month)} y={yp(d.penalties)} width={x.bandwidth()} height={Math.max(0, yp(0) - yp(d.penalties))} fill={C.context} />
                ))}

                {data.map((d) => (
                    <g key={`h${+d.month}`} className="cursor-pointer" onClick={() => onSelect(d)}>
                        <title>{`${monthShort(d.month)} 2022: ${d.onTimePct.toFixed(1)}% on time · ${fmtEurShort(d.penalties)} penalties${d.month.getUTCMonth() === 7 ? " (to 21 Aug)" : ""}`}</title>
                        <rect x={x(d.month)! - x.step() * x.paddingInner() / 2} y={top0} width={x.step()} height={bot1 - top0} fill="transparent" className="hover:fill-[var(--grid)] hover:opacity-40" />
                        <text x={cx(d)} y={height - 4} textAnchor="middle" className="fill-muted-foreground text-100">{monthShort(d.month)}</text>
                    </g>
                ))}
            </svg>
        </div>
    );
}
