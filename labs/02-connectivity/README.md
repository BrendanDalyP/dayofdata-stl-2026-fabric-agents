# Lab 02 — Call the agents over MCP

**Goal:** call each published data agent from a script over its **MCP endpoint**. That endpoint is the whole integration surface: anything that speaks MCP — a script, VS Code, your app's backend — can use the agent team.

**Time:** 20 minutes.

## 1. The endpoint

Each published agent is an MCP server:

```
https://api.fabric.microsoft.com/v1/mcp/workspaces/{workspaceId}/dataagents/{agentId}/agent
```

Streamable HTTP, a bearer token for scope `https://api.fabric.microsoft.com/.default`, and a real MCP exchange: **initialize → initialized → list tools → call the tool**. There is exactly one tool, named after the agent and described by the text you typed at publish. A plain HTTP POST that skips the handshake won't work.

## 2. Ask as yourself

```powershell
pip install -r requirements.txt
az login --tenant <your-tenant>
python test_agent_mcp.py "Which key accounts are furthest behind budget this year?"
python test_agent_mcp.py --agent operations "What is the open order backlog in euros by order status?"
python test_agent_mcp.py --agent planning "How does the 2022 forecast compare with the 2022 budget by product type?"
```

Agent URLs come from `../01-data-agent/published-agents.json`. Expect 30–60 seconds per answer.

## 3. What the script does

`test_agent_mcp.py` is the whole protocol: get a token for `https://api.fabric.microsoft.com/.default`, open a streamable-HTTP MCP session, `initialize`, list the tools (there is one — the agent), call it with the question, print the text. The agent's answer is markdown text and tables; the endpoint keeps no conversation state, so each question stands alone. The Rayfin function in Lab 03 (`data-agent.ts`) is the same four messages in TypeScript.

## 4. Identity

The script asks as **you** (`az login`). The Lab 03 app asks as **itself** — the Rayfin app identity (`ctx.Tokens.Fabric`, the owner of the app item) — so there is no app registration and no secret to manage. (A service principal can also call the endpoint; it isn't covered here.)

## ✅ Checkpoint

`test_agent_mcp.py` answers all three agents as you.
