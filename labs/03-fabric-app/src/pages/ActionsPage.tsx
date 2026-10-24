import { useState } from "react";
import { CircleCheck, Eye, Flag, LifeBuoy, RotateCcw, Siren } from "lucide-react";

import { useAsk } from "@/agent/AskContext";
import { colorOf, memberByKey, type AgentKey } from "@/agent/team";
import { Skeleton } from "@/components/Card";
import { AnswerLine } from "@/components/AnswerLine";
import { STATUS, fmtEurShort } from "@/components/viz/common";
import { actionTip, setActionStatus, type ActionKind, type ActionRow } from "@/services/actions";
import { navigate } from "@/lib/nav";
import { cn } from "@/lib/utils";

const KIND: Record<ActionKind, { label: string; icon: typeof Flag }> = {
    "recovery-plan": { label: "Recovery plan", icon: LifeBuoy },
    escalation: { label: "Escalation", icon: Siren },
    "follow-up": { label: "Follow-up", icon: Flag },
    watch: { label: "Watch", icon: Eye },
};
const COLUMNS = [
    { id: "high", label: "High priority", status: STATUS.critical },
    { id: "medium", label: "Medium", status: STATUS.warning },
    { id: "low", label: "Low", status: STATUS.good },
    { id: "done", label: "Done", status: undefined },
] as const;
const isAgent = (a?: string): a is AgentKey => a === "sales" || a === "operations" || a === "planning";

export function ActionsPage() {
    const { actions, actionsError, refreshActions, ask } = useAsk();
    const [agent, setAgent] = useState<AgentKey | "all">("all");
    const [kind, setKind] = useState<ActionKind | "all">("all");

    if (actionsError) return <p role="alert" className="rounded-lg border border-destructive/40 bg-card p-4 text-300 text-destructive">{actionsError}</p>;
    if (!actions) return <Skeleton />;

    const shown = actions.filter((a) => (agent === "all" || a.agent === agent) && (kind === "all" || a.kind === kind));
    const col = (id: (typeof COLUMNS)[number]["id"]) => shown.filter((a) => (id === "done" ? a.status === "done" : a.status === "open" && a.priority === id));
    const toggle = async (a: ActionRow) => { await setActionStatus(a.id, a.status === "open" ? "done" : "open"); void refreshActions(); };

    const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
        <button type="button" onClick={onClick} aria-pressed={active}
            className={cn("inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "border-brand bg-accent font-semibold text-emphasis-foreground" : "border-border text-muted-foreground hover:text-foreground")}>{children}</button>
    );

    const openItems = actions.filter((a) => a.status === "open");
    const high = openItems.filter((a) => a.priority === "high");
    const done = actions.length - openItems.length;

    return (
        <div className="flex h-full min-h-0 flex-col gap-3">
            <AnswerLine question="What are we doing about it?" source="the app's own database (ActionItem), written by Rayfin functions"
                answer={openItems.length
                    ? `${openItems.length} open action${openItems.length === 1 ? "" : "s"}, ${high.length} high priority${high[0] ? `, led by "${high[0].title}"` : ""}; ${done} done.`
                    : "Nothing open yet. Ask an agent, then use the action buttons under its answer."} />
            <div className="flex flex-wrap items-center gap-2">
                <h1 className="mr-2 font-heading text-500 font-semibold text-emphasis-foreground">Action board</h1>
                <Chip active={agent === "all"} onClick={() => setAgent("all")}>All agents</Chip>
                {(["sales", "operations", "planning"] as AgentKey[]).map((k) => (
                    <Chip key={k} active={agent === k} onClick={() => setAgent(k)}><span aria-hidden className="inline-block size-2 rounded-full" style={{ background: colorOf(k) }} />{memberByKey(k).name}</Chip>
                ))}
                <span className="mx-1 h-5 w-px bg-border" />
                <Chip active={kind === "all"} onClick={() => setKind("all")}>All kinds</Chip>
                {(Object.keys(KIND) as ActionKind[]).map((k) => {
                    const I = KIND[k].icon;
                    return <Chip key={k} active={kind === k} onClick={() => setKind(k)}><I className="icon-size-100" />{KIND[k].label}</Chip>;
                })}
                <button type="button" onClick={() => void refreshActions()} aria-label="Refresh" className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-muted"><RotateCcw className="icon-size-200" /></button>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-4 gap-3 max-[1100px]:grid-cols-1">
                {COLUMNS.map((c) => {
                    const items = col(c.id);
                    return (
                        <section key={c.id} className="flex min-h-0 flex-col rounded-lg border border-border bg-muted/50 p-2">
                            <header className="mb-2 flex items-center gap-2 px-1">
                                {c.status && <span aria-hidden style={{ color: c.status.color }}>{c.status.icon}</span>}
                                <h2 className="text-300 font-semibold text-emphasis-foreground">{c.label}</h2>
                                <span className="tabular ml-auto text-200 text-muted-foreground">{items.length}</span>
                            </header>
                            <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
                                {items.length === 0 && <li className="px-2 py-4 text-center text-200 text-muted-foreground">Nothing here</li>}
                                {items.map((a) => {
                                    const K = KIND[a.kind];
                                    return (
                                        <li key={a.id} className={cn("rounded-md border border-border bg-card p-3", a.status === "done" && "opacity-60")}
                                            style={{ borderLeft: `3px solid ${isAgent(a.agent) ? colorOf(a.agent) : "var(--color-border)"}` }}>
                                            <div className="flex items-start gap-2">
                                                <button type="button" onClick={() => void toggle(a)} aria-label={a.status === "open" ? "Mark done" : "Reopen"} title={actionTip(a.status === "open" ? "done" : "reopen")}
                                                    className="mt-0.5 text-muted-foreground hover:text-success focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                                    <CircleCheck className={cn("icon-size-200", a.status === "done" && "text-success")} />
                                                </button>
                                                <div className="min-w-0 flex-1">
                                                    <div className={cn("text-300 font-semibold text-emphasis-foreground", a.status === "done" && "line-through")}>{a.title}</div>
                                                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-100 text-muted-foreground">
                                                        <span className="inline-flex items-center gap-1"><K.icon className="icon-size-100" />{K.label}</span>
                                                        {a.dueDate && <span>due {a.dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
                                                        {a.amountEur ? <span className="tabular">{fmtEurShort(a.amountEur)} to land</span> : null}
                                                        {isAgent(a.agent) && <span className="inline-flex items-center gap-1"><span aria-hidden className="inline-block size-1.5 rounded-full" style={{ background: colorOf(a.agent) }} />{memberByKey(a.agent).name}</span>}
                                                    </div>
                                                    {a.owner && <div className="text-100 text-muted-foreground">{a.owner}</div>}
                                                    {a.detail && <p className="mt-1 line-clamp-3 whitespace-pre-line text-200 text-foreground">{a.detail}</p>}
                                                    <div className="mt-1.5 flex flex-wrap gap-2 text-100">
                                                        {a.subject && <button type="button" onClick={() => navigate("accounts", a.subject)} className="font-semibold text-brand-foreground hover:underline">Open {a.subject}</button>}
                                                        {a.subject && isAgent(a.agent) && <button type="button" onClick={() => ask(`What is the latest on ${a.subject}?`, a.agent as AgentKey, a.subject)} className="font-semibold text-brand-foreground hover:underline">Ask again</button>}
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    );
                })}
            </div>
        </div>
    );
}
