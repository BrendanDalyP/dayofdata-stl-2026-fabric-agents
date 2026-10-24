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

/**
 * Tooltip for an action button: which Rayfin function runs and what it does.
 * Keep in step with rulesFor() and planRecovery() in rayfin/functions/src/actions.ts.
 */
export function actionTip(kind: ActionKind | "done" | "reopen", about?: string): string {
    const on = about ? ` for ${about}` : "";
    switch (kind) {
        case "recovery-plan":
            return `buildRecoveryPlan works out the monthly net sales${on} needed Aug–Dec to land the full-year budget, `
                + "rates it (on track, recoverable, stretch or reset the plan) and saves the plan to the action board. "
                + "High priority if 5% or more behind budget; due in 7 days.";
        case "escalation":
            return `createAction adds a high-priority escalation${on} to the action board for Operations, due in 2 days.`;
        case "follow-up":
            return `createAction adds a medium-priority follow-up${on} to the action board, due in 5 days.`;
        case "watch":
            return `createAction adds a low-priority watch item${on} to the action board, with a check-in in 30 days.`;
        case "done":
            return "setActionStatus marks this action done; it moves to the Done column.";
        case "reopen":
            return "setActionStatus reopens this action and puts it back in its priority column.";
    }
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
