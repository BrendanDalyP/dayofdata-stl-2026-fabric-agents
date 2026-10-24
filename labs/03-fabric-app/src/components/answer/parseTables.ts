// Pulls markdown tables out of an agent answer and works out how to chart them.
// Over MCP a Fabric data agent returns text and markdown tables (not the charts it
// draws in the Fabric portal), so the app draws its own.

export interface ParsedTable {
    headers: string[];
    rows: string[][];
    /** Index of the label column (first mostly non-numeric column). */
    labelCol: number;
    /** Columns whose cells are mostly numbers. */
    numericCols: number[];
    /** Column to chart. */
    valueCol: number;
    kind: "line" | "bar" | "diverging";
    /** Values are percentages. */
    percent: boolean;
}

export interface Segment { type: "text"; text: string }
export interface TableSegment { type: "table"; table: ParsedTable; raw: string }
export type AnswerPart = Segment | TableSegment;

const MONTHS = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(\d{2,4})?$|^\d{4}-\d{2}(-\d{2})?$|^\d{1,2}\/\d{4}$/i;

/** "€1,168,869,267" → 1168869267; "−8.2%" → -8.2; "(1,234)" → -1234; otherwise NaN. */
export function toNumber(cell: string): number {
    let s = cell.replace(/\*\*/g, "").trim();
    if (!s || s === "–" || s === "-") return NaN;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    s = s.replace(/[−–]/g, "-").replace(/[€$£\s,%]/g, "").replace(/^\+/, "");
    const mult = /bn$/i.test(s) ? 1e9 : /m$/i.test(s) ? 1e6 : /k$/i.test(s) ? 1e3 : 1;
    s = s.replace(/(bn|m|k)$/i, "");
    if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
    const v = parseFloat(s) * mult;
    return neg ? -v : v;
}

function parseTable(lines: string[]): ParsedTable | null {
    const cells = (l: string) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
    const headers = cells(lines[0]).map((h) => h.replace(/\*\*/g, ""));
    const body = lines.slice(2).map(cells).filter((r) => r.length === headers.length);
    // Drop total rows — they flatten every chart.
    const rows = body.filter((r) => !/^\**\s*(total|grand total|overall)\b/i.test(r[0].replace(/\*/g, "")));
    if (rows.length < 2 || headers.length < 2) return null;

    const numericShare = headers.map((_, j) => rows.filter((r) => Number.isFinite(toNumber(r[j]))).length / rows.length);
    const labelCol = numericShare.findIndex((s) => s < 0.5);
    if (labelCol < 0) return null;
    const numericCols = numericShare.map((s, j) => (s >= 0.8 && j !== labelCol ? j : -1)).filter((j) => j >= 0);
    if (!numericCols.length) return null;

    // Prefer a gap / variance / growth column; otherwise the first euro or plain number column.
    const prefer = numericCols.find((j) => /gap|variance|vs\.?\s*budget|growth|change|delta|%/i.test(headers[j]) && rows.some((r) => toNumber(r[j]) < 0));
    const valueCol = prefer ?? numericCols[0];
    const values = rows.map((r) => toNumber(r[valueCol]));
    const percent = /%|pct|percent|rate/i.test(headers[valueCol]) || rows.every((r) => /%/.test(r[valueCol]));
    const isTime = rows.filter((r) => MONTHS.test(r[labelCol].replace(/\*/g, ""))).length >= rows.length * 0.7;
    const kind = isTime ? "line" : values.some((v) => v < 0) && values.some((v) => v > 0) || prefer !== undefined ? "diverging" : "bar";
    return { headers, rows, labelCol, numericCols, valueCol, kind, percent };
}

/** Splits an answer into text and table parts, in order. */
export function splitAnswer(md: string): AnswerPart[] {
    const lines = md.split(/\r?\n/);
    const parts: AnswerPart[] = [];
    let text: string[] = [];
    for (let i = 0; i < lines.length; i++) {
        const isRow = (l?: string) => !!l && /^\s*\|.*\|\s*$/.test(l);
        const isSep = (l?: string) => !!l && /^\s*\|?\s*:?-{2,}/.test(l);
        if (isRow(lines[i]) && isSep(lines[i + 1])) {
            const block: string[] = [lines[i], lines[i + 1]];
            i += 2;
            while (i < lines.length && isRow(lines[i])) block.push(lines[i++]);
            i--;
            const table = parseTable(block);
            if (text.length) parts.push({ type: "text", text: text.join("\n") });
            text = [];
            if (table) parts.push({ type: "table", table, raw: block.join("\n") });
            else parts.push({ type: "text", text: block.join("\n") });
        } else {
            text.push(lines[i]);
        }
    }
    if (text.join("").trim()) parts.push({ type: "text", text: text.join("\n") });
    return parts;
}
