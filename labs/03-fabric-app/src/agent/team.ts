// The agent team as the UI sees it. Keys match rayfin/functions/src/agents.ts.
// Chips are the questions that passed every evaluation run (labs/01-data-agent/ground_truth.csv).

export type AgentKey = "sales" | "operations" | "planning";

export interface TeamMember {
    key: AgentKey;
    name: string;
    /** Each agent's colour, used on its answers, chips and roster button. */
    color: string;
    role: string;
    covers: string;
    chips: string[];
}

export const TEAM: TeamMember[] = [
    {
        key: "sales",
        name: "Sales Analyst",
        color: "#0078d4",
        role: "Net sales against budget",
        covers: "Invoices, budget, customers, regions, products, rates",
        chips: [
            "Which key accounts are furthest behind budget this year?",
            "What were net sales in euros by region this year?",
            "How did net sales grow against last year by product type?",
            "Who are the top 5 account managers by net sales this year?",
        ],
    },
    {
        key: "operations",
        name: "Operations",
        color: "#e8890c",
        role: "Backlog, delivery and penalties",
        covers: "Orders, order status, invoices, customers, regions, products",
        chips: [
            "What is the open order backlog in euros by order status?",
            "What was the on-time delivery rate by month this year?",
            "Which key accounts have the most overdue order value?",
            "Which regions paid the most late-delivery penalties this year, in euros?",
        ],
    },
    {
        key: "planning",
        name: "Planning",
        color: "#8b5cf6",
        role: "Forecast, budget and brands",
        covers: "Forecast, budget, invoices, products, brands, regions",
        chips: [
            "How does the 2022 forecast compare with the 2022 budget by product type?",
            "Which territories are furthest behind their forecast so far this year?",
            "How are SpaceParts brands doing against private brands this year compared with last year?",
            "Which brands are furthest behind budget this year?",
        ],
    },
];

export const memberByKey = (key: AgentKey) => TEAM.find((m) => m.key === key)!;

export const TEAM_COLOR = "#f2c811";
export const colorOf = (key: AgentKey | "team") => (key === "team" ? TEAM_COLOR : memberByKey(key).color);
