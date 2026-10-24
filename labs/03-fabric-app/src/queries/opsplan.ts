// Operations and Plan tab data, read through the same Rayfin lakehouse connector (as the signed-in user).
// Each table is small (≤ 700 rows), fetched once per session with an explicit page size and shaped here.
// Numbers match labs/01-data-agent/expected-answers.md (O1, O3, O4*, O5, P1, P2, P4).
// *O4 there counts account_type = 'Key Account' only; the app treats Private Contract as a key account too.

import { getRayfinClient } from "@/lib/rayfin-client";

const sp = () => getRayfinClient().connectors.spaceparts;
const num = (v: unknown) => Number(v ?? 0);
const str = (v: unknown) => String(v ?? "").trim();
const asDate = (v: unknown) => new Date(v as string);

export const BACKLOG_STATUSES = ["Future Order", "WIP Order", "Late Order", "Overdue Order"] as const;
export type BacklogStatus = (typeof BACKLOG_STATUSES)[number];

export interface BacklogRow { status: BacklogStatus; region: string; account: string; lines: number; value: number }
export interface RegionDelivery { month: Date; region: string; onTime: number; lines: number; penalties: number }
export interface Cancellation { productType: string; cancelled: number; ordered: number; pct: number }

export interface OpsData {
    backlog: BacklogRow[];
    delivery: RegionDelivery[];
    cancellations: Cancellation[];
}

export interface TerritoryMonth { month: Date; territory: string; region: string; forecast: number; actual: number }
export interface BrandMonth { month: Date; brand: string; brandClass: string; actual: number; budget: number }
export interface ForecastMonth { month: Date; productType: string; forecast: number; budget: number }

export interface PlanData {
    territories: TerritoryMonth[];
    brands: BrandMonth[];
    forecast: ForecastMonth[];
}

let opsCache: Promise<OpsData> | undefined;
let planCache: Promise<PlanData> | undefined;

export function loadOpsData(): Promise<OpsData> {
    opsCache ??= loadOps().catch((e) => { opsCache = undefined; throw e; });
    return opsCache;
}

export function loadPlanData(): Promise<PlanData> {
    planCache ??= loadPlan().catch((e) => { planCache = undefined; throw e; });
    return planCache;
}

async function loadOps(): Promise<OpsData> {
    const [b, d, c] = await Promise.all([
        sp().OrderBacklog.select(["statusText", "interplanetaryRegion", "keyAccountName", "orderLines", "valueEur"]).first(5000).execute(),
        sp().DeliveryByRegion.select(["month", "interplanetaryRegion", "onTimeLines", "invoiceLines", "latePenaltiesEur"]).first(2000).execute(),
        sp().CancellationsByType.select(["productType", "cancelledEur", "orderedEur"]).first(100).execute(),
    ]);
    const data: OpsData = {
        backlog: b.map((r) => ({ status: str(r.statusText) as BacklogStatus, region: str(r.interplanetaryRegion), account: str(r.keyAccountName), lines: num(r.orderLines), value: num(r.valueEur) })),
        delivery: d.map((r) => ({ month: asDate(r.month), region: str(r.interplanetaryRegion), onTime: num(r.onTimeLines), lines: num(r.invoiceLines), penalties: num(r.latePenaltiesEur) })),
        cancellations: c.map((r) => ({ productType: str(r.productType), cancelled: num(r.cancelledEur), ordered: num(r.orderedEur), pct: num(r.orderedEur) ? (100 * num(r.cancelledEur)) / num(r.orderedEur) : 0 })),
    };
    const total = data.backlog.reduce((s, r) => s + r.value, 0);
    const msg = `[ops check] backlog ${Math.round(total).toLocaleString()} (expect 1,254,172,116) · rows ${data.backlog.length}`;
    if (Math.abs(total - 1254172116) < 10) console.info(`✔ ${msg}`); else console.warn(`✖ ${msg}`);
    return data;
}

async function loadPlan(): Promise<PlanData> {
    const [t, b, f] = await Promise.all([
        sp().TerritoryVsForecast.select(["month", "territory", "interplanetaryRegion", "forecastEur", "actualEur"]).first(5000).execute(),
        sp().BrandVsBudget.select(["month", "brand", "brandClass", "actualEur", "budgetEur"]).first(5000).execute(),
        sp().ForecastVsBudget.select(["month", "productType", "forecastEur", "budgetEur"]).first(1000).execute(),
    ]);
    return {
        territories: t.map((r) => ({ month: asDate(r.month), territory: str(r.territory), region: str(r.interplanetaryRegion), forecast: num(r.forecastEur), actual: num(r.actualEur) })),
        brands: b.map((r) => ({ month: asDate(r.month), brand: str(r.brand), brandClass: str(r.brandClass), actual: num(r.actualEur), budget: num(r.budgetEur) })),
        forecast: f.map((r) => ({ month: asDate(r.month), productType: str(r.productType), forecast: num(r.forecastEur), budget: num(r.budgetEur) })),
    };
}

/** Group and sum: `sumBy(rows, r => r.region, r => r.value)` → Map. */
export function sumBy<T>(rows: T[], key: (r: T) => string, val: (r: T) => number): Map<string, number> {
    const m = new Map<string, number>();
    for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + val(r));
    return m;
}
