# Ways to call and embed a data agent

A published Fabric data agent has an **MCP endpoint**:

```
https://api.fabric.microsoft.com/v1/mcp/workspaces/<workspace id>/dataagents/<agent id>/agent
```

Anything that can send four JSON-RPC messages with a bearer token for `https://api.fabric.microsoft.com` can ask it a question: `initialize` → `notifications/initialized` → `tools/list` (one tool, named after the agent) → `tools/call` with the question. Each call stands alone; the agent keeps no conversation.

The real decision is **whose identity asks**, because the agent queries the data with that identity's permissions.

| Way | Who asks | Good for | Here |
| --- | --- | --- | --- |
| **Script, Python** | You (`az login`) | Testing an agent; batch questions | [`labs/02-connectivity/test_agent_mcp.py`](../../labs/02-connectivity/test_agent_mcp.py) |
| **Script, Node** (no dependencies) | You (`az login`) | The protocol in 60 lines; a starting point for a backend | [`ask-agent.mjs`](ask-agent.mjs) |
| **Coding assistant** (VS Code, any MCP client) | You (a pasted token) | Asking the agent from your editor or chat client | [`vscode-mcp.json`](vscode-mcp.json) |
| **Fabric app function** (Rayfin) | The app (`ctx.Tokens.Fabric`) | An app with charts and actions around the answers; no app registration, no secrets | [`labs/03-fabric-app`](../../labs/03-fabric-app/README.md), `rayfin/functions/src/function_app.ts` |
| **Your own backend** | A managed identity or service principal | Embedding in an existing site or product | Same calls as `ask-agent.mjs`; keep the token server-side |
| **Fabric portal** | The signed-in user | People who work in Fabric already | Share the agent; nothing to build |

## Rules that hold for every way

- **Never put the token in a browser.** Ask from a server or function and send back only the answer.
- **The asking identity needs** access to the agent and Read on each of its data sources. An app identity answers every user with the same permissions, so scope the agent's tables to what every user may see, or use one agent per audience.
- **Answers take 10–60 seconds.** Show a pending state; Rayfin functions stop at 240 s.
- **Answers come back as markdown text and tables**, not charts. Draw your own: see [`../response-formatting`](../response-formatting/README.md) and [`../charts`](../charts/README.md).
- **Older samples use the Assistants-style endpoint** (`.../aiassistant/openai`, threads and runs). Microsoft now points to MCP; new code should use it.

## VS Code

Copy `vscode-mcp.json` to `.vscode/mcp.json` in a project, fill in the URL, and start the server from the MCP view. VS Code asks for the token once per session; get one with:

```bash
az account get-access-token --resource https://api.fabric.microsoft.com --query accessToken -o tsv
```

Tokens last about an hour. Any MCP client that supports streamable HTTP with custom headers can use the same URL and header.
