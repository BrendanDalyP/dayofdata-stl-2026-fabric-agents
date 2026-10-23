import { Monitor, Server, Bot, Database } from "lucide-react";
import { cn } from "@/lib/utils";

interface RequestTraceProps {
    agentLabel?: string;
    /** null while the request is in flight */
    totalMs: number | null;
    serverMs: number | null;
    protocol?: string;
}

/**
 * The signature detail: shows the path each question takes.
 * Browser → Rayfin function (holds the secret) → Fabric Data Agent → Lakehouse.
 */
export function RequestTrace({ agentLabel = "Data Agent", totalMs, serverMs, protocol }: RequestTraceProps) {
    const pending = totalMs === null;
    const hops = [
        { icon: Monitor, label: "Browser", detail: "Rayfin session" },
        {
            icon: Server,
            label: "Rayfin function",
            detail: pending ? "invoking…" : `askDataAgent · ${fmt(Math.max(0, (totalMs ?? 0) - (serverMs ?? 0)))} overhead`,
        },
        {
            icon: Bot,
            label: agentLabel,
            detail: pending ? "thinking…" : `${protocol === "offline" ? "replay" : (protocol ?? "mcp").toUpperCase()} · ${fmt(serverMs ?? 0)}`,
        },
        { icon: Database, label: "Lakehouse", detail: "NL → SQL, governed" },
    ];

    return (
        <ol className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-2 font-monospace text-100 text-muted-foreground" aria-label="Request path">
            {hops.map(({ icon: Icon, label, detail }, i) => (
                <li key={label} className="flex items-center gap-1">
                    <span
                        className={cn(
                            "flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-1",
                            pending && i > 0 && "trace-pulse",
                        )}
                        title={detail}
                    >
                        <Icon className="icon-size-100 text-signal" aria-hidden />
                        <span className="text-foreground">{label}</span>
                        <span className="hidden lg:inline">· {detail}</span>
                    </span>
                    {i < hops.length - 1 && <span aria-hidden className="text-signal">→</span>}
                </li>
            ))}
            {!pending && <li className="ml-2 text-foreground">total {fmt(totalMs ?? 0)}</li>}
        </ol>
    );
}

function fmt(ms: number) {
    return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}
