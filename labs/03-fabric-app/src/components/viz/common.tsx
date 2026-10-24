import { useEffect, useRef, useState, type ReactNode } from "react";
import * as d3 from "d3";

/**
 * Palette roles (validated with the dataviz skill's validate_palette.js).
 * - series: one measure in a chart (slot 1 blue); budget/plan reference uses ink, not a hue.
 * - diverging: gap against budget — red below, blue above, neutral grey midpoint.
 * - status: reserved, always with an icon + label.
 */
export const C = {
    series: "#2a78d6",
    seriesSoft: "#86b6ef",
    plan: "var(--plan)",    // budget / plan marker (ink; theme-aware)
    context: "var(--context)", // earlier periods and context series (grey)
    below: "#d03b3b",       // diverging warm pole
    above: "#2a78d6",       // diverging cool pole
    neutral: "#f0efec",     // diverging midpoint
};

export const STATUS = {
    good: { color: "#0ca30c", icon: "✓", label: "on track" },
    warning: { color: "#fab219", icon: "▲", label: "at-watch" },
    critical: { color: "#d03b3b", icon: "●", label: "critical" },
} as const;

export type StatusKey = keyof typeof STATUS;
/** On track ≥ 0%, at-watch 0 to −5%, critical below −5% (gap against budget). */
export const statusOf = (gapPct: number): StatusKey => (gapPct >= 0 ? "good" : gapPct >= -5 ? "warning" : "critical");

/** Diverging fill for a gap %: red ↔ grey ↔ blue, clamped at ±max. */
export function gapColor(gapPct: number, max = 15) {
    const t = Math.max(-1, Math.min(1, gapPct / max));
    const root = typeof document !== "undefined" ? document.documentElement : undefined;
    const neutral = root?.classList.contains("dark") ? (root.dataset.theme === "midnight" ? "#2a3a55" : "#383835") : C.neutral;
    return t < 0 ? d3.interpolateRgb(neutral, C.below)(-t * 0.9) : d3.interpolateRgb(neutral, C.above)(t * 0.9);
}

/** Width and height of a container, kept in sync with ResizeObserver. */
export function useSize<T extends HTMLElement>(fallback = { width: 600, height: 300 }) {
    const ref = useRef<T>(null);
    const [size, setSize] = useState(fallback);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const ro = new ResizeObserver(([e]) =>
            setSize({ width: Math.max(200, Math.floor(e.contentRect.width)), height: Math.max(80, Math.floor(e.contentRect.height)) }),
        );
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    return [ref, size] as const;
}

/** Width only (for charts whose height follows their rows). */
export function useWidth<T extends HTMLElement>(fallback = 600) {
    const [ref, size] = useSize<T>({ width: fallback, height: 300 });
    return [ref, size.width] as const;
}

export interface TooltipState { x: number; y: number; content: ReactNode }

export function Tooltip({ tip }: { tip: TooltipState | null }) {
    if (!tip) return null;
    return (
        <div role="tooltip"
            className="pointer-events-none absolute z-20 max-w-64 rounded-lg border border-border bg-card px-3 py-2 text-200 text-foreground shadow-container-8"
            style={{ left: tip.x + 12, top: tip.y + 12 }}>
            {tip.content}
        </div>
    );
}

export const fmtEurShort = (v: number) => {
    const a = Math.abs(v);
    const s = a >= 1e9 ? `${(a / 1e9).toFixed(2)}bn` : a >= 1e6 ? `${(a / 1e6).toFixed(1)}m` : a >= 1e3 ? `${(a / 1e3).toFixed(0)}k` : a.toFixed(0);
    return `${v < 0 ? "−" : ""}€${s}`;
};

export const monthShort = (d: Date) => d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
export const monthLong = (d: Date) => d.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

/** Solid hairline gridline + tick label (no dashes — see dataviz anti-patterns). */
export function GridLine({ x1, x2, y, label, align = "end" }: { x1: number; x2: number; y: number; label?: string; align?: "end" | "start" }) {
    return (
        <g>
            <line x1={x1} x2={x2} y1={y} y2={y} stroke="var(--grid)" strokeWidth={1} />
            {label !== undefined && (
                <text x={align === "end" ? x1 - 6 : x2 + 6} y={y + 3} textAnchor={align} className="tabular fill-muted-foreground text-100">{label}</text>
            )}
        </g>
    );
}

export function StatusBadge({ gapPct, compact }: { gapPct: number; compact?: boolean }) {
    const s = STATUS[statusOf(gapPct)];
    return (
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-100 font-semibold text-foreground">
            <span aria-hidden style={{ color: s.color }}>{s.icon}</span>{compact ? null : s.label}
        </span>
    );
}
