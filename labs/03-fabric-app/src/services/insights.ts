import { getRayfinClient } from "@/lib/rayfin-client";
import type { AgentKey } from "@/agent/team";

export type InsightKind = "saved" | "pinned";

export interface InsightRow {
    id: string;
    agent: AgentKey;
    question: string;
    answer: string;
    kind: InsightKind;
    protocol?: string;
    durationMs?: number;
    createdAt: Date;
}

const FIELDS = ["id", "agent", "question", "answer", "kind", "protocol", "durationMs", "createdAt"] as const;

function currentUserId(): string {
    const session = getRayfinClient().auth.getSession() as { isAuthenticated?: boolean; user?: { id?: string } };
    const id = session?.user?.id;
    if (!session?.isAuthenticated || !id) throw new Error("Sign in to save insights.");
    return id;
}

export async function listInsights(): Promise<InsightRow[]> {
    const rows = await getRayfinClient()
        .data.Insight.select([...FIELDS])
        .orderBy({ createdAt: "desc" })
        .execute();
    return (rows as unknown as InsightRow[]).map((r) => ({ ...r, createdAt: new Date(r.createdAt) }));
}

export async function saveInsight(input: {
    agent: AgentKey;
    question: string;
    answer: string;
    kind: InsightKind;
    protocol?: string;
    durationMs?: number;
}): Promise<void> {
    await getRayfinClient().data.Insight.create({
        agent: input.agent,
        question: input.question.slice(0, 1000),
        answer: input.answer.slice(0, 4000),
        kind: input.kind,
        protocol: input.protocol,
        durationMs: input.durationMs,
        helpful: false,
        createdAt: new Date(),
        user_id: currentUserId(),
    });
}

export async function deleteInsight(id: string): Promise<void> {
    await getRayfinClient().data.Insight.delete({ id });
}

export async function setInsightKind(id: string, kind: InsightKind): Promise<void> {
    await getRayfinClient().data.Insight.update({ id }, { kind });
}
