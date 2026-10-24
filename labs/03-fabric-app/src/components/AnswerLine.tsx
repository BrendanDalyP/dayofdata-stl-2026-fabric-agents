import type { ReactNode } from "react";
import { Info } from "lucide-react";

import { sourceDetail } from "@/lib/sources";

/**
 * The first line on every tab: the business question the tab exists to answer, the answer
 * (computed from the data on screen), and where it comes from. Answer first, detail below.
 */
export function AnswerLine({ question, answer, source }: { question: string; answer?: ReactNode; source: string }) {
    return (
        <div role="note" aria-label={question}
            className="flex shrink-0 items-center gap-3 rounded-lg border border-border border-l-[3px] border-l-brand bg-card px-4 py-2">
            <span className="shrink-0 text-100 font-semibold uppercase tracking-wide text-brand-foreground">{question}</span>
            <p className="min-w-0 flex-1 truncate text-300 font-semibold text-emphasis-foreground" title={typeof answer === "string" ? answer : undefined}>
                {answer ?? <span className="inline-block h-3 w-72 rounded bg-muted align-middle trace-pulse" />}
            </p>
            <SourceTag source={source} />
        </div>
    );
}

/** A small "Source" marker whose hover text names the table and the rules behind the number. */
export function SourceTag({ source, label = "Source" }: { source: string; label?: string }) {
    return (
        <span tabIndex={0} title={sourceDetail(source)} aria-label={sourceDetail(source)}
            className="inline-flex shrink-0 cursor-help items-center gap-1 rounded text-100 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Info className="icon-size-100" aria-hidden /> {label}
        </span>
    );
}
