import { useEffect, useRef, useState } from "react";
import { Check, Palette } from "lucide-react";
import { cn } from "@/lib/utils";

type ThemeName = "light" | "dark" | "midnight";
const THEMES: Array<{ id: ThemeName; label: string; swatch: [string, string] }> = [
    { id: "light", label: "Light", swatch: ["#f9f9f7", "#2a78d6"] },
    { id: "dark", label: "Dark", swatch: ["#1a1a19", "#3987e5"] },
    { id: "midnight", label: "Midnight", swatch: ["#111c2e", "#4f93ec"] },
];
const KEY = "spaceparts.theme";

function apply(t: ThemeName) {
    const root = document.documentElement;
    root.classList.toggle("dark", t !== "light");
    if (t === "midnight") root.dataset.theme = "midnight"; else delete root.dataset.theme;
    root.setAttribute("data-appearance", t === "light" ? "light" : "dark");
}

export function initTheme() {
    let t: ThemeName = "light";
    try { t = (localStorage.getItem(KEY) as ThemeName) || "light"; } catch { /* storage unavailable */ }
    apply(t);
}

/** Theme picker: Light / Dark / Midnight, remembered per viewer. */
export function ThemeMenu() {
    const [open, setOpen] = useState(false);
    const [theme, setTheme] = useState<ThemeName>(() => {
        try { return (localStorage.getItem(KEY) as ThemeName) || "light"; } catch { return "light"; }
    });
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, []);

    const choose = (t: ThemeName) => {
        setTheme(t);
        apply(t);
        try { localStorage.setItem(KEY, t); } catch { /* ignore */ }
        setOpen(false);
    };

    return (
        <div ref={ref} className="relative">
            <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Theme"
                className="inline-flex items-center gap-1.5 rounded-md border border-white/20 px-2.5 py-1.5 text-200 text-white/85 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
                <Palette className="icon-size-200" /> Theme
            </button>
            {open && (
                <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-48 rounded-lg border border-border bg-card p-1.5 text-foreground shadow-container-16">
                    {THEMES.map((t) => (
                        <button key={t.id} role="menuitemradio" aria-checked={theme === t.id} type="button" onClick={() => choose(t.id)}
                            className={cn("flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-300 hover:bg-muted", theme === t.id && "font-semibold")}>
                            <span aria-hidden className="flex h-5 w-8 overflow-hidden rounded border border-border">
                                <span className="flex-1" style={{ background: t.swatch[0] }} /><span className="w-2" style={{ background: t.swatch[1] }} />
                            </span>
                            {t.label}
                            {theme === t.id && <Check className="ml-auto icon-size-200 text-brand-foreground" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
