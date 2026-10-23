# Lab 01 — Build, instruct and validate the agent team

**Goal:** three published Fabric data agents over the SpaceParts lakehouse — **Sales Analyst**, **Operations** and **Planning** — each scoped to its own tables, each giving answers you have checked against SQL.

**Time:** 45 minutes (15 if you use the script).

| File | What it is |
| --- | --- |
| `agents/<name>/agent.json` | Name, description (becomes the MCP tool description), selected tables, demo chips |
| `agents/<name>/instructions.md` | Agent instructions — read for every question |
| `agents/<name>/datasource-instructions.md` | Data source instructions — the currency rule, joins, dates |
| `agents/<name>/fewshots.json` | Example queries — one SQL pattern each |
| `verify_answers.sql` | The ground truth: one query per evaluation question |
| `validate_fewshots.py` | Runs every example query; a broken example misleads the agent |
| `create_agents.py` | Creates or updates and publishes all three agents from the files above |
| `make_ground_truth.py` | Runs `verify_answers.sql` → `ground_truth_<agent>.csv`, `expected-answers.md`, the app's offline answers |
| `evaluate_agent.ipynb` | Evaluation with `fabric-data-agent-sdk` (run in Fabric) |

## 0. Load SpaceParts

Load SpaceParts into a lakehouse with Tabular Editor's Fabric starter notebook (see the root README). This repo assumes a **schema-enabled** lakehouse named `lh__spaceparts` with the tables in schema `SpaceParts`. Find your IDs:

```powershell
./scripts/discover.ps1 -Workspace "<your workspace>" -Lakehouse lh__spaceparts
```

## 1. Know the data before you instruct anyone

Three facts the agent cannot guess, all found by querying the lakehouse:

1. **Currency.** `invoices.net_invoice_value` is in 15 local currencies. Euros = `value ÷ budget_rate.rate × exchange_rate.rate` (`rate_type = 'Monthly Rate'`, matched on the billing date). This matches the budget to within about 1% in 2020 and 2021; summing local currencies does not.
2. **What counts as a sale.** Only `invoice_doc_type.[group] = 'Invoice'`. Returns and warranty credits are negative adjustments.
3. **Time.** The data ends on **21 August 2022**. Left alone, the agent writes `YEAR(GETDATE())` and finds nothing. "This year" = 2022 to date; budget comparisons use complete months (Jan–Jul 2022).

## 2. Choose the tables — fewer is better

Every extra table is another wrong join the agent can choose.

| Agent | Tables (of 14) | Leaves out |
| --- | --- | --- |
| Sales Analyst | invoices, invoice_doc_type, budget, customers, regions, products, budget_rate, exchange_rate (8) | orders, forecast, employees, brands |
| Operations | orders, order_status, order_doc_type, invoices, invoice_doc_type, customers, regions, products, budget_rate, exchange_rate (10) | budget, forecast, employees, brands |
| Planning | forecast, budget, invoices, invoice_doc_type, products, brands, customers, regions, budget_rate, exchange_rate (10) | orders, employees |

## 3a. Build one agent by hand (the Demo 1 path)

1. Workspace → **New item** → **Data agent** → `SpaceParts Sales Analyst (live)`.
2. **Add a data source** → `lh__spaceparts` → tick only the 8 Sales tables.
3. Ask *"What were net sales by region this year?"* and open the **run steps**. It sums `net_invoice_value` across currencies and filters on 2026. Nobody told it.
4. Paste `agents/sales-analyst/instructions.md` into **Agent instructions** and `agents/sales-analyst/datasource-instructions.md` into the data source's **instructions**.
5. Add the example queries from `agents/sales-analyst/fewshots.json`.
6. Ask again. Compare with `expected-answers.md` (S2).
7. **Publish**, with the description from `agent.json`. That description becomes the MCP tool description.

## 3b. Or script all three

```powershell
pip install mssql-python
$env:SQL_SERVER = "<endpoint>.datawarehouse.fabric.microsoft.com"; $env:SQL_DB = "lh__spaceparts"
python validate_fewshots.py           # every example query must PASS
python create_agents.py --workspace-id <ws> --lakehouse-id <lh> --lakehouse-name lh__spaceparts --sql-server $env:SQL_SERVER
```

`create_agents.py` reads the real column types from the SQL endpoint, builds each agent's definition (`Files/Config/...` parts), creates or updates it, publishes it, and writes the MCP URLs to `published-agents.json`.

## 4. Prove it

```powershell
python make_ground_truth.py           # ground_truth_<agent>.csv + expected-answers.md
```

Upload the CSVs to the lakehouse `Files/evaluation/` folder, open `evaluate_agent.ipynb` in Fabric and run it. Each question is asked three times; only questions that pass every repeat go on stage as chips.

When an answer is wrong, open the run steps and fix **one layer**:

| Symptom in the generated SQL | Layer to fix |
| --- | --- |
| Sums `net_invoice_value` as is | Data source instructions + a currency example query |
| `YEAR(GETDATE())`, or `ship_date` for "this year" | Data source instructions: dates |
| Counts returns as sales | Agent instructions: Group = 'Invoice' |
| Joins forecast or orders | Tables: take them out |
| Joins budget to invoices row by row | Data source instructions: aggregate before joining |

## ✅ Checkpoint

`published-agents.json` lists three MCP URLs, and the cold-open question returns exactly:

| Key account | Gap vs budget, Jan–Jul 2022 |
| --- | --- |
| Government Contract | −€104,564,389 (−8.2%) |
| Supernova Spaceparts | −€29,492,648 (−7.9%) |
| Pioneering Systems | −€17,437,957 (−4.8%) |
| Black Flag Spaceships | −€13,126,372 (−4.7%) |
| Sigil Interstellar | −€6,333,494 (−1.8%) |
