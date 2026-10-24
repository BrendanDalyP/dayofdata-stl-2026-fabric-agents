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

/** Small text button that hands a question to an agent. */
export function AskLink({ label, onClick, color }: { label: string; onClick: () => void; color: string }) {
    return (
        <button type="button" onClick={onClick}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-0.5 text-200 text-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: color }} />{label}
        </button>
    );
}

export function Skeleton({ className }: { className?: string }) {
    return <div aria-label="Loading" className={cn("h-full min-h-16 rounded-md bg-muted trace-pulse", className)} />;
}
