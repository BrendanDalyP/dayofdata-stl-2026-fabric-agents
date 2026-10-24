import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { askAgent, type AgentAnswer } from "@/agent";
import { TEAM, type AgentKey } from "@/agent/team";
import { listActions, type ActionRow } from "@/services/actions";
import { loadCommandData, type CommandData } from "@/queries/overview";
import type { RecoveryPlanResult } from "../../rayfin/functions/src/types";

export type Target = AgentKey | "team";

export interface Reply {
    agent: AgentKey;
    result?: AgentAnswer;
    error?: string;
    done: Record<string, string>; // action key → "busy" | "done" | "Failed: …"
    plan?: RecoveryPlanResult;
}
export interface Turn { id: string; question: string; context?: string; replies: Reply[] }

interface AskState {
    data?: CommandData;
    dataError?: string;
    open: boolean;
    setOpen: (open: boolean) => void;
    target: Target;
    setTarget: (t: Target) => void;
    thread: Turn[];
    clear: () => void;
    busy: boolean;
    /** Ask an agent (or the whole team); opens the drawer. `context` is shown as a chip, e.g. "Government Contract · Apr 2022". */
    ask: (question: string, to: Target, context?: string) => void;
    /** Put an already-answered brief into the thread and open the drawer. */
    continueInChat: (question: string, reply: Reply, context?: string) => void;
    /** Run an action button for a reply in the thread. */
    runThreadAction: (turnId: string, agent: AgentKey, key: string, fn: () => Promise<unknown>) => Promise<void>;
    actions: ActionRow[] | null;
    actionsError?: string;
    refreshActions: () => Promise<void>;
}

const Ctx = createContext<AskState | undefined>(undefined);

export function useAsk(): AskState {
    const v = useContext(Ctx);
    if (!v) throw new Error("useAsk must be used inside <AskProvider>");
    return v;
}

export function AskProvider({ children }: { children: ReactNode }) {
    const [data, setData] = useState<CommandData>();
    const [dataError, setDataError] = useState<string>();
    const [open, setOpen] = useState(false);
    const [target, setTarget] = useState<Target>("sales");
    const [thread, setThread] = useState<Turn[]>([]);
    const [busy, setBusy] = useState(false);
    const [actions, setActions] = useState<ActionRow[] | null>(null);
    const [actionsError, setActionsError] = useState<string>();
    const convo = useRef<Partial<Record<AgentKey, string>>>({});

    useEffect(() => {
        loadCommandData().then(setData).catch((e) => setDataError(e instanceof Error ? e.message : String(e)));
    }, []);

    const refreshActions = useCallback(async () => {
        try { setActionsError(undefined); setActions(await listActions()); }
        catch (e) { setActionsError(e instanceof Error ? e.message : String(e)); setActions([]); }
    }, []);
    useEffect(() => { void refreshActions(); }, [refreshActions]);

    const patch = (turnId: string, agent: AgentKey, change: (r: Reply) => Partial<Reply>) =>
        setThread((t) => t.map((x) => (x.id !== turnId ? x : { ...x, replies: x.replies.map((r) => (r.agent === agent ? { ...r, ...change(r) } : r)) })));

    const ask = useCallback((question: string, to: Target, context?: string) => {
        const q = question.trim();
        if (!q) return;
        setOpen(true);
        setTarget(to);
        const id = crypto.randomUUID();
        const agents: AgentKey[] = to === "team" ? TEAM.map((m) => m.key) : [to];
        setThread((t) => [...t, { id, question: q, context, replies: agents.map((agent) => ({ agent, done: {} })) }]);
        setBusy(true);
        void Promise.all(agents.map(async (agent) => {
            try {
                const result = await askAgent(agent, q, convo.current[agent] ?? "");
                convo.current[agent] = result.conversation;
                patch(id, agent, () => ({ result }));
            } catch (err) {
                patch(id, agent, () => ({ error: err instanceof Error ? err.message : String(err) }));
            }
        })).finally(() => setBusy(false));
    }, []);

    const continueInChat = useCallback((question: string, reply: Reply, context?: string) => {
        setThread((t) => [...t, { id: crypto.randomUUID(), question, context, replies: [reply] }]);
        setTarget(reply.agent);
        setOpen(true);
    }, []);

    const runThreadAction = useCallback(async (turnId: string, agent: AgentKey, key: string, fn: () => Promise<unknown>) => {
        patch(turnId, agent, (r) => ({ done: { ...r.done, [key]: "busy" } }));
        try {
            const out = await fn();
            patch(turnId, agent, (r) => ({ done: { ...r.done, [key]: "done" }, ...(key.startsWith("plan:") ? { plan: out as RecoveryPlanResult } : {}) }));
            void refreshActions();
        } catch (e) {
            patch(turnId, agent, (r) => ({ done: { ...r.done, [key]: `Failed: ${e instanceof Error ? e.message : e}` } }));
        }
    }, [refreshActions]);

    // ⌘K / Ctrl+K toggles the drawer; Esc closes it.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
            if (e.key === "Escape") setOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    const value = useMemo<AskState>(() => ({
        data, dataError, open, setOpen, target, setTarget, thread, clear: () => { convo.current = {}; setThread([]); },
        busy, ask, continueInChat, runThreadAction, actions, actionsError, refreshActions,
    }), [data, dataError, open, target, thread, busy, ask, continueInChat, runThreadAction, actions, actionsError, refreshActions]);

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
