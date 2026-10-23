// Overview data, read from the SpaceParts lakehouse through the Rayfin connector
// (`client.connectors.spaceparts`). The connector runs as the signed-in user
// (auth: delegated), so the user's own lakehouse permissions apply.
// Aggregation happens server-side (DAB groupBy), not in the browser.

import { getRayfinClient } from "@/lib/rayfin-client";

// The SpaceParts data ends on 21 Aug 2022. "This year" = 2022 to date;
// budget comparisons use complete months (Jan–Jul 2022), like the agents.
export const YEAR_START = new Date("2022-01-01T00:00:00Z");
export const LAST_FULL_MONTH_END = new Date("2022-08-01T00:00:00Z");
export const DATA_END_LABEL = "21 Aug 2022";

const sp = () => getRayfinClient().connectors.spaceparts;

const num = (v: number | null | undefined) => Number(v ?? 0);
const asDate = (v: unknown) => new Date(v as string);

export interface MonthPoint { month: Date; netSalesEur: number; budgetEur: number }
export interface Ranked { name: string; netSalesEur: number; budgetEur: number }
export interface DeliveryPoint { month: Date; onTimePct: number; latePenaltiesEur: number }
export interface ForecastRow { productType: string; forecastEur: number; budgetEur: number }

export async function salesByMonth(): Promise<MonthPoint[]> {
    const rows = await sp()
        .SalesVsBudget.groupBy(["month"])
        .aggregate({ net: { sum: "netSalesEur" }, budget: { sum: "budgetEur" } })
        .execute();
    return rows
        .map((r) => ({ month: asDate(r.fields.month), netSalesEur: num(r.aggregations.net), budgetEur: num(r.aggregations.budget) }))
        .sort((a, b) => a.month.getTime() - b.month.getTime());
}

export async function salesByRegionThisYear(): Promise<Ranked[]> {
    const rows = await sp()
        .SalesVsBudget.where({ month: { gte: YEAR_START } })
        .groupBy(["interplanetaryRegion"])
        .aggregate({ net: { sum: "netSalesEur" }, budget: { sum: "budgetEur" } })
        .execute();
    return rows
        .map((r) => ({ name: String(r.fields.interplanetaryRegion), netSalesEur: num(r.aggregations.net), budgetEur: num(r.aggregations.budget) }))
        .sort((a, b) => b.netSalesEur - a.netSalesEur);
}

/** Key accounts, Jan–Jul 2022 (complete months), with budget. */
export async function keyAccountsVsBudget(): Promise<Ranked[]> {
    const rows = await sp()
        .SalesVsBudget.where({ month: { gte: YEAR_START, lt: LAST_FULL_MONTH_END } })
        .groupBy(["keyAccountName"])
        .aggregate({ net: { sum: "netSalesEur" }, budget: { sum: "budgetEur" } })
        .execute();
    return rows
        .map((r) => ({ name: String(r.fields.keyAccountName), netSalesEur: num(r.aggregations.net), budgetEur: num(r.aggregations.budget) }))
        .filter((r) => r.name !== "No Key Account" && r.budgetEur > 0)
        .sort((a, b) => a.netSalesEur - a.budgetEur - (b.netSalesEur - b.budgetEur));
}

export async function deliveryByMonth(): Promise<DeliveryPoint[]> {
    const rows = await sp()
        .DeliveryByMonth.select(["month", "onTimeLines", "invoiceLines", "latePenaltiesEur"])
        .first(100)
        .execute();
    return rows
        .map((r) => ({
            month: asDate(r.month),
            onTimePct: r.invoiceLines ? (100 * num(r.onTimeLines)) / num(r.invoiceLines) : 0,
            latePenaltiesEur: num(r.latePenaltiesEur),
        }))
        .sort((a, b) => a.month.getTime() - b.month.getTime());
}

export async function forecastVsBudget(): Promise<ForecastRow[]> {
    const rows = await sp()
        .ForecastVsBudget.groupBy(["productType"])
        .aggregate({ forecast: { sum: "forecastEur" }, budget: { sum: "budgetEur" } })
        .execute();
    return rows
        .map((r) => ({ productType: String(r.fields.productType), forecastEur: num(r.aggregations.forecast), budgetEur: num(r.aggregations.budget) }))
        .sort((a, b) => a.forecastEur - a.budgetEur - (b.forecastEur - b.budgetEur));
}

export const eur = (v: number, compact = false) =>
    new Intl.NumberFormat("en-IE", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: compact ? 1 : 0,
        notation: compact ? "compact" : "standard",
    }).format(v);

export const pct = (v: number, signed = false) => `${signed && v > 0 ? "+" : ""}${v.toFixed(1)}%`;
