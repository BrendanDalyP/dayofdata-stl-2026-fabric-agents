import * as d3 from "d3";

import { BACKLOG_STATUSES, type BacklogRow, type BacklogStatus } from "@/queries/opsplan";
import { fmtEurShort, useSize } from "./common";

/**
 * Order status is ordinal (how urgent the order is), so it gets one hue stepped light → dark:
 * future → in progress → late → overdue. Operations' orange family, darkest = most urgent.
 */
export const STATUS_FILL: Record<BacklogStatus, string> = {
    "Future Order": "#f6c7a9",
    "WIP Order": "#f09a66",
    "Late Order": "#d9622c",
    "Overdue Order": "#8f3511",
};
export const STATUS_LABEL: Record<BacklogStatus, string> = { "Future Order": "Future", "WIP Order": "In progress", "Late Order": "Late", "Overdue Order": "Overdue" };

/** Open order book by region, stacked by status; sorted by overdue value. Fits its container. */
export function BacklogByRegion({ rows, onSelect }: { rows: BacklogRow[]; onSelect: (region: string) => void }) {
    const [ref, { width, height }] = useSize<HTMLDivElement>({ width: 500, height: 240 });
    const by = d3.rollup(rows, (v) => d3.sum(v, (r) => r.value), (r) => r.region, (r) => r.status);
    const regions = [...by.keys()].map((region) => {
        const s = by.get(region)!;
        const parts = BACKLOG_STATUSES.map((st) => ({ st, v: s.get(st) ?? 0 }));
        return { region, parts, total: d3.sum(parts, (p) => p.v), overdue: s.get("Overdue Order") ?? 0 };
    }).sort((a, b) => b.overdue - a.overdue);

    const legendH = 20;
    const rowH = (height - legendH) / Math.max(1, regions.length);
    const font = Math.max(10, Math.min(13, rowH * 0.72));
    const labelW = Math.min(150, width * 0.3);
    const valueW = 62;
    const x = d3.scaleLinear().domain([0, d3.max(regions, (r) => r.total) ?? 1]).range([labelW, width - valueW]);
    const barH = Math.max(4, Math.min(16, rowH * 0.62));

    return (
        <div ref={ref} className="h-full min-h-0 overflow-hidden">
            <svg width={width} height={height} role="img" aria-label="Open order backlog by region and status, euros">
                <g>
                    {BACKLOG_STATUSES.map((st, i) => (
                        <g key={st} transform={`translate(${labelW + i * 92},4)`}>
                            <rect width={10} height={10} rx={2} fill={STATUS_FILL[st]} />
                            <text x={14} y={9} className="fill-muted-foreground text-100">{STATUS_LABEL[st]}</text>
                        </g>
                    ))}
                </g>
                {regions.map((r, i) => {
                    let x0 = labelW;
                    return (
                        <g key={r.region} transform={`translate(0,${legendH + i * rowH})`} className="cursor-pointer" onClick={() => onSelect(r.region)}>
                            <title>{`${r.region}: ${fmtEurShort(r.total)} open · ${r.parts.map((p) => `${STATUS_LABEL[p.st]} ${fmtEurShort(p.v)}`).join(" · ")}`}</title>
                            <rect width={width} height={rowH} fill="transparent" />
                            <text x={labelW - 8} y={rowH / 2} dy="0.35em" textAnchor="end" className="fill-foreground" style={{ fontSize: font }}>{r.region.replace(" Region", "")}</text>
                            {r.parts.map((p) => {
                                const w = x(p.v) - x(0);
                                const el = <rect key={p.st} x={x0} y={(rowH - barH) / 2} width={Math.max(0, w - 1.5)} height={barH} fill={STATUS_FILL[p.st]} />;
                                x0 += w;
                                return el;
                            })}
                            <text x={width - 2} y={rowH / 2} dy="0.35em" textAnchor="end" className="tabular fill-foreground font-semibold" style={{ fontSize: font }}>{fmtEurShort(r.total)}</text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}
