import { useEffect, useMemo, useState, type ReactNode } from "react";
import { MessageSquarePlus, TrendingUp, Truck, Target } from "lucide-react";

import { AgentConsole, type PendingAsk } from "@/components/AgentConsole";
import { VarianceHeatmap } from "@/components/viz/VarianceHeatmap";
import { PulseChart } from "@/components/viz/PulseChart";
import { RegionBullets } from "@/components/viz/RegionBullets";
import { DeliveryStrip } from "@/components/viz/DeliveryStrip";
import { ForecastDiverging } from "@/components/viz/ForecastDiverging";
import { Sparkline } from "@/components/viz/Sparkline";
import { C } from "@/components/viz/common";
import { DATA_END_LABEL, eur, gapPct, loadCommandData, pct, type CommandData } from "@/queries/overview";
import type { AgentKey } from "@/agent/team";
import { cn } from "@/lib/utils";

type Target = AgentKey | "team";
const AGENT_ICON = { sales: TrendingUp, operations: Truck, planning: Target, team: MessageSquarePlus } as const;

export function CommandCenter() {
    const [data, setData] = useState<CommandData>();
    const [error, setError] = useState<string>();
    const [pending, setPending] = useState<PendingAsk>();
    const [focus, setFocus] = useState<string>();

    useEffect(() => {
        loadCommandData().then(setData).catch((e) => setError(e instanceof Error ? e.message : String(e)));
    }, []);

    const ask = (question: string, agent: Target, subject?: string) => {
        if (subject) setFocus(subject);
        setPending({ id: Date.now(), question, agent });
    };

    const kpi = useMemo(() => {
        if (!data) return undefined;
        const y22 = data.months.filter((m) => m.month.getUTCFullYear() === 2022 && m.month.getUTCMonth() <= 7);
        const ytd = y22.filter((m) => m.month.getUTCMonth() < 7);
        const net22 = y22.reduce((s, m) => s + m.net, 0);
        const gap = (ytd.reduce((s, m) => s + m.net, 0) / ytd.reduce((s, m) => s + m.budget, 0) - 1) * 100;
        const behind = data.accounts.filter((a) => a.actualYtd < a.budgetYtd);
        const otd = data.delivery.filter((d) => d.month.getUTCFullYear() === 2022);
        const fc = data.forecast.reduce((s, r) => s + r.forecast, 0);
        const fb = data.forecast.reduce((s, r) => s + r.budget, 0);
        return { y22, ytd, net22, gap, behind, otd, fc, fb };
    }, [data]);

    return (
        <div className="grid gap-grid xl:grid-cols-[minmax(0,1fr)_440px]">
            <div className="min-w-0 space-y-grid">
                {error && (
                    <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-300 text-destructive">
                        Couldn't read the lakehouse through the connector: {error}
                    </p>
                )}

                {/* KPI strip */}
                <div className="grid gap-grid sm:grid-cols-2 2xl:grid-cols-5">
                    <Kpi label="Net sales · 2022 to date" value={kpi && eur(kpi.net22, true)} note={`to ${DATA_END_LABEL}`}
                        spark={kpi && <Sparkline values={kpi.y22.map((m) => m.net)} band={kpi.y22.map((m) => m.budget)} color={C.blue} />}
                        onAsk={() => ask("What were net sales in euros by region this year?", "sales")} agent="sales" />
                    <Kpi label="Against budget · Jan–Jul" value={kpi && pct(kpi.gap, true)} bad={kpi && kpi.gap < 0} note="complete months"
                        onAsk={() => ask("Which key accounts are furthest behind budget this year?", "sales")} agent="sales" />
                    <Kpi label="Key accounts behind budget" value={kpi && `${kpi.behind.length} of ${data!.accounts.length}`} bad={!!kpi?.behind.length}
                        note={kpi?.behind.length ? `worst: ${[...kpi.behind].sort((a, b) => (a.actualYtd - a.budgetYtd) - (b.actualYtd - b.budgetYtd))[0].name}` : ""}
                        onAsk={() => ask("Which key accounts are furthest behind budget this year?", "sales")} agent="sales" />
                    <Kpi label="On-time delivery · latest" value={kpi?.otd.length ? pct(kpi.otd.at(-1)!.onTimePct) : undefined} bad={kpi?.otd.length ? kpi.otd.at(-1)!.onTimePct < 70 : false}
                        note="Aug 2022, to 21 Aug" spark={kpi && <Sparkline values={kpi.otd.map((d) => d.onTimePct)} color={C.yellow} />}
                        onAsk={() => ask("What was the on-time delivery rate by month this year?", "operations")} agent="operations" />
                    <Kpi label="2022 forecast vs budget" value={kpi && pct((kpi.fc / kpi.fb - 1) * 100, true)} bad={kpi && kpi.fc < kpi.fb} note={kpi && `${eur(kpi.fc, true)} forecast`}
                        onAsk={() => ask("How does the 2022 forecast compare with the 2022 budget by product type?", "planning")} agent="planning" />
                </div>

                <Panel title="Where we're missing budget" subtitle="Key account × month, 2022 · colour = net sales vs budget · bars = gap Jan–Jul · click a row or cell to ask"
                    loading={!data} asks={[["Which key accounts are furthest behind budget this year?", "sales"], ["Which key accounts have the most overdue order value?", "operations"]]} onAsk={ask}>
                    {data && (
                        <VarianceHeatmap cells={data.accountCells} subjects={data.accounts} focus={focus}
                            onSelect={(s, m) => ask(
                                m ? `How did the key account ${s.name} do against budget in ${m.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}?`
                                  : `How is the key account ${s.name} doing against budget this year, and which months and product types drive the gap?`,
                                "sales", s.name)} />
                    )}
                </Panel>

                <Panel title="Sales pulse" subtitle="Monthly net sales (bars) vs budget (yellow), 2021–22 · lower panel: cumulative gap within each year · Aug 2022 partial"
                    loading={!data} asks={[["How did net sales grow against last year by product type?", "sales"]]} onAsk={ask}>
                    {data && <PulseChart data={data.months} />}
                </Panel>

                <div className="grid gap-grid lg:grid-cols-2">
                    <Panel title="Regions vs budget" subtitle="Jan–Jul 2022 · bar = net sales, yellow tick = budget, bands = 90/100/110%"
                        loading={!data} asks={[["What were net sales in euros by region this year?", "sales"]]} onAsk={ask}>
                        {data && <RegionBullets regions={data.regions} focus={focus}
                            onSelect={(s) => ask(`How is ${s.name} doing against budget this year (${pct(gapPct(s), true)} Jan–Jul)?`, "sales", s.name)} />}
                    </Panel>
                    <div className="space-y-grid">
                        <Panel title="2022 forecast vs budget" subtitle="by product type · click a bar to ask Planning"
                            loading={!data} asks={[["Which territories are furthest behind their forecast so far this year?", "planning"]]} onAsk={ask}>
                            {data && <ForecastDiverging rows={data.forecast}
                                onSelect={(r) => ask(`Why is the 2022 forecast for ${r.productType} ${r.forecast < r.budget ? "below" : "above"} budget?`, "planning", r.productType)} />}
                        </Panel>
                        <Panel title="Delivery" subtitle="On-time % (blue) · late-delivery penalties € (yellow)"
                            loading={!data} asks={[["Which regions paid the most late-delivery penalties this year, in euros?", "operations"]]} onAsk={ask}>
                            {data && <DeliveryStrip data={data.delivery} />}
                        </Panel>
                    </div>
                </div>
            </div>

            <div className="xl:sticky xl:top-4 xl:h-[calc(100vh-6rem)]">
                <div className="h-[80vh] xl:h-full">
                    <AgentConsole data={data} pending={pending} focus={focus} />
                </div>
            </div>
        </div>
    );
}

function Kpi({ label, value, note, bad, spark, onAsk, agent }: {
    label: string; value?: string; note?: string; bad?: boolean; spark?: ReactNode; onAsk: () => void; agent: AgentKey;
}) {
    const Icon = AGENT_ICON[agent];
    return (
        <div className="flex flex-col rounded-xl border border-border bg-card p-3 shadow-container-2">
            <div className="font-monospace text-100 uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
            <div className="mt-1 flex items-end justify-between gap-2">
                <div className={cn("font-numeric text-hero-700 font-semibold leading-hero-700", bad ? "text-destructive" : "text-emphasis-foreground")}>
                    {value ?? <span className="inline-block h-7 w-24 rounded bg-muted trace-pulse" />}
                </div>
                {spark}
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
                <span className="truncate text-100 text-muted-foreground">{note}</span>
                <button type="button" onClick={onAsk} className="flex shrink-0 items-center gap-1 rounded px-1 text-100 text-brand-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Icon className="icon-size-100" aria-hidden /> Ask
                </button>
            </div>
        </div>
    );
}

function Panel({ title, subtitle, children, loading, asks, onAsk }: {
    title: string; subtitle?: string; children?: ReactNode; loading?: boolean;
    asks: Array<[string, AgentKey]>; onAsk: (q: string, a: Target) => void;
}) {
    return (
        <section className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-container-2">
            <header className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                    <h2 className="font-heading text-visual-title font-semibold text-emphasis-foreground">{title}</h2>
                    {subtitle && <p className="text-100 text-muted-foreground">{subtitle}</p>}
                </div>
                <div className="flex flex-wrap gap-1">
                    {asks.map(([q, a]) => {
                        const Icon = AGENT_ICON[a];
                        return (
                            <button key={q} type="button" onClick={() => onAsk(q, a)} title={q}
                                className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-100 text-muted-foreground hover:border-brand hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                <Icon className="icon-size-100 text-brand-foreground" aria-hidden /> Ask {a}
                            </button>
                        );
                    })}
                </div>
            </header>
            {loading ? <div className="h-48 rounded-lg bg-muted trace-pulse" aria-label="Loading" /> : children}
        </section>
    );
}
