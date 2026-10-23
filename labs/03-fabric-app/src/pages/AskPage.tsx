import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, Bookmark, Pin, RotateCcw, Check, Users, TrendingUp, Truck, Target, ShieldCheck } from "lucide-react";

import { askAgent, type AgentAnswer } from "@/agent";
import { TEAM, memberByKey, type AgentKey } from "@/agent/team";
import { saveInsight, type InsightKind } from "@/services/insights";
import { Markdown } from "@/components/Markdown";
import { RequestTrace } from "@/components/RequestTrace";
import { PageHeader } from "@/components/Shell";
import { cn } from "@/lib/utils";

type Target = AgentKey | "team";

const ICON: Record<Target, typeof Users> = { sales: TrendingUp, operations: Truck, planning: Target, team: Users };

const TEAM_CHIPS = [
    "How is Government Contract doing?",
    "Where is the Îlos V Region falling short?",
    "What should the leadership team worry about this month?",
];

interface Reply {
    agent: AgentKey;
    result?: AgentAnswer;
    error?: string;
    saved?: InsightKind[];
}

interface Turn {
    id: string;
    question: string;
    target: Target;
    replies: Reply[];
}

export function AskPage({ initialQuestion, initialTarget }: { initialQuestion?: string; initialTarget?: Target }) {
    const [target, setTarget] = useState<Target>(initialTarget ?? "sales");
    const [turns, setTurns] = useState<Turn[]>([]);
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const conversations = useRef<Partial<Record<AgentKey, string>>>({});
    const endRef = useRef<HTMLDivElement>(null);
    const asked = useRef(false);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [turns]);

    useEffect(() => {
        if (initialQuestion && !asked.current) {
            asked.current = true;
            void ask(initialQuestion, initialTarget ?? "sales");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialQuestion]);

    async function ask(question: string, to: Target = target) {
        const q = question.trim();
        if (!q || busy) return;
        const id = crypto.randomUUID();
        const agents: AgentKey[] = to === "team" ? TEAM.map((m) => m.key) : [to];
        setTurns((t) => [...t, { id, question: q, target: to, replies: agents.map((agent) => ({ agent })) }]);
        setInput("");
        setBusy(true);

        await Promise.all(
            agents.map(async (agent) => {
                try {
                    const result = await askAgent(agent, q, conversations.current[agent] ?? "");
                    conversations.current[agent] = result.conversation;
                    patch(id, agent, { result });
                } catch (err) {
                    patch(id, agent, { error: err instanceof Error ? err.message : String(err) });
                }
            }),
        );
        setBusy(false);
    }

    function patch(turnId: string, agent: AgentKey, change: Partial<Reply>) {
        setTurns((t) =>
            t.map((turn) =>
                turn.id !== turnId ? turn : { ...turn, replies: turn.replies.map((r) => (r.agent === agent ? { ...r, ...change } : r)) },
            ),
        );
    }

    async function keep(turn: Turn, reply: Reply, kind: InsightKind) {
        if (!reply.result) return;
        try {
            await saveInsight({
                agent: reply.agent,
                question: turn.question,
                answer: reply.result.answer,
                kind,
                protocol: reply.result.protocol,
                durationMs: reply.result.totalMs,
            });
            patch(turn.id, reply.agent, { saved: [...(reply.saved ?? []), kind] });
        } catch (err) {
            patch(turn.id, reply.agent, { error: `Could not save: ${err instanceof Error ? err.message : err}` });
        }
    }

    function onSubmit(e: FormEvent) {
        e.preventDefault();
        void ask(input);
    }

    function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void ask(input);
        }
    }

    function reset() {
        conversations.current = {};
        setTurns([]);
    }

    const chips = target === "team" ? TEAM_CHIPS : memberByKey(target).chips;

    return (
        <div className="flex min-h-[calc(100vh-8rem)] flex-col">
            <PageHeader
                eyebrow="Fabric data agents · over MCP"
                title="Ask the agent team"
                subtitle="Three published Fabric data agents, each scoped to its own tables and instructions. Pick one, or ask the whole team at once."
                actions={
                    turns.length > 0 && (
                        <button
                            type="button"
                            onClick={reset}
                            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-200 text-muted-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <RotateCcw className="icon-size-200" aria-hidden /> New conversation
                        </button>
                    )
                }
            />

            {/* Roster */}
            <div role="radiogroup" aria-label="Choose an agent" className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[...TEAM.map((m) => ({ key: m.key as Target, name: m.name, role: m.role, covers: m.covers })),
                  { key: "team" as Target, name: "Whole team", role: "One question, three agents", covers: "Answers side by side; each stays in its lane" }].map((m) => {
                    const Icon = ICON[m.key];
                    const active = target === m.key;
                    return (
                        <button
                            key={m.key}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => setTarget(m.key)}
                            className={cn(
                                "flex items-start gap-3 rounded-xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                active ? "border-brand bg-brand/10 shadow-container-4" : "border-border bg-card hover:border-brand/50",
                            )}
                        >
                            <span className={cn("flex icon-size-600 shrink-0 items-center justify-center rounded-lg", active ? "bg-brand text-on-brand" : "bg-muted text-muted-foreground")}>
                                <Icon className="icon-size-300" aria-hidden />
                            </span>
                            <span className="min-w-0">
                                <span className="block font-heading text-300 font-semibold text-emphasis-foreground">{m.name}</span>
                                <span className="block text-200 text-foreground">{m.role}</span>
                                <span className="mt-1 block font-monospace text-100 text-muted-foreground">{m.covers}</span>
                            </span>
                        </button>
                    );
                })}
            </div>

            <section className="flex-1 space-y-6" aria-live="polite">
                {turns.length === 0 && (
                    <div>
                        <div className="mb-2 font-monospace text-100 uppercase tracking-[0.2em] text-muted-foreground">
                            {target === "team" ? "Try the team" : "Evaluated questions"}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {chips.map((q) => (
                                <button
                                    key={q}
                                    type="button"
                                    onClick={() => void ask(q)}
                                    className="rounded-full border border-border bg-card px-4 py-2 text-left text-200 text-foreground shadow-container-2 transition hover:border-brand hover:text-emphasis-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {turns.map((turn) => (
                    <article key={turn.id} className="space-y-3">
                        <div className="flex justify-end">
                            <p className="max-w-[80%] rounded-2xl rounded-br-sm bg-brand px-4 py-2 text-300 text-on-brand">{turn.question}</p>
                        </div>
                        <div className={cn("grid gap-3", turn.replies.length > 1 && "lg:grid-cols-3")}>
                            {turn.replies.map((reply) => (
                                <AnswerCard key={reply.agent} reply={reply} onKeep={(kind) => void keep(turn, reply, kind)} />
                            ))}
                        </div>
                    </article>
                ))}
                <div ref={endRef} />
            </section>

            <form onSubmit={onSubmit} className="sticky bottom-0 mt-6 bg-gradient-to-t from-background via-background to-transparent pb-2 pt-4">
                <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-container-8 focus-within:border-brand">
                    <label htmlFor="question" className="sr-only">
                        Ask a question
                    </label>
                    <span className="mb-2 ml-2 hidden shrink-0 rounded-md bg-muted px-2 py-1 font-monospace text-100 text-muted-foreground sm:block">
                        → {target === "team" ? "whole team" : memberByKey(target).name}
                    </span>
                    <textarea
                        id="question"
                        rows={1}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={onKeyDown}
                        placeholder="Ask about sales, budget, orders, delivery, forecast…"
                        className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-3 py-2 text-400 text-foreground placeholder:text-muted-foreground focus:outline-none"
                        disabled={busy}
                    />
                    <button
                        type="submit"
                        disabled={busy || !input.trim()}
                        className="flex icon-size-700 items-center justify-center rounded-xl bg-brand text-on-brand hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                        aria-label="Send question"
                    >
                        <ArrowUp className="icon-size-300" />
                    </button>
                </div>
            </form>
        </div>
    );
}

function AnswerCard({ reply, onKeep }: { reply: Reply; onKeep: (kind: InsightKind) => void }) {
    const member = memberByKey(reply.agent);
    const Icon = ICON[reply.agent];
    return (
        <div className="min-w-0 rounded-2xl rounded-tl-sm border border-border bg-card p-4 shadow-container-4">
            <div className="mb-2 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-heading text-200 font-semibold text-emphasis-foreground">
                    <Icon className="icon-size-200 text-brand-foreground" aria-hidden /> {member.name}
                </span>
                {reply.result && (
                    <span className="flex items-center gap-1 rounded-full bg-signal/15 px-2 py-0.5 font-monospace text-100 text-foreground">
                        <ShieldCheck className="icon-size-100" aria-hidden /> answered as {reply.result.identity}
                    </span>
                )}
            </div>

            {reply.error ? (
                <p role="alert" className="text-300 text-destructive">
                    {reply.error}
                </p>
            ) : reply.result ? (
                <div className="overflow-x-auto">
                    <Markdown>{reply.result.answer}</Markdown>
                </div>
            ) : (
                <div className="space-y-2" aria-label={`Waiting for ${member.name}`}>
                    <div className="h-3 w-3/4 rounded bg-muted trace-pulse" />
                    <div className="h-3 w-1/2 rounded bg-muted trace-pulse" />
                    <div className="h-3 w-2/3 rounded bg-muted trace-pulse" />
                </div>
            )}

            <RequestTrace
                agentLabel={member.name}
                totalMs={reply.result?.totalMs ?? (reply.error ? 0 : null)}
                serverMs={reply.result?.serverMs ?? 0}
                protocol={reply.result?.protocol}
            />

            {reply.result && (
                <div className="mt-3 flex gap-2">
                    {(["pinned", "saved"] as const).map((kind) => {
                        const done = reply.saved?.includes(kind);
                        const KIcon = done ? Check : kind === "pinned" ? Pin : Bookmark;
                        return (
                            <button
                                key={kind}
                                type="button"
                                disabled={done}
                                onClick={() => onKeep(kind)}
                                className={cn(
                                    "flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    done ? "text-success" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                )}
                            >
                                <KIcon className="icon-size-100" aria-hidden />
                                {done ? (kind === "pinned" ? "Pinned" : "Saved") : kind === "pinned" ? "Pin insight" : "Save question"}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
