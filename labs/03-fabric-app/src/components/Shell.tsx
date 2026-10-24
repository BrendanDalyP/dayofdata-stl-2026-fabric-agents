import type { ReactNode } from "react";
import { Search } from "lucide-react";

import { useAsk } from "@/agent/AskContext";
import { agentMode } from "@/agent";
import { BrandMark } from "@/components/Brand";
import { ThemeMenu } from "@/components/ThemeMenu";
import { cn } from "@/lib/utils";

export type TabId = "overview" | "accounts" | "operations" | "plan" | "actions";

const TABS: Array<{ id: TabId; label: string; soon?: boolean }> = [
    { id: "overview", label: "Overview" },
    { id: "accounts", label: "Accounts" },
    { id: "operations", label: "Operations", soon: true },
    { id: "plan", label: "Plan", soon: true },
    { id: "actions", label: "Actions" },
];

/** Fixed app frame: a navy brand band with tabs; the tab content fills the rest of the viewport (no page scroll). */
export function Shell({ tab, onTab, children }: { tab: TabId; onTab: (t: TabId) => void; children: ReactNode }) {
    const { setOpen, actions } = useAsk();
    const open = actions?.filter((a) => a.status === "open").length ?? 0;

    return (
        <div className="flex h-screen min-h-0 flex-col bg-background">
            <header className="brand-band flex h-14 shrink-0 items-center gap-6 border-b px-5">
                <div className="flex items-center gap-2.5">
                    <BrandMark size={30} />
                    <div className="leading-tight">
                        <div className="font-heading text-400 font-semibold tracking-tight text-white">SpaceParts <span className="font-normal text-white/70">Mission Control</span></div>
                        <div className="text-100 text-white/60">Sales &amp; operations · data to 21 Aug 2022</div>
                    </div>
                </div>

                <nav aria-label="Sections" className="flex h-full items-stretch gap-1">
                    {TABS.map((t) => (
                        <button key={t.id} type="button" disabled={t.soon} onClick={() => onTab(t.id)} aria-current={tab === t.id ? "page" : undefined}
                            title={t.soon ? "Coming next" : undefined}
                            className={cn("relative inline-flex items-center gap-1.5 px-3 text-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
                                tab === t.id ? "font-semibold text-white" : "text-white/65 hover:text-white",
                                t.soon && "cursor-not-allowed text-white/30 hover:text-white/30")}>
                            {t.label}
                            {t.id === "actions" && open > 0 && <span className="tabular rounded-full bg-white/15 px-1.5 text-100 font-semibold text-white">{open}</span>}
                            {tab === t.id && <span aria-hidden className="absolute inset-x-2 bottom-0 h-[3px] rounded-t bg-[#f0b429]" />}
                        </button>
                    ))}
                </nav>

                <div className="ml-auto flex items-center gap-2">
                    <span className="hidden items-center gap-1.5 text-100 text-white/70 xl:inline-flex" title="Charts read the lakehouse through a Rayfin connector, as you">
                        <span aria-hidden className={cn("inline-block size-2 rounded-full", agentMode === "offline" ? "bg-white/40" : "bg-[#3ecf6e]")} />
                        {agentMode === "offline" ? "Offline replay" : "Live on OneLake"}
                    </span>
                    <button type="button" onClick={() => setOpen(true)}
                        className="inline-flex w-64 items-center gap-2 rounded-md border border-white/20 bg-white/10 px-2.5 py-1.5 text-300 text-white/80 hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
                        <Search className="icon-size-200" /> Ask the agents…
                        <kbd className="ml-auto whitespace-nowrap rounded border border-white/25 px-1 font-monospace text-100">Ctrl K</kbd>
                    </button>
                    <ThemeMenu />
                </div>
            </header>
            <main className="min-h-0 flex-1 overflow-hidden p-4 max-[1100px]:overflow-y-auto">{children}</main>
        </div>
    );
}
