import type { ReactNode } from "react";
import { Moon, Sun, Orbit, Database, Bot, Zap } from "lucide-react";

import { useThemeContext } from "@/hooks/theme.context";
import { agentMode } from "@/agent";
import { cn } from "@/lib/utils";

/** One-page command center: a slim top bar, then the page. */
export function Shell({ children }: { children: ReactNode }) {
    const { isDark, toggleTheme } = useThemeContext();
    return (
        <div className="min-h-full bg-background">
            <header className="sticky top-0 z-30 border-b border-border bg-card/85 backdrop-blur">
                <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 md:px-6">
                    <div className="flex items-center gap-2">
                        <span className="flex icon-size-600 items-center justify-center rounded-lg bg-brand text-on-brand">
                            <Orbit className="icon-size-300" aria-hidden />
                        </span>
                        <div className="leading-tight">
                            <div className="font-heading text-400 font-bold text-emphasis-foreground">SpaceParts Co.</div>
                            <div className="font-monospace text-100 uppercase tracking-widest text-muted-foreground">Business command center</div>
                        </div>
                    </div>
                    <div className="hidden flex-1 items-center gap-4 font-monospace text-100 text-muted-foreground lg:flex">
                        <span className="flex items-center gap-1"><Database className="icon-size-100 text-brand-foreground" /> lakehouse connector · as you</span>
                        <span className="flex items-center gap-1">
                            <Bot className="icon-size-100 text-brand-foreground" /> 3 data agents · MCP
                            <span className={cn("ml-1 inline-block size-2 rounded-full", agentMode === "offline" ? "bg-muted-foreground" : "bg-signal trace-pulse")} />
                            {agentMode === "offline" && "offline replay"}
                        </span>
                        <span className="flex items-center gap-1"><Zap className="icon-size-100 text-brand-foreground" /> actions · Rayfin functions</span>
                    </div>
                    <button type="button" onClick={toggleTheme} aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
                        className="ml-auto flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-200 text-muted-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        {isDark ? <Sun className="icon-size-200" /> : <Moon className="icon-size-200" />}
                    </button>
                </div>
            </header>
            <main className="mx-auto w-full max-w-[1800px] px-4 py-4 md:px-6">{children}</main>
        </div>
    );
}
