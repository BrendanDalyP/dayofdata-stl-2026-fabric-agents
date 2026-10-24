import type { TabId } from "@/components/Shell";

/** Hash routes: #/overview · #/accounts · #/accounts/<name> · #/actions */
export function navigate(tab: TabId, account?: string) {
    window.location.hash = `/${tab}${account ? `/${encodeURIComponent(account)}` : ""}`;
}

export function parseRoute(): { tab: TabId; account?: string } {
    const [, tab, ...rest] = window.location.hash.replace(/^#/, "").split("/");
    const t = (["overview", "accounts", "actions"] as TabId[]).includes(tab as TabId) ? (tab as TabId) : "overview";
    return { tab: t, account: rest.length ? decodeURIComponent(rest.join("/")) : undefined };
}
