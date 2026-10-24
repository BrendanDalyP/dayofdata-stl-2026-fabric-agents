import { Children, isValidElement, cloneElement, type ReactNode, type ReactElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { AnswerChart } from "./AnswerChart";
import { splitAnswer } from "./parseTables";

export interface Highlights {
    /** Names to emphasise (key accounts, regions, product types). */
    entities: string[];
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The command-center answer style: names in bold white, key figures in the agent's colour,
 * shortfalls in red, table and column names in mono — and markdown tables drawn as charts.
 */
export function RichAnswer({ text, color, highlights }: { text: string; color: string; highlights: Highlights }) {
    const names = [...new Set(highlights.entities.filter((n) => n.length > 2))].sort((a, b) => b.length - a.length);
    const pattern = new RegExp(
        [
            String.raw`[−–-]\s?(?:€|EUR)\s?[\d,.]+(?:\s?(?:bn|m|k|million|billion))?`,
            String.raw`(?<![\w.])[−–-]\d[\d,]*(?:\.\d+)?\s?%?(?![\w])`,
            String.raw`\+\s?(?:€|EUR)?\s?\d[\d,.]*(?:\s?(?:bn|m|k|million|billion))?\s?%?`,
            String.raw`(?:€|EUR)\s?\d[\d,.]*(?:\s?(?:bn|m|k|million|billion))?`,
            String.raw`\b\d[\d,]*(?:\.\d+)?\s?%`,
            String.raw`\b[a-z]+(?:_[a-z]+)+\b`,
            String.raw`\b(?:behind|below|short(?:fall)?|missed?|overdue|late)\b`,
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
            const k = `${key}-${at}`;
            const lower = t.toLowerCase();
            if (nameSet.has(lower)) out.push(<strong key={k} className="font-semibold text-emphasis-foreground">{t}</strong>);
            else if (/^[a-z]+(_[a-z]+)+$/.test(t)) out.push(<span key={k} className="font-monospace text-[0.92em]" style={{ color }}>{t}</span>);
            else if (/^[−–-]/.test(t) || /^(behind|below|short|shortfall|miss|missed|overdue|late)$/.test(lower)) out.push(<span key={k} className="font-semibold text-destructive">{t}</span>);
            else if (/^\+/.test(t)) out.push(<span key={k} className="font-semibold text-success">{t}</span>);
            else out.push(<span key={k} className="font-numeric font-semibold" style={{ color }}>{t}</span>);
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
        <div className="prose-answer text-300 leading-400 text-foreground">
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
