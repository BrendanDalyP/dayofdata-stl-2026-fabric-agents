import { useMemo } from "react";
import { ArrowRight } from "lucide-react";

import { useAsk } from "@/agent/AskContext";
import { memberByKey } from "@/agent/team";
import { AgentBrief } from "@/components/AgentBrief";
import { Card, Skeleton } from "@/components/Card";
import { Ask, Kpi } from "@/components/Kpi";
import { PulseChart } from "@/components/viz/PulseChart";
import { RegionGaps } from "@/components/viz/RegionGaps";
import { Sparkline } from "@/components/viz/Sparkline";
import { C, STATUS, statusOf, fmtEurShort } from "@/components/viz/common";
import { DATA_END_LABEL, eur, gapPct, pct, type Subject } from "@/queries/overview";
import { navigate } from "@/lib/nav";

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
        return { y22, net22, gap, byStatus, behind: byStatus.warning + byStatus.critical, otd, fc, fb, worst: sorted.slice(0, 4), best: sorted.slice(-4).reverse() };
    }, [data]);

    if (dataError) return <p role="alert" className="rounded-lg border border-destructive/40 bg-card p-4 text-300 text-destructive">Couldn't read the lakehouse through the connector: {dataError}</p>;

    const order = { high: 0, medium: 1, low: 2 } as const;
    const open = (actions ?? []).filter((a) => a.status === "open").sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 5);

    return (
        <div className="grid h-full min-h-0 grid-cols-12 grid-rows-[auto_minmax(0,1fr)_minmax(0,1fr)] gap-3 max-[1100px]:h-auto max-[1100px]:grid-rows-none">
            {/* KPIs — each with the agent who can explain it */}
            <div className="col-span-12 grid grid-cols-5 gap-3 max-[1100px]:grid-cols-2">
                <Kpi label="Net sales, 2022 to date" value={k && eur(k.net22, true)} note={`to ${DATA_END_LABEL} · dotted line = budget`}
                    spark={k && <Sparkline values={k.y22.map((m) => m.net)} band={k.y22.map((m) => m.budget)} color={C.series} />}
                    ask={<Ask agent="sales" label="By region" q="What were net sales in euros by region this year?" />} />
                <Kpi label="Against budget, Jan–Jul" value={k && pct(k.gap, true)} tone={k && k.gap < 0 ? "bad" : "good"} note="complete months"
                    ask={<Ask agent="sales" label="What drives it?" q="Which key accounts and regions drive net sales against budget this year?" />} />
                <Kpi label="Key accounts behind budget" value={k && `${k.behind} of ${data!.accounts.length}`} tone={k && k.behind ? "bad" : undefined}
                    onClick={() => navigate("accounts")}
                    note={k && (
                        <span className="flex gap-2.5">
                            {(Object.keys(STATUS) as Array<keyof typeof STATUS>).map((s) => (
                                <span key={s} className="inline-flex items-center gap-1"><span aria-hidden style={{ color: STATUS[s].color }}>{STATUS[s].icon}</span>{k.byStatus[s]} {STATUS[s].label}</span>
                            ))}
                        </span>
                    )}
                    ask={<Ask agent="sales" label="Who and why?" q="Which key accounts are furthest behind budget this year?" />} />
                <Kpi label="On-time delivery, Aug 2022" value={k?.otd.length ? pct(k.otd.at(-1)!.onTimePct) : undefined} tone="bad" note="share of invoice lines on time"
                    spark={k && <Sparkline values={k.otd.map((d) => d.onTimePct)} color={memberByKey("operations").color} />}
                    ask={<Ask agent="operations" label="Trend" q="What was the on-time delivery rate by month this year?" />} />
                <Kpi label="2022 forecast vs budget" value={k && pct((k.fc / k.fb - 1) * 100, true)} tone={k && k.fc < k.fb ? "bad" : "good"} note={k && `${eur(k.fc, true)} forecast · ${eur(k.fb, true)} budget`}
                    ask={<Ask agent="planning" label="By product" q="How does the 2022 forecast compare with the 2022 budget by product type?" />} />
            </div>

            {/* Sales pulse + brief */}
            <Card className="col-span-8 max-[1100px]:col-span-12 max-[1100px]:h-96" title="Net sales against budget"
                subtitle="Monthly, 2021–2022 · click a month to ask about it"
                actions={<>
                    <Ask agent="sales" label="Growth vs last year" q="How did net sales grow against last year by product type?" />
                    <Ask agent="planning" label="Rest of 2022" q="How does the 2022 forecast compare with budget by month?" />
                </>}>
                {data ? <PulseChart data={data.months} onSelect={(m) => {
                    const label = m.month.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
                    ask(`What drove net sales against budget in ${label}?`, "sales", m.month.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }));
                }} /> : <Skeleton />}
            </Card>
            <AgentBrief className="col-span-4 max-[1100px]:col-span-12" agent="sales"
                title="Where are we behind budget, and why?"
                question="Which key accounts are furthest behind budget this year, and what is driving the gap?" />

            {/* Movers · regions · actions */}
            <Card className="col-span-4 max-[1100px]:col-span-12" title="Key account movers" subtitle="Jan–Jul vs budget · click to open"
                actions={<button type="button" onClick={() => navigate("accounts")} className="inline-flex items-center gap-1 text-200 font-semibold text-brand-foreground hover:underline">All 13 <ArrowRight className="icon-size-100" /></button>}>
                {k ? (
                    <div className="grid h-full grid-cols-2 gap-4">
                        <MoverList title="Furthest behind" list={k.worst} />
                        <MoverList title="Furthest ahead" list={k.best} />
                    </div>
                ) : <Skeleton />}
            </Card>
            <Card className="col-span-4 max-[1100px]:col-span-12 max-[1100px]:h-96" title="Regions vs budget"
                subtitle="Jan–Jul gap to budget · click a region"
                actions={<Ask agent="sales" label="Why so uneven?" q="Which regions are furthest above and below budget this year, and which key accounts drive that?" />}>
                {data ? <RegionGaps regions={data.regions} onSelect={(r: Subject) => ask(`How is ${r.name} doing against budget this year (${pct(gapPct(r), true)} Jan–Jul), and which key accounts drive it?`, "sales", r.name)} /> : <Skeleton />}
            </Card>
            <Card className="col-span-4 max-[1100px]:col-span-12" title="Open actions" subtitle="Created from agent answers · highest priority first"
                actions={<button type="button" onClick={() => navigate("actions")} className="inline-flex items-center gap-1 text-200 font-semibold text-brand-foreground hover:underline">Board <ArrowRight className="icon-size-100" /></button>}
                bodyClassName="overflow-y-auto">
                {actions === null ? <Skeleton /> : open.length === 0 ? (
                    <div className="flex h-full flex-col justify-center gap-2.5">
                        <p className="text-300 text-muted-foreground">No open actions yet. Ask an agent, then use the buttons under its answer.</p>
                        <div className="flex flex-wrap gap-1.5">
                            <Ask agent="operations" label="Overdue orders" q="Which key accounts have the most overdue order value?" />
                            <Ask agent="planning" label="Brands behind budget" q="Which brands are furthest behind budget this year?" />
                        </div>
                    </div>
                ) : (
                    <ul className="space-y-1.5">
                        {open.map((a) => (
                            <li key={a.id} className="flex items-start gap-2 rounded px-1 py-1 hover:bg-muted">
                                <span aria-hidden className="mt-0.5" style={{ color: a.priority === "high" ? STATUS.critical.color : a.priority === "medium" ? STATUS.warning.color : STATUS.good.color }}>
                                    {a.priority === "high" ? STATUS.critical.icon : a.priority === "medium" ? STATUS.warning.icon : STATUS.good.icon}
                                </span>
                                <div className="min-w-0">
                                    <div className="truncate text-300 font-semibold text-foreground">{a.title}</div>
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

function MoverList({ title, list }: { title: string; list: Subject[] }) {
    const max = Math.max(...list.map((a) => Math.abs(gapPct(a))), 1);
    return (
        <div className="min-h-0">
            <div className="mb-1.5 text-100 font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
            <ul className="space-y-2">
                {list.map((a) => {
                    const g = gapPct(a);
                    return (
                        <li key={a.name}>
                            <button type="button" onClick={() => navigate("accounts", a.name)} className="w-full rounded px-1 py-0.5 text-left hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                <div className="flex items-baseline justify-between gap-2">
                                    <span className="truncate text-200 text-foreground">{a.name}</span>
                                    <span className="tabular text-200 font-semibold" style={{ color: g < 0 ? C.below : C.above }}>{pct(g, true)}</span>
                                </div>
                                <span className="mt-0.5 block h-1.5 rounded-full bg-muted">
                                    <span className="block h-1.5 rounded-full" style={{ width: `${(Math.abs(g) / max) * 100}%`, background: g < 0 ? C.below : C.above }} />
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
