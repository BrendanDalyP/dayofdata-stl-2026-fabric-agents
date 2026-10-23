import { useCallback, useEffect, useState } from "react";
import { Bookmark, Pin, Trash2, MessagesSquare } from "lucide-react";

import { deleteInsight, listInsights, setInsightKind, type InsightRow } from "@/services/insights";
import { Markdown } from "@/components/Markdown";
import { PageHeader } from "@/components/Shell";
import { cn } from "@/lib/utils";

export function InsightsPage({ onAsk }: { onAsk: () => void }) {
    const [rows, setRows] = useState<InsightRow[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<"all" | "pinned" | "saved">("all");

    const load = useCallback(async () => {
        try {
            setError(null);
            setRows(await listInsights());
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setRows([]);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const visible = (rows ?? []).filter((r) => filter === "all" || r.kind === filter);

    return (
        <div>
            <PageHeader
                eyebrow="Stored in the Rayfin app database"
                title="Pinned insights"
                subtitle="Answers you kept. They live in the app's own SQL database in Fabric, with a row-level policy so only you can see them."
                actions={
                    <div className="flex rounded-lg border border-border p-0.5" role="tablist" aria-label="Filter insights">
                        {(["all", "pinned", "saved"] as const).map((f) => (
                            <button
                                key={f}
                                role="tab"
                                aria-selected={filter === f}
                                type="button"
                                onClick={() => setFilter(f)}
                                className={cn(
                                    "rounded-md px-3 py-1 text-200 capitalize focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    filter === f ? "bg-muted text-emphasis-foreground" : "text-muted-foreground hover:text-foreground",
                                )}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                }
            />

            {error && (
                <p role="alert" className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-300 text-destructive">
                    {error}
                </p>
            )}

            {rows === null ? (
                <div className="grid gap-grid md:grid-cols-2">
                    {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="h-40 rounded-xl border border-border bg-card trace-pulse" />
                    ))}
                </div>
            ) : visible.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
                    <Pin className="icon-size-600 text-muted-foreground" aria-hidden />
                    <p className="mt-3 text-300 text-muted-foreground">Nothing here yet. Ask the agent something worth keeping.</p>
                    <button
                        type="button"
                        onClick={onAsk}
                        className="mt-4 flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-300 font-semibold text-on-brand hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <MessagesSquare className="icon-size-200" aria-hidden /> Ask the agent
                    </button>
                </div>
            ) : (
                <div className="columns-1 gap-4 md:columns-2 xl:columns-3">
                    {visible.map((row) => (
                        <article key={row.id} className="mb-4 break-inside-avoid rounded-xl border border-border bg-card p-4 shadow-container-2">
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <span
                                    className={cn(
                                        "flex items-center gap-1 rounded-full px-2 py-0.5 font-monospace text-100 uppercase tracking-wider",
                                        row.kind === "pinned" ? "bg-brand/15 text-brand-foreground" : "bg-muted text-muted-foreground",
                                    )}
                                >
                                    {row.kind === "pinned" ? <Pin className="icon-size-100" /> : <Bookmark className="icon-size-100" />}
                                    {row.kind}
                                </span>
                                <time className="font-monospace text-100 text-muted-foreground" dateTime={row.createdAt.toISOString()}>
                                    {row.createdAt.toLocaleString()}
                                </time>
                            </div>
                            <h2 className="font-heading text-400 font-semibold text-emphasis-foreground">{row.question}</h2>
                            <div className="mt-2 max-h-72 overflow-auto">
                                <Markdown>{row.answer}</Markdown>
                            </div>
                            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                                <span className="font-monospace text-100 text-muted-foreground">
                                    {row.agent} · {row.protocol ?? "agent"}
                                    {row.durationMs ? ` · ${(row.durationMs / 1000).toFixed(1)}s` : ""}
                                </span>
                                <div className="flex gap-1">
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            await setInsightKind(row.id, row.kind === "pinned" ? "saved" : "pinned");
                                            void load();
                                        }}
                                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        aria-label={row.kind === "pinned" ? "Unpin" : "Pin"}
                                    >
                                        <Pin className="icon-size-200" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            await deleteInsight(row.id);
                                            void load();
                                        }}
                                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        aria-label="Delete insight"
                                    >
                                        <Trash2 className="icon-size-200" />
                                    </button>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
}
