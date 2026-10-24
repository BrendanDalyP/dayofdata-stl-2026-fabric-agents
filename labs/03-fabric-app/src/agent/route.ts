import type { AgentKey } from "./team";

// Auto mode: pick the agent whose domain the question is about. Deliberately simple and visible
// (the answer shows "routed to … · <why>"), so the audience can see why an agent answered.
// Each agent's MCP tool description could drive this too; keywords keep it instant and free.

const RULES: Array<{ agent: AgentKey; why: string; re: RegExp }> = [
    { agent: "operations", why: "orders and delivery", re: /\b(backlog|overdue|late order|orders?|deliver(y|ies|ed)?|on[- ]time|otd|penalt(y|ies)|cancel(led|lation)?s?|shipping|wip)\b/i },
    { agent: "planning", why: "forecast and plan", re: /\b(forecast|outlook|territor(y|ies)|brands?|private brand|rest of (the )?year|full[- ]year|plan(ning)?)\b/i },
];

export function routeQuestion(question: string): { agent: AgentKey; why: string } {
    for (const r of RULES) if (r.re.test(question)) return { agent: r.agent, why: r.why };
    return { agent: "sales", why: "sales and budget" };
}
