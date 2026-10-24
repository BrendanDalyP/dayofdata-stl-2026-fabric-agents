// The agent team as the UI sees it. Keys match rayfin/functions/src/agents.ts.
// Chips are the questions that passed every evaluation run (labs/01-data-agent/ground_truth_*.csv);
// `grounded` mirrors each agent's selected tables (labs/01-data-agent/agents/<name>/agent.json).

export type AgentKey = "sales" | "operations" | "planning";

export interface Handoff {
    to: AgentKey;
    /** Button text; {subject} is replaced with the account/region the answer names. */
    label: string;
    question: string;
}

export interface TeamMember {
    key: AgentKey;
    name: string;
    /** Short tag shown on tabs and answers ("SALES", "OPS"). */
    tag: string;
    /** Each agent's colour, used on its tab, answers and hand-offs. */
    color: string;
    role: string;
    grounded: string[];
    chips: string[];
    handoffs: Handoff[];
}

export const TEAM: TeamMember[] = [
    {
        key: "sales",
        name: "Sales Analyst",
        tag: "Sales",
        color: "#38bdf8",
        role: "net sales against budget, in euros, by key account, region and product",
        grounded: ["invoices", "budget", "customers", "regions", "products", "budget_rate", "exchange_rate"],
        chips: [
            "Which key accounts are furthest behind budget this year?",
            "What were net sales in euros by region this year?",
            "How did net sales grow against last year by product type?",
            "Who are the top 5 account managers by net sales this year?",
        ],
        handoffs: [
            { to: "operations", label: "Ask Operations what's holding {subject} back", question: "Which overdue or late orders does the key account {subject} have, in euros?" },
            { to: "planning", label: "Ask Planning if the forecast covers {subject}", question: "Does the 2022 forecast already assume {subject} misses budget?" },
        ],
    },
    {
        key: "operations",
        name: "Operations",
        tag: "Ops",
        color: "#2dd4a7",
        role: "order backlog, on-time delivery and penalties",
        grounded: ["orders", "order_status", "invoices", "customers", "regions", "products"],
        chips: [
            "What is the open order backlog in euros by order status?",
            "What was the on-time delivery rate by month this year?",
            "Which key accounts have the most overdue order value?",
            "Which regions paid the most late-delivery penalties this year, in euros?",
        ],
        handoffs: [
            { to: "sales", label: "Ask Sales what it costs {subject} against budget", question: "How is the key account {subject} doing against budget this year?" },
            { to: "planning", label: "Ask Planning about the forecast impact", question: "How does the 2022 forecast compare with the 2022 budget by product type?" },
        ],
    },
    {
        key: "planning",
        name: "Planning",
        tag: "Planning",
        color: "#a78bfa",
        role: "2022 forecast against budget, territories and brands",
        grounded: ["forecast", "budget", "invoices", "products", "brands", "regions"],
        chips: [
            "How does the 2022 forecast compare with the 2022 budget by product type?",
            "Which territories are furthest behind their forecast so far this year?",
            "How are SpaceParts brands doing against private brands this year compared with last year?",
            "Which brands are furthest behind budget this year?",
        ],
        handoffs: [
            { to: "sales", label: "Ask Sales which key accounts drive it", question: "Which key accounts are furthest behind budget this year?" },
            { to: "operations", label: "Ask Operations if delivery is the cause", question: "What was the on-time delivery rate by month this year?" },
        ],
    },
];

export const memberByKey = (key: AgentKey) => TEAM.find((m) => m.key === key)!;
export const TEAM_COLOR = "#f5c542";
export const colorOf = (key: AgentKey | "team") => (key === "team" ? TEAM_COLOR : memberByKey(key).color);
