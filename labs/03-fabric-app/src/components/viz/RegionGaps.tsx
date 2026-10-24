import type { Subject } from "@/queries/overview";
import { fmtEurShort } from "./common";
import { GapBars } from "./GapBars";

/** Regions sorted by gap to budget (Jan–Jul), diverging bars around zero, sized to fit the card. */
export function RegionGaps({ regions, onSelect }: { regions: Subject[]; onSelect: (s: Subject) => void }) {
    const rows = regions.map((r) => {
        const g = (r.actualYtd / r.budgetYtd - 1) * 100;
        return { key: r.name, label: r.name.replace(" Region", ""), gap: g, item: r, tip: `${r.name}: ${fmtEurShort(r.actualYtd)} net sales vs ${fmtEurShort(r.budgetYtd)} budget (${g.toFixed(1)}%)` };
    });
    return <GapBars rows={rows} onSelect={onSelect} label="Regions by gap to budget, Jan–Jul 2022" />;
}
