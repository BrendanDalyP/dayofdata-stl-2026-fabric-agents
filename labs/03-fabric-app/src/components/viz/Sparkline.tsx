import * as d3 from "d3";

/**
 * KPI-tile trend. Straight segments only (no smoothing: a curve invents values between months).
 * kind="columns" for monthly totals (an optional last-period `partial` is drawn lighter);
 * kind="line" for rates, with the end point marked.
 */
export function Sparkline({ values, color, width = 110, height = 30, kind = "line", partialLast }: {
    values: number[]; color: string; width?: number; height?: number; kind?: "line" | "columns"; partialLast?: boolean;
}) {
    if (values.length < 2) return null;
    if (kind === "columns") {
        const x = d3.scaleBand<number>().domain(values.map((_, i) => i)).range([0, width]).padding(0.25);
        const y = d3.scaleLinear().domain([0, d3.max(values) ?? 1]).range([height, 2]);
        return (
            <svg width={width} height={height} aria-hidden>
                {values.map((v, i) => (
                    <rect key={i} x={x(i)} y={y(v)} width={x.bandwidth()} height={height - y(v)} fill={color}
                        opacity={partialLast && i === values.length - 1 ? 0.35 : 1} />
                ))}
            </svg>
        );
    }
    const x = d3.scaleLinear().domain([0, values.length - 1]).range([2, width - 4]);
    const y = d3.scaleLinear().domain(d3.extent(values) as [number, number]).range([height - 3, 3]);
    const line = d3.line<number>().x((_, i) => x(i)).y((v) => y(v));
    return (
        <svg width={width} height={height} aria-hidden>
            <path d={line(values) ?? ""} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" />
            <circle cx={x(values.length - 1)} cy={y(values.at(-1)!)} r={3} fill={color} />
        </svg>
    );
}
