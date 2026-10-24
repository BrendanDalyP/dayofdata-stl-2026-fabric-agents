import { useMemo, useState } from "react";
import { Check, Eye, Flag, LifeBuoy, Siren } from "lucide-react";

import { useAsk } from "@/agent/AskContext";
import { memberByKey } from "@/agent/team";
import { AgentBrief } from "@/components/AgentBrief";
import { PlanCard } from "@/components/AgentAnswer";
import { AskLink, Card, Skeleton } from "@/components/Card";
import { AccountTrend } from "@/components/viz/AccountTrend";
import { VarianceHeatmap } from "@/components/viz/VarianceHeatmap";
import { Sparkline } from "@/components/viz/Sparkline";
import { C, STATUS, StatusBadge, statusOf, fmtEurShort } from "@/components/viz/common";
import { MONTHS_REMAINING, eur, gapPct, pct, type Subject } from "@/queries/overview";
import { buildRecoveryPlan, createAction } from "@/services/actions";
import type { RecoveryPlanResult } from "../../rayfin/functions/src/types";
import { navigate } from "@/lib/nav";
import { cn } from "@/lib/utils";

const sales = memberByKey("sales"), ops = memberByKey("operations"), plan = memberByKey("planning");

export function AccountsPage({ selected }: { selected?: string }) {
    const { data, dataError, ask } = useAsk();
    const [view, setView] = useState<"list" | "heatmap">("list");

    const accounts = useMemo(() => (data ? [...data.accounts].sort((a, b) => gapPct(a) - gapPct(b)) : []), [data]);
    const current = accounts.find((a) => a.name === selected) ?? accounts[0];

    if (dataError) return <p role="alert" className="rounded-lg border border-destructive/40 bg-card p-4 text-300 text-destructive">Couldn't read the lakehouse: {dataError}</p>;
    if (!data) return <Skeleton />;

    const toggle = (
        <div className="flex rounded-md border border-border p-0.5" role="tablist" aria-label="View">
            {(["list", "heatmap"] as const).map((v) => (
                <button key={v} role="tab" type="button" aria-selected={view === v} onClick={() => setView(v)}
                    className={cn("rounded px-2.5 py-0.5 text-200 capitalize", view === v ? "bg-muted font-semibold text-emphasis-foreground" : "text-muted-foreground hover:text-foreground")}>{v}</button>
            ))}
        </div>
    );

    if (view === "heatmap") {
        return (
            <Card className="h-full" title="Key accounts × month, 2022" subtitle="Net sales vs budget · click a row to open the account, a cell to ask about that month" actions={toggle}>
                <VarianceHeatmap cells={data.accountCells} subjects={data.accounts} focus={current?.name}
                    onSelect={(s, m) => m
                        ? ask(`How did the key account ${s.name} do against budget in ${m.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}?`, "sales", `${s.name} · ${m.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" })}`)
                        : (setView("list"), navigate("accounts", s.name))} />
            </Card>
        );
    }

    return (
        <div className="grid h-full min-h-0 grid-cols-12 gap-3 max-[1100px]:h-auto">
            {/* master list */}
            <Card className="col-span-4 max-[1100px]:col-span-12" title="Key accounts" subtitle={`${accounts.length} accounts · Jan–Jul 2022 vs budget`} actions={toggle} bodyClassName="overflow-y-auto -mx-2">
                <ul>
                    {accounts.map((a) => {
                        const g = gapPct(a);
                        const active = a.name === current?.name;
                        const ytd = a.monthly.filter((m) => m.month.getUTCFullYear() === 2022 && m.month.getUTCMonth() < 7);
                        return (
                            <li key={a.name}>
                                <button type="button" onClick={() => navigate("accounts", a.name)} aria-current={active ? "true" : undefined}
                                    className={cn("grid w-full grid-cols-[16px_1fr_72px_60px] items-center gap-2 rounded-md px-2 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                        active ? "bg-accent" : "hover:bg-muted")}>
                                    <span aria-label={STATUS[statusOf(g)].label} style={{ color: STATUS[statusOf(g)].color }}>{STATUS[statusOf(g)].icon}</span>
                                    <span className={cn("truncate text-300", active ? "font-semibold text-emphasis-foreground" : "text-foreground")}>{a.name}</span>
                                    <Sparkline values={ytd.map((m) => m.net)} band={ytd.map((m) => m.budget)} color={g < 0 ? C.below : C.series} width={72} height={22} />
                                    <span className="tabular text-right text-200 font-semibold" style={{ color: g < 0 ? C.below : undefined }}>{pct(g, true)}</span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </Card>

            {/* detail */}
            {current && <AccountDetail key={current.name} a={current} />}
        </div>
    );
}

function AccountDetail({ a }: { a: Subject }) {
    const g = gapPct(a);
    const needed = Math.max(0, a.budgetFy - a.actualYtd) / MONTHS_REMAINING;
    const budgetMonthly = (a.budgetFy - a.budgetYtd) / MONTHS_REMAINING;
    const uplift = budgetMonthly > 0 ? (needed / budgetMonthly - 1) * 100 : 0;
    const [saved, setSaved] = useState<Record<string, string>>({});
    const [planResult, setPlanResult] = useState<RecoveryPlanResult>();
    const { refreshActions, ask } = useAsk();

    const run = async (key: string, fn: () => Promise<unknown>) => {
        setSaved((s) => ({ ...s, [key]: "busy" }));
        try {
            const out = await fn();
            if (key === "plan") setPlanResult(out as RecoveryPlanResult);
            setSaved((s) => ({ ...s, [key]: "done" }));
            void refreshActions();
        } catch (e) { setSaved((s) => ({ ...s, [key]: `Failed: ${e instanceof Error ? e.message : e}` })); }
    };
    const Btn = ({ k, label, icon: Icon, fn, primary }: { k: string; label: string; icon: typeof Flag; fn: () => Promise<unknown>; primary?: boolean }) => (
        <button type="button" disabled={saved[k] === "busy" || saved[k] === "done"} onClick={() => void run(k, fn)} title={saved[k]?.startsWith("Failed") ? saved[k] : "Runs a Rayfin function"}
            className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-200 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                saved[k] === "done" ? "border border-border text-success" : primary ? "bg-brand text-on-brand hover:opacity-90" : "border border-border text-foreground hover:bg-muted",
                saved[k] === "busy" && "trace-pulse")}>
            {saved[k] === "done" ? <Check className="icon-size-100" /> : <Icon className="icon-size-100" />}{saved[k] === "done" ? `${label} — saved` : label}
        </button>
    );

    return (
        <div className="col-span-8 grid min-h-0 grid-rows-[auto_minmax(0,1fr)_minmax(0,1.1fr)] gap-3 max-[1100px]:col-span-12">
            {/* header */}
            <div className="rounded-lg border border-border bg-card px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-heading text-500 font-semibold text-emphasis-foreground">{a.name}</h2>
                    <StatusBadge gapPct={g} />
                    <div className="ml-auto flex flex-wrap gap-1.5">
                        <Btn k="fu" label="Follow up" icon={Flag} fn={() => createAction({ kind: "follow-up", title: `Follow up with ${a.name}`, subject: a.name, detail: `${pct(g, true)} vs budget Jan–Jul`, agent: "sales" })} />
                        <Btn k="watch" label="Watch" icon={Eye} fn={() => createAction({ kind: "watch", title: `Watch ${a.name}`, subject: a.name, detail: `${pct(g, true)} vs budget Jan–Jul`, agent: "sales" })} />
                        <Btn k="esc" label="Escalate orders" icon={Siren} fn={() => createAction({ kind: "escalation", title: `Escalate overdue orders · ${a.name}`, subject: a.name, detail: `Raised from the Accounts view (${pct(g, true)} vs budget)`, agent: "operations" })} />
                    </div>
                </div>
                <dl className="mt-2 grid grid-cols-4 gap-3">
                    {([["Net sales, Jan–Jul", eur(a.actualYtd)], ["Budget, Jan–Jul", eur(a.budgetYtd)], ["Gap", `${eur(a.actualYtd - a.budgetYtd)} (${pct(g, true)})`], ["Full-year budget", eur(a.budgetFy)]] as const).map(([k, v], i) => (
                        <div key={k}>
                            <dt className="text-100 text-muted-foreground">{k}</dt>
                            <dd className="tabular text-400 font-semibold" style={{ color: i === 2 && g < 0 ? C.below : "var(--color-emphasis-foreground)" }}>{v}</dd>
                        </div>
                    ))}
                </dl>
            </div>

            {/* trend + recovery maths */}
            <div className="grid min-h-0 grid-cols-12 gap-3">
                <Card className="col-span-8" title="Monthly net sales vs budget" subtitle="2021 – Aug 2022 · red bars missed budget · click a month to ask"
                        actions={<>
                            <AskLink agent={sales.tag} color={sales.color} label="Which months missed?" onClick={() => ask(`Which months did the key account ${a.name} miss budget this year, and by how much?`, "sales", a.name)} />
                            <AskLink agent={ops.tag} color={ops.color} label="Backlog" onClick={() => ask(`What is the open order backlog for the key account ${a.name}, in euros?`, "operations", a.name)} />
                        </>}>
                    <AccountTrend data={a.monthly} onSelect={(m) => ask(`How did the key account ${a.name} do against budget in ${m.month.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}?`, "sales", `${a.name} · ${m.month.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" })}`)} />
                </Card>
                <Card className="col-span-4" title="To land the full-year budget" subtitle={`Aug–Dec · ${MONTHS_REMAINING} months left`} bodyClassName="flex flex-col gap-3">
                    {planResult ? <div className="min-h-0 flex-1 overflow-y-auto"><PlanCard plan={planResult} onAsk={(q, to, ctx) => ask(q, to, ctx)} /></div> : (
                        <>
                            <dl className="grid grid-cols-1 gap-2.5">
                                <div className="flex items-baseline justify-between gap-2"><dt className="text-200 text-muted-foreground">Needed per month</dt><dd className="tabular text-500 font-semibold text-emphasis-foreground">{fmtEurShort(needed)}</dd></div>
                                <div className="flex items-baseline justify-between gap-2"><dt className="text-200 text-muted-foreground">Budget per month</dt><dd className="tabular text-300 text-foreground">{fmtEurShort(budgetMonthly)}</dd></div>
                                <div className="flex items-baseline justify-between gap-2"><dt className="text-200 text-muted-foreground">Uplift on budget run-rate</dt><dd className="tabular text-400 font-semibold" style={{ color: uplift > 0 ? C.below : C.above }}>{pct(uplift, true)}</dd></div>
                            </dl>
                            <div className="mt-auto">
                                {g < 0
                                    ? <Btn k="plan" label="Save recovery plan" icon={LifeBuoy} primary fn={() => buildRecoveryPlan(a, "sales")} />
                                    : <p className="text-200 text-muted-foreground">Ahead of budget — no recovery needed.</p>}
                            </div>
                        </>
                    )}
                </Card>
            </div>

            {/* agent brief */}
            <div className="grid min-h-0 grid-cols-12 gap-3">
                <AgentBrief className="col-span-8" agent="sales" context={a.name}
                    title={`What's driving ${a.name}?`}
                    question={`How is the key account ${a.name} doing against budget this year, and which months and product types drive the gap?`} />
                <Card className="col-span-4" title="Ask the team" subtitle="Hand this account to another agent" bodyClassName="flex flex-col items-start gap-2">
                    <AskLink agent={ops.tag} color={ops.color} label="Overdue & late orders" onClick={() => ask(`Which overdue or late orders does the key account ${a.name} have, in euros?`, "operations", a.name)} />
                    <AskLink agent={ops.tag} color={ops.color} label="Late-delivery penalties" onClick={() => ask(`How much in late-delivery penalties did ${a.name} receive this year, in euros?`, "operations", a.name)} />
                    <AskLink agent={plan.tag} color={plan.color} label="Forecast assumes a miss?" onClick={() => ask(`Does the 2022 forecast already assume ${a.name} misses budget?`, "planning", a.name)} />
                    <AskLink agent={sales.tag} color={sales.color} label="Growth vs last year" onClick={() => ask(`How did net sales for the key account ${a.name} grow against the same period last year?`, "sales", a.name)} />
                </Card>
            </div>
        </div>
    );
}
