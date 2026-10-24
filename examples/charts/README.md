# Charts for agent answers

Open [`gallery.html`](gallery.html) in a browser (no server, no libraries). It draws five chart forms from the real SpaceParts data, and says when to use each one:

| Question shape | Chart | In the app |
| --- | --- | --- |
| How are we tracking against budget by month? | Columns with a **budget marker** and the gap written under each month | `labs/03-fabric-app/src/components/viz/BudgetColumns.tsx` |
| Who is behind? | **Diverging bars**, sorted by the gap, red below plan, blue above | `GapBars.tsx` |
| What's the ranking? | **Horizontal bars**, the leader in colour, the tail grouped as "Other" | `BacklogByRegion.tsx` |
| Same measure across several groups over time | **Small multiples** on one shared scale | `DeliveryMultiples.tsx` |
| Plan vs plan, item by item | **Dot plot**: dot = forecast, tick = budget, line = gap | `ForecastMonthly.tsx`, `GapStrip.tsx` |

The rules behind them are in [`labs/03-fabric-app/docs/chart-principles.md`](../../labs/03-fabric-app/docs/chart-principles.md). The short version:

- **The title states the finding** ("5 of 13 key accounts are behind budget"), not the topic ("Sales by account").
- **A budget is a marker**, never a second bar or a second axis.
- **No smoothing.** Months are discrete; straight segments only.
- **Colour has a job:** blue/red for above/below plan, grey for context, one highlight for the point of the title.
- **Label directly** where the eye already is; drop the legend when you can.

## From an agent answer to a chart

Over MCP a data agent returns text and markdown tables, not the charts it draws in the Fabric portal. The agent instructions ask it to name a chart for its table (`Chart: diverging bar chart of the gap by key account`), and the app picks the form from the table itself. See [`../response-formatting/parse-answer.ts`](../response-formatting/parse-answer.ts).
