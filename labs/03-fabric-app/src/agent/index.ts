// ─────────────────────────────────────────────────────────────────────────────
//  THE AGENT SEAM
//
//  Everything in the UI talks to the agent team through `askAgent()`.
//  The browser sends only the agent key and the question; the Rayfin function
//  `askDataAgent` holds the agent URLs and the identity, and calls MCP.
//
//    VITE_AGENT_MODE=function  (default) → Rayfin function `askDataAgent`
//    VITE_AGENT_MODE=offline             → recorded answers, for when the venue Wi-Fi dies
// ─────────────────────────────────────────────────────────────────────────────

import { getRayfinClient } from "@/lib/rayfin-client";
import { memberByKey, type AgentKey } from "./team";
import { offlineAnswer } from "./offline";

export type { AgentKey } from "./team";

export interface AgentAnswer {
    agent: AgentKey;
    agentName: string;
    answer: string;
    /** Opaque conversation state; pass it back with the next question to the same agent. */
    conversation: string;
    protocol: "mcp" | "assistants" | "offline";
    identity: string;
    /** Time spent inside the Rayfin function (agent round-trip). */
    serverMs: number;
    /** Total time seen by the browser. */
    totalMs: number;
}

export type AgentMode = "function" | "offline";

export const agentMode: AgentMode =
    import.meta.env.VITE_AGENT_MODE === "offline" ? "offline" : "function";

export async function askAgent(agent: AgentKey, question: string, conversation = ""): Promise<AgentAnswer> {
    const started = performance.now();

    if (agentMode === "offline") {
        const answer = await offlineAnswer(agent, question);
        const ms = Math.round(performance.now() - started);
        return {
            agent, agentName: memberByKey(agent).name, answer, conversation,
            protocol: "offline", identity: "recorded", serverMs: ms, totalMs: ms,
        };
    }

    const reply = await getRayfinClient().functions.askDataAgent.invoke(
        { agent, question, conversation: conversation || "-" },
        { timeoutMs: 240_000 },
    );

    return {
        agent,
        agentName: reply.agentName,
        answer: reply.answer,
        conversation: reply.conversation,
        protocol: reply.protocol,
        identity: reply.identity,
        serverMs: reply.elapsedMs,
        totalMs: Math.round(performance.now() - started),
    };
}
