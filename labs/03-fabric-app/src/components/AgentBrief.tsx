import { useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";

import { askAgent } from "@/agent";
import { useAsk, type Reply } from "@/agent/AskContext";
import { memberByKey, type AgentKey } from "@/agent/team";
import { AgentAnswer, AgentMark } from "@/components/AgentAnswer";
import type { RecoveryPlanResult } from "../../rayfin/functions/src/types";
import { cn } from "@/lib/utils";

// Briefs are cached for the session: each answer takes 15–40 s and uses capacity.
const cache = new Map<string, Reply>();

interface Props {
    agent: AgentKey;
    question: string;
    /** Shown as the context chip when continued in chat. */
    context?: string;
    title?: string;
    className?: string;
}

/** An inline "agent brief": one question for this view, answered in place on demand. */
export function AgentBrief({ agent, question, context, title, className }: Props) {
    const { data, ask, continueInChat, refreshActions } = useAsk();
    const key = `${agent}|${question}`;
    const [reply, setReply] = useState<Reply | undefined>(cache.get(key));
    const member = memberByKey(agent);

    const run = async () => {
        const pending: Reply = { agent, done: {} };
        setReply(pending);
        try {
            const result = await askAgent(agent, question, "");
            const r = { ...pending, result };
            cache.set(key, r);
            setReply(r);
        } catch (e) {
            setReply({ ...pending, error: e instanceof Error ? e.message : String(e) });
        }
    };

    const onRun = async (k: string, fn: () => Promise<unknown>) => {
        setReply((r) => r && { ...r, done: { ...r.done, [k]: "busy" } });
        try {
            const out = await fn();
            setReply((r) => {
                const next = r && { ...r, done: { ...r.done, [k]: "done" }, ...(k.startsWith("plan:") ? { plan: out as RecoveryPlanResult } : {}) };
                if (next) cache.set(key, next);
                return next;
            });
            void refreshActions();
        } catch (e) {
            setReply((r) => r && { ...r, done: { ...r.done, [k]: `Failed: ${e instanceof Error ? e.message : e}` } });
        }
    };

    return (
        <section className={cn("flex min-h-0 flex-col rounded-lg border border-border bg-card p-4", className)} aria-label={`${member.name} brief`}>
            <header className="mb-2 flex items-start justify-between gap-2">
                <div>
                    <div className="text-100 font-semibold uppercase tracking-wide text-muted-foreground">Agent brief</div>
                    <h2 className="font-heading text-400 font-semibold text-emphasis-foreground">{title ?? question}</h2>
                </div>
                <AgentMark agent={agent} />
            </header>

            {!reply ? (
                <div className="flex flex-1 flex-col items-start justify-center gap-3">
                    <p className="text-300 text-muted-foreground">{member.name} answers this with a fresh, governed query on the lakehouse (about 20–40 seconds).</p>
                    <button type="button" onClick={() => void run()}
                        className="inline-flex items-center gap-2 rounded-md bg-brand px-3.5 py-2 text-300 font-semibold text-on-brand hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <Sparkles className="icon-size-200" /> Brief me
                    </button>
                </div>
            ) : (
                <div className="min-h-0 flex-1 overflow-y-auto">
                    <AgentAnswer question={question} reply={reply} data={data} focus={context} compact
                        onRun={(k, fn) => void onRun(k, fn)} onAsk={(q, to, ctx) => ask(q, to, ctx)} />
                </div>
            )}

            {reply?.result && (
                <button type="button" onClick={() => continueInChat(question, reply, context)}
                    className="mt-2 inline-flex items-center gap-1 self-start text-200 font-semibold text-brand-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    Continue in chat <ArrowRight className="icon-size-100" />
                </button>
            )}
        </section>
    );
}
