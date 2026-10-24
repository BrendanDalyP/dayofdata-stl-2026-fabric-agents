import type { ReactNode } from "react";

import { useAsk, type Target } from "@/agent/AskContext";
import { memberByKey, type AgentKey } from "@/agent/team";
import { AskLink } from "@/components/Card";
import { cn } from "@/lib/utils";
import { sourceDetail } from "@/lib/sources";

/** An ask chip for a given agent. */
export function Ask({ agent, label, q, ctx }: { agent: AgentKey; label: string; q: string; ctx?: string }) {
    const { ask } = useAsk();
    const m = memberByKey(agent);
    return <AskLink color={m.color} agent={m.tag} label={label} onClick={() => ask(q, agent as Target, ctx)} />;
}

/** A KPI tile: label, hero value, note, optional sparkline and the agent who can explain it. */
export function Kpi({ label, value, note, tone, spark, ask, onClick, source }: {
    label: string; value?: string; note?: ReactNode; tone?: "bad" | "good"; spark?: ReactNode; ask?: ReactNode; onClick?: () => void;
    /** The app.* table behind the number; shown on hover with the rules applied. */
    source?: string;
}) {
    return (
        <div className={cn("flex h-full flex-col rounded-lg border border-border bg-card px-4 py-3", onClick && "cursor-pointer hover:border-brand")} onClick={onClick}>
            <div className="text-200 font-semibold text-muted-foreground">{label}</div>
            <div className="mt-1 flex items-end justify-between gap-2">
                <div title={source ? sourceDetail(source) : undefined} className={cn("font-heading text-hero-800 font-semibold leading-hero-800 tracking-tight", source && "cursor-help", tone === "bad" ? "text-destructive" : "text-emphasis-foreground")}>
                    {value ?? <span className="inline-block h-8 w-28 rounded bg-muted trace-pulse" />}
                </div>
                {spark}
            </div>
            <div className="mt-1 truncate text-100 text-muted-foreground">{note}</div>
            {ask && <div className="mt-2" onClick={(e) => e.stopPropagation()}>{ask}</div>}
        </div>
    );
}
