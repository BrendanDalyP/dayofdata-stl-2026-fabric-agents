# Rethinking Embedded Analytics with Fabric data agents

Labs and code from **Day of Data St. Louis 2026** (Brendan Daly & Abby Yang): build a team of Microsoft Fabric data agents, connect to them from outside Fabric over MCP, and host them beside live analytics in a Fabric app built with Rayfin.

```
SpaceParts lakehouse ──▶ 3 data agents (Sales Analyst · Operations · Planning) ──▶ MCP endpoints
        │                                                                              │
        └──▶ Rayfin lakehouse connector ──▶ Overview charts        Rayfin function askDataAgent
                                                    └────────── one Fabric app ──────────┘
```

| Lab | You build | Time |
| --- | --- | --- |
| [00 · Prerequisites](labs/00-prereqs.md) | Capacity, tenant settings, tools, the SpaceParts data | 15 min |
| [01 · Data agents](labs/01-data-agent/README.md) | Three agents with scoped tables, instructions and example queries, checked against SQL and evaluated with the SDK | 45 min |
| [02 · Connectivity](labs/02-connectivity/README.md) | An MCP client in Python, first as you, then as an app registration | 20 min |
| [03 · Fabric app](labs/03-fabric-app/README.md) | A Rayfin app: live charts through a lakehouse connector, the agent team through a server-side function, saved insights in the app's own database | 40 min |

## What makes the agents right

SpaceParts invoices in 15 local currencies and reports in euros, and the data ends on 21 Aug 2022. The agents are told, and shown with example queries:

- **euros** = `net_invoice_value ÷ budget_rate.rate × exchange_rate.rate` (monthly rate on the billing date);
- **net sales** = real invoices only (`invoice_doc_type.group = 'Invoice'`), filtered on `billing_date`;
- **"this year"** = 2022 to date; budget comparisons use complete months (Jan–Jul 2022).

Every demo answer is checked against [`labs/01-data-agent/verify_answers.sql`](labs/01-data-agent/verify_answers.sql); the results are in [`expected-answers.md`](labs/01-data-agent/expected-answers.md).

## Reference deployment

| Item | Where |
| --- | --- |
| Workspace | Fabric Demos (`aa68b708-…`) |
| Lakehouse | `lh__spaceparts`, schema `SpaceParts`; app tables in schema `app` |
| Agents | SpaceParts Sales Analyst · SpaceParts Operations · SpaceParts Planning (`labs/01-data-agent/published-agents.json`) |
| App | `spaceparts-mission-control` → <https://keen-blaze-6f617cb0d9-northcentralus.webapp.fabricapps.net> |

## Repo layout

```
labs/
  00-prereqs.md
  01-data-agent/      agents/<name>/, verify_answers.sql, create_agents.py, evaluate_agent.ipynb …
  02-connectivity/    test_agent_mcp.py, requirements.txt
  03-fabric-app/      the Rayfin app (rayfin/, src/, fabric/)
scripts/discover.ps1  find workspaces, lakehouses and tables
```

## Status of the pieces (October 2026)

- **Fabric data agents:** generally available. The agent's **MCP endpoint** is the supported way to call it from code. Older samples use the OpenAI Assistants-style endpoint, which Microsoft now steers away from.
- **Calling an agent as a service principal:** Microsoft's pages disagree, so test it in your tenant (Lab 02). The app falls back to Rayfin's app identity.
- **Fabric Apps / Rayfin:** preview. Re-check commands against the docs before you build.

## Credits

SpaceParts Co. is **Tabular Editor's** sample dataset, used with thanks. Check Tabular Editor's terms before reusing the dataset elsewhere.
