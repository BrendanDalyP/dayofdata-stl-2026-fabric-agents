// Command-center data, read from the SpaceParts lakehouse through the Rayfin connector
// (`client.connectors.spaceparts`, auth: delegated → runs as the signed-in user).
// Aggregation happens server-side (DAB groupBy); the browser only shapes small results.

import { getRayfinClient } from "@/lib/rayfin-client";

// The SpaceParts data ends on 21 Aug 2022. "This year" = 2022 to date;
// budget comparisons use complete months (Jan–Jul 2022), like the agents.
export const DATA_END_LABEL = "21 Aug 2022";
export const YTD_MONTHS = 7; // Jan–Jul complete
export const MONTHS_REMAINING = 5; // Aug–Dec

const sp = () => getRayfinClient().connectors.spaceparts;
const num = (v: number | null | undefined) => Number(v ?? 0);
const asDate = (v: unknown) => new Date(v as string);
const isYtd = (d: Date) => d.getUTCFullYear() === 2022 && d.getUTCMonth() < YTD_MONTHS;

export interface MonthPoint { month: Date; net: number; budget: number }
export interface Cell { name: string; month: Date; net: number; budget: number }
export interface Subject {
    name: string;
    kind: "account" | "region";
    actualYtd: number;   // Jan–Jul 2022
    budgetYtd: number;   // Jan–Jul 2022
    budgetFy: number;    // full year 2022
    net2022: number;     // 2022 to 21 Aug
}
export interface DeliveryPoint { month: Date; onTimePct: number; lines: number; penalties: number }
export interface ForecastRow { productType: string; forecast: number; budget: number }

export interface CommandData {
    months: MonthPoint[];
    accountCells: Cell[];
    regionCells: Cell[];
    accounts: Subject[];
    regions: Subject[];
    delivery: DeliveryPoint[];
    forecast: ForecastRow[];
}

async function grouped(field: "keyAccountName" | "interplanetaryRegion"): Promise<Cell[]> {
    const rows = await sp()
        .SalesVsBudget.where({ month: { gte: new Date("2021-01-01T00:00:00Z") } })
        .groupBy([field, "month"])
        .aggregate({ net: { sum: "netSalesEur" }, budget: { sum: "budgetEur" } })
        .execute();
    return rows.map((r) => ({
        name: String((r.fields as Record<string, unknown>)[field]).trim(),
        month: asDate(r.fields.month),
        net: num(r.aggregations.net),
        budget: num(r.aggregations.budget),
    }));
}

function subjects(cells: Cell[], kind: Subject["kind"]): Subject[] {
    const by = new Map<string, Subject>();
    for (const c of cells) {
        if (c.month.getUTCFullYear() !== 2022) continue;
        const s = by.get(c.name) ?? { name: c.name, kind, actualYtd: 0, budgetYtd: 0, budgetFy: 0, net2022: 0 };
        s.budgetFy += c.budget;
        s.net2022 += c.net;
        if (isYtd(c.month)) { s.actualYtd += c.net; s.budgetYtd += c.budget; }
        by.set(c.name, s);
    }
    return [...by.values()].filter((s) => s.budgetFy > 0);
}

export async function loadCommandData(): Promise<CommandData> {
    const [accountCells, regionCells, monthRows, deliveryRows, forecastRows] = await Promise.all([
        grouped("keyAccountName"),
        grouped("interplanetaryRegion"),
        sp().SalesVsBudget.groupBy(["month"]).aggregate({ net: { sum: "netSalesEur" }, budget: { sum: "budgetEur" } }).execute(),
        sp().DeliveryByMonth.select(["month", "onTimeLines", "invoiceLines", "latePenaltiesEur"]).first(100).execute(),
        sp().ForecastVsBudget.groupBy(["productType"]).aggregate({ forecast: { sum: "forecastEur" }, budget: { sum: "budgetEur" } }).execute(),
    ]);

    const months = monthRows
        .map((r) => ({ month: asDate(r.fields.month), net: num(r.aggregations.net), budget: num(r.aggregations.budget) }))
        .sort((a, b) => +a.month - +b.month);

    const delivery = deliveryRows
        .map((r) => ({
            month: asDate(r.month),
            onTimePct: r.invoiceLines ? (100 * num(r.onTimeLines)) / num(r.invoiceLines) : 0,
            lines: num(r.invoiceLines),
            penalties: num(r.latePenaltiesEur),
        }))
        .sort((a, b) => +a.month - +b.month);

    const forecast = forecastRows.map((r) => ({
        productType: String(r.fields.productType),
        forecast: num(r.aggregations.forecast),
        budget: num(r.aggregations.budget),
    }));

    const accounts = subjects(accountCells, "account").filter((s) => s.name !== "No Key Account");
    const regions = subjects(regionCells, "region");

    return {
        months,
        accountCells: accountCells.filter((c) => c.name !== "No Key Account"),
        regionCells,
        accounts,
        regions,
        delivery,
        forecast,
    };
}

export const eur = (v: number, compact = false) =>
    new Intl.NumberFormat("en-IE", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: compact ? 1 : 0,
        notation: compact ? "compact" : "standard",
    }).format(v);

export const pct = (v: number, signed = false) => `${signed && v > 0 ? "+" : ""}${v.toFixed(1)}%`;
export const gapPct = (s: { actualYtd: number; budgetYtd: number }) => (s.actualYtd / s.budgetYtd - 1) * 100;
