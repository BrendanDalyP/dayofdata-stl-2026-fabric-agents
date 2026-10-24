import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Flat hairline card whose body fills the remaining height (for no-scroll grid layouts). */
export function Card({ title, subtitle, actions, children, className, bodyClassName }: {
    title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string;
}) {
    return (
        <section className={cn("flex min-h-0 min-w-0 flex-col rounded-lg border border-border bg-card p-4", className)}>
            {(title || actions) && (
                <header className="mb-2 flex shrink-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                        {title && <h2 className="font-heading text-400 font-semibold text-emphasis-foreground">{title}</h2>}
                        {subtitle && <p className="text-200 text-muted-foreground">{subtitle}</p>}
                    </div>
                    {actions && <div className="flex shrink-0 flex-wrap gap-1.5">{actions}</div>}
                </header>
            )}
            <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
        </section>
    );
}

/** Button that hands a question to a named agent: "● Sales · Which accounts drive this?". */
export function AskLink({ label, onClick, color, agent }: { label: string; onClick: () => void; color: string; agent?: string }) {
    return (
        <button type="button" onClick={onClick} title={agent ? `Ask the ${agent} agent` : undefined}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-200 text-foreground shadow-container-2 transition hover:border-brand hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: color }} />
            {agent && <span className="font-semibold">{agent}</span>}
            {agent && <span aria-hidden className="text-muted-foreground">·</span>}
            <span>{label}</span>
        </button>
    );
}

export function Skeleton({ className }: { className?: string }) {
    return <div aria-label="Loading" className={cn("h-full min-h-16 rounded-md bg-muted trace-pulse", className)} />;
}
