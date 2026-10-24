import type { Subject } from "@/queries/overview";
import { fmtEurShort } from "./common";
import { GapBars } from "./GapBars";

/**
 * Regions by euro gap to budget (Jan–Jul), largest shortfalls first. Euros, not %, so a tiny
 * region with a tiny budget can't dominate; the % is in the hover text.
 */
export function RegionGaps({ regions, onSelect }: { regions: Subject[]; onSelect: (s: Subject) => void }) {
    const rows = regions.map((r) => {
        const pct = (r.actualYtd / r.budgetYtd - 1) * 100;
        return {
            key: r.name, label: r.name.replace(" Region", ""), gap: r.actualYtd - r.budgetYtd, item: r,
            tip: `${r.name}: ${fmtEurShort(r.actualYtd)} net sales vs ${fmtEurShort(r.budgetYtd)} budget (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%)`,
        };
    });
    return <GapBars unit="eur" rows={rows} onSelect={onSelect} label="Regions by euro gap to budget, Jan–Jul 2022" />;
}
