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

const ROW = 28;
const FONT = 12;

/**
 * Open order book by region, stacked by status, sorted by overdue value. Shows as many regions
 * as fit at a readable size (28px rows, 12px text); the rest are summed into one "Other" row.
 */
export function BacklogByRegion({ rows, onSelect }: { rows: BacklogRow[]; onSelect: (region: string) => void }) {
    const [ref, { width, height }] = useSize<HTMLDivElement>({ width: 500, height: 240 });
    const by = d3.rollup(rows, (v) => d3.sum(v, (r) => r.value), (r) => r.region, (r) => r.status);
    const all = [...by.keys()].map((region) => {
        const s = by.get(region)!;
        const parts = BACKLOG_STATUSES.map((st) => ({ st, v: s.get(st) ?? 0 }));
        return { region, parts, total: d3.sum(parts, (p) => p.v), overdue: s.get("Overdue Order") ?? 0, other: false };
    }).sort((a, b) => b.overdue - a.overdue);

    const legendH = 26;
    const fit = Math.max(3, Math.floor((height - legendH) / ROW));
    let regions = all;
    if (all.length > fit) {
        const rest = all.slice(fit - 1);
        const parts = BACKLOG_STATUSES.map((st) => ({ st, v: d3.sum(rest, (r) => r.parts.find((p) => p.st === st)!.v) }));
        regions = [...all.slice(0, fit - 1), { region: `Other ${rest.length} regions`, parts, total: d3.sum(parts, (p) => p.v), overdue: 0, other: true }];
    }
    const rowH = Math.min(36, (height - legendH) / regions.length);
    const labelW = Math.min(150, width * 0.28);
    const valueW = 70;
    const x = d3.scaleLinear().domain([0, d3.max(regions, (r) => r.total) ?? 1]).range([labelW, width - valueW]);
    const barH = Math.min(18, rowH * 0.62);

    return (
        <div ref={ref} className="h-full min-h-0 overflow-hidden">
            <svg width={width} height={height} role="img" aria-label="Open order backlog by region and status, euros" style={{ fontSize: FONT }}>
                <g transform={`translate(${labelW},6)`}>
                    {BACKLOG_STATUSES.map((st, i) => (
                        <g key={st} transform={`translate(${i * 104},0)`}>
                            <rect width={12} height={12} rx={2} fill={STATUS_FILL[st]} />
                            <text x={17} y={10} className="fill-foreground">{STATUS_LABEL[st]}</text>
                        </g>
                    ))}
                </g>
                {regions.map((r, i) => {
                    let x0 = labelW;
                    return (
                        <g key={r.region} transform={`translate(0,${legendH + i * rowH})`} className={r.other ? undefined : "cursor-pointer"}
                            onClick={() => !r.other && onSelect(r.region)}>
                            <title>{`${r.region}: ${fmtEurShort(r.total)} open · ${r.parts.map((p) => `${STATUS_LABEL[p.st]} ${fmtEurShort(p.v)}`).join(" · ")}`}</title>
                            <rect width={width} height={rowH} fill="transparent" className={r.other ? undefined : "hover:fill-[var(--grid)]"} />
                            <text x={labelW - 8} y={rowH / 2} dy="0.35em" textAnchor="end" className={r.other ? "fill-muted-foreground" : "fill-foreground"} fontStyle={r.other ? "italic" : undefined}>
                                {r.region.replace(" Region", "")}
                            </text>
                            {r.parts.map((p) => {
                                const w = x(p.v) - x(0);
                                const el = <rect key={p.st} x={x0} y={(rowH - barH) / 2} width={Math.max(0, w - 1.5)} height={barH} fill={STATUS_FILL[p.st]} opacity={r.other ? 0.55 : 1} />;
                                x0 += w;
                                return el;
                            })}
                            <text x={width - 2} y={rowH / 2} dy="0.35em" textAnchor="end" className="tabular fill-foreground" fontWeight={600}>{fmtEurShort(r.total)}</text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}
