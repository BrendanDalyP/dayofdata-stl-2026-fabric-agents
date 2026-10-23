import { useEffect, useState, type ReactNode } from "react";
import { VegaVisual } from "@microsoft/fabric-visuals";
import type { DataTable } from "@microsoft/fabric-visuals-core";
import { MessageSquarePlus, TrendingUp, Truck, Target, Database } from "lucide-react";

import { useThemeContext } from "@/hooks/theme.context";
import { PageHeader } from "@/components/Shell";
import { TEAM, type AgentKey } from "@/agent/team";
import {
    DATA_END_LABEL, deliveryByMonth, eur, forecastVsBudget, keyAccountsVsBudget, pct,
    salesByMonth, salesByRegionThisYear,
    type DeliveryPoint, type ForecastRow, type MonthPoint, type Ranked,
} from "@/queries/overview";
import { deliverySpec, forecastSpec, regionSpec, salesVsBudgetSpec } from "@/queries/overview-specs";
import { cn } from "@/lib/utils";

export type AskHandler = (question: string, agent: AgentKey) => void;

interface State<T> { data?: T; error?: string }

function useLoad<T>(fn: () => Promise<T>): State<T> {
    const [s, set] = useState<State<T>>({});
    useEffect(() => {
        let live = true;
        fn().then((data) => live && set({ data })).catch((e) => live && set({ error: e instanceof Error ? e.message : String(e) }));
        return () => { live = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return s;
}

const AGENT_ICON = { sales: TrendingUp, operations: Truck, planning: Target } as const;

export function OverviewPage({ onAsk }: { onAsk: AskHandler }) {
    const { theme } = useThemeContext();
    const months = useLoad(salesByMonth);
    const regions = useLoad(salesByRegionThisYear);
    const accounts = useLoad(keyAccountsVsBudget);
    const delivery = useLoad(deliveryByMonth);
    const forecast = useLoad(forecastVsBudget);

    const ytd = months.data?.filter((m) => m.month.getUTCFullYear() === 2022);
    const ytdNet = ytd?.reduce((s, m) => s + m.netSalesEur, 0);
    const janJul = ytd?.filter((m) => m.month.getUTCMonth() < 7);
    const janJulGap = janJul ? (janJul.reduce((s, m) => s + m.netSalesEur, 0) / janJul.reduce((s, m) => s + m.budgetEur, 0) - 1) * 100 : undefined;
    const otd2022 = delivery.data?.filter((d) => d.month.getUTCFullYear() === 2022);
    const otdLatest = otd2022?.at(-1)?.onTimePct;
    const fcTotal = forecast.data?.reduce((s, r) => s + r.forecastEur, 0);
    const fcBudget = forecast.data?.reduce((s, r) => s + r.budgetEur, 0);

    return (
        <div>
            <PageHeader
                eyebrow="SpaceParts Co. · live from the lakehouse"
                title="Sales, delivery and plan"
                subtitle={`Charts read the SpaceParts lakehouse through a Rayfin connector, as you. Data runs to ${DATA_END_LABEL}. Ask the agent team about anything a chart doesn't show.`}
            />

            {/* KPI row */}
            <div className="mb-grid grid gap-grid sm:grid-cols-2 xl:grid-cols-4">
                <Kpi label="Net sales, 2022 to date" value={ytdNet !== undefined ? eur(ytdNet, true) : undefined} note={`to ${DATA_END_LABEL}`} error={months.error}
                    ask={() => onAsk("What were net sales in euros by region this year?", "sales")} agent="sales" />
                <Kpi label="Against budget, Jan–Jul" value={janJulGap !== undefined ? pct(janJulGap, true) : undefined} tone={janJulGap !== undefined && janJulGap < 0 ? "bad" : "good"} note="complete months" error={months.error}
                    ask={() => onAsk("Which key accounts are furthest behind budget this year?", "sales")} agent="sales" />
                <Kpi label="On-time delivery, latest month" value={otdLatest !== undefined ? pct(otdLatest) : undefined} note={otd2022?.length ? otd2022.at(-1)!.month.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }) : ""} error={delivery.error}
                    tone={otdLatest !== undefined && otdLatest < 70 ? "bad" : "good"}
                    ask={() => onAsk("What was the on-time delivery rate by month this year?", "operations")} agent="operations" />
                <Kpi label="2022 forecast vs budget" value={fcTotal && fcBudget ? pct((fcTotal / fcBudget - 1) * 100, true) : undefined} note={fcTotal ? `${eur(fcTotal, true)} forecast` : ""} error={forecast.error}
                    tone={fcTotal && fcBudget && fcTotal < fcBudget ? "bad" : "good"}
                    ask={() => onAsk("How does the 2022 forecast compare with the 2022 budget by product type?", "planning")} agent="planning" />
            </div>

            <div className="grid gap-grid lg:grid-cols-3">
                <Panel className="lg:col-span-2" title="Net sales against budget" subtitle="EUR by month · bars = net sales, line = budget · Aug 2022 is partial"
                    asks={[["How did net sales grow against last year by product type?", "sales"]]} onAsk={onAsk} error={months.error} loading={!months.data}>
                    {months.data && (
                        <VegaVisual spec={salesVsBudgetSpec} theme={theme} style={{ height: 300 }}
                            data={table(["month", "net", "budget"], months.data.map((m: MonthPoint) => [m.month.toISOString(), m.netSalesEur, m.budgetEur]))} />
                    )}
                </Panel>

                <TeamRail onAsk={onAsk} />

                <Panel title="Net sales by region, 2022" subtitle={`EUR, to ${DATA_END_LABEL}`}
                    asks={[["Who are the top 5 account managers by net sales this year?", "sales"]]} onAsk={onAsk} error={regions.error} loading={!regions.data}>
                    {regions.data && (
                        <VegaVisual spec={regionSpec} theme={theme} style={{ height: 340 }}
                            data={table(["region", "net"], regions.data.map((r: Ranked) => [r.name.replace(" Region", ""), r.netSalesEur]))} />
                    )}
                </Panel>

                <Panel className="lg:col-span-2" title="Key accounts against budget" subtitle="EUR, Jan–Jul 2022 · sorted by gap"
                    asks={[["Which key accounts are furthest behind budget this year?", "sales"], ["Which key accounts have the most overdue order value?", "operations"]]}
                    onAsk={onAsk} error={accounts.error} loading={!accounts.data}>
                    {accounts.data && <AccountsTable rows={accounts.data} onAsk={onAsk} />}
                </Panel>

                <Panel className="lg:col-span-2" title="On-time delivery" subtitle="Share of invoice lines delivered on time, by month"
                    asks={[["Which regions paid the most late-delivery penalties this year, in euros?", "operations"]]} onAsk={onAsk} error={delivery.error} loading={!delivery.data}>
                    {delivery.data && (
                        <VegaVisual spec={deliverySpec} theme={theme} style={{ height: 260 }}
                            data={table(["month", "otd"], delivery.data.map((d: DeliveryPoint) => [d.month.toISOString(), Number(d.onTimePct.toFixed(1))]))} />
                    )}
                </Panel>

                <Panel title="2022 forecast vs budget" subtitle="by product type"
                    asks={[["Which territories are furthest behind their forecast so far this year?", "planning"]]} onAsk={onAsk} error={forecast.error} loading={!forecast.data}>
                    {forecast.data && (
                        <VegaVisual spec={forecastSpec} theme={theme} style={{ height: 260 }}
                            data={table(["productType", "forecast", "budget", "gapPct"], forecast.data.map((r: ForecastRow) => [r.productType, r.forecastEur, r.budgetEur, Number(((r.forecastEur / r.budgetEur - 1) * 100).toFixed(1))]))} />
                    )}
                </Panel>
            </div>
        </div>
    );
}

function table(cols: string[], rows: unknown[][]): DataTable {
    return { columns: cols.map((name) => ({ name })), rows } as DataTable;
}

function Kpi({ label, value, note, tone, error, ask, agent }: { label: string; value?: string; note?: string; tone?: "good" | "bad"; error?: string; ask: () => void; agent: AgentKey }) {
    const Icon = AGENT_ICON[agent];
    return (
        <div className="flex flex-col rounded-xl border border-border bg-card p-4 shadow-container-2">
            <div className="font-monospace text-100 uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
            <div className={cn("mt-2 font-numeric text-hero-800 font-semibold leading-hero-800",
                error ? "text-destructive" : tone === "bad" ? "text-destructive" : "text-emphasis-foreground")}>
                {error ? "—" : value ?? <span className="inline-block h-8 w-28 rounded bg-muted trace-pulse" />}
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-200 text-muted-foreground">{error ? "Couldn't load" : note}</span>
                <button type="button" onClick={ask} className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-200 text-brand-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Icon className="icon-size-100" aria-hidden /> Ask why
                </button>
            </div>
        </div>
    );
}

function Panel({ title, subtitle, children, className, asks, onAsk, error, loading }: {
    title: string; subtitle?: string; children?: ReactNode; className?: string;
    asks: Array<[string, AgentKey]>; onAsk: AskHandler; error?: string; loading?: boolean;
}) {
    return (
        <section className={cn("flex min-w-0 flex-col rounded-xl border border-border bg-card p-4 shadow-container-2", className)}>
            <header className="mb-3">
                <h2 className="font-heading text-visual-title font-semibold text-emphasis-foreground">{title}</h2>
                {subtitle && <p className="text-200 text-muted-foreground">{subtitle}</p>}
            </header>
            <div className="min-h-0 flex-1">
                {error ? (
                    <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-200 text-destructive">
                        Couldn't read the lakehouse: {error}
                    </p>
                ) : loading ? (
                    <div className="h-64 rounded-lg bg-muted trace-pulse" aria-label="Loading" />
                ) : (
                    children
                )}
            </div>
            <footer className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                {asks.map(([q, agent]) => {
                    const Icon = AGENT_ICON[agent];
                    const name = TEAM.find((m) => m.key === agent)!.name;
                    return (
                        <button key={q} type="button" onClick={() => onAsk(q, agent)}
                            className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-left text-200 text-muted-foreground hover:border-brand hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            <Icon className="icon-size-100 shrink-0 text-brand-foreground" aria-hidden />
                            <span><span className="font-semibold text-foreground">{name}:</span> {q}</span>
                        </button>
                    );
                })}
            </footer>
        </section>
    );
}

function AccountsTable({ rows, onAsk }: { rows: Ranked[]; onAsk: AskHandler }) {
    return (
        <div className="max-h-80 overflow-auto">
            <table className="w-full text-200">
                <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-border text-left font-monospace text-100 uppercase tracking-wider text-muted-foreground">
                        <th className="py-2 pr-2 font-semibold">Key account</th>
                        <th className="py-2 pr-2 text-right font-semibold">Net sales</th>
                        <th className="py-2 pr-2 text-right font-semibold">Budget</th>
                        <th className="py-2 pr-2 text-right font-semibold">Gap</th>
                        <th className="py-2 text-right font-semibold">Gap %</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r) => {
                        const gap = r.netSalesEur - r.budgetEur;
                        const gp = (r.netSalesEur / r.budgetEur - 1) * 100;
                        return (
                            <tr key={r.name} className="group border-b border-border/60 hover:bg-muted/60">
                                <td className="py-2 pr-2">
                                    <button type="button" onClick={() => onAsk(`How is ${r.name} doing?`, "sales")}
                                        className="text-left text-foreground underline-offset-2 hover:text-brand-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        title={`Ask the Sales Analyst about ${r.name}`}>
                                        {r.name}
                                    </button>
                                </td>
                                <td className="py-2 pr-2 text-right font-numeric">{eur(r.netSalesEur)}</td>
                                <td className="py-2 pr-2 text-right font-numeric">{eur(r.budgetEur)}</td>
                                <td className={cn("py-2 pr-2 text-right font-numeric", gap < 0 ? "text-destructive" : "text-success")}>{eur(gap)}</td>
                                <td className={cn("py-2 text-right font-numeric", gap < 0 ? "text-destructive" : "text-success")}>{pct(gp, true)}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function TeamRail({ onAsk }: { onAsk: AskHandler }) {
    return (
        <aside className="flex flex-col rounded-xl border border-brand/40 bg-card p-4 shadow-container-4 lg:row-span-2">
            <div className="mb-1 flex items-center gap-2 font-monospace text-100 uppercase tracking-[0.2em] text-signal">
                <Database className="icon-size-100" aria-hidden /> Agent team
            </div>
            <h2 className="font-heading text-visual-title font-semibold text-emphasis-foreground">Ask beside the charts</h2>
            <p className="mb-3 text-200 text-muted-foreground">Three Fabric data agents, each with its own tables and instructions. Each answer runs a fresh, governed query.</p>
            <div className="flex flex-1 flex-col gap-3">
                {TEAM.map((m) => {
                    const Icon = AGENT_ICON[m.key];
                    return (
                        <div key={m.key} className="rounded-lg border border-border p-3">
                            <div className="flex items-center gap-2">
                                <span className="flex icon-size-500 items-center justify-center rounded-md bg-brand text-on-brand"><Icon className="icon-size-200" aria-hidden /></span>
                                <div>
                                    <div className="font-heading text-300 font-semibold text-emphasis-foreground">{m.name}</div>
                                    <div className="text-200 text-muted-foreground">{m.role}</div>
                                </div>
                            </div>
                            <div className="mt-2 flex flex-col gap-1">
                                {m.chips.slice(0, 2).map((q) => (
                                    <button key={q} type="button" onClick={() => onAsk(q, m.key)}
                                        className="flex items-start gap-1.5 rounded-md px-2 py-1 text-left text-200 text-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                        <MessageSquarePlus className="mt-0.5 icon-size-100 shrink-0 text-brand-foreground" aria-hidden /> {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </aside>
    );
}
