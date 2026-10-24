import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
    ArrowRight, ArrowUp, Check, CircleCheck, ClipboardList, Eye, Flag, LifeBuoy, RotateCcw, Siren, Target, TrendingUp, Truck, Users,
} from "lucide-react";

import { askAgent, type AgentAnswer } from "@/agent";
import { TEAM, TEAM_COLOR, colorOf, memberByKey, type AgentKey } from "@/agent/team";
import { RichAnswer } from "@/components/answer/RichAnswer";
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
    const member = target === "team" ? undefined : memberByKey(target);
    const accent = colorOf(target);
    const chips = member ? member.chips : ["How is the key account Government Contract doing?", "What should leadership worry about this month?"];

    return (
        <div className="glass flex h-full min-h-0 flex-col rounded-2xl border border-border bg-card shadow-container-16">
            {/* header */}
            <div className="p-4 pb-3">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <h2 className="flex items-center gap-2 font-heading text-500 font-bold text-emphasis-foreground">
                            <span aria-hidden className="text-brand">◆</span> Data Agent Team
                        </h2>
                        <p className="text-200 text-brand-foreground">3 role-scoped agents · one copy in OneLake</p>
                    </div>
                    <button type="button" onClick={() => setTab(tab === "chat" ? "actions" : "chat")}
                        className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-200 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            tab === "actions" ? "border-brand bg-brand text-on-brand" : "border-border text-foreground hover:bg-muted")}>
                        <ClipboardList className="icon-size-200" /> Actions{open ? ` · ${open}` : ""}
                    </button>
                </div>

                <div role="radiogroup" aria-label="Choose an agent" className="mt-3 flex flex-wrap gap-1.5">
                    {([...TEAM.map((m) => m.key), "team"] as Target[]).map((k) => {
                        const active = target === k && tab === "chat";
                        const col = colorOf(k);
                        return (
                            <button key={k} type="button" role="radio" aria-checked={active} onClick={() => { setTarget(k); setTab("chat"); }}
                                style={active ? { background: col, borderColor: col, color: "#04130e" } : undefined}
                                className={cn("flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-200 font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    !active && "border-border text-muted-foreground hover:text-foreground")}>
                                {active ? <span aria-hidden>▶</span> : <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: col }} />}
                                {k === "team" ? "Whole team" : memberByKey(k).tag}
                            </button>
                        );
                    })}
                </div>

                {tab === "chat" && (
                    <div className="mt-3">
                        <p className="text-300 leading-400 text-foreground">
                            <span className="font-semibold" style={{ color: accent }}>{member ? `${member.name} Agent` : "The whole team"}</span>
                            {" — "}{member ? member.role : "one question, three agents, answers side by side"}
                        </p>
                        <p className="mt-0.5 font-monospace text-100 text-muted-foreground">
                            grounded on {(member ? member.grounded : ["SpaceParts lakehouse"]).join(" · ")}
                        </p>
                    </div>
                )}
            </div>

            {tab === "chat" ? (
                <>
                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-3" aria-live="polite">
                        {turns.length === 0 && (
                            <div className="space-y-2">
                                {chips.map((q) => (
                                    <button key={q} type="button" onClick={() => void ask(q, target)}
                                        className="block w-full rounded-xl border border-border bg-background/40 px-3.5 py-2.5 text-left text-300 text-emphasis-foreground transition hover:border-brand/70 hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                        {q}
                                    </button>
                                ))}
                                <p className="pt-1 text-200 text-muted-foreground">Or click a row or bar in the visuals.</p>
                            </div>
                        )}
                        {turns.map((turn) => (
                            <article key={turn.id} className="space-y-2">
                                <p className="ml-auto w-fit max-w-[90%] rounded-xl rounded-br-sm border border-border bg-muted px-3 py-1.5 text-300 text-emphasis-foreground">{turn.question}</p>
                                {turn.replies.map((reply) => (
                                    <AnswerCard key={reply.agent} turn={turn} reply={reply} data={data} focus={focus} onRun={runAction} onAsk={ask} />
                                ))}
                            </article>
                        ))}
                        <div ref={endRef} />
                    </div>
                    <form className="border-t border-border p-3" onSubmit={(e: FormEvent) => { e.preventDefault(); void ask(input, target); }}>
                        <div className="flex items-end gap-2 rounded-xl border border-border bg-background/60 p-1.5 focus-within:border-brand">
                            <label htmlFor="console-q" className="sr-only">Ask the agent team</label>
                            <textarea id="console-q" rows={1} value={input} disabled={busy}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(input, target); } }}
                                placeholder={`Ask ${member ? member.name : "the whole team"}…`}
                                className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-300 text-foreground placeholder:text-muted-foreground focus:outline-none" />
                            <button type="submit" disabled={busy || !input.trim()} aria-label="Send"
                                style={{ background: accent }}
                                className="flex icon-size-600 items-center justify-center rounded-lg text-[#04130e] disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
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

// ── answers ─────────────────────────────────────────────────────────────────

function findSubjects(text: string, data?: CommandData): Subject[] {
    if (!data) return [];
    const lower = text.toLowerCase();
    return [...data.accounts, ...data.regions]
        .map((s) => ({ s, at: lower.indexOf(s.name.toLowerCase()) }))
        .filter((h) => h.at >= 0)
        .sort((a, b) => a.at - b.at)
        .map((h) => h.s)
        .slice(0, 2);
}

function AnswerCard({ turn, reply, data, focus, onRun, onAsk }: {
    turn: Turn; reply: Reply; data?: CommandData; focus?: string;
    onRun: (turn: Turn, reply: Reply, key: string, fn: () => Promise<unknown>) => void;
    onAsk: (q: string, to: Target) => void;
}) {
    const member = memberByKey(reply.agent);
    const color = member.color;
    const text = reply.result?.answer ?? "";
    const entities = data ? [...data.accounts.map((a) => a.name), ...data.regions.map((r) => r.name), ...data.forecast.map((f) => f.productType)] : [];
    let subjects = findSubjects(text + " " + turn.question, data);
    if (!subjects.length && focus && data) {
        const f = [...data.accounts, ...data.regions].find((s) => s.name === focus);
        if (f) subjects = [f];
    }
    const lead = subjects[0];
    const summary = text.split("\n").find((l) => l.trim() && !l.startsWith("|"))?.replace(/[*_#]/g, "").slice(0, 300);
    const sources = member.grounded.filter((t) => text.toLowerCase().includes(t.replace(/_/g, " ")) || text.includes(t));
    const sourceList = (sources.length ? sources : member.grounded.slice(0, 3)).join(" · ");

    // Functions the answer can trigger
    type Btn = { key: string; label: string; icon: typeof Flag; run: () => Promise<unknown>; primary?: boolean };
    const buttons: Btn[] = [];
    for (const s of subjects) {
        const short = s.name.replace(" Region", "");
        if (reply.agent === "sales" && s.actualYtd < s.budgetYtd) buttons.push({ key: `plan:${s.name}`, label: `Recovery plan · ${short}`, icon: LifeBuoy, primary: true, run: () => buildRecoveryPlan(s, "sales") });
        if (reply.agent === "operations") buttons.push({ key: `esc:${s.name}`, label: `Escalate orders · ${short}`, icon: Siren, primary: true, run: () => createAction({ kind: "escalation", title: `Escalate overdue orders · ${s.name}`, subject: s.name, detail: summary, agent: "operations", sourceQuestion: turn.question }) });
        if (reply.agent === "sales") buttons.push({ key: `fu:${s.name}`, label: `Follow up · ${short}`, icon: Flag, run: () => createAction({ kind: "follow-up", title: `Follow up with ${s.name}`, subject: s.name, detail: summary, agent: "sales", sourceQuestion: turn.question }) });
        buttons.push({ key: `watch:${s.name}`, label: `Watch · ${short}`, icon: Eye, run: () => createAction({ kind: "watch", title: `Watch ${s.name}`, subject: s.name, detail: summary, agent: reply.agent, sourceQuestion: turn.question }) });
    }
    if (reply.agent === "planning" && data) {
        const pt = data.forecast.find((f) => text.includes(f.productType) && f.forecast < f.budget);
        if (pt) buttons.push({ key: `fc:${pt.productType}`, label: `Flag forecast gap · ${pt.productType}`, icon: Flag, primary: true, run: () => createAction({ kind: "follow-up", title: `Forecast below budget · ${pt.productType}`, subject: pt.productType, detail: summary, agent: "planning", sourceQuestion: turn.question }) });
    }
    if (!buttons.length && reply.result) {
        buttons.push({ key: "save", label: "Add to action board", icon: ClipboardList, run: () => createAction({ kind: "follow-up", title: turn.question.slice(0, 190), detail: summary, agent: reply.agent, sourceQuestion: turn.question }) });
    }

    // Suggested hand-offs to the other agents
    const handoffs = member.handoffs
        .filter((h) => !h.label.includes("{subject}") || lead)
        .map((h) => ({ ...h, label: h.label.replace("{subject}", lead?.name ?? ""), question: h.question.replace("{subject}", lead?.name ?? "") }));

    return (
        <div className="rounded-xl border border-border bg-background/50 p-3.5" style={{ borderLeft: `3px solid ${color}` }}>
            <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="font-monospace text-100 font-semibold uppercase tracking-widest" style={{ color }}>▶ {member.tag}</span>
                {reply.result && (
                    <span className="font-monospace text-100 text-muted-foreground" title="via the agent's MCP endpoint">
                        answered as {reply.result.identity === "service principal" ? "service principal" : "the app"} · {(reply.result.totalMs / 1000).toFixed(1)}s
                    </span>
                )}
            </div>

            {reply.error ? (
                <p role="alert" className="text-200 text-destructive">{reply.error}</p>
            ) : reply.result ? (
                <>
                    <div className="max-h-[30rem] overflow-auto"><RichAnswer text={reply.result.answer} color={color} highlights={{ entities }} /></div>
                    <p className="mt-2 font-monospace text-100 text-muted-foreground">sources · {sourceList}</p>
                </>
            ) : (
                <div className="space-y-1.5">
                    <div className="h-2.5 w-3/4 rounded bg-muted trace-pulse" />
                    <div className="h-2.5 w-1/2 rounded bg-muted trace-pulse" />
                    <p className="text-100 text-muted-foreground">{member.name} is querying the lakehouse…</p>
                </div>
            )}

            {reply.result && (
                <div className="mt-3 space-y-2">
                    {handoffs.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {handoffs.map((h) => {
                                const c = memberByKey(h.to).color;
                                return (
                                    <button key={h.label} type="button" onClick={() => onAsk(h.question, h.to)}
                                        style={{ borderColor: `${c}99`, color: c }}
                                        className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-200 font-semibold hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                        {h.label} <ArrowRight className="icon-size-100" />
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    {buttons.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-monospace text-100 uppercase tracking-widest text-muted-foreground">act</span>
                            {buttons.map((b) => {
                                const st = reply.done[b.key];
                                const BIcon = st === "done" ? Check : b.icon;
                                return (
                                    <button key={b.key} type="button" disabled={st === "busy" || st === "done"} onClick={() => onRun(turn, reply, b.key, b.run)}
                                        title={typeof st === "string" && st.startsWith("Failed") ? st : "Runs a Rayfin function"}
                                        className={cn("flex items-center gap-1 rounded-md border px-2 py-0.5 text-100 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                            st === "done" ? "border-success/50 text-success" :
                                                st?.startsWith("Failed") ? "border-destructive/50 text-destructive" :
                                                    b.primary ? "border-brand/60 text-brand-foreground hover:bg-muted" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                                            st === "busy" && "trace-pulse")}>
                                        <BIcon className="icon-size-100" aria-hidden />{b.label}
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

function PlanCard({ plan, onAsk }: { plan: RecoveryPlanResult; onAsk: (q: string, to: Target) => void }) {
    const tone = plan.verdict === "on track" || plan.verdict === "recoverable" ? "text-success" : plan.verdict === "stretch" ? "text-[#f5c542]" : "text-destructive";
    const ops = memberByKey("operations").color, pl = memberByKey("planning").color;
    return (
        <div className="mt-3 rounded-xl border border-border bg-card p-3" style={{ borderLeft: `3px solid ${TEAM_COLOR}` }}>
            <div className="flex items-center justify-between">
                <span className="font-monospace text-100 font-semibold uppercase tracking-widest" style={{ color: TEAM_COLOR }}>▶ buildRecoveryPlan</span>
                <span className={cn("rounded-full border border-border px-2 py-0.5 text-100 font-semibold uppercase", tone)}>{plan.verdict}</span>
            </div>
            <p className="mt-1.5 text-300 text-foreground">
                <strong className="text-emphasis-foreground">{plan.subject}</strong> is <span className="font-semibold text-destructive">{eur(plan.gapYtdEur, true)}</span> ({pct(plan.gapYtdPct, true)}) against budget Jan–Jul.
                Landing the full-year budget needs <span className="font-numeric font-semibold" style={{ color: TEAM_COLOR }}>{eur(plan.requiredMonthlyEur, true)}</span> a month
                for {plan.monthsRemaining} months, against a budget of {eur(plan.budgetMonthlyEur, true)} — <span className="font-semibold" style={{ color: TEAM_COLOR }}>{pct(plan.upliftPct, true)}</span>.
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-200 text-foreground">
                {plan.steps.slice(1).map((s) => <li key={s}>{s}</li>)}
            </ol>
            <div className="mt-2 flex flex-wrap gap-1.5">
                <button type="button" onClick={() => onAsk(`Which overdue or late orders does the key account ${plan.subject} have, in euros?`, "operations")}
                    style={{ borderColor: `${ops}99`, color: ops }} className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-200 font-semibold hover:bg-muted">
                    Ask Operations about the backlog <ArrowRight className="icon-size-100" /></button>
                <button type="button" onClick={() => onAsk(`Does the 2022 forecast already assume ${plan.subject} misses budget?`, "planning")}
                    style={{ borderColor: `${pl}99`, color: pl }} className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-200 font-semibold hover:bg-muted">
                    Ask Planning about the forecast <ArrowRight className="icon-size-100" /></button>
            </div>
            <p className="mt-2 font-monospace text-100 text-muted-foreground">saved to the action board · sources · app.sales_vs_budget</p>
        </div>
    );
}

// ── action board ────────────────────────────────────────────────────────────

const KIND_ICON = { "follow-up": Flag, escalation: Siren, "recovery-plan": LifeBuoy, watch: Eye } as const;

function ActionBoard({ actions, error, onToggle }: { actions: ActionRow[] | null; error?: string; onToggle: (a: ActionRow) => Promise<void> }) {
    if (error) return <p role="alert" className="m-4 text-200 text-destructive">{error}</p>;
    if (!actions) return <div className="m-4 h-40 rounded-lg bg-muted trace-pulse" />;
    if (!actions.length) return <p className="m-4 text-300 text-muted-foreground">No actions yet. Ask an agent, then use the buttons under its answer.</p>;
    const order = { high: 0, medium: 1, low: 2 };
    const sorted = [...actions].sort((a, b) => (a.status === b.status ? order[a.priority] - order[b.priority] : a.status === "open" ? -1 : 1));
    const prio = { high: "#f87171", medium: "#f5c542", low: "#2dd4a7" };
    return (
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-4">
            {sorted.map((a) => {
                const KIcon = KIND_ICON[a.kind];
                const agentColor = a.agent && ["sales", "operations", "planning"].includes(a.agent) ? colorOf(a.agent as AgentKey) : TEAM_COLOR;
                return (
                    <li key={a.id} className={cn("rounded-xl border border-border bg-background/50 p-3", a.status === "done" && "opacity-55")} style={{ borderLeft: `3px solid ${agentColor}` }}>
                        <div className="flex items-start gap-2">
                            <button type="button" onClick={() => void onToggle(a)} aria-label={a.status === "open" ? "Mark done" : "Reopen"}
                                className="mt-0.5 text-muted-foreground hover:text-success focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                <CircleCheck className={cn("icon-size-200", a.status === "done" && "text-success")} />
                            </button>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                    <KIcon className="icon-size-100 shrink-0" style={{ color: agentColor }} aria-hidden />
                                    <span className={cn("truncate text-300 font-semibold text-emphasis-foreground", a.status === "done" && "line-through")}>{a.title}</span>
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 font-monospace text-100 text-muted-foreground">
                                    <span className="flex items-center gap-1"><span className="inline-block size-1.5 rounded-full" style={{ background: prio[a.priority] }} />{a.priority}</span>
                                    {a.dueDate && <span>due {a.dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
                                    {a.amountEur ? <span>{eur(a.amountEur, true)} to land</span> : null}
                                    {a.agent && <span style={{ color: agentColor }}>{a.agent}</span>}
                                </div>
                                {a.detail && <p className="mt-1 line-clamp-3 whitespace-pre-line text-200 text-foreground">{a.detail}</p>}
                            </div>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
