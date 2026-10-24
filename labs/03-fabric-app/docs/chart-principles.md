# Chart principles

How every chart in SpaceParts Mission Control is drawn. The format follows TOGAF architecture principles: each principle has a name, a statement, a rationale and its implications. The visual conventions are the ones strategy-consulting decks use.

Apply these principles to every new chart. Each principle names the code that implements it.

---

## 1. The title states the finding

**Statement.** Every chart's title is a full sentence saying what the chart shows, computed from the data. Examples:
- "Net sales are +7.5% against budget in 2022, ahead in 6 of 7 months"
- "€326.3m of orders are overdue, 26.0% of the open book"

A subtitle names the measure, unit and period, and a source line names the table.

**Rationale.** A label such as "Net sales against budget" leaves the reader to find the point. In a meeting there's no time for that, and in a live demo the presenter needs the sentence on screen.

**Implications.**
- `Card` takes `title`, `subtitle` and `source`.
- Titles are built from the same numbers the chart draws, so they can't drift from the data.
- Each title has a fallback label while the data loads.

## 2. One measure per axis; reference values are markers, not lines

**Statement.** Actuals are columns, and budget is a short dark marker across each column. Monthly values are never joined by a line drawn over the columns, and a chart never has two y-axes.

**Rationale.** A line joining monthly budgets suggests values between the months that don't exist, and it hides the column tops it crosses. A marker on each column makes the comparison exact and readable at a glance.

**Implications.**
- `BudgetColumns` is used for Overview and Accounts.
- `ForecastMonthly` (Plan) shows a forecast column with a narrower actual column inside it, plus the budget marker.
- On-time delivery and penalties are two small charts that share one x-axis (`DeliveryMultiples`).

## 3. No smoothing

**Statement.** Lines are straight segments between real data points.

**Rationale.** Curve smoothing (monotone or cardinal) invents peaks and dips that aren't in the data and makes the chart look like decoration.

**Implications.**
- Every `d3.line()` uses the default linear curve.
- Sparklines are linear for rates, or mini columns for monthly totals.

## 4. Grey for context, one colour for the focus

**Statement.** The period or series being discussed takes the series colour (blue). Earlier periods and context series are grey (`--context`), and budget or plan uses ink (`--plan`).

**Rationale.** The reader's eye should land on 2022 first. Colouring every series equally makes the reader compare them all.

**Implications.**
- `C.series`, `C.context` and `C.plan` in `viz/common.tsx`, with theme-aware tokens in `global.css`.
- Agent colours appear only on agent marks, never in charts.

## 5. Variance is shown explicitly, and red means below plan

**Statement.** Where a chart compares with a plan, the gap is drawn as well: a variance row under the columns, or diverging bars sorted from worst to best. Red is below plan and blue is above; the midpoint is neutral.

**Rationale.** Readers shouldn't have to subtract two bar heights in their head. Red and blue stay distinguishable for colour-blind readers, which red and green don't.

**Implications.** `BudgetColumns` has a variance row; `GapBars` handles regions, territories, product types and brands; `GapStrip` shows monthly gaps in the Accounts list.

## 6. Label directly; keep axes and gridlines quiet

**Statement.** Label values on the marks that matter (the last point, the largest gap, each diverging bar). Gridlines are hairlines, and there's a legend only when a chart has two or more series.

**Rationale.** Labels on the marks remove a lookup step, and quiet gridlines keep the data in front.

**Implications.**
- Diverging bars carry their own values.
- Time axes use month initials with the year under each group.
- Partial periods are marked: August 2022 is labelled "to 21st" and drawn lighter.

## 7. Every number has a source

**Statement.** Each chart names the lakehouse table it reads, and the euro rule applied (EUR at monthly rates).

**Rationale.** Executives trust numbers they can trace. Here the source line also matches the tables the data agents read, so an agent's answer can be checked against the chart.

**Implications.**
- Use `Card source=…`.
- Table names match `fabric/build_app_tables.sql`.

## 8. Fit the frame

**Statement.** A chart sizes itself to its card, never overflows it, and never makes the page scroll.

**Rationale.** A tab is one screen. A chart that spills out of its box reads as broken.

**Implications.** Charts measure their container (`useSize`) and size their rows to fit it, and card bodies clip whatever is left over.
