import type { ReactNode } from "react";
import { Moon, Search, Sun } from "lucide-react";

import { useThemeContext } from "@/hooks/theme.context";
import { useAsk } from "@/agent/AskContext";
import { agentMode } from "@/agent";
import { cn } from "@/lib/utils";

export type TabId = "overview" | "accounts" | "operations" | "plan" | "actions";

const TABS: Array<{ id: TabId; label: string; soon?: boolean }> = [
    { id: "overview", label: "Overview" },
    { id: "accounts", label: "Accounts" },
    { id: "operations", label: "Operations", soon: true },
    { id: "plan", label: "Plan", soon: true },
    { id: "actions", label: "Actions" },
];

/** Fixed app frame: one header row with tabs; the tab content fills the rest of the viewport (no page scroll). */
export function Shell({ tab, onTab, children }: { tab: TabId; onTab: (t: TabId) => void; children: ReactNode }) {
    const { isDark, toggleTheme } = useThemeContext();
    const { setOpen, actions } = useAsk();
    const open = actions?.filter((a) => a.status === "open").length ?? 0;

    return (
        <div className="flex h-screen min-h-0 flex-col bg-background">
            <header className="flex h-14 shrink-0 items-center gap-6 border-b border-border bg-card px-5">
                <div className="flex items-center gap-2.5">
                    <span aria-hidden className="flex size-7 items-center justify-center rounded-md bg-emphasis-foreground text-200 font-bold text-background">SP</span>
                    <div className="leading-tight">
                        <div className="font-heading text-300 font-semibold text-emphasis-foreground">SpaceParts Co.</div>
                        <div className="text-100 text-muted-foreground">Sales &amp; operations · data to 21 Aug 2022</div>
                    </div>
                </div>

                <nav aria-label="Sections" className="flex h-full items-stretch gap-1">
                    {TABS.map((t) => (
                        <button key={t.id} type="button" disabled={t.soon} onClick={() => onTab(t.id)} aria-current={tab === t.id ? "page" : undefined}
                            title={t.soon ? "Coming next" : undefined}
                            className={cn("relative inline-flex items-center gap-1.5 px-3 text-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                tab === t.id ? "font-semibold text-emphasis-foreground" : "text-muted-foreground hover:text-foreground",
                                t.soon && "cursor-not-allowed opacity-45 hover:text-muted-foreground")}>
                            {t.label}
                            {t.id === "actions" && open > 0 && (
                                <span className="tabular rounded-full bg-muted px-1.5 text-100 font-semibold text-foreground">{open}</span>
                            )}
                            {tab === t.id && <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand" />}
                        </button>
                    ))}
                </nav>

                <div className="ml-auto flex items-center gap-2">
                    <span className="hidden items-center gap-1.5 text-100 text-muted-foreground lg:inline-flex" title="Charts read the lakehouse through a Rayfin connector, as you">
                        <span aria-hidden className={cn("inline-block size-2 rounded-full", agentMode === "offline" ? "bg-[#898781]" : "bg-[#0ca30c]")} />
                        {agentMode === "offline" ? "Offline replay" : "Live on OneLake"}
                    </span>
                    <button type="button" onClick={() => setOpen(true)}
                        className="inline-flex w-56 items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-300 text-muted-foreground hover:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <Search className="icon-size-200" /> Ask about the business…
                        <kbd className="ml-auto rounded border border-border px-1 font-monospace text-100">Ctrl K</kbd>
                    </button>
                    <button type="button" onClick={toggleTheme} aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
                        className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        {isDark ? <Sun className="icon-size-200" /> : <Moon className="icon-size-200" />}
                    </button>
                </div>
            </header>
            <main className="min-h-0 flex-1 overflow-hidden p-4 max-[1100px]:overflow-y-auto">{children}</main>
        </div>
    );
}
