// Action buttons → Rayfin functions. The browser sends what was clicked; priority,
// due date, owner and the recovery maths are decided server-side (rayfin/functions/src/actions.ts).

import { getRayfinClient } from "@/lib/rayfin-client";
import { pick } from "@/lib/snapshot";
import type { RecoveryPlanResult } from "../../rayfin/functions/src/types";
import type { AgentKey } from "@/agent/team";
import { MONTHS_REMAINING, type Subject } from "@/queries/overview";

export type ActionKind = "follow-up" | "escalation" | "recovery-plan" | "watch";

export interface ActionRow {
    id: string;
    kind: ActionKind;
    status: "open" | "done";
    title: string;
    subject?: string;
    detail?: string;
    owner?: string;
    priority: "high" | "medium" | "low";
    amountEur?: number;
    dueDate?: Date;
    agent?: string;
    createdAt: Date;
}

export async function createAction(input: { kind: Exclude<ActionKind, "recovery-plan">; title: string; subject?: string; detail?: string; agent: AgentKey; sourceQuestion?: string }) {
    return getRayfinClient().functions.createAction.invoke({
        kind: input.kind,
        title: input.title,
        subject: input.subject ?? "-",
        detail: (input.detail ?? "-").slice(0, 3800),
        agent: input.agent,
        sourceQuestion: (input.sourceQuestion ?? "-").slice(0, 990),
    });
}

export async function buildRecoveryPlan(s: Subject, agent: AgentKey): Promise<RecoveryPlanResult> {
    return getRayfinClient().functions.buildRecoveryPlan.invoke({
        subject: s.name,
        actualYtdEur: Math.round(s.actualYtd),
        budgetYtdEur: Math.round(s.budgetYtd),
        budgetFullYearEur: Math.round(s.budgetFy),
        monthsRemaining: MONTHS_REMAINING,
        agent,
    });
}

export async function setActionStatus(id: string, status: "open" | "done") {
    return getRayfinClient().functions.setActionStatus.invoke({ id, status });
}

export async function listActions(): Promise<ActionRow[]> {
    const rows = await pick("ActionItem", () => getRayfinClient()
        .data.ActionItem.select(["id", "kind", "status", "title", "subject", "detail", "owner", "priority", "amountEur", "dueDate", "agent", "createdAt"])
        .orderBy({ createdAt: "desc" })
        .first(200)
        .execute());
    return (rows as unknown as ActionRow[]).map((r) => ({
        ...r,
        subject: r.subject === "-" ? undefined : r.subject,
        detail: r.detail === "-" ? undefined : r.detail,
        dueDate: r.dueDate ? new Date(r.dueDate) : undefined,
        createdAt: new Date(r.createdAt),
    }));
}
