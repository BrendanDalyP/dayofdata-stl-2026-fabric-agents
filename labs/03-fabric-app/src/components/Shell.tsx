import type { ReactNode } from "react";
import { LayoutDashboard, MessagesSquare, Pin, Moon, Sun, Orbit } from "lucide-react";

import { useThemeContext } from "@/hooks/theme.context";
import { agentMode } from "@/agent";
import { cn } from "@/lib/utils";

export type PageId = "overview" | "ask" | "insights";

const NAV: Array<{ id: PageId; label: string; icon: typeof LayoutDashboard }> = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "ask", label: "Agent team", icon: MessagesSquare },
    { id: "insights", label: "Pinned insights", icon: Pin },
];

interface ShellProps {
    page: PageId;
    onNavigate: (page: PageId) => void;
    children: ReactNode;
}

export function Shell({ page, onNavigate, children }: ShellProps) {
    const { isDark, toggleTheme } = useThemeContext();

    return (
        <div className="starfield flex min-h-full flex-col bg-background md:flex-row">
            <aside className="flex shrink-0 flex-row items-center gap-2 border-b border-border bg-card/80 px-3 py-2 backdrop-blur md:w-60 md:flex-col md:items-stretch md:border-b-0 md:border-r md:px-4 md:py-6">
                <div className="mr-auto flex items-center gap-2 md:mb-8 md:mr-0">
                    <span className="flex icon-size-600 items-center justify-center rounded-lg bg-brand text-on-brand">
                        <Orbit className="icon-size-300" aria-hidden />
                    </span>
                    <div className="leading-tight">
                        <div className="font-heading text-400 font-bold text-emphasis-foreground">SpaceParts</div>
                        <div className="font-monospace text-100 uppercase tracking-widest text-muted-foreground">
                            Mission Control
                        </div>
                    </div>
                </div>

                <nav className="flex gap-1 md:flex-col" aria-label="Main">
                    {NAV.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => onNavigate(id)}
                            aria-current={page === id ? "page" : undefined}
                            className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2 text-left text-300 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                page === id
                                    ? "bg-brand/15 text-brand-foreground"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                            )}
                        >
                            <Icon className="icon-size-200 shrink-0" aria-hidden />
                            <span className="hidden sm:inline">{label}</span>
                        </button>
                    ))}
                </nav>

                <div className="flex items-center gap-2 md:mt-auto md:flex-col md:items-stretch">
                    <div className="hidden rounded-lg border border-border bg-muted/60 p-3 md:block">
                        <div className="font-monospace text-100 uppercase tracking-widest text-muted-foreground">Agent link</div>
                        <div className="mt-1 flex items-center gap-2 text-200 text-foreground">
                            <span
                                className={cn(
                                    "inline-block size-2 rounded-full",
                                    agentMode === "offline" ? "bg-muted-foreground" : "bg-signal trace-pulse",
                                )}
                            />
                            {agentMode === "offline" ? "Offline replay" : "3 agents via Rayfin function"}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={toggleTheme}
                        className="flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-200 text-muted-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
                    >
                        {isDark ? <Sun className="icon-size-200" /> : <Moon className="icon-size-200" />}
                        <span className="hidden md:inline">{isDark ? "Light" : "Dark"} mode</span>
                    </button>
                </div>
            </aside>

            <main className="min-w-0 flex-1">
                <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">{children}</div>
            </main>
        </div>
    );
}

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow: string; title: string; subtitle?: string; actions?: ReactNode }) {
    return (
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
                <div className="font-monospace text-100 uppercase tracking-[0.2em] text-signal">{eyebrow}</div>
                <h1 className="mt-1 font-page-title text-page-title font-semibold text-emphasis-foreground">{title}</h1>
                {subtitle && <p className="mt-1 max-w-2xl font-page-subtitle text-page-subtitle text-muted-foreground">{subtitle}</p>}
            </div>
            {actions}
        </header>
    );
}
