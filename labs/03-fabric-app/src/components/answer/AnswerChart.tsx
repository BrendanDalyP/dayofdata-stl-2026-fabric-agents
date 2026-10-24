import { useState } from "react";
import * as d3 from "d3";
import { BarChart3, Table2 } from "lucide-react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useWidth, fmtEurShort } from "@/components/viz/common";
import { toNumber, type ParsedTable } from "./parseTables";
import { cn } from "@/lib/utils";

const RED = "#d03b3b";
const GREEN = "#2a78d6"; // diverging "above" pole

/** Chart for a table the agent returned, with a toggle back to the table itself. */
export function AnswerChart({ table, raw, color }: { table: ParsedTable; raw: string; color: string }) {
    const [view, setView] = useState<"chart" | "table">("chart");
    const [ref, width] = useWidth<HTMLDivElement>(380);
    const { headers, rows, labelCol, valueCol, kind, percent } = table;
    const data = rows.map((r) => ({ label: r[labelCol].replace(/\*\*/g, ""), value: toNumber(r[valueCol]) })).filter((d) => Number.isFinite(d.value));
    const fmt = (v: number) => (percent ? `${v > 0 ? "+" : ""}${v.toFixed(1)}%` : fmtEurShort(v).replace("€", /eur|€|sales|budget|value|forecast|penalt/i.test(headers[valueCol]) ? "€" : ""));

    return (
        <div className="my-2 rounded-lg border border-border bg-card/60 p-2">
            <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate font-monospace text-100 uppercase tracking-wider text-muted-foreground">
                    {headers[valueCol]} <span className="normal-case">by {headers[labelCol].toLowerCase()}</span>
                </span>
                <div className="flex shrink-0 rounded-md border border-border p-0.5">
                    {(["chart", "table"] as const).map((v) => (
                        <button key={v} type="button" onClick={() => setView(v)} aria-label={`Show ${v}`} aria-pressed={view === v}
                            className={cn("rounded px-1.5 py-0.5 text-100", view === v ? "bg-muted text-emphasis-foreground" : "text-muted-foreground")}>
                            {v === "chart" ? <BarChart3 className="icon-size-100" /> : <Table2 className="icon-size-100" />}
                        </button>
                    ))}
                </div>
            </div>
            <div ref={ref}>
                {view === "table" ? (
                    <div className="prose-answer overflow-x-auto text-200"><ReactMarkdown remarkPlugins={[remarkGfm]}>{raw}</ReactMarkdown></div>
                ) : kind === "line" ? (
                    <LineChart data={data} width={width} color={color} fmt={fmt} />
                ) : (
                    <Bars data={data} width={width} color={color} fmt={fmt} diverging={kind === "diverging"} />
                )}
            </div>
        </div>
    );
}

interface ChartProps { data: { label: string; value: number }[]; width: number; color: string; fmt: (v: number) => string }

function Bars({ data, width, color, fmt, diverging }: ChartProps & { diverging: boolean }) {
    const shown = data.slice(0, 15);
    const labelW = Math.min(150, width * 0.38);
    const valueW = 62;
    const rowH = 20;
    const ext = d3.extent(shown, (d) => d.value) as [number, number];
    const lo = Math.min(0, ext[0]), hi = Math.max(0, ext[1]);
    const x = d3.scaleLinear().domain([lo, hi]).range([labelW, width - valueW]);
    return (
        <svg width={width} height={shown.length * rowH + 4} role="img" aria-label="Chart of the agent's table">
            {lo < 0 && <line x1={x(0)} x2={x(0)} y1={0} y2={shown.length * rowH} stroke="var(--grid)" />}
            {shown.map((d, i) => {
                const fill = diverging ? (d.value < 0 ? RED : GREEN) : color;
                return (
                    <g key={d.label + i} transform={`translate(0,${i * rowH})`}>
                        <text x={labelW - 6} y={rowH / 2 + 3} textAnchor="end" className="fill-foreground text-100">
                            {d.label.length > 24 ? d.label.slice(0, 23) + "…" : d.label}
                        </text>
                        <rect x={Math.min(x(0), x(d.value))} y={3} width={Math.max(1, Math.abs(x(d.value) - x(0)))} height={rowH - 6} rx={2} fill={fill} opacity={0.88} />
                        <text x={width - valueW + 4} y={rowH / 2 + 3} className={cn("tabular text-100", d.value < 0 ? "fill-destructive" : "fill-muted-foreground")}>
                            {fmt(d.value)}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}

function LineChart({ data, width, color, fmt }: ChartProps) {
    const h = 140, m = { l: 46, r: 8, t: 8, b: 18 };
    const x = d3.scalePoint<string>().domain(data.map((d) => d.label)).range([m.l, width - m.r]).padding(0.3);
    const ext = d3.extent(data, (d) => d.value) as [number, number];
    const pad = (ext[1] - ext[0]) * 0.15 || Math.abs(ext[1]) * 0.1 || 1;
    const y = d3.scaleLinear().domain([ext[0] - pad, ext[1] + pad]).range([h - m.b, m.t]);
    const line = d3.line<{ label: string; value: number }>().x((d) => x(d.label)!).y((d) => y(d.value)).curve(d3.curveMonotoneX);
    const step = Math.ceil(data.length / 6);
    return (
        <svg width={width} height={h} role="img" aria-label="Chart of the agent's table over time">
            {y.ticks(3).map((t) => (
                <g key={t}>
                    <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
                    <text x={m.l - 4} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground tabular text-100">{fmt(t)}</text>
                </g>
            ))}
            <path d={line(data) ?? ""} fill="none" stroke={color} strokeWidth={2.5} />
            {data.map((d) => <circle key={d.label} cx={x(d.label)} cy={y(d.value)} r={3} fill={color}><title>{`${d.label}: ${fmt(d.value)}`}</title></circle>)}
            {data.filter((_, i) => i % step === 0).map((d) => (
                <text key={d.label} x={x(d.label)} y={h - 4} textAnchor="middle" className="fill-muted-foreground font-monospace text-100">{d.label.slice(0, 8)}</text>
            ))}
        </svg>
    );
}
