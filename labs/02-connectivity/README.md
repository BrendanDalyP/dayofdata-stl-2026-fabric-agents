# Lab 02 — Connecting to the agent from outside Fabric

**Goal:** call a published data agent from a script over MCP, first as you, then as an app registration (service principal).

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
az login
python test_agent_mcp.py "Which key accounts are furthest behind budget this year?"
python test_agent_mcp.py --agent operations "What is the open order backlog in euros by order status?"
python test_agent_mcp.py --agent planning "How does the 2022 forecast compare with the 2022 budget by product type?"
```

Agent URLs come from `../01-data-agent/published-agents.json`. Expect 30–60 seconds per answer.

## 3. Now as an app: the app registration

### Which identity calls the agent?

The agent answers with the permissions of **whoever calls it**. Pick one on purpose:

| Option | Who the agent "is" | Good for | Watch out |
| --- | --- | --- | --- |
| **App registration (service principal)** — this lab | The app | One shared, governed view of the data; no per-user Fabric licence prompts | Everyone sees what the app can see. Scope its data access tightly. |
| **Rayfin app identity** (`ctx.Tokens.Fabric`) | The owner of the Rayfin item | Fastest demo — nothing to register | Uses the item owner's permissions. Fine for a demo, not for production. |
| **Delegated user** (on-behalf-of) | The signed-in user | Row-level security in the source applies per user | More moving parts; each user needs access to the agent and data |

> Microsoft's documentation is inconsistent about service-principal support when *querying* agents. Test it in your tenant early, and keep the app-identity fallback ready (the Rayfin function in this repo falls back automatically).

### 3.1 Register the app

1. Entra admin center → **App registrations** → **New registration**.
2. Name: `spaceparts-mission-control-agent`. Single tenant. No redirect URI.
3. Copy the **Application (client) ID** and **Directory (tenant) ID**.
4. **Certificates & secrets** → **New client secret** (expiry: 30 days for a demo). Copy the **value** now — you can't see it again.

No API permissions are needed: Fabric checks **workspace roles**, not consented scopes, for service principals.

### 3.2 Allow service principals to use Fabric

Fabric admin portal → Tenant settings → **Service principals can use Fabric APIs** → enabled for a security group that contains the app (recommended) or the whole org.

### 3.3 Give the app access

In the workspace that holds the agent and the lakehouse:

1. **Manage access** → **Add people or groups** → search for the app name.
2. Role: **Contributor** (Member also works). Viewer is not enough to call the agent.
3. If the lakehouse lives in a different workspace, give the app **Read** on the lakehouse item (Share → Read all SQL endpoint data).

### 3.4 Run the same script as the service principal

Create `.env` next to the script (it's git-ignored):

```
AGENT_TENANT_ID=<tenant-id>
AGENT_CLIENT_ID=<client-id>
AGENT_CLIENT_SECRET=<secret>
```

Run the script again. Before step 3.3 you should see a 403 with a hint; after it, the same answer. That's the identity working.

Or smoke-test the token by hand:

```powershell
$body = @{
  grant_type    = 'client_credentials'
  client_id     = '<client-id>'
  client_secret = '<secret>'
  scope         = 'https://api.fabric.microsoft.com/.default'
}
$t = (Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/<tenant-id>/oauth2/v2.0/token" -Body $body).access_token
Invoke-RestMethod -Headers @{ Authorization = "Bearer $t" } -Uri "https://api.fabric.microsoft.com/v1/workspaces/<workspace-id>/dataAgents"
```

A list containing your agent means the app can see it.

| Error | Meaning |
| --- | --- |
| `401` | Wrong tenant, client ID or secret |
| `403` / `PrincipalTypeNotSupported` | Tenant setting off, app not in the allowed group, or no workspace role |
| `404` | Wrong workspace ID, or the agent is not published |

## 4. Hand the secrets to the app (never the browser)

These go into the **Rayfin function's secret store**, not into frontend code or the repo:

```bash
cd app
npx rayfin secret set AGENT_TENANT_ID
npx rayfin secret set AGENT_CLIENT_ID
npx rayfin secret set AGENT_CLIENT_SECRET
```

(`rayfin secret` needs the app deployed once — Lab 03 does that. The agent URLs aren't secrets; they live in `labs/03-fabric-app/rayfin/functions/src/agents.ts`. Without the three `AGENT_*` secrets the function uses Rayfin's app identity, the owner of the app item.)

## ✅ Checkpoint

`test_agent_mcp.py` answers as `service principal …`.
