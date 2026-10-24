import { useEffect, useMemo, useState } from "react";
import { Check, Siren } from "lucide-react";

import { useAsk } from "@/agent/AskContext";
import { memberByKey } from "@/agent/team";
import { AgentBrief } from "@/components/AgentBrief";
import { Card, Skeleton } from "@/components/Card";
import { Ask, Kpi } from "@/components/Kpi";
import { BacklogByRegion, STATUS_FILL } from "@/components/viz/BacklogByRegion";
import { DeliveryMultiples } from "@/components/viz/DeliveryMultiples";
import { Sparkline } from "@/components/viz/Sparkline";
import { fmtEurShort } from "@/components/viz/common";
import { eur, pct } from "@/queries/overview";
import { loadOpsData, sumBy, type OpsData } from "@/queries/opsplan";
import { createAction } from "@/services/actions";
import { cn } from "@/lib/utils";

const ops = memberByKey("operations");

/** Operations: the order book, delivery performance and cancellations — one screen, agent on hand. */
export function OperationsPage() {
    const { ask, refreshActions } = useAsk();
    const [d, setD] = useState<OpsData>();
    const [err, setErr] = useState<string>();
    const [saved, setSaved] = useState<Record<string, string>>({});

    useEffect(() => { loadOpsData().then(setD).catch((e) => setErr(e instanceof Error ? e.message : String(e))); }, []);

    const k = useMemo(() => {
        if (!d) return undefined;
        const total = d.backlog.reduce((s, r) => s + r.value, 0);
        const lines = d.backlog.reduce((s, r) => s + r.lines, 0);
        const overdue = d.backlog.filter((r) => r.status === "Overdue Order").reduce((s, r) => s + r.value, 0);
        const months = [...d3group(d.delivery)].sort((a, b) => +a.month - +b.month);
        const penalties = months.reduce((s, m) => s + m.penalties, 0);
        const penByRegion = [...sumBy(d.delivery, (r) => r.region, (r) => r.penalties)].sort((a, b) => b[1] - a[1]);
        const cancelled = d.cancellations.reduce((s, c) => s + c.cancelled, 0);
        const ordered = d.cancellations.reduce((s, c) => s + c.ordered, 0);
        const cancels = [...d.cancellations].sort((a, b) => b.pct - a.pct);
        const overdueAccounts = [...sumBy(d.backlog.filter((r) => r.status === "Overdue Order" && r.account !== "No Key Account"), (r) => r.account, (r) => r.value)]
            .sort((a, b) => b[1] - a[1]).slice(0, 6);
        return { total, lines, overdue, months, penalties, penByRegion, cancelPct: (100 * cancelled) / ordered, cancels, overdueAccounts };
    }, [d]);

    if (err) return <p role="alert" className="rounded-lg border border-destructive/40 bg-card p-4 text-300 text-destructive">Couldn't read the order tables through the connector: {err}</p>;

    const escalate = async (account: string, value: number) => {
        const key = `esc:${account}`;
        setSaved((s) => ({ ...s, [key]: "busy" }));
        try {
            await createAction({ kind: "escalation", title: `Escalate overdue orders · ${account}`, subject: account, detail: `${fmtEurShort(value)} of overdue orders (Operations tab)`, agent: "operations" });
            setSaved((s) => ({ ...s, [key]: "done" }));
            void refreshActions();
        } catch (e) { setSaved((s) => ({ ...s, [key]: `Failed: ${e instanceof Error ? e.message : e}` })); }
    };

    const first = k?.months[0], last = k?.months.at(-1);
    const maxOverdue = k?.overdueAccounts[0]?.[1] ?? 1;
    const maxCancel = k?.cancels[0]?.pct ?? 1;

    return (
        <div className="grid h-full min-h-0 grid-cols-12 grid-rows-[auto_minmax(0,1fr)_minmax(0,1fr)] gap-3 max-[1100px]:h-auto max-[1100px]:grid-rows-none">
            <div className="col-span-12 grid grid-cols-5 gap-3 max-[1100px]:grid-cols-2">
                <Kpi label="Open order book" value={k && eur(k.total, true)} note={k && `${k.lines.toLocaleString()} order lines · all open statuses`}
                    ask={<Ask agent="operations" label="By status" q="What is the open order backlog in euros by order status?" />} />
                <Kpi label="Overdue orders" value={k && eur(k.overdue, true)} tone="bad" note={k && `${pct((100 * k.overdue) / k.total)} of the open order book`}
                    ask={<Ask agent="operations" label="Which accounts?" q="Which key accounts have the most overdue order value?" />} />
                <Kpi label="On-time delivery, Aug 2022" value={last && pct(last.onTimePct)} tone={last && first && last.onTimePct < first.onTimePct ? "bad" : undefined}
                    note={first && `${pct(first.onTimePct)} in January · to 21 Aug`}
                    spark={k && <Sparkline values={k.months.map((m) => m.onTimePct)} color={ops.color} />}
                    ask={<Ask agent="operations" label="Trend" q="What was the on-time delivery rate by month this year?" />} />
                <Kpi label="Late-delivery penalties, 2022" value={k && eur(k.penalties, true)} tone="bad" note={k && `most in ${k.penByRegion[0][0].replace(" Region", "")} (${fmtEurShort(k.penByRegion[0][1])})`}
                    ask={<Ask agent="operations" label="Which regions?" q="Which regions paid the most late-delivery penalties this year, in euros?" />} />
                <Kpi label="Order value cancelled, 2022" value={k && pct(k.cancelPct)} note={k && `highest: ${k.cancels[0].productType} ${pct(k.cancels[0].pct)}`}
                    ask={<Ask agent="operations" label="By product" q="What share of order value was cancelled this year, by product type?" />} />
            </div>

            <Card className="col-span-7 max-[1100px]:col-span-12 max-[1100px]:h-96" title="Open order book by region"
                subtitle="Sorted by overdue value · click a region to ask Operations"
                actions={<Ask agent="operations" label="Where is it stuck?" q="Which regions have the most overdue and late order value, in euros?" />}>
                {d ? <BacklogByRegion rows={d.backlog} onSelect={(r) => ask(`What is the open and overdue order backlog in ${r}, by order status and key account, in euros?`, "operations", r)} /> : <Skeleton />}
            </Card>
            <Card className="col-span-5 max-[1100px]:col-span-12 max-[1100px]:h-96" title="Delivery performance, 2022"
                subtitle="Same months, two measures · click a month to ask"
                actions={<Ask agent="operations" label="Why the drop?" q="Why did the on-time delivery rate fall this year, and which regions drive it?" />}>
                {k ? <DeliveryMultiples data={k.months} color={ops.color} onSelect={(m) => {
                    const label = m.month.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
                    ask(`What was the on-time delivery rate and late-delivery penalties by region in ${label}?`, "operations", label);
                }} /> : <Skeleton />}
            </Card>

            <Card className="col-span-4 max-[1100px]:col-span-12" title="Overdue orders by key account" subtitle="Escalate straight to the action board" bodyClassName="overflow-y-auto">
                {k ? (
                    <ul className="space-y-1.5">
                        {k.overdueAccounts.map(([account, value]) => {
                            const st = saved[`esc:${account}`];
                            return (
                                <li key={account} className="grid grid-cols-[1fr_auto] items-center gap-2">
                                    <button type="button" onClick={() => ask(`Which overdue or late orders does the key account ${account} have, in euros?`, "operations", account)}
                                        className="min-w-0 rounded px-1 py-0.5 text-left hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                        <span className="flex items-baseline justify-between gap-2">
                                            <span className="truncate text-200 text-foreground">{account}</span>
                                            <span className="tabular text-200 font-semibold text-foreground">{fmtEurShort(value)}</span>
                                        </span>
                                        <span className="mt-0.5 block h-1.5 rounded-full bg-muted">
                                            <span className="block h-1.5 rounded-full" style={{ width: `${(value / maxOverdue) * 100}%`, background: STATUS_FILL["Overdue Order"] }} />
                                        </span>
                                    </button>
                                    <button type="button" disabled={st === "busy" || st === "done"} onClick={() => void escalate(account, value)}
                                        title={st?.startsWith("Failed") ? st : "Runs createAction (a Rayfin function)"} aria-label={`Escalate overdue orders for ${account}`}
                                        className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 text-100 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                            st === "done" ? "border-border text-success" : st?.startsWith("Failed") ? "border-destructive/50 text-destructive" : "border-border text-foreground hover:bg-muted",
                                            st === "busy" && "trace-pulse")}>
                                        {st === "done" ? <Check className="icon-size-100" /> : <Siren className="icon-size-100" />}{st === "done" ? "Escalated" : "Escalate"}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                ) : <Skeleton />}
            </Card>
            <Card className="col-span-4 max-[1100px]:col-span-12" title="Cancelled order value, 2022" subtitle="Share of each product type's order value · click to ask"
                bodyClassName="overflow-y-auto">
                {k ? (
                    <ul className="space-y-1">
                        {k.cancels.map((c) => (
                            <li key={c.productType}>
                                <button type="button" onClick={() => ask(`Which customers and regions cancelled the most ${c.productType} order value this year, in euros?`, "operations", c.productType)}
                                    className="grid w-full grid-cols-[1fr_auto] items-center gap-x-2 rounded px-1 py-0.5 text-left hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                    <span className="truncate text-200 text-foreground">{c.productType}</span>
                                    <span className="tabular text-200 font-semibold text-foreground">{pct(c.pct)}</span>
                                    <span className="col-span-2 block h-1.5 rounded-full bg-muted">
                                        <span className="block h-1.5 rounded-full" style={{ width: `${(c.pct / maxCancel) * 100}%`, background: "var(--color-muted-foreground)" }} />
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : <Skeleton />}
            </Card>
            <AgentBrief className="col-span-4 max-[1100px]:col-span-12" agent="operations"
                title="What's stuck in the order book?"
                question="Which key accounts and regions have the most overdue order value, and how has on-time delivery changed this year?" />
        </div>
    );
}

/** Region × month delivery rows → one point per month. */
function d3group(rows: OpsData["delivery"]) {
    const m = new Map<number, { month: Date; onTime: number; lines: number; penalties: number }>();
    for (const r of rows) {
        const p = m.get(+r.month) ?? { month: r.month, onTime: 0, lines: 0, penalties: 0 };
        p.onTime += r.onTime; p.lines += r.lines; p.penalties += r.penalties;
        m.set(+r.month, p);
    }
    return [...m.values()].map((p) => ({ month: p.month, penalties: p.penalties, onTimePct: p.lines ? (100 * p.onTime) / p.lines : 0 }));
}
