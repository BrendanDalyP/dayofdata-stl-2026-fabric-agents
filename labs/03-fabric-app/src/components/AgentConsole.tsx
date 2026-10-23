import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
    ArrowUp, Check, CircleCheck, ClipboardList, Eye, Flag, LifeBuoy, RotateCcw, ShieldCheck, Siren, Target, TrendingUp, Truck, Users, Zap,
} from "lucide-react";

import { askAgent, type AgentAnswer } from "@/agent";
import { TEAM, memberByKey, type AgentKey } from "@/agent/team";
import { Markdown } from "@/components/Markdown";
import { RequestTrace } from "@/components/RequestTrace";
import { buildRecoveryPlan, createAction, listActions, setActionStatus, type ActionRow } from "@/services/actions";
import { eur, pct, type CommandData, type Subject } from "@/queries/overview";
import type { RecoveryPlanResult } from "../../rayfin/functions/src/types";
import { cn } from "@/lib/utils";

type Target = AgentKey | "team";
const ICON: Record<Target, typeof Users> = { sales: TrendingUp, operations: Truck, planning: Target, team: Users };

export interface PendingAsk { id: number; question: string; agent: Target }

interface Reply {
    agent: AgentKey;
    result?: AgentAnswer;
    error?: string;
    done: Record<string, "busy" | "done" | string>;
    plan?: RecoveryPlanResult;
}
interface Turn { id: string; question: string; replies: Reply[] }

interface Props { data?: CommandData; pending?: PendingAsk; focus?: string }

export function AgentConsole({ data, pending, focus }: Props) {
    const [tab, setTab] = useState<"chat" | "actions">("chat");
    const [target, setTarget] = useState<Target>("sales");
    const [turns, setTurns] = useState<Turn[]>([]);
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const [actions, setActions] = useState<ActionRow[] | null>(null);
    const [actionsError, setActionsError] = useState<string>();
    const convo = useRef<Partial<Record<AgentKey, string>>>({});
    const endRef = useRef<HTMLDivElement>(null);

    const refreshActions = useCallback(async () => {
        try { setActionsError(undefined); setActions(await listActions()); }
        catch (e) { setActionsError(e instanceof Error ? e.message : String(e)); setActions([]); }
    }, []);
    useEffect(() => { void refreshActions(); }, [refreshActions]);
    useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turns]);

    const patch = (turnId: string, agent: AgentKey, change: (r: Reply) => Partial<Reply>) =>
        setTurns((t) => t.map((x) => (x.id !== turnId ? x : { ...x, replies: x.replies.map((r) => (r.agent === agent ? { ...r, ...change(r) } : r)) })));

    const ask = useCallback(async (question: string, to: Target) => {
        const q = question.trim();
        if (!q) return;
        setTab("chat");
        setTarget(to);
        const id = crypto.randomUUID();
        const agents: AgentKey[] = to === "team" ? TEAM.map((m) => m.key) : [to];
        setTurns((t) => [...t, { id, question: q, replies: agents.map((agent) => ({ agent, done: {} })) }]);
        setInput("");
        setBusy(true);
        await Promise.all(agents.map(async (agent) => {
            try {
                const result = await askAgent(agent, q, convo.current[agent] ?? "");
                convo.current[agent] = result.conversation;
                patch(id, agent, () => ({ result }));
            } catch (err) {
                patch(id, agent, () => ({ error: err instanceof Error ? err.message : String(err) }));
            }
        }));
        setBusy(false);
    }, []);

    // Questions sent from the visuals
    const lastPending = useRef<number | undefined>(undefined);
    useEffect(() => {
        if (pending && pending.id !== lastPending.current) {
            lastPending.current = pending.id;
            void ask(pending.question, pending.agent);
        }
    }, [pending, ask]);

    async function runAction(turn: Turn, reply: Reply, key: string, fn: () => Promise<unknown>) {
        patch(turn.id, reply.agent, (r) => ({ done: { ...r.done, [key]: "busy" } }));
        try {
            const out = await fn();
            patch(turn.id, reply.agent, (r) => ({
                done: { ...r.done, [key]: "done" },
                ...(key.startsWith("plan:") ? { plan: out as RecoveryPlanResult } : {}),
            }));
            void refreshActions();
        } catch (e) {
            patch(turn.id, reply.agent, (r) => ({ done: { ...r.done, [key]: `Failed: ${e instanceof Error ? e.message : e}` } }));
        }
    }

    const open = actions?.filter((a) => a.status === "open").length ?? 0;
    const chips = target === "team"
        ? ["How is Government Contract doing?", "What should leadership worry about this month?"]
        : memberByKey(target).chips;

    return (
        <div className="flex h-full min-h-0 flex-col rounded-xl border border-brand/40 bg-card shadow-container-8">
            {/* header */}
            <div className="border-b border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                    <div>
                        <div className="font-monospace text-100 uppercase tracking-[0.2em] text-signal">Agent team · over MCP</div>
                        <div className="font-heading text-400 font-semibold text-emphasis-foreground">Ask · decide · act</div>
                    </div>
                    <div className="flex rounded-lg border border-border p-0.5" role="tablist">
                        {(["chat", "actions"] as const).map((t) => (
                            <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setTab(t)}
                                className={cn("flex items-center gap-1 rounded-md px-2.5 py-1 text-200 capitalize focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    tab === t ? "bg-muted text-emphasis-foreground" : "text-muted-foreground hover:text-foreground")}>
                                {t === "actions" ? <ClipboardList className="icon-size-100" /> : <Zap className="icon-size-100" />}
                                {t === "actions" ? `Actions${open ? ` · ${open}` : ""}` : "Chat"}
                            </button>
                        ))}
                    </div>
                </div>
                <div role="radiogroup" aria-label="Choose an agent" className="grid grid-cols-4 gap-1">
                    {([...TEAM.map((m) => m.key), "team"] as Target[]).map((k) => {
                        const Icon = ICON[k];
                        const active = target === k;
                        return (
                            <button key={k} type="button" role="radio" aria-checked={active} onClick={() => setTarget(k)}
                                className={cn("flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    active ? "border-brand bg-brand/15 text-emphasis-foreground" : "border-border text-muted-foreground hover:border-brand/50")}>
                                <Icon className="icon-size-200" aria-hidden />
                                <span className="font-semibold">{k === "team" ? "Whole team" : memberByKey(k).name}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {tab === "chat" ? (
                <>
                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3" aria-live="polite">
                        {turns.length === 0 && (
                            <div className="space-y-2">
                                <p className="text-200 text-muted-foreground">
                                    Click any row or bar in the visuals, or pick a question. Answers come with action buttons that run Rayfin functions.
                                </p>
                                {chips.map((q) => (
                                    <button key={q} type="button" onClick={() => void ask(q, target)}
                                        className="block w-full rounded-lg border border-border px-3 py-2 text-left text-200 text-foreground hover:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                        {q}
                                    </button>
                                ))}
                            </div>
                        )}
                        {turns.map((turn) => (
                            <article key={turn.id} className="space-y-2">
                                <p className="ml-auto max-w-[90%] rounded-xl rounded-br-sm bg-brand px-3 py-1.5 text-200 text-on-brand">{turn.question}</p>
                                {turn.replies.map((reply) => (
                                    <AnswerCard key={reply.agent} turn={turn} reply={reply} data={data} focus={focus} onRun={runAction} onAsk={ask} />
                                ))}
                            </article>
                        ))}
                        <div ref={endRef} />
                    </div>
                    <form className="border-t border-border p-2" onSubmit={(e: FormEvent) => { e.preventDefault(); void ask(input, target); }}>
                        <div className="flex items-end gap-2 rounded-xl border border-border bg-background p-1.5 focus-within:border-brand">
                            <label htmlFor="console-q" className="sr-only">Ask the agent team</label>
                            <textarea id="console-q" rows={1} value={input} disabled={busy}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(input, target); } }}
                                placeholder={`Ask ${target === "team" ? "the whole team" : memberByKey(target).name}…`}
                                className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-300 text-foreground placeholder:text-muted-foreground focus:outline-none" />
                            <button type="submit" disabled={busy || !input.trim()} aria-label="Send"
                                className="flex icon-size-600 items-center justify-center rounded-lg bg-brand text-on-brand disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                <ArrowUp className="icon-size-200" />
                            </button>
                            {turns.length > 0 && (
                                <button type="button" aria-label="New conversation" onClick={() => { convo.current = {}; setTurns([]); }}
                                    className="flex icon-size-600 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted">
                                    <RotateCcw className="icon-size-200" />
                                </button>
                            )}
                        </div>
                    </form>
                </>
            ) : (
                <ActionBoard actions={actions} error={actionsError} onToggle={async (a) => { await setActionStatus(a.id, a.status === "open" ? "done" : "open"); void refreshActions(); }} />
            )}
        </div>
    );
}

// ── answers and their actions ───────────────────────────────────────────────

function findSubjects(text: string, data?: CommandData): Subject[] {
    if (!data) return [];
    const lower = text.toLowerCase();
    const hits = [...data.accounts, ...data.regions]
        .map((s) => ({ s, at: lower.indexOf(s.name.toLowerCase()) }))
        .filter((h) => h.at >= 0)
        .sort((a, b) => a.at - b.at)
        .map((h) => h.s);
    return hits.slice(0, 2);
}

function AnswerCard({ turn, reply, data, focus, onRun, onAsk }: {
    turn: Turn; reply: Reply; data?: CommandData; focus?: string;
    onRun: (turn: Turn, reply: Reply, key: string, fn: () => Promise<unknown>) => void;
    onAsk: (q: string, to: Target) => void;
}) {
    const member = memberByKey(reply.agent);
    const Icon = ICON[reply.agent];
    const text = reply.result?.answer ?? "";
    let subjects = findSubjects(text + " " + turn.question, data);
    if (!subjects.length && focus && data) {
        const f = [...data.accounts, ...data.regions].find((s) => s.name === focus);
        if (f) subjects = [f];
    }
    const summary = text.split("\n").find((l) => l.trim() && !l.startsWith("|"))?.replace(/[*_#]/g, "").slice(0, 300);

    type Btn = { key: string; label: string; icon: typeof Flag; run: () => Promise<unknown>; tone?: "primary" };
    const buttons: Btn[] = [];
    for (const s of subjects) {
        const short = s.name.replace(" Region", "");
        if (reply.agent === "sales") {
            if (s.actualYtd < s.budgetYtd) buttons.push({ key: `plan:${s.name}`, label: `Recovery plan · ${short}`, icon: LifeBuoy, tone: "primary", run: () => buildRecoveryPlan(s, "sales") });
            buttons.push({ key: `fu:${s.name}`, label: `Follow up · ${short}`, icon: Flag, run: () => createAction({ kind: "follow-up", title: `Follow up with ${s.name}`, subject: s.name, detail: summary, agent: "sales", sourceQuestion: turn.question }) });
        }
        if (reply.agent === "operations") {
            buttons.push({ key: `esc:${s.name}`, label: `Escalate orders · ${short}`, icon: Siren, tone: "primary", run: () => createAction({ kind: "escalation", title: `Escalate overdue orders · ${s.name}`, subject: s.name, detail: summary, agent: "operations", sourceQuestion: turn.question }) });
        }
        buttons.push({ key: `watch:${s.name}`, label: `Watch · ${short}`, icon: Eye, run: () => createAction({ kind: "watch", title: `Watch ${s.name}`, subject: s.name, detail: summary, agent: reply.agent, sourceQuestion: turn.question }) });
    }
    if (reply.agent === "planning" && data) {
        const pt = data.forecast.find((f) => text.includes(f.productType) && f.forecast < f.budget);
        if (pt) buttons.push({ key: `fc:${pt.productType}`, label: `Flag forecast gap · ${pt.productType}`, icon: Flag, tone: "primary", run: () => createAction({ kind: "follow-up", title: `Forecast below budget · ${pt.productType}`, subject: pt.productType, detail: summary, agent: "planning", sourceQuestion: turn.question }) });
    }
    if (!buttons.length && reply.result) {
        buttons.push({ key: "save", label: "Add to action board", icon: ClipboardList, run: () => createAction({ kind: "follow-up", title: turn.question.slice(0, 190), detail: summary, agent: reply.agent, sourceQuestion: turn.question }) });
    }

    return (
        <div className="rounded-xl rounded-tl-sm border border-border bg-background/60 p-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-heading text-200 font-semibold text-emphasis-foreground">
                    <Icon className="icon-size-100 text-brand-foreground" aria-hidden /> {member.name}
                </span>
                {reply.result && (
                    <span className="flex items-center gap-1 rounded-full bg-signal/15 px-2 py-0.5 font-monospace text-100 text-foreground">
                        <ShieldCheck className="icon-size-100" aria-hidden /> {reply.result.identity}
                    </span>
                )}
            </div>
            {reply.error ? (
                <p role="alert" className="text-200 text-destructive">{reply.error}</p>
            ) : reply.result ? (
                <div className="max-h-96 overflow-auto text-200"><Markdown>{reply.result.answer}</Markdown></div>
            ) : (
                <div className="space-y-1.5"><div className="h-2.5 w-3/4 rounded bg-muted trace-pulse" /><div className="h-2.5 w-1/2 rounded bg-muted trace-pulse" /></div>
            )}
            <RequestTrace agentLabel={member.name} totalMs={reply.result?.totalMs ?? (reply.error ? 0 : null)} serverMs={reply.result?.serverMs ?? 0} protocol={reply.result?.protocol} />

            {reply.result && buttons.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {buttons.map((b) => {
                        const st = reply.done[b.key];
                        const BIcon = st === "done" ? Check : b.icon;
                        return (
                            <button key={b.key} type="button" disabled={st === "busy" || st === "done"} onClick={() => onRun(turn, reply, b.key, b.run)}
                                title={typeof st === "string" && st.startsWith("Failed") ? st : "Runs a Rayfin function"}
                                className={cn("flex items-center gap-1 rounded-md border px-2 py-1 text-100 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    st === "done" ? "border-success/50 text-success" :
                                        st?.startsWith("Failed") ? "border-destructive/50 text-destructive" :
                                            b.tone === "primary" ? "border-brand bg-brand text-on-brand hover:opacity-90" : "border-border text-foreground hover:bg-muted",
                                    st === "busy" && "trace-pulse")}>
                                <BIcon className="icon-size-100" aria-hidden />{b.label}
                            </button>
                        );
                    })}
                </div>
            )}
            {reply.plan && <PlanCard plan={reply.plan} onAsk={onAsk} />}
        </div>
    );
}

function PlanCard({ plan, onAsk }: { plan: RecoveryPlanResult; onAsk: (q: string, to: Target) => void }) {
    const tone = plan.verdict === "on track" || plan.verdict === "recoverable" ? "text-success" : plan.verdict === "stretch" ? "text-signal" : "text-destructive";
    return (
        <div className="mt-2 rounded-lg border border-brand/40 bg-brand/5 p-3">
            <div className="flex items-center justify-between">
                <div className="font-monospace text-100 uppercase tracking-widest text-muted-foreground">buildRecoveryPlan()</div>
                <span className={cn("rounded-full bg-muted px-2 py-0.5 text-100 font-semibold", tone)}>{plan.verdict}</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <Stat label="Gap Jan–Jul" value={eur(plan.gapYtdEur, true)} sub={pct(plan.gapYtdPct, true)} bad={plan.gapYtdEur < 0} />
                <Stat label="Needed / month" value={eur(plan.requiredMonthlyEur, true)} sub={`budget ${eur(plan.budgetMonthlyEur, true)}`} />
                <Stat label="Uplift" value={pct(plan.upliftPct, true)} sub={`${plan.monthsRemaining} months left`} bad={plan.upliftPct > 15} />
            </div>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-200 text-foreground">
                {plan.steps.map((s) => <li key={s}>{s}</li>)}
            </ol>
            <div className="mt-2 flex flex-wrap gap-1.5">
                <button type="button" onClick={() => onAsk(`What open and overdue orders does ${plan.subject} have, in euros?`, "operations")}
                    className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-100 hover:bg-muted"><Truck className="icon-size-100" /> Ask Operations</button>
                <button type="button" onClick={() => onAsk(`Does the 2022 forecast assume ${plan.subject} misses budget?`, "planning")}
                    className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-100 hover:bg-muted"><Target className="icon-size-100" /> Ask Planning</button>
            </div>
            <div className="mt-2 text-100 text-muted-foreground">Saved to the action board.</div>
        </div>
    );
}

function Stat({ label, value, sub, bad }: { label: string; value: string; sub: string; bad?: boolean }) {
    return (
        <div className="rounded-md bg-card p-1.5">
            <div className="text-100 text-muted-foreground">{label}</div>
            <div className={cn("font-numeric text-300 font-semibold", bad ? "text-destructive" : "text-emphasis-foreground")}>{value}</div>
            <div className="text-100 text-muted-foreground">{sub}</div>
        </div>
    );
}

// ── action board ────────────────────────────────────────────────────────────

const KIND_ICON = { "follow-up": Flag, escalation: Siren, "recovery-plan": LifeBuoy, watch: Eye } as const;

function ActionBoard({ actions, error, onToggle }: { actions: ActionRow[] | null; error?: string; onToggle: (a: ActionRow) => Promise<void> }) {
    if (error) return <p role="alert" className="m-3 text-200 text-destructive">{error}</p>;
    if (!actions) return <div className="m-3 h-40 rounded-lg bg-muted trace-pulse" />;
    if (!actions.length) return <p className="m-3 text-200 text-muted-foreground">No actions yet. Ask an agent, then use the buttons under its answer.</p>;
    const order = { high: 0, medium: 1, low: 2 };
    const sorted = [...actions].sort((a, b) => (a.status === b.status ? order[a.priority] - order[b.priority] : a.status === "open" ? -1 : 1));
    return (
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {sorted.map((a) => {
                const KIcon = KIND_ICON[a.kind];
                return (
                    <li key={a.id} className={cn("rounded-lg border border-border p-2.5", a.status === "done" && "opacity-55")}>
                        <div className="flex items-start gap-2">
                            <button type="button" onClick={() => void onToggle(a)} aria-label={a.status === "open" ? "Mark done" : "Reopen"}
                                className="mt-0.5 text-muted-foreground hover:text-success focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                <CircleCheck className={cn("icon-size-200", a.status === "done" && "text-success")} />
                            </button>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                    <KIcon className="icon-size-100 shrink-0 text-brand-foreground" aria-hidden />
                                    <span className={cn("truncate text-200 font-semibold text-emphasis-foreground", a.status === "done" && "line-through")}>{a.title}</span>
                                </div>
                                <div className="mt-0.5 flex flex-wrap gap-x-2 font-monospace text-100 text-muted-foreground">
                                    <span className={a.priority === "high" ? "text-destructive" : undefined}>{a.priority}</span>
                                    {a.dueDate && <span>due {a.dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
                                    {a.amountEur ? <span>{eur(a.amountEur, true)} to land</span> : null}
                                    {a.agent && <span>from {a.agent}</span>}
                                </div>
                                {a.owner && <div className="text-100 text-muted-foreground">{a.owner}</div>}
                                {a.detail && <p className="mt-1 line-clamp-3 whitespace-pre-line text-100 text-foreground">{a.detail}</p>}
                            </div>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
