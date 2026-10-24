import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, RotateCcw, X } from "lucide-react";

import { useAsk, type Target } from "@/agent/AskContext";
import { TEAM, colorOf, memberByKey } from "@/agent/team";
import { AgentAnswer } from "@/components/AgentAnswer";
import { cn } from "@/lib/utils";

/** Slide-over "Ask" drawer: opened with ⌘K, the Ask button, a chart click, a brief or a hand-off. */
export function AskDrawer() {
    const { open, setOpen, target, setTarget, thread, clear, busy, ask, runThreadAction, data } = useAsk();
    const [input, setInput] = useState("");
    const endRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [thread]);
    useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);

    const member = target === "team" ? undefined : memberByKey(target);
    const chips = member ? member.chips.slice(0, 3) : ["How is the key account Government Contract doing?"];
    const submit = () => { if (input.trim()) { ask(input, target); setInput(""); } };

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
                        <p className="text-100 text-muted-foreground">Answers come from governed queries on the SpaceParts lakehouse.</p>
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

                <div role="radiogroup" aria-label="Choose an agent" className="flex gap-1 border-b border-border px-4 py-2">
                    {([...TEAM.map((m) => m.key), "team"] as Target[]).map((k) => {
                        const active = target === k;
                        const m = k === "team" ? undefined : memberByKey(k);
                        return (
                            <button key={k} type="button" role="radio" aria-checked={active} onClick={() => setTarget(k)}
                                title={m ? `${m.name}: ${m.role}. Tables: ${m.grounded.join(", ")}` : "Ask all three agents at once"}
                                className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-200 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    active ? "bg-card text-emphasis-foreground shadow-container-2 ring-1 ring-border" : "text-muted-foreground hover:text-foreground")}>
                                <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: colorOf(k) }} />
                                {m ? m.name : "All three"}
                            </button>
                        );
                    })}
                </div>

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3" aria-live="polite">
                    {thread.length === 0 && (
                        <div className="space-y-2">
                            <p className="text-200 text-muted-foreground">{member ? `${member.name} — ${member.role}.` : "One question, answered by all three agents side by side."}</p>
                            {chips.map((q) => (
                                <button key={q} type="button" onClick={() => ask(q, target)}
                                    className="block w-full rounded-lg border border-border bg-card px-3 py-2 text-left text-300 text-foreground hover:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">{q}</button>
                            ))}
                        </div>
                    )}
                    {thread.map((turn) => (
                        <article key={turn.id} className="space-y-2">
                            <div className="ml-auto w-fit max-w-[92%] text-right">
                                {turn.context && <span className="mb-1 inline-block rounded-full border border-border bg-card px-2 py-0.5 text-100 text-muted-foreground">{turn.context}</span>}
                                <p className="rounded-lg bg-muted px-3 py-1.5 text-left text-300 text-emphasis-foreground">{turn.question}</p>
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
                            placeholder={`Ask ${member ? member.name : "all three agents"}…`}
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
