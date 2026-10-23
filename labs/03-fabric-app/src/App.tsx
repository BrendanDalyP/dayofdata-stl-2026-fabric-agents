import { useState } from "react";

import { Shell, type PageId } from "@/components/Shell";
import { OverviewPage } from "@/pages/OverviewPage";
import { AskPage } from "@/pages/AskPage";
import { InsightsPage } from "@/pages/InsightsPage";
import type { AgentKey } from "@/agent/team";

function initialPage(): PageId {
    const hash = window.location.hash.replace("#", "");
    return hash === "ask" || hash === "insights" ? hash : "overview";
}

interface PendingAsk { id: number; question: string; agent: AgentKey }

function App() {
    const [page, setPage] = useState<PageId>(initialPage);
    const [pending, setPending] = useState<PendingAsk | undefined>();

    const navigate = (next: PageId) => {
        setPage(next);
        if (next !== "ask") setPending(undefined);
        history.replaceState(null, "", `#${next}`);
    };

    const askFromOverview = (question: string, agent: AgentKey) => {
        setPending({ id: Date.now(), question, agent });
        setPage("ask");
        history.replaceState(null, "", "#ask");
    };

    return (
        <Shell page={page} onNavigate={navigate}>
            {page === "overview" && <OverviewPage onAsk={askFromOverview} />}
            {page === "ask" && (
                <AskPage key={pending?.id ?? "ask"} initialQuestion={pending?.question} initialTarget={pending?.agent} />
            )}
            {page === "insights" && <InsightsPage onAsk={() => navigate("ask")} />}
        </Shell>
    );
}

export default App;
