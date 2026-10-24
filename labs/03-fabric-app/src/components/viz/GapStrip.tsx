import { C } from "./common";

/**
 * One small bar per month: how far that month landed above (blue, up) or below (red, down) budget.
 * Replaces the actual-vs-budget sparkline, whose dotted budget line needed explaining.
 */
export function GapStrip({ months, width = 84, height = 24, max = 25 }: { months: Array<{ label: string; gap: number }>; width?: number; height?: number; max?: number }) {
    const mid = height / 2;
    const bw = width / Math.max(1, months.length);
    const h = (g: number) => Math.max(1.5, (Math.min(Math.abs(g), max) / max) * (mid - 1));
    return (
        <svg width={width} height={height} role="img" aria-label={months.map((m) => `${m.label} ${m.gap >= 0 ? "+" : ""}${m.gap.toFixed(0)}%`).join(", ")}>
            <line x1={0} x2={width} y1={mid} y2={mid} stroke="var(--axis)" />
            {months.map((m, i) => (
                <rect key={m.label} x={i * bw + bw * 0.18} width={bw * 0.64} rx={1}
                    y={m.gap >= 0 ? mid - h(m.gap) : mid} height={h(m.gap)} fill={m.gap < 0 ? C.below : C.above}>
                    <title>{`${m.label}: ${m.gap >= 0 ? "+" : ""}${m.gap.toFixed(1)}% vs budget`}</title>
                </rect>
            ))}
        </svg>
    );
}
