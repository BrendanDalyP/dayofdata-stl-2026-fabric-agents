# Formatting agent responses

An answer an app can use has a predictable shape: a headline, a few key points, a table with units, a suggested chart and a line of notes. You get that shape by asking for it in the agent instructions, then reading it back in code.

| File | What it is |
| --- | --- |
| [`agent-instructions-template.md`](agent-instructions-template.md) | Fill-in-the-blanks agent instructions: objective, terms, answer template, when to ask, out of scope; and what goes wrong without each section |
| [`sample-answers.md`](sample-answers.md) | Real SpaceParts answers in that shape: a full answer, a single number, a clarifying question, a stated assumption, two polite refusals |
| [`parse-answer.ts`](parse-answer.ts) | Splits an answer into headline, key points, tables (with a chart picked for each) and notes. `node --experimental-strip-types parse-answer.ts` runs a demo (Node 22.6+) |

## Tips

- **Ask for units in table headers** ("Net sales (EUR)", "Gap (%)"). It's what lets code tell a euro column from a percentage.
- **Ask for a sort order** that matches the question (largest shortfall first; months in calendar order). Then the table is already the chart.
- **Ask for a Total row, then drop it before charting.** People want the total; charts don't.
- **Cap the rows** (the agent returns at most 25 rows and 25 columns anyway) and have it say how many it left out.
- **Keep the agent's chart suggestion as a hint**, not a command: the parser picks a line for months, diverging bars for gaps with negatives, and bars otherwise.
- **Test the format like the numbers.** The evaluation notebooks in `labs/01-data-agent` check the figures; read a few answers by eye after every instruction change to check the shape.
