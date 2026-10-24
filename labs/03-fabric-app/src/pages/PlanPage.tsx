import { useEffect, useMemo, useState } from "react";
import { Check, Flag } from "lucide-react";

import { useAsk } from "@/agent/AskContext";
import { AgentBrief } from "@/components/AgentBrief";
import { Card, Skeleton } from "@/components/Card";
import { Ask, Kpi } from "@/components/Kpi";
import { AnswerLine } from "@/components/AnswerLine";
import { ForecastMonthly, type PlanMonth } from "@/components/viz/ForecastMonthly";
import { GapBars, type GapRow } from "@/components/viz/GapBars";
import { fmtEurShort } from "@/components/viz/common";
import { eur, pct } from "@/queries/overview";
import { loadPlanData, type PlanData } from "@/queries/opsplan";
import { actionTip, createAction } from "@/services/actions";
import { cn } from "@/lib/utils";

const isJanJul = (d: Date) => d.getUTCFullYear() === 2022 && d.getUTCMonth() < 7;
const isJanJul21 = (d: Date) => d.getUTCFullYear() === 2021 && d.getUTCMonth() < 7;
const gap = (a: number, b: number) => (b ? (a / b - 1) * 100 : 0);

/** Plan: the 2022 forecast against budget and actuals — by month, product type, territory and brand. */
export function PlanPage() {
    const { ask, refreshActions } = useAsk();
    const [d, setD] = useState<PlanData>();
    const [err, setErr] = useState<string>();
    const [flag, setFlag] = useState<string>();

    useEffect(() => { loadPlanData().then(setD).catch((e) => setErr(e instanceof Error ? e.message : String(e))); }, []);

    const k = useMemo(() => {
        if (!d) return undefined;
        // by month: forecast and budget from forecast_vs_budget; actuals from territory_vs_forecast (Jan–Aug)
        const months = new Map<number, PlanMonth>();
        for (const r of d.forecast) {
            const p = months.get(+r.month) ?? { month: r.month, forecast: 0, budget: 0 };
            p.forecast += r.forecast; p.budget += r.budget; months.set(+r.month, p);
        }
        for (const r of d.territories) {
            const p = months.get(+r.month);
            if (p && r.month.getUTCMonth() <= 7) p.actual = (p.actual ?? 0) + r.actual;
        }
        const monthly = [...months.values()].sort((a, b) => +a.month - +b.month);
        const fc = monthly.reduce((s, m) => s + m.forecast, 0), bud = monthly.reduce((s, m) => s + m.budget, 0);

        // product types, full year
        const types = new Map<string, { forecast: number; budget: number }>();
        for (const r of d.forecast) { const t = types.get(r.productType) ?? { forecast: 0, budget: 0 }; t.forecast += r.forecast; t.budget += r.budget; types.set(r.productType, t); }
        const typeRows: GapRow<string>[] = [...types].map(([name, t]) => ({ key: name, label: name, gap: gap(t.forecast, t.budget), item: name, tip: `${name}: forecast ${fmtEurShort(t.forecast)} vs budget ${fmtEurShort(t.budget)}` }));
        const worstType = [...typeRows].sort((a, b) => a.gap - b.gap)[0];

        // territories, Jan–Jul actual vs forecast
        const terr = new Map<string, { region: string; actual: number; forecast: number }>();
        for (const r of d.territories.filter((t) => isJanJul(t.month))) {
            const t = terr.get(r.territory) ?? { region: r.region, actual: 0, forecast: 0 };
            t.actual += r.actual; t.forecast += r.forecast; terr.set(r.territory, t);
        }
        const terrAll = [...terr].filter(([, t]) => t.forecast > 0);
        const actYtd = terrAll.reduce((s, [, t]) => s + t.actual, 0), fcYtd = terrAll.reduce((s, [, t]) => s + t.forecast, 0);
        const terrRows: GapRow<string>[] = terrAll
            .map(([name, t]) => ({ name, t, g: t.actual - t.forecast }))
            .sort((a, b) => a.g - b.g).slice(0, 10)
            .map(({ name, t }) => ({ key: name, label: name, gap: t.actual - t.forecast, item: name, tip: `${name} (${t.region}): ${fmtEurShort(t.actual)} actual vs ${fmtEurShort(t.forecast)} forecast, Jan–Jul (${gap(t.actual, t.forecast).toFixed(1)}%)` }));
        const terrBehind = terrAll.filter(([, t]) => t.actual < t.forecast).length;

        // brands, Jan–Jul vs budget; class growth vs Jan–Jul 2021
        const brands = new Map<string, { cls: string; actual: number; budget: number }>();
        const cls = new Map<string, { y22: number; y21: number }>();
        for (const r of d.brands) {
            if (isJanJul(r.month)) { const b = brands.get(r.brand) ?? { cls: r.brandClass, actual: 0, budget: 0 }; b.actual += r.actual; b.budget += r.budget; brands.set(r.brand, b); }
            const c = cls.get(r.brandClass) ?? { y22: 0, y21: 0 };
            if (isJanJul(r.month)) c.y22 += r.actual; else if (isJanJul21(r.month)) c.y21 += r.actual;
            cls.set(r.brandClass, c);
        }
        const brandRows: GapRow<string>[] = [...brands].map(([name, b]) => ({ key: name, label: `${name}${b.cls.startsWith("Private") ? " ·P" : ""}`, gap: gap(b.actual, b.budget), item: name, tip: `${name} (${b.cls}): ${fmtEurShort(b.actual)} vs ${fmtEurShort(b.budget)} budget, Jan–Jul` }));
        const own = cls.get("SpaceParts Brand"), priv = [...cls].find(([c]) => c !== "SpaceParts Brand")?.[1];

        return {
            monthly, fc, bud, typeRows, worstType, terrRows, terrBehind, terrCount: terrAll.length, actYtd, fcYtd, brandRows,
            brandsBehind: brandRows.filter((b) => b.gap < 0).length,
            ownGrowth: own ? gap(own.y22, own.y21) : 0, privGrowth: priv ? gap(priv.y22, priv.y21) : 0,
        };
    }, [d]);

    if (err) return <p role="alert" className="rounded-lg border border-destructive/40 bg-card p-4 text-300 text-destructive">Couldn't read the plan tables through the connector: {err}</p>;

    const flagGap = async () => {
        if (!k?.worstType) return;
        setFlag("busy");
        try {
            await createAction({ kind: "follow-up", title: `Forecast below budget · ${k.worstType.label}`, subject: k.worstType.label, detail: `2022 forecast ${pct(k.worstType.gap, true)} vs budget (Plan tab)`, agent: "planning" });
            setFlag("done"); void refreshActions();
        } catch (e) { setFlag(`Failed: ${e instanceof Error ? e.message : e}`); }
    };

    return (
        <div className="flex h-full min-h-0 flex-col gap-3 max-[1100px]:h-auto">
            <AnswerLine question="Is the forecast credible?" source="app.forecast_vs_budget, app.territory_vs_forecast" answer={k && `${k.fc < k.bud ? "Not yet" : "Yes"}: the 2022 forecast is ${pct(gap(k.fc, k.bud), true)} against budget, actuals run ${pct(gap(k.actYtd, k.fcYtd), true)} against forecast Jan–Jul, and ${k.terrBehind} of ${k.terrCount} territories trail it.`} />
            <div className="grid min-h-0 flex-1 grid-cols-12 grid-rows-[auto_minmax(0,1fr)_minmax(0,1fr)] gap-3 max-[1100px]:flex-none max-[1100px]:grid-rows-none">
            <div className="col-span-12 grid grid-cols-5 gap-3 max-[1100px]:grid-cols-2">
                <Kpi source="app.forecast_vs_budget" label="2022 forecast vs budget" value={k && pct(gap(k.fc, k.bud), true)} tone={k && k.fc < k.bud ? "bad" : "good"} note={k && `${eur(k.fc, true)} forecast · ${eur(k.bud, true)} budget`}
                    ask={<Ask agent="planning" label="By product" q="How does the 2022 forecast compare with the 2022 budget by product type?" />} />
                <Kpi source="app.territory_vs_forecast" label="Actual vs forecast, Jan–Jul" value={k && pct(gap(k.actYtd, k.fcYtd), true)} tone={k && k.actYtd < k.fcYtd ? "bad" : "good"} note={k && `${eur(k.actYtd, true)} actual · ${eur(k.fcYtd, true)} forecast`}
                    ask={<Ask agent="planning" label="Where?" q="Which territories are furthest behind their forecast so far this year?" />} />
                <Kpi source="app.territory_vs_forecast" label="Territories behind forecast" value={k && `${k.terrBehind} of ${k.terrCount}`} tone={k && k.terrBehind ? "bad" : undefined} note="Jan–Jul 2022, actual vs forecast"
                    ask={<Ask agent="planning" label="Worst five" q="Which territories are furthest behind their forecast so far this year?" />} />
                <Kpi source="app.brand_vs_budget" label="Brands behind budget" value={k && `${k.brandsBehind} of ${k.brandRows.length}`} tone={k && k.brandsBehind ? "bad" : "good"} note="Jan–Jul 2022"
                    ask={<Ask agent="planning" label="Which?" q="Which brands are furthest behind budget this year?" />} />
                <Kpi source="app.brand_vs_budget" label="SpaceParts brands, growth" value={k && pct(k.ownGrowth, true)} note={k && `private brands ${pct(k.privGrowth, true)} · Jan–Jul vs 2021`}
                    ask={<Ask agent="planning" label="Own vs private" q="How are SpaceParts brands doing against private brands this year compared with last year?" />} />
            </div>

            <Card className="col-span-7 max-[1100px]:col-span-12 max-[1100px]:h-96" title={k ? `The 2022 forecast is ${pct(gap(k.fc, k.bud), true)} against budget; actuals run ${pct(gap(k.actYtd, k.fcYtd), true)} against forecast Jan–Jul` : "2022 forecast, budget and actuals"}
                subtitle="Monthly forecast, actual and budget, € · click a month"
                source="SpaceParts lakehouse · app.forecast_vs_budget, app.territory_vs_forecast"
                actions={<Ask agent="planning" label="Rest of 2022" q="How does the 2022 forecast compare with budget by month?" />}>
                {k ? <ForecastMonthly data={k.monthly} onSelect={(m) => {
                    const label = m.month.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
                    ask(`How does the forecast compare with budget in ${label}, by product type?`, "planning", label);
                }} /> : <Skeleton />}
            </Card>
            <Card className="col-span-5 max-[1100px]:col-span-12 max-[1100px]:h-96" title={k?.worstType ? `${k.worstType.label} is furthest below budget, ${pct(k.worstType.gap, true)}` : "Forecast against budget by product type"}
                subtitle="Full-year 2022 forecast against budget, % · click to ask"
                source="SpaceParts lakehouse · app.forecast_vs_budget"
                actions={k?.worstType && k.worstType.gap < 0 && (
                    <button type="button" disabled={flag === "busy" || flag === "done"} onClick={() => void flagGap()} title={flag?.startsWith("Failed") ? flag : actionTip("follow-up", k?.worstType ? `the ${k.worstType.label} forecast gap` : "the forecast gap")}
                        className={cn("inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-200 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            flag === "done" ? "border border-border text-success" : "bg-brand text-on-brand hover:opacity-90", flag === "busy" && "trace-pulse")}>
                        {flag === "done" ? <Check className="icon-size-100" /> : <Flag className="icon-size-100" />}{flag === "done" ? "Flagged" : `Flag ${k.worstType.label}`}
                    </button>
                )}>
                {k ? <GapBars rows={k.typeRows} label="2022 forecast vs budget by product type" onSelect={(t) => ask(`Why is the 2022 forecast for ${t} different from budget, by month and territory?`, "planning", t)} /> : <Skeleton />}
            </Card>

            <Card className="col-span-4 max-[1100px]:col-span-12 max-[1100px]:h-80" title={k ? `${k.terrBehind} of ${k.terrCount} territories trail forecast` : "Territories furthest behind forecast"}
                subtitle="Largest gaps to forecast, Jan–Jul 2022, € · click to ask"
                source="SpaceParts lakehouse · app.territory_vs_forecast">
                {k ? <GapBars unit="eur" fit="top" rows={k.terrRows} label="Territories furthest behind forecast" onSelect={(t) => ask(`Why is the territory ${t} behind its forecast this year, by month and product type?`, "planning", t)} /> : <Skeleton />}
            </Card>
            <Card className="col-span-4 max-[1100px]:col-span-12 max-[1100px]:h-80" title={k ? (k.brandsBehind ? `${k.brandsBehind} of ${k.brandRows.length} brands are behind budget` : `All ${k.brandRows.length} brands are at or above budget`) : "Brands against budget"}
                subtitle="Jan–Jul 2022 against budget, % · ·P = private brand"
                source="SpaceParts lakehouse · app.brand_vs_budget">
                {k ? <GapBars rows={k.brandRows} label="Brands against budget" onSelect={(b) => ask(`How is the brand ${b} doing against budget this year, by month?`, "planning", b)} /> : <Skeleton />}
            </Card>
            <AgentBrief className="col-span-4 max-[1100px]:col-span-12" agent="planning"
                title="Is the forecast realistic?"
                question="How does the 2022 forecast compare with budget by product type, and which territories are furthest behind their forecast so far this year?" />
        </div>
        </div>
    );
}
