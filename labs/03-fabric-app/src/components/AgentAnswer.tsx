import { ArrowRight, Check, ClipboardList, Eye, Flag, LifeBuoy, Siren } from "lucide-react";

import { memberByKey, type AgentKey } from "@/agent/team";
import type { Reply, Target } from "@/agent/AskContext";
import { RichAnswer } from "@/components/answer/RichAnswer";
import { buildRecoveryPlan, createAction } from "@/services/actions";
import { eur, pct, type CommandData, type Subject } from "@/queries/overview";
import type { RecoveryPlanResult } from "../../rayfin/functions/src/types";
import { cn } from "@/lib/utils";

/** The agent's mark: a coloured dot plus its name (colour never appears without the label). */
export function AgentMark({ agent, size = "sm" }: { agent: AgentKey; size?: "sm" | "md" }) {
    const m = memberByKey(agent);
    return (
        <span className={cn("inline-flex items-center gap-1.5 font-semibold text-foreground", size === "md" ? "text-300" : "text-200")}>
            <span aria-hidden className={cn("inline-block rounded-full", size === "md" ? "size-2.5" : "size-2")} style={{ background: m.color }} />
            {m.name}
        </span>
    );
}

export function findSubjects(text: string, data?: CommandData): Subject[] {
    if (!data) return [];
    const lower = text.toLowerCase();
    return [...data.accounts, ...data.regions]
        .map((s) => ({ s, at: lower.indexOf(s.name.toLowerCase()) }))
        .filter((h) => h.at >= 0)
        .sort((a, b) => a.at - b.at)
        .map((h) => h.s)
        .slice(0, 2);
}

interface Props {
    question: string;
    reply: Reply;
    data?: CommandData;
    focus?: string;
    compact?: boolean;
    onRun: (key: string, fn: () => Promise<unknown>) => void;
    onAsk: (q: string, to: Target, context?: string) => void;
}

/** One agent's answer: mark, colour-coded text (tables become charts), sources, hand-offs and action buttons. */
export function AgentAnswer({ question, reply, data, focus, compact, onRun, onAsk }: Props) {
    const member = memberByKey(reply.agent);
    const text = reply.result?.answer ?? "";
    const entities = data ? [...data.accounts.map((a) => a.name), ...data.regions.map((r) => r.name), ...data.forecast.map((f) => f.productType)] : [];
    let subjects = findSubjects(text + " " + question, data);
    if (!subjects.length && focus && data) {
        const f = [...data.accounts, ...data.regions].find((s) => s.name === focus);
        if (f) subjects = [f];
    }
    const lead = subjects[0];
    const summary = text.split("\n").find((l) => l.trim() && !l.startsWith("|"))?.replace(/[*_#]/g, "").slice(0, 300);
    const sources = member.grounded.filter((t) => text.includes(t));

    type Btn = { key: string; label: string; icon: typeof Flag; run: () => Promise<unknown>; primary?: boolean };
    const buttons: Btn[] = [];
    for (const s of subjects) {
        const short = s.name.replace(" Region", "");
        if (reply.agent === "sales" && s.actualYtd < s.budgetYtd) buttons.push({ key: `plan:${s.name}`, label: `Recovery plan · ${short}`, icon: LifeBuoy, primary: true, run: () => buildRecoveryPlan(s, "sales") });
        if (reply.agent === "operations") buttons.push({ key: `esc:${s.name}`, label: `Escalate orders · ${short}`, icon: Siren, primary: true, run: () => createAction({ kind: "escalation", title: `Escalate overdue orders · ${s.name}`, subject: s.name, detail: summary, agent: "operations", sourceQuestion: question }) });
        if (reply.agent === "sales") buttons.push({ key: `fu:${s.name}`, label: `Follow up · ${short}`, icon: Flag, run: () => createAction({ kind: "follow-up", title: `Follow up with ${s.name}`, subject: s.name, detail: summary, agent: "sales", sourceQuestion: question }) });
        buttons.push({ key: `watch:${s.name}`, label: `Watch · ${short}`, icon: Eye, run: () => createAction({ kind: "watch", title: `Watch ${s.name}`, subject: s.name, detail: summary, agent: reply.agent, sourceQuestion: question }) });
    }
    if (reply.agent === "planning" && data) {
        const pt = data.forecast.find((f) => text.includes(f.productType) && f.forecast < f.budget);
        if (pt) buttons.push({ key: `fc:${pt.productType}`, label: `Flag forecast gap · ${pt.productType}`, icon: Flag, primary: true, run: () => createAction({ kind: "follow-up", title: `Forecast below budget · ${pt.productType}`, subject: pt.productType, detail: summary, agent: "planning", sourceQuestion: question }) });
    }
    if (!buttons.length && reply.result) {
        buttons.push({ key: "save", label: "Add to action board", icon: ClipboardList, run: () => createAction({ kind: "follow-up", title: question.slice(0, 190), detail: summary, agent: reply.agent, sourceQuestion: question }) });
    }

    const handoffs = member.handoffs
        .filter((h) => !h.label.includes("{subject}") || lead)
        .map((h) => ({ ...h, label: h.label.replace("{subject}", lead?.name ?? ""), question: h.question.replace("{subject}", lead?.name ?? "") }));

    return (
        <div className="rounded-lg border border-border bg-card p-3.5" style={{ borderLeft: `3px solid ${member.color}` }}>
            <div className="mb-1.5 flex items-center justify-between gap-2">
                <AgentMark agent={reply.agent} />
                {reply.result && <span className="tabular text-100 text-muted-foreground" title="via the agent's MCP endpoint">answered as the app · {(reply.result.totalMs / 1000).toFixed(1)}s</span>}
            </div>

            {reply.error ? (
                <p role="alert" className="text-200 text-destructive">{reply.error}</p>
            ) : reply.result ? (
                <>
                    <div className={cn("overflow-auto", compact ? "max-h-64" : "max-h-[28rem]")}>
                        <RichAnswer text={reply.result.answer} color={member.color} highlights={{ entities }} />
                    </div>
                    {sources.length > 0 && <p className="mt-1.5 text-100 text-muted-foreground">Sources: {sources.map((s) => <code key={s} className="font-monospace">{s}</code>).reduce<React.ReactNode[]>((a, c, i) => (i ? [...a, ", ", c] : [c]), [])}</p>}
                </>
            ) : (
                <div className="space-y-1.5" aria-label={`Waiting for ${member.name}`}>
                    <div className="h-2.5 w-3/4 rounded bg-muted trace-pulse" />
                    <div className="h-2.5 w-1/2 rounded bg-muted trace-pulse" />
                    <p className="text-100 text-muted-foreground">{member.name} is querying the lakehouse…</p>
                </div>
            )}

            {reply.result && (
                <div className="mt-3 space-y-2">
                    {handoffs.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {handoffs.map((h) => (
                                <button key={h.label} type="button" onClick={() => onAsk(h.question, h.to, lead?.name)}
                                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-200 text-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                    <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: memberByKey(h.to).color }} />
                                    {h.label} <ArrowRight className="icon-size-100 text-muted-foreground" />
                                </button>
                            ))}
                        </div>
                    )}
                    {buttons.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                            {buttons.map((b) => {
                                const st = reply.done[b.key];
                                const BIcon = st === "done" ? Check : b.icon;
                                return (
                                    <button key={b.key} type="button" disabled={st === "busy" || st === "done"} onClick={() => onRun(b.key, b.run)}
                                        title={st?.startsWith("Failed") ? st : "Runs a Rayfin function"}
                                        className={cn("inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-200 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                            st === "done" ? "border border-border text-success" :
                                                st?.startsWith("Failed") ? "border border-destructive/50 text-destructive" :
                                                    b.primary ? "bg-brand text-on-brand hover:opacity-90" : "border border-border text-foreground hover:bg-muted",
                                            st === "busy" && "trace-pulse")}>
                                        <BIcon className="icon-size-100" aria-hidden />{st === "done" ? `${b.label} — saved` : b.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
            {reply.plan && <PlanCard plan={reply.plan} onAsk={onAsk} />}
        </div>
    );
}

export function PlanCard({ plan, onAsk }: { plan: RecoveryPlanResult; onAsk: (q: string, to: Target, context?: string) => void }) {
    const verdictColor = plan.verdict === "on track" || plan.verdict === "recoverable" ? "#0ca30c" : plan.verdict === "stretch" ? "#b37a00" : "#d03b3b";
    return (
        <div className="mt-3 rounded-lg border border-border bg-background p-3">
            <div className="flex items-center justify-between">
                <span className="text-200 font-semibold text-foreground">Recovery plan · <code className="font-monospace text-100 text-muted-foreground">buildRecoveryPlan()</code></span>
                <span className="rounded-full border border-border px-2 py-0.5 text-100 font-semibold" style={{ color: verdictColor }}>{plan.verdict}</span>
            </div>
            <p className="mt-1.5 text-300 text-foreground">
                <strong>{plan.subject}</strong> is <strong style={{ color: "#d03b3b" }}>{eur(plan.gapYtdEur, true)}</strong> ({pct(plan.gapYtdPct, true)}) against budget Jan–Jul.
                Landing the full-year budget needs <strong>{eur(plan.requiredMonthlyEur, true)}</strong> a month for {plan.monthsRemaining} months
                against a budget of {eur(plan.budgetMonthlyEur, true)} (<strong>{pct(plan.upliftPct, true)}</strong>).
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-200 text-foreground">{plan.steps.slice(1).map((s) => <li key={s}>{s}</li>)}</ol>
            <div className="mt-2 flex flex-wrap gap-1.5">
                {([["operations", `Which overdue or late orders does the key account ${plan.subject} have, in euros?`, "Ask Operations about the backlog"],
                   ["planning", `Does the 2022 forecast already assume ${plan.subject} misses budget?`, "Ask Planning about the forecast"]] as const).map(([to, q, label]) => (
                    <button key={to} type="button" onClick={() => onAsk(q, to, plan.subject)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-200 text-foreground hover:bg-muted">
                        <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: memberByKey(to).color }} />{label} <ArrowRight className="icon-size-100 text-muted-foreground" />
                    </button>
                ))}
            </div>
            <p className="mt-2 text-100 text-muted-foreground">Saved to the action board.</p>
        </div>
    );
}
