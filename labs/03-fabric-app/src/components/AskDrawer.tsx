import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowRight, ArrowUp, Check, Flag, LifeBuoy, RotateCcw, Siren, Sparkles, X } from "lucide-react";

import { useAsk, type Target } from "@/agent/AskContext";
import { TEAM, memberByKey, type AgentKey } from "@/agent/team";
import { AgentAnswer } from "@/components/AgentAnswer";
import { actionTip, buildRecoveryPlan, createAction } from "@/services/actions";
import { gapPct, type CommandData } from "@/queries/overview";
import { cn } from "@/lib/utils";

/** One quick action per agent: what that agent's function can do right now, from the data on screen. */
function quickActions(agent: AgentKey, data?: CommandData): Array<{ key: string; label: string; tip: string; icon: typeof Flag; run: () => Promise<unknown> }> {
    if (!data) return [];
    const worst = [...data.accounts].sort((a, b) => gapPct(a) - gapPct(b))[0];
    const fcGap = [...data.forecast].sort((a, b) => (a.forecast / a.budget) - (b.forecast / b.budget))[0];
    if (agent === "sales" && worst) return [
        { key: `plan:${worst.name}`, label: `Save recovery plan · ${worst.name}`, tip: actionTip("recovery-plan", worst.name), icon: LifeBuoy, run: () => buildRecoveryPlan(worst, "sales") },
        { key: `fu:${worst.name}`, label: `Follow up · ${worst.name}`, tip: actionTip("follow-up", worst.name), icon: Flag, run: () => createAction({ kind: "follow-up", title: `Follow up with ${worst.name}`, subject: worst.name, agent: "sales" }) },
    ];
    if (agent === "operations" && worst) return [
        { key: `esc:${worst.name}`, label: `Escalate overdue orders · ${worst.name}`, tip: actionTip("escalation", `${worst.name}'s overdue orders`), icon: Siren, run: () => createAction({ kind: "escalation", title: `Escalate overdue orders · ${worst.name}`, subject: worst.name, agent: "operations" }) },
    ];
    if (agent === "planning" && fcGap && fcGap.forecast < fcGap.budget) return [
        { key: `fc:${fcGap.productType}`, label: `Flag forecast gap · ${fcGap.productType}`, tip: actionTip("follow-up", `the ${fcGap.productType} forecast gap`), icon: Flag, run: () => createAction({ kind: "follow-up", title: `Forecast below budget · ${fcGap.productType}`, subject: fcGap.productType, agent: "planning" }) },
    ];
    return [];
}

/** Slide-over "Ask" drawer. Type anything and the right agent answers (auto), or pick an agent for its suggestions and actions. */
export function AskDrawer() {
    const { open, setOpen, target, setTarget, thread, clear, busy, ask, runThreadAction, refreshActions, data } = useAsk();
    const [input, setInput] = useState("");
    const [done, setDone] = useState<Record<string, string>>({});
    const endRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [thread]);
    useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);

    const member = target === "auto" ? undefined : memberByKey(target);
    const submit = () => { if (input.trim()) { ask(input, target); setInput(""); } };
    const acts = member ? quickActions(member.key, data) : [];
    const runAct = async (key: string, fn: () => Promise<unknown>) => {
        setDone((d) => ({ ...d, [key]: "busy" }));
        try { await fn(); setDone((d) => ({ ...d, [key]: "done" })); void refreshActions(); }
        catch (e) { setDone((d) => ({ ...d, [key]: `Failed: ${e instanceof Error ? e.message : e}` })); }
    };

    return (
        <>
            <div aria-hidden onClick={() => setOpen(false)}
                className={cn("fixed inset-0 z-40 bg-black/20 transition-opacity", open ? "opacity-100" : "pointer-events-none opacity-0")} />
            <aside role="dialog" aria-modal="true" aria-label="Ask the agents" aria-hidden={!open}
                className={cn("fixed inset-y-0 right-0 z-50 flex w-[min(480px,100vw)] flex-col border-l border-border bg-background shadow-container-16 transition-transform duration-200",
                    open ? "translate-x-0" : "translate-x-full")}>
                <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
                    <div>
                        <h2 className="font-heading text-400 font-semibold text-emphasis-foreground">Ask</h2>
                        <p className="text-100 text-muted-foreground">Ask anything. The right agent answers from the lakehouse.</p>
                    </div>
                    <div className="flex items-center gap-1">
                        {thread.length > 0 && (
                            <button type="button" onClick={clear} aria-label="New conversation" title="New conversation"
                                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"><RotateCcw className="icon-size-200" /></button>
                        )}
                        <button type="button" onClick={() => setOpen(false)} aria-label="Close"
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="icon-size-200" /></button>
                    </div>
                </header>

                {/* who answers: Auto by default; picking an agent shows its suggestions and actions */}
                <div className="border-b border-border px-4 py-2">
                    <div role="radiogroup" aria-label="Who answers" className="flex flex-wrap items-center gap-1">
                        {(["auto", ...TEAM.map((m) => m.key)] as Target[]).map((k) => {
                            const active = target === k;
                            const m = k === "auto" ? undefined : memberByKey(k);
                            return (
                                <button key={k} type="button" role="radio" aria-checked={active} onClick={() => setTarget(active && m ? "auto" : k)}
                                    title={m ? `${m.name}: ${m.role}` : "The app sends each question to the agent whose data it is about"}
                                    className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-200 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                        active ? "border-transparent text-white" : "border-border text-muted-foreground hover:text-foreground")}
                                    style={active ? { background: m ? m.color : "var(--color-emphasis-foreground)", color: m ? "#fff" : "var(--color-background)" } : undefined}>
                                    {m ? <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: active ? "#fff" : m.color }} /> : <Sparkles className="icon-size-100" aria-hidden />}
                                    {m ? m.name : "Auto"}
                                </button>
                            );
                        })}
                    </div>

                    {member && (
                        <div className="mt-2 space-y-2">
                            <p className="text-100 text-muted-foreground">{member.name} answers about {member.role}.</p>
                            <div className="flex flex-col gap-1">
                                {member.chips.slice(0, thread.length ? 2 : 4).map((q) => (
                                    <button key={q} type="button" onClick={() => ask(q, member.key)}
                                        className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-left text-200 text-foreground hover:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                        {q} <ArrowRight className="icon-size-100 shrink-0 text-muted-foreground" />
                                    </button>
                                ))}
                            </div>
                            {acts.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {acts.map((a) => {
                                        const st = done[a.key];
                                        const Icon = st === "done" ? Check : a.icon;
                                        return (
                                            <button key={a.key} type="button" disabled={st === "busy" || st === "done"} onClick={() => void runAct(a.key, a.run)}
                                                title={st?.startsWith("Failed") ? st : a.tip}
                                                className={cn("inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-200 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                    st === "done" ? "border border-border text-success" : st?.startsWith("Failed") ? "border border-destructive/50 text-destructive" : "bg-brand text-on-brand hover:opacity-90",
                                                    st === "busy" && "trace-pulse")}>
                                                <Icon className="icon-size-100" aria-hidden />{st === "done" ? `${a.label} — saved` : a.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3" aria-live="polite">
                    {thread.length === 0 && !member && (
                        <div className="space-y-2">
                            <p className="text-200 text-muted-foreground">Try one of these. Each goes to the agent that owns the data.</p>
                            {TEAM.map((m) => (
                                <button key={m.key} type="button" onClick={() => ask(m.chips[0], "auto")}
                                    className="flex w-full items-start gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left text-300 text-foreground hover:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                    <span aria-hidden className="mt-1.5 inline-block size-2 shrink-0 rounded-full" style={{ background: m.color }} />
                                    <span>{m.chips[0]}<span className="block text-100 text-muted-foreground">{m.name} answers</span></span>
                                </button>
                            ))}
                        </div>
                    )}
                    {thread.map((turn) => (
                        <article key={turn.id} className="space-y-2">
                            <div className="ml-auto w-fit max-w-[92%] text-right">
                                {turn.context && <span className="mb-1 inline-block rounded-full border border-border bg-card px-2 py-0.5 text-100 text-muted-foreground">{turn.context}</span>}
                                <p className="rounded-lg bg-muted px-3 py-1.5 text-left text-300 text-emphasis-foreground">{turn.question}</p>
                                {turn.routed && (
                                    <p className="mt-1 text-100 text-muted-foreground">
                                        Routed to <span className="font-semibold" style={{ color: memberByKey(turn.replies[0].agent).color }}>{memberByKey(turn.replies[0].agent).name}</span> · {turn.routed}
                                    </p>
                                )}
                            </div>
                            {turn.replies.map((reply) => (
                                <AgentAnswer key={reply.agent} question={turn.question} reply={reply} data={data} focus={turn.context}
                                    onRun={(key, fn) => void runThreadAction(turn.id, reply.agent, key, fn)}
                                    onAsk={(q, to, ctx) => ask(q, to, ctx)} />
                            ))}
                        </article>
                    ))}
                    <div ref={endRef} />
                </div>

                <form className="border-t border-border p-3" onSubmit={(e: FormEvent) => { e.preventDefault(); submit(); }}>
                    <div className="flex items-end gap-2 rounded-lg border border-border bg-card p-1.5 focus-within:border-brand">
                        <label htmlFor="ask-input" className="sr-only">Ask a question</label>
                        <textarea id="ask-input" ref={inputRef} rows={1} value={input} disabled={busy}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
                            placeholder={member ? `Ask ${member.name}…` : "Ask about sales, orders or the plan…"}
                            className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-300 text-foreground placeholder:text-muted-foreground focus:outline-none" />
                        <button type="submit" disabled={busy || !input.trim()} aria-label="Send"
                            className="flex icon-size-600 items-center justify-center rounded-md bg-brand text-on-brand disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            <ArrowUp className="icon-size-200" />
                        </button>
                    </div>
                    <p className="mt-1.5 text-100 text-muted-foreground"><kbd className="font-monospace">Ctrl K</kbd> to open or close · answered as the app over each agent's MCP endpoint</p>
                </form>
            </aside>
        </>
    );
}
