import { useEffect, useState } from "react";

import { AskProvider } from "@/agent/AskContext";
import { AskDrawer } from "@/components/AskDrawer";
import { Shell } from "@/components/Shell";
import { OverviewPage } from "@/pages/OverviewPage";
import { AccountsPage } from "@/pages/AccountsPage";
import { ActionsPage } from "@/pages/ActionsPage";
import { navigate, parseRoute } from "@/lib/nav";

function App() {
    const [route, setRoute] = useState(parseRoute);
    useEffect(() => {
        const on = () => setRoute(parseRoute());
        window.addEventListener("hashchange", on);
        return () => window.removeEventListener("hashchange", on);
    }, []);

    return (
        <AskProvider>
            <Shell tab={route.tab} onTab={(t) => navigate(t)}>
                {route.tab === "overview" && <OverviewPage />}
                {route.tab === "accounts" && <AccountsPage selected={route.account} />}
                {route.tab === "actions" && <ActionsPage />}
            </Shell>
            <AskDrawer />
        </AskProvider>
    );
}

export default App;
