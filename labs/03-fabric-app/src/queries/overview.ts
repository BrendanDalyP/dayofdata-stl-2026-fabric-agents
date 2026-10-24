// App data, read from the SpaceParts lakehouse through the Rayfin connector
// (`client.connectors.spaceparts`, auth: delegated → runs as the signed-in user).
//
// The connector's groupBy returns one page (100 rows), which silently dropped accounts and
// regions. The app tables are small (sales_vs_budget is ~4.4k rows), so we fetch rows once
// with an explicit page size and aggregate in the browser.

import { getRayfinClient } from "@/lib/rayfin-client";
import { pick } from "@/lib/snapshot";

export const DATA_END_LABEL = "21 Aug 2022";
export const YTD_MONTHS = 7; // Jan–Jul complete
export const MONTHS_REMAINING = 5; // Aug–Dec

const sp = () => getRayfinClient().connectors.spaceparts;
const num = (v: unknown) => Number(v ?? 0);
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
    monthly: MonthPoint[]; // 2021 → Dec 2022
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

function rollup(rows: Cell[]): Cell[] {
    const m = new Map<string, Cell>();
    for (const r of rows) {
        const k = `${r.name}|${+r.month}`;
        const c = m.get(k) ?? { name: r.name, month: r.month, net: 0, budget: 0 };
        c.net += r.net; c.budget += r.budget;
        m.set(k, c);
    }
    return [...m.values()];
}

function subjects(cells: Cell[], kind: Subject["kind"]): Subject[] {
    const by = new Map<string, Subject>();
    for (const c of cells) {
        const s = by.get(c.name) ?? { name: c.name, kind, actualYtd: 0, budgetYtd: 0, budgetFy: 0, net2022: 0, monthly: [] };
        s.monthly.push({ month: c.month, net: c.net, budget: c.budget });
        if (c.month.getUTCFullYear() === 2022) {
            s.budgetFy += c.budget;
            s.net2022 += c.net;
            if (isYtd(c.month)) { s.actualYtd += c.net; s.budgetYtd += c.budget; }
        }
        by.set(c.name, s);
    }
    for (const s of by.values()) s.monthly.sort((a, b) => +a.month - +b.month);
    return [...by.values()].filter((s) => s.budgetFy > 0);
}

let cache: Promise<CommandData> | undefined;

/** Loads everything once per session (the data ends in 2022; nothing changes while you look). */
export function loadCommandData(): Promise<CommandData> {
    cache ??= load().catch((e) => { cache = undefined; throw e; });
    return cache;
}

async function load(): Promise<CommandData> {
    const [salesRows, deliveryRows, forecastRows] = await Promise.all([
        pick("SalesVsBudget", () => sp().SalesVsBudget.select(["month", "interplanetaryRegion", "keyAccountName", "netSalesEur", "budgetEur"]).first(20000).execute()),
        pick("DeliveryByMonth", () => sp().DeliveryByMonth.select(["month", "onTimeLines", "invoiceLines", "latePenaltiesEur"]).first(1000).execute()),
        pick("ForecastVsBudget", () => sp().ForecastVsBudget.select(["month", "productType", "forecastEur", "budgetEur"]).first(1000).execute()),
    ]);

    const base = salesRows.map((r) => ({
        month: asDate(r.month),
        region: String(r.interplanetaryRegion).trim(),
        account: String(r.keyAccountName).trim(),
        net: num(r.netSalesEur),
        budget: num(r.budgetEur),
    }));

    const accountCells = rollup(base.filter((r) => r.account !== "No Key Account").map((r) => ({ name: r.account, month: r.month, net: r.net, budget: r.budget })));
    const regionCells = rollup(base.map((r) => ({ name: r.region, month: r.month, net: r.net, budget: r.budget })));
    const months = rollup(base.map((r) => ({ name: "all", month: r.month, net: r.net, budget: r.budget })))
        .map(({ month, net, budget }) => ({ month, net, budget }))
        .sort((a, b) => +a.month - +b.month);

    const delivery = deliveryRows
        .map((r) => ({
            month: asDate(r.month),
            onTimePct: num(r.invoiceLines) ? (100 * num(r.onTimeLines)) / num(r.invoiceLines) : 0,
            lines: num(r.invoiceLines),
            penalties: num(r.latePenaltiesEur),
        }))
        .sort((a, b) => +a.month - +b.month);

    const fc = new Map<string, ForecastRow>();
    for (const r of forecastRows) {
        const k = String(r.productType);
        const f = fc.get(k) ?? { productType: k, forecast: 0, budget: 0 };
        f.forecast += num(r.forecastEur); f.budget += num(r.budgetEur);
        fc.set(k, f);
    }

    const data: CommandData = {
        months,
        accountCells,
        regionCells,
        accounts: subjects(accountCells, "account"),
        regions: subjects(regionCells, "region"),
        delivery,
        forecast: [...fc.values()],
    };
    check(data, salesRows.length);
    return data;
}

/** Guards against silent truncation: compare with labs/01-data-agent/expected-answers.md. */
function check(d: CommandData, rows: number) {
    const total2022 = d.months.filter((m) => m.month.getUTCFullYear() === 2022).reduce((s, m) => s + m.net, 0);
    const ok = Math.abs(total2022 - 9026084019) < 5 && d.accounts.length === 13;
    const msg = `[data check] rows ${rows} · 2022 net ${Math.round(total2022).toLocaleString()} (expect 9,026,084,019) · key accounts ${d.accounts.length} (expect 13) · regions ${d.regions.length}`;
    if (ok) console.info(`✔ ${msg}`); else console.warn(`✖ ${msg}`);
}

/** €1,234,567 — or compact: €9.03bn / €214.5m / €850k. */
export const eur = (v: number, compact = false) => {
    if (!compact) return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
    const a = Math.abs(v), sign = v < 0 ? "−" : "";
    return a >= 1e9 ? `${sign}€${(a / 1e9).toFixed(2)}bn` : a >= 1e6 ? `${sign}€${(a / 1e6).toFixed(1)}m` : a >= 1e3 ? `${sign}€${(a / 1e3).toFixed(0)}k` : `${sign}€${a.toFixed(0)}`;
};

export const pct = (v: number, signed = false) => `${signed && v > 0 ? "+" : ""}${v.toFixed(1)}%`;
export const gapPct = (s: { actualYtd: number; budgetYtd: number }) => (s.actualYtd / s.budgetYtd - 1) * 100;
