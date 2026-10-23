import { useEffect, useRef, useState, type ReactNode } from "react";

export const C = {
    blue: "#0078d4",
    blueSoft: "#4da3ff",
    yellow: "#f2c811",
    red: "#e05252",
    green: "#2fa572",
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
    return gapPct < 0 ? `rgba(224, 82, 82, ${alpha})` : `rgba(0, 120, 212, ${alpha})`;
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
