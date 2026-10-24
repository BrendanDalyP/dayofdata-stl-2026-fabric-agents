// Where each number comes from, shown on hover (a KPI value or a chart's source line).
// Every figure in the app traces to one of the small app.* tables built by fabric/build_app_tables.sql.

export const EURO_RULE =
    "Euros = local invoice value ÷ budget rate × monthly exchange rate on the billing date; real invoices only (credit notes excluded). The data agents apply the same rule.";

const MONEY = /sales|budget|forecast|order|backlog|delivery|penalt|cancel|brand|territory|EUR/i;

/** Hover text for a source: the table, the euro rule when money is involved, and how it is read. */
export function sourceDetail(source: string): string {
    if (/database/i.test(source)) {
        return `Source: ${source}\nStored in the app's own SQL database. Only the Rayfin functions (createAction, buildRecoveryPlan, setActionStatus) write to it; priority and due date are set server-side.`;
    }
    return [
        `Source: ${source}`,
        MONEY.test(source) ? EURO_RULE : "",
        "Data to 21 Aug 2022, read live from the SpaceParts lakehouse through the Rayfin connector, as you.",
    ].filter(Boolean).join("\n");
}
