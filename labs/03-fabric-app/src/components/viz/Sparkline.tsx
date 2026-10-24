import * as d3 from "d3";

export function Sparkline({ values, color, width = 110, height = 30, band }: { values: number[]; color: string; width?: number; height?: number; band?: number[] }) {
    if (values.length < 2) return null;
    const all = band ? [...values, ...band] : values;
    const x = d3.scaleLinear().domain([0, values.length - 1]).range([1, width - 3]);
    const y = d3.scaleLinear().domain(d3.extent(all) as [number, number]).range([height - 2, 2]);
    const line = d3.line<number>().x((_, i) => x(i)).y((v) => y(v)).curve(d3.curveMonotoneX);
    return (
        <svg width={width} height={height} aria-hidden>
            {band && <path d={line(band) ?? ""} fill="none" stroke="#52514e" strokeWidth={1.5} strokeDasharray="3 2" />}
            <path d={line(values) ?? ""} fill="none" stroke={color} strokeWidth={2} />
            <circle cx={x(values.length - 1)} cy={y(values.at(-1)!)} r={2.5} fill={color} />
        </svg>
    );
}
