import { Children, isValidElement, cloneElement, type ReactNode, type ReactElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { AnswerChart } from "./AnswerChart";
import { splitAnswer } from "./parseTables";

export interface Highlights {
    /** Names to show as tinted chips (key accounts, regions, product types). */
    entities: string[];
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Colour-codes an agent answer: shortfalls (negative euros or %) in red, gains in green,
 * euro amounts in bold numerals, named accounts/regions/product types as chips — and
 * turns markdown tables into charts.
 */
export function RichAnswer({ text, color, highlights }: { text: string; color: string; highlights: Highlights }) {
    const names = [...new Set(highlights.entities.filter((n) => n.length > 2))].sort((a, b) => b.length - a.length);
    const pattern = new RegExp(
        [
            String.raw`[−–-]\s?€\s?[\d,.]+(?:\s?(?:bn|m|k))?`,          // negative euros
            String.raw`\+\s?€\s?[\d,.]+(?:\s?(?:bn|m|k))?`,             // positive euros
            String.raw`[−–-]\d+(?:\.\d+)?\s?%`,                          // negative %
            String.raw`\+\d+(?:\.\d+)?\s?%`,                             // positive %
            String.raw`(?:€|EUR)\s?[\d,.]+(?:\s?(?:bn|m|k|million|billion))?`,  // euros
            String.raw`(?<![\w.])[−–-][\d,]+(?:\.\d+)?(?![\w])`,      // other negative numbers (table cells)
            String.raw`\b(?:behind|below|short(?:fall)?|missed?|under(?:-plan)?|overdue|late|decline[ds]?|down)\b`,
            String.raw`\b(?:ahead|above|over(?:-plan)?|grew|growth|up|exceed(?:ed|s)?)\b`,
            ...names.map(escape),
        ].join("|"),
        "gi",
    );
    const nameSet = new Set(names.map((n) => n.toLowerCase()));

    const mark = (s: string, key: string | number): ReactNode[] => {
        const out: ReactNode[] = [];
        let last = 0;
        for (const m of s.matchAll(pattern)) {
            const t = m[0];
            const at = m.index ?? 0;
            if (at > last) out.push(s.slice(last, at));
            const lower = t.toLowerCase();
            let cls = "";
            if (nameSet.has(lower)) {
                out.push(
                    <span key={`${key}-${at}`} className="rounded px-1 font-semibold text-emphasis-foreground" style={{ background: `${color}22`, boxShadow: `inset 0 -2px 0 ${color}` }}>
                        {t}
                    </span>,
                );
                last = at + t.length;
                continue;
            }
            if (/^[−–-]/.test(t) || /^(behind|below|short|shortfall|miss|missed|under|under-plan|overdue|late|decline|declined|declines)$/.test(lower)) cls = "font-semibold text-destructive";
            else if (/^\+/.test(t) || /^(ahead|above|over|over-plan|grew|growth|exceed|exceeded|exceeds)$/.test(lower)) cls = "font-semibold text-success";
            else cls = "font-numeric font-semibold text-emphasis-foreground";
            out.push(<span key={`${key}-${at}`} className={cls}>{t}</span>);
            last = at + t.length;
        }
        if (last < s.length) out.push(s.slice(last));
        return out;
    };

    const walk = (children: ReactNode, depth = 0): ReactNode =>
        Children.map(children, (child, i) => {
            if (typeof child === "string") return mark(child, `${depth}-${i}`);
            if (isValidElement(child) && depth < 6) {
                const el = child as ReactElement<{ children?: ReactNode }>;
                return cloneElement(el, undefined, walk(el.props.children, depth + 1));
            }
            return child;
        });

    const components = Object.fromEntries(
        (["p", "li", "strong", "em", "td"] as const).map((tag) => [
            tag,
            ({ children }: { children?: ReactNode }) => {
                const Tag = tag;
                return <Tag>{walk(children)}</Tag>;
            },
        ]),
    );

    return (
        <div className="prose-answer text-200 leading-300">
            {splitAnswer(text).map((part, i) =>
                part.type === "table" ? (
                    <AnswerChart key={i} table={part.table} raw={part.raw} color={color} />
                ) : (
                    <ReactMarkdown key={i} remarkPlugins={[remarkGfm]} components={components}>
                        {part.text}
                    </ReactMarkdown>
                ),
            )}
        </div>
    );
}
