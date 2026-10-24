// Turn a data agent's markdown answer into something an app can render:
// the headline, the key points, each table (with a chart picked for it), and the notes.
//
// Over MCP a Fabric data agent returns text and markdown tables, not the charts it draws
// in the Fabric portal, so the app draws its own. This works best when the agent follows
// the template in agent-instructions-template.md. The full version used by the app is
// labs/03-fabric-app/src/components/answer/parseTables.ts.
//
// Run the demo (Node 22.6+):  node --experimental-strip-types parse-answer.ts

export type ChartKind = "line" | "bar" | "diverging";

export interface AnswerTable {
  headers: string[];
  rows: string[][];
  label: number; // label column
  value: number; // column to chart
  chart: ChartKind;
}

export interface ParsedAnswer {
  headline: string;
  keyPoints: string[];
  tables: AnswerTable[];
  suggestedChart?: string; // the agent's own "Chart:" line
  notes?: string;
}

/** "€1,168,869,267" → 1168869267, "−8.2%" → -8.2, "(1,234)" → -1234, otherwise NaN. */
export function toNumber(cell: string): number {
  let s = cell.replace(/\*\*/g, "").trim();
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(/[−–]/g, "-").replace(/[€$£\s,%]/g, "").replace(/^\+/, "");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return neg ? -parseFloat(s) : parseFloat(s);
}

const MONTH = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|^\d{4}-\d{2}/i;

function readTable(lines: string[]): AnswerTable | undefined {
  const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  const headers = cells(lines[0]);
  // Leave total rows out of the chart: they flatten everything else.
  const rows = lines.slice(2).map(cells).filter((r) => r.length === headers.length && !/^\**total/i.test(r[0]));
  if (rows.length < 2) return undefined;

  const isNumeric = (j: number) => rows.filter((r) => Number.isFinite(toNumber(r[j]))).length >= rows.length * 0.8;
  const label = headers.findIndex((_, j) => !isNumeric(j));
  const numeric = headers.map((_, j) => j).filter((j) => j !== label && isNumeric(j));
  if (label < 0 || !numeric.length) return undefined;

  // Prefer a gap / growth column with negative values; otherwise the first number column.
  const gap = numeric.find((j) => /gap|variance|growth|change|vs/i.test(headers[j]) && rows.some((r) => toNumber(r[j]) < 0));
  const value = gap ?? numeric[0];
  const overTime = rows.filter((r) => MONTH.test(r[label])).length >= rows.length * 0.7;
  const chart: ChartKind = overTime ? "line" : gap !== undefined ? "diverging" : "bar";
  return { headers, rows, label, value, chart };
}

export function parseAnswer(md: string): ParsedAnswer {
  const lines = md.split(/\r?\n/);
  const tables: AnswerTable[] = [];
  const keyPoints: string[] = [];
  const text: string[] = [];
  let suggestedChart: string | undefined;
  let notes: string | undefined;

  // Agents often bold the template labels: "**Answer**: …", "**Notes**: …".
  const plain = (l: string) => l.replace(/^\s*\*\*([^*]+)\*\*\s*:/, "$1:");
  for (let i = 0; i < lines.length; i++) {
    const line = plain(lines[i]);
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] ?? "")) {
      const block = [line, lines[i + 1]];
      i += 2;
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) block.push(lines[i++]);
      i--;
      const t = readTable(block);
      if (t) tables.push(t);
    } else if (/^\s*chart:/i.test(line)) {
      suggestedChart = line.replace(/^\s*chart:\s*/i, "");
    } else if (/^\s*notes?:/i.test(line)) {
      notes = line.replace(/^\s*notes?:\s*/i, "");
    } else if (/^\s*[-*]\s+/.test(line)) {
      keyPoints.push(line.replace(/^\s*[-*]\s+/, ""));
    } else if (line.trim() && !/^\s*(key points|table)\s*:?\s*$/i.test(line)) {
      text.push(line.trim().replace(/^answer:\s*/i, ""));
    }
  }
  return { headline: text[0] ?? "", keyPoints, tables, suggestedChart, notes };
}

// Demo with a real answer from the SpaceParts Sales Analyst.
const sample = `Five key accounts are behind budget for January–July 2022; **Government Contract** is furthest behind at **−€104,564,389 (−8.2%)**.

- **Government Contract** alone accounts for more than half of the combined shortfall.
- **Supernova Spaceparts** is close behind at **−7.9%**.

| Key account | Actual (EUR) | Budget (EUR) | Gap (EUR) | Gap (%) |
| --- | ---: | ---: | ---: | ---: |
| Government Contract | 1,168,869,267 | 1,273,433,656 | −104,564,389 | −8.2 |
| Supernova Spaceparts | 342,380,213 | 371,872,861 | −29,492,648 | −7.9 |
| Pioneering Systems | 346,142,027 | 363,579,984 | −17,437,957 | −4.8 |

Chart: diverging bar chart of the gap (%) by key account.

**Notes**: real invoices only · euros at monthly rates · complete months Jan–Jul 2022.`;

if (typeof process !== "undefined" && process.argv[1]?.includes("parse-answer")) {
  const a = parseAnswer(sample);
  const t = a.tables[0];
  console.log("Headline:", a.headline);
  console.log("Key points:", a.keyPoints.length);
  console.log(`Table: ${t.rows.length} rows, chart "${t.chart}" of "${t.headers[t.value]}" by "${t.headers[t.label]}"`);
  console.log("Agent suggested:", a.suggestedChart);
  console.log("Notes:", a.notes);
}
