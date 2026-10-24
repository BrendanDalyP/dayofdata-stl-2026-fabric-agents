import { useMemo } from "react";
import { ArrowRight } from "lucide-react";

import { useAsk } from "@/agent/AskContext";
import { memberByKey } from "@/agent/team";
import { AgentBrief } from "@/components/AgentBrief";
import { AskLink, Card, Skeleton } from "@/components/Card";
import { PulseChart } from "@/components/viz/PulseChart";
import { RegionBullets } from "@/components/viz/RegionBullets";
import { Sparkline } from "@/components/viz/Sparkline";
import { C, STATUS, statusOf, fmtEurShort } from "@/components/viz/common";
import { DATA_END_LABEL, eur, gapPct, pct } from "@/queries/overview";
import { navigate } from "@/lib/nav";
import { cn } from "@/lib/utils";

const sales = memberByKey("sales"), ops = memberByKey("operations"), plan = memberByKey("planning");

export function OverviewPage() {
    const { data, dataError, ask, actions } = useAsk();

    const k = useMemo(() => {
        if (!data) return undefined;
        const y22 = data.months.filter((m) => m.month.getUTCFullYear() === 2022 && m.month.getUTCMonth() <= 7);
        const ytd = y22.filter((m) => m.month.getUTCMonth() < 7);
        const net22 = y22.reduce((s, m) => s + m.net, 0);
        const gap = (ytd.reduce((s, m) => s + m.net, 0) / ytd.reduce((s, m) => s + m.budget, 0) - 1) * 100;
        const byStatus = { good: 0, warning: 0, critical: 0 } as Record<keyof typeof STATUS, number>;
        for (const a of data.accounts) byStatus[statusOf(gapPct(a))]++;
        const otd = data.delivery.filter((d) => d.month.getUTCFullYear() === 2022);
        const fc = data.forecast.reduce((s, r) => s + r.forecast, 0), fb = data.forecast.reduce((s, r) => s + r.budget, 0);
        const sorted = [...data.accounts].sort((a, b) => gapPct(a) - gapPct(b));
        return { y22, net22, gap, byStatus, behind: byStatus.warning + byStatus.critical, otd, fc, fb, worst: sorted.slice(0, 3), best: sorted.slice(-3).reverse() };
    }, [data]);

    if (dataError) return <p role="alert" className="rounded-lg border border-destructive/40 bg-card p-4 text-300 text-destructive">Couldn't read the lakehouse through the connector: {dataError}</p>;

    const openHigh = (actions ?? []).filter((a) => a.status === "open").sort((a, b) => ({ high: 0, medium: 1, low: 2 })[a.priority] - ({ high: 0, medium: 1, low: 2 })[b.priority]).slice(0, 5);

    return (
        <div className="grid h-full min-h-0 grid-cols-12 grid-rows-[auto_minmax(0,1.15fr)_minmax(0,1fr)] gap-3 max-[1100px]:h-auto max-[1100px]:grid-rows-none">
            {/* KPIs */}
            <div className="col-span-12 grid grid-cols-5 gap-3 max-[1100px]:grid-cols-2">
                <Kpi label="Net sales, 2022 to date" value={k && eur(k.net22, true)} note={`to ${DATA_END_LABEL}`}
                    spark={k && <Sparkline values={k.y22.map((m) => m.net)} band={k.y22.map((m) => m.budget)} color={C.series} />} />
                <Kpi label="Against budget, Jan–Jul" value={k && pct(k.gap, true)} tone={k && k.gap < 0 ? "bad" : undefined} note="complete months" />
                <button type="button" onClick={() => navigate("accounts")} className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
                    <Kpi label="Key accounts behind budget" value={k && `${k.behind} of ${data!.accounts.length}`} tone={k && k.behind ? "bad" : undefined}
                        note={k && (
                            <span className="flex gap-2">
                                {(Object.keys(STATUS) as Array<keyof typeof STATUS>).map((s) => (
                                    <span key={s} className="inline-flex items-center gap-1"><span aria-hidden style={{ color: STATUS[s].color }}>{STATUS[s].icon}</span>{k.byStatus[s]} {STATUS[s].label}</span>
                                ))}
                            </span>
                        )} />
                </button>
                <Kpi label="On-time delivery, Aug 2022" value={k?.otd.length ? pct(k.otd.at(-1)!.onTimePct) : undefined} note="share of invoice lines"
                    spark={k && <Sparkline values={k.otd.map((d) => d.onTimePct)} color={ops.color} />} />
                <Kpi label="2022 forecast vs budget" value={k && pct((k.fc / k.fb - 1) * 100, true)} tone={k && k.fc < k.fb ? "bad" : undefined} note={k && `${eur(k.fc, true)} forecast`} />
            </div>

            {/* Sales pulse + brief */}
            <Card className="col-span-8 max-[1100px]:col-span-12 max-[1100px]:h-96" title="Net sales against budget"
                subtitle="Monthly, 2021–2022 · click a month to ask"
                actions={<AskLink color={sales.color} label="Growth by product type" onClick={() => ask("How did net sales grow against last year by product type?", "sales")} />}>
                {data ? <PulseChart data={data.months} onSelect={(m) => ask(`What drove net sales against budget in ${m.month.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}?`, "sales", m.month.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }))} /> : <Skeleton />}
            </Card>
            <AgentBrief className="col-span-4 max-[1100px]:col-span-12" agent="sales"
                title="Where are we behind budget, and why?"
                question="Which key accounts are furthest behind budget this year, and what is driving the gap?" />

            {/* Movers · regions · actions */}
            <Card className="col-span-4 max-[1100px]:col-span-12" title="Top movers" subtitle="Key accounts, Jan–Jul vs budget"
                actions={<button type="button" onClick={() => navigate("accounts")} className="inline-flex items-center gap-1 text-200 font-semibold text-brand-foreground hover:underline">All accounts <ArrowRight className="icon-size-100" /></button>}>
                {k ? (
                    <div className="grid h-full grid-rows-2 gap-2">
                        {([["Furthest behind", k.worst], ["Furthest ahead", k.best]] as const).map(([label, list]) => (
                            <div key={label} className="min-h-0">
                                <div className="mb-1 text-100 font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
                                <ul className="space-y-1">
                                    {list.map((a) => {
                                        const g = gapPct(a);
                                        const w = Math.min(100, Math.abs(g) * 3);
                                        return (
                                            <li key={a.name}>
                                                <button type="button" onClick={() => navigate("accounts", a.name)}
                                                    className="grid w-full grid-cols-[1fr_88px_56px] items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                                    <span className="truncate text-200 text-foreground">{a.name}</span>
                                                    <span className="h-2 rounded-full bg-muted"><span className="block h-2 rounded-full" style={{ width: `${w}%`, background: g < 0 ? C.below : C.above }} /></span>
                                                    <span className="tabular text-right text-200 font-semibold" style={{ color: g < 0 ? C.below : undefined }}>{pct(g, true)}</span>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        ))}
                    </div>
                ) : <Skeleton />}
            </Card>
            <Card className="col-span-4 max-[1100px]:col-span-12 max-[1100px]:h-96" title="Regions vs budget" subtitle="Jan–Jul · bar = net sales, tick = budget, band = ±10%">
                {data ? <RegionBullets regions={data.regions} onSelect={(r) => ask(`How is ${r.name} doing against budget this year (${pct(gapPct(r), true)} Jan–Jul), and which key accounts drive it?`, "sales", r.name)} /> : <Skeleton />}
            </Card>
            <Card className="col-span-4 max-[1100px]:col-span-12" title="Open actions" subtitle="From agent answers · highest priority first"
                actions={<button type="button" onClick={() => navigate("actions")} className="inline-flex items-center gap-1 text-200 font-semibold text-brand-foreground hover:underline">Action board <ArrowRight className="icon-size-100" /></button>}
                bodyClassName="overflow-y-auto">
                {actions === null ? <Skeleton /> : openHigh.length === 0 ? (
                    <div className="space-y-2 text-200 text-muted-foreground">
                        <p>No open actions yet. Brief an agent, then use the buttons under its answer.</p>
                        <div className="flex flex-wrap gap-1.5">
                            <AskLink color={ops.color} label="Overdue orders" onClick={() => ask("Which key accounts have the most overdue order value?", "operations")} />
                            <AskLink color={plan.color} label="Forecast vs budget" onClick={() => ask("How does the 2022 forecast compare with the 2022 budget by product type?", "planning")} />
                        </div>
                    </div>
                ) : (
                    <ul className="space-y-1.5">
                        {openHigh.map((a) => (
                            <li key={a.id} className="flex items-start gap-2 rounded px-1 py-1 hover:bg-muted">
                                <span aria-hidden className="mt-1 inline-block size-2 shrink-0 rounded-full" style={{ background: a.priority === "high" ? STATUS.critical.color : a.priority === "medium" ? STATUS.warning.color : STATUS.good.color }} />
                                <div className="min-w-0">
                                    <div className="truncate text-200 font-semibold text-foreground">{a.title}</div>
                                    <div className="tabular text-100 text-muted-foreground">{a.priority} · {a.dueDate ? `due ${a.dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "no due date"}{a.amountEur ? ` · ${fmtEurShort(a.amountEur)} to land` : ""}</div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
        </div>
    );
}

function Kpi({ label, value, note, tone, spark }: { label: string; value?: string; note?: React.ReactNode; tone?: "bad"; spark?: React.ReactNode }) {
    return (
        <div className="flex h-full flex-col justify-between rounded-lg border border-border bg-card px-4 py-3">
            <div className="text-200 text-muted-foreground">{label}</div>
            <div className="mt-1 flex items-end justify-between gap-2">
                <div className={cn("font-heading text-hero-700 font-semibold leading-hero-700", tone === "bad" ? "text-destructive" : "text-emphasis-foreground")}>
                    {value ?? <span className="inline-block h-7 w-24 rounded bg-muted trace-pulse" />}
                </div>
                {spark}
            </div>
            <div className="mt-1 truncate text-100 text-muted-foreground">{note}</div>
        </div>
    );
}

