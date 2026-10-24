# Lab 03 — Host the agent team in a Fabric app

**Goal:** *SpaceParts Mission Control*, a business app on Fabric Apps: live d3 analytics from the lakehouse, the three data agents one keystroke away, and action buttons that run Rayfin functions — while the browser never sees a token, a secret or an agent URL.

**Time:** 45 minutes (the first `npx rayfin up` takes a few minutes).

## What's in the app

Five tabs in three groups (**Monitor** · **Diagnose** · **Act**). Each tab is one screen with no page scrolling, opens with a one-line answer, and every chart has an action title and its source on hover:

| Tab | What's on it | Data path |
| --- | --- | --- |
| **Overview** | KPI row (net sales, vs budget, key accounts behind with status mix, on-time delivery, forecast vs budget), net sales vs budget by month, top movers, regions vs budget, open actions, and an **agent brief** | Rayfin **lakehouse connector** (`fabric-sqlanalytics`, delegated) over small `app.*` tables |
| **Accounts** | All 13 key accounts (list or heatmap) and the selected account: figures, monthly trend, what it takes to land the full-year budget, an agent brief, hand-offs | same connector |
| **Operations** | Open order backlog by region, on-time delivery by region (small multiples), late penalties, cancellations by product type | same connector |
| **Plan** | Forecast vs budget by month, territories vs forecast, brands vs budget | same connector |
| **Actions** | The action board: High / Medium / Low / Done, filtered by agent and kind | `ActionItem` in the app's **Rayfin SQL database** |

**Agents** live in an **Ask drawer** (`Ctrl K`, the Ask box, or clicking any bar, cell or month). Ask without picking an agent and the question is routed to the right one (the drawer says which, and why); pick an agent to see its suggested questions and quick actions. They also appear in inline **agent briefs** ("Brief me"). Each answer shows the agent's mark, colour-coded text with tables drawn as charts, its sources, **hand-offs** to the other agents and **action buttons** that run Rayfin functions (`buildRecoveryPlan`, `createAction`, `setActionStatus`). **Agents answer; functions act.**

```
chart click / Ctrl K / Brief me ─▶ askDataAgent (Rayfin function, as the app) ─▶ MCP ─▶ data agent ─▶ lakehouse
answer + hand-offs + action buttons ─▶ buildRecoveryPlan / createAction ─▶ ActionItem ─▶ Actions tab
```

## Files that matter

| File | What it does |
| --- | --- |
| `rayfin/functions/src/function_app.ts` | `askDataAgent`, `createAction`, `buildRecoveryPlan`, `setActionStatus`. **The context parameter must be annotated `RayfinContext<…>` inline** — through a type alias, typegen treats it as a request parameter and every call fails with `MissingInput` |
| `rayfin/functions/src/actions.ts` | Business rules: priority and due date by action kind, and the recovery-plan maths (run-rate needed for the rest of the year vs the budget's) |
| `rayfin/functions/src/data-agent.ts` | The MCP client: four JSON-RPC messages over `fetch` (plus the legacy Assistants path); client-held conversation state is validated before use |
| `rayfin/functions/src/agents.ts` | The agent team's MCP URLs (**replace with yours**) |
| `rayfin/data/ActionItem.ts` | The shared action board table |
| `src/pages/*Page.tsx`, `src/components/Shell.tsx` | The five tabs and the app frame |
| `src/components/viz/*` | d3 visuals (React SVG), built to `docs/chart-principles.md`: action titles, budget as a marker, no smoothing, direct labels, variance in red/blue. Palette validated with the dataviz skill |
| `src/agent/route.ts` | Routes an un-targeted question to Sales, Operations or Planning |
| `src/agent/AskContext.tsx`, `src/components/AskDrawer.tsx`, `AgentBrief.tsx`, `AgentAnswer.tsx` | The agent experience: shared ask state, the drawer, inline briefs, the answer card with hand-offs and actions |
| `src/agent/index.ts` | **The seam.** The UI calls `askAgent()`; `VITE_AGENT_MODE=offline` replays SQL-verified answers |
| `src/queries/overview.ts`, `src/queries/opsplan.ts`, `src/lib/connectors.ts`, `rayfin/connectors/spaceparts/*` | Connector queries (one row fetch with an explicit page size — **groupBy returns one 100-row page**) and wiring (field-name arrays in the browser — decorated entity classes can't be bundled) |
| `fabric/build_app_tables.sql`, `fabric/deploy_app_tables.py` | Builds the eight small `app.*` Delta tables the charts read, with a Spark notebook |
| `fabric/seed_demo_actions.py`, `scripts/export_snapshot.py` | Demo data for the action board; a local copy of the app tables for offline development |

## Steps

1. **Prerequisites:** a workspace on F2+ capacity with *Fabric Apps (preview)* enabled, Node 20+, and Labs 01–02 done.
2. **Install:**
   ```powershell
   npm install
   cd rayfin/functions; npm install; cd ../..
   ```
3. **Point the app at your agents:** paste the three `mcpUrl` values from `labs/01-data-agent/published-agents.json` into `rayfin/functions/src/agents.ts`. The URLs in the repo are the speakers' workspace; you can't call them.
4. **Build the app tables** (once, and whenever the data changes):
   ```powershell
   python fabric/deploy_app_tables.py --workspace-id <ws> --lakehouse-id <lh> --lakehouse-name lh__spaceparts [--folder-id <folder id>]
   ```
   > Why tables, not SQL views? The connector reads through Fabric's GraphQL layer, which needs table metadata and rejects views.
5. **Connect the lakehouse.** `rayfin/rayfin.yml` and `rayfin/connectors/spaceparts/metadata.json` point at the speakers' workspace; replace them with yours:
   ```powershell
   npx rayfin connector add --type fabric-sqlanalytics --name spaceparts --workspace-id <ws> --item-id <lh> --operations read
   ```
   Then set `auth.type: delegated` for the connector in `rayfin/rayfin.yml`, so charts run as the signed-in user, and keep the hand-written entities in `rayfin/connectors/spaceparts/`.
6. **Deploy:**
   ```powershell
   npx rayfin up --workspace-id <ws> --yes
   ```
   It creates the app item, the SQL database (`Insight`), the functions and the static site, and prints the URL.
   `rayfin up` has no folder option, so after the **first** deploy, move the app into your workspace folder (its database, functions and GraphQL API move with it; later deploys reuse the item):
   ```powershell
   $t = az account get-access-token --resource https://api.fabric.microsoft.com --query accessToken -o tsv
   Invoke-RestMethod -Method Post -Headers @{Authorization="Bearer $t"} -ContentType application/json `
     -Uri "https://api.fabric.microsoft.com/v1/workspaces/<ws>/items/<app item id>/move" -Body '{"targetFolderId":"<folder id>"}'
   ```
7. **Identity.** The app calls the agents as **itself** — Rayfin's app identity (`ctx.Tokens.Fabric`, the owner of the app item). No app registration, no secrets; answers read *answered as the app*. Every user's question runs with the owner's permissions on the agents' data, so scope the agents' tables accordingly.
8. **Share:** give users *Run and interact* on the app item, and (because the connector is delegated) read access to the lakehouse.

## Seed demo actions

The Action board starts empty, and a fresh deploy or `db apply` can clear it. To put six realistic items on it before a demo, run:

```powershell
pip install mssql-python
python fabric/seed_demo_actions.py --workspace-id <ws>
```

The six items:
- a Government Contract recovery plan ("stretch", high priority);
- escalating Government Contract's overdue orders;
- flagging the Electrical forecast gap;
- a Supernova Spaceparts follow-up;
- a Sigil Interstellar watch;
- one done item.

They follow the same priority, due-date and recovery rules as the Rayfin functions. The script is safe to re-run: it replaces only the rows it seeded, and leaves items you created in the app alone.

## Develop locally without Fabric

The local dev server can't sign in to Fabric, so it can read a JSON copy of the app tables instead:

```powershell
python scripts/export_snapshot.py --workspace-id <ws> --out ../snapshot
$env:SNAPSHOT_DIR = "../snapshot"; $env:VITE_DATA_SNAPSHOT = "1"; $env:VITE_AGENT_MODE = "offline"; npm run dev
```

Snapshot mode exists only on the dev server (`import.meta.env.DEV`); production builds never include it.

## Offline fallback

```powershell
$env:VITE_AGENT_MODE = "offline"; npx rayfin up staticapp deploy
```

The agent team then replays the SQL-verified answers from `src/agent/recorded.ts` (generated by `labs/01-data-agent/make_ground_truth.py`), labelled as recordings. Unset it and redeploy to go live again.

## ✅ Checkpoint

The Overview KPI row shows **€9.03bn** net sales for 2022 to date and **5 of 13** key accounts behind budget; clicking Government Contract in the heatmap asks the Sales Analyst, the answer names it at **−8.2%** against budget, and **Recovery plan · Government Contract** returns a plan and adds it to the action board.
