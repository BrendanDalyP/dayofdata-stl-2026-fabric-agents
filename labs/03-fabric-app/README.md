# Lab 03 — Host the agent team in a Fabric app

**Goal:** a one-page business command center on Fabric Apps: live d3 analytics from the lakehouse, the three data agents beside them, and action buttons that run Rayfin functions — while the browser never sees a token, a secret or an agent URL.

**Time:** 45 minutes (the first `npx rayfin up` takes a few minutes).

## What's in the app

One page — a **business command center** — with the analytics and the agent team side by side:

| Part | Data path |
| --- | --- |
| **KPI strip** and **d3 visuals** — budget-variance heatmap (key account × month), sales pulse with cumulative gap, region bullet charts, forecast-vs-budget diverging bars, delivery strip | Rayfin **lakehouse connector** (`fabric-sqlanalytics`, delegated: runs as the signed-in user) over three small tables in `lh__spaceparts.app`, aggregated server-side with `groupBy` |
| **Agent console** (docked right) — Sales Analyst, Operations, Planning, or the whole team at once | `askDataAgent` **Rayfin function** → each agent's **MCP endpoint** |
| **Action buttons** under every answer — *Recovery plan*, *Follow up*, *Escalate orders*, *Watch*, *Flag forecast gap* | `buildRecoveryPlan`, `createAction`, `setActionStatus` **Rayfin functions**: business rules (priority, due date, owner, the recovery maths) run server-side and write to the app's own SQL database |
| **Action board** (console tab) — the team's open follow-ups, escalations, plans and watches | `ActionItem` in the app's **Rayfin SQL database** |

Click any heatmap row or cell, region bar or forecast bar and the right agent gets the question. **Agents answer; functions act.** Data agents can't call your functions themselves, so the app turns each answer into buttons — detecting the key accounts, regions and product types the answer names — and the buttons call Rayfin functions.

```
visual click ─▶ askDataAgent ─▶ MCP ─▶ data agent ─▶ lakehouse
                     │
answer + buttons ◀───┘
   └─▶ buildRecoveryPlan / createAction ─▶ ActionItem (Rayfin SQL DB) ─▶ action board
```

## Files that matter

| File | What it does |
| --- | --- |
| `rayfin/functions/src/function_app.ts` | `askDataAgent`, `createAction`, `buildRecoveryPlan`, `setActionStatus`. **The context parameter must be annotated `RayfinContext<…>` inline** — through a type alias, typegen treats it as a request parameter and every call fails with `MissingInput` |
| `rayfin/functions/src/actions.ts` | Business rules: priority and due date by action kind, and the recovery-plan maths (run-rate needed for the rest of the year vs the budget's) |
| `rayfin/functions/src/data-agent.ts` | The MCP client: four JSON-RPC messages over `fetch` (plus the legacy Assistants path); client-held conversation state is validated before use |
| `rayfin/functions/src/agents.ts` | The agent team's MCP URLs |
| `rayfin/data/ActionItem.ts` | The shared action board table |
| `src/pages/CommandCenter.tsx` | The page: KPIs, visuals, docked console |
| `src/components/viz/*` | The d3 visuals (React-rendered SVG, d3 for scales, shapes and axes) |
| `src/components/AgentConsole.tsx` | Agent roster, chat, action buttons, recovery-plan card, action board |
| `src/agent/index.ts` | **The seam.** The UI calls `askAgent()`; `VITE_AGENT_MODE=offline` replays SQL-verified answers |
| `src/queries/overview.ts`, `src/lib/connectors.ts`, `rayfin/connectors/spaceparts/*` | Connector queries and wiring (field-name arrays in the browser — decorated entity classes can't be bundled) |
| `fabric/build_app_tables.sql`, `fabric/deploy_app_tables.py` | Builds the three `app.*` Delta tables with a Spark notebook |

## Steps

1. **Prerequisites:** a workspace on F2+ capacity with *Fabric Apps (preview)* enabled, Node 20+, and Labs 01–02 done.
2. **Install:**
   ```powershell
   npm install
   cd rayfin/functions; npm install; cd ../..
   ```
3. **Point the app at your agents:** paste the three `mcpUrl` values from `labs/01-data-agent/published-agents.json` into `rayfin/functions/src/agents.ts`.
4. **Build the Overview tables** (once, and whenever the data changes):
   ```powershell
   python fabric/deploy_app_tables.py --workspace-id <ws> --lakehouse-id <lh> --lakehouse-name lh__spaceparts [--folder-id <folder id>]
   ```
   > Why tables, not SQL views? The connector reads through Fabric's GraphQL layer, which needs table metadata and rejects views.
5. **Connect the lakehouse** (already in `rayfin/rayfin.yml` for the reference workspace; for yours):
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
7. **Choose the identity.** With no secrets set, the function uses Rayfin's **app identity** — the owner of the app item — and every user's question runs with the owner's permissions. To use the Lab 02 app registration instead:
   ```powershell
   npx rayfin secret set AGENT_TENANT_ID
   npx rayfin secret set AGENT_CLIENT_ID
   npx rayfin secret set AGENT_CLIENT_SECRET
   npx rayfin secret list        # names, never values
   ```
   Each answer shows **answered as app identity** or **answered as service principal**.
8. **Share:** give users *Run and interact* on the app item, and (because the connector is delegated) read access to the lakehouse.

## Offline fallback

```powershell
$env:VITE_AGENT_MODE = "offline"; npx rayfin up staticapp deploy
```

The agent team then replays the SQL-verified answers from `src/agent/recorded.ts` (generated by `labs/01-data-agent/make_ground_truth.py`), labelled as recordings. Unset it and redeploy to go live again.

## ✅ Checkpoint

The KPI strip shows **€9.03bn** net sales for 2022 to date; clicking Government Contract in the heatmap asks the Sales Analyst, the answer names it at **−8.2%** against budget, and **Recovery plan · Government Contract** returns a plan and adds it to the action board.
