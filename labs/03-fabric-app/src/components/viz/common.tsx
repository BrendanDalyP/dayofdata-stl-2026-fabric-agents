import { useEffect, useRef, useState, type ReactNode } from "react";

export const C = {
    blue: "#38bdf8",      // net sales / primary series
    blueSoft: "#7dd3fc",
    yellow: "#f5c542",    // budget / plan
    red: "#f87171",       // below plan
    green: "#2dd4a7",     // above plan
};

/** Width of a container, kept in sync with ResizeObserver. */
export function useWidth<T extends HTMLElement>(fallback = 600) {
    const ref = useRef<T>(null);
    const [width, setWidth] = useState(fallback);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, Math.floor(e.contentRect.width))));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    return [ref, width] as const;
}

/** Gap colour: red below plan, blue above, intensity by size. */
export function gapColor(gapPct: number, max = 15) {
    const t = Math.min(1, Math.abs(gapPct) / max);
    const alpha = 0.12 + 0.78 * t;
    return gapPct < 0 ? `rgba(248, 113, 113, ${alpha})` : `rgba(45, 212, 167, ${alpha})`;
}

export interface TooltipState { x: number; y: number; content: ReactNode }

export function Tooltip({ tip }: { tip: TooltipState | null }) {
    if (!tip) return null;
    return (
        <div
            role="tooltip"
            className="pointer-events-none absolute z-20 max-w-64 rounded-lg border border-border bg-card px-3 py-2 text-200 text-foreground shadow-container-16"
            style={{ left: tip.x + 12, top: tip.y + 12 }}
        >
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
