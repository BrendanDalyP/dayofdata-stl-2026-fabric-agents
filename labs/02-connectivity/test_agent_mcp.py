"""Ask a published Fabric data agent a question over MCP, from outside Fabric.

    python test_agent_mcp.py "What were net sales in euros this year?"
    python test_agent_mcp.py --agent operations "What is the open order backlog in euros by order status?"

Identity:
  * AGENT_TENANT_ID, AGENT_CLIENT_ID and AGENT_CLIENT_SECRET set (in .env or the environment)
    → the app registration (service principal).
  * otherwise → your `az login` (a user).

Agent URLs come from ../01-data-agent/published-agents.json (written by create_agents.py),
or pass --url.

It's an MCP exchange, not a REST call: initialize → (initialized) → list tools → call the one tool.
The script finds the tool name and its argument at runtime, so renaming the agent doesn't break it.
"""
from __future__ import annotations

import argparse, asyncio, json, os, pathlib, sys, time

from azure.identity import AzureCliCredential, ClientSecretCredential
from mcp import ClientSession
import mcp.client.streamable_http as mcp_http

SCOPE = "https://api.fabric.microsoft.com/.default"


def open_transport(url: str, headers: dict[str, str]):
    """Streamable HTTP transport for mcp 1.x and 2.x (the client API changed between them)."""
    if hasattr(mcp_http, "streamable_http_client"):  # mcp >= 2: pass a configured HTTP client
        client = mcp_http.create_mcp_http_client(headers=headers)
        client.timeout = type(client.timeout)(300.0)  # agents can take a minute
        return mcp_http.streamable_http_client(url, http_client=client)
    return mcp_http.streamablehttp_client(url, headers=headers, timeout=60, sse_read_timeout=300)
HERE = pathlib.Path(__file__).parent


def load_dotenv(path: pathlib.Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def get_token() -> tuple[str, str]:
    tenant, client, secret = (os.environ.get(k) for k in ("AGENT_TENANT_ID", "AGENT_CLIENT_ID", "AGENT_CLIENT_SECRET"))
    if tenant and client and secret:
        return ClientSecretCredential(tenant, client, secret).get_token(SCOPE).token, f"service principal {client[:4]}…"
    return AzureCliCredential().get_token(SCOPE).token, "user (az login)"


async def ask(url: str, question: str) -> None:
    token, who = get_token()
    print(f"Asking as {who}")
    started = time.time()
    async with open_transport(url, {"Authorization": f"Bearer {token}"}) as streams:
        async with ClientSession(streams[0], streams[1]) as session:
            await session.initialize()                      # initialize + initialized
            tools = (await session.list_tools()).tools        # exactly one: the agent
            tool = tools[0]
            props = (tool.inputSchema or {}).get("properties", {})
            arg = next((k for k, v in props.items() if v.get("type") == "string"), next(iter(props), "question"))
            print(f"→ tool: {tool.name}  (argument: {arg})")
            result = await session.call_tool(tool.name, {arg: question})
    text = "\n".join(c.text for c in result.content if getattr(c, "text", None))
    print(f"\n{text}\n\n({time.time() - started:.1f} s)")
    if result.isError:
        sys.exit(1)


def main() -> None:
    load_dotenv(HERE / ".env")
    p = argparse.ArgumentParser()
    p.add_argument("question")
    p.add_argument("--agent", default="sales-analyst", help="key in published-agents.json")
    p.add_argument("--url", help="MCP URL (overrides --agent)")
    args = p.parse_args()

    url = args.url
    if not url:
        published = json.loads((HERE.parent / "01-data-agent" / "published-agents.json").read_text(encoding="utf-8"))
        url = published[args.agent]["mcpUrl"]
    try:
        asyncio.run(ask(url, args.question))
    except Exception as e:  # noqa: BLE001
        while isinstance(e, BaseExceptionGroup) and e.exceptions:  # unwrap anyio task groups
            e = e.exceptions[0]
        msg = str(e)
        print(f"\n✗ {type(e).__name__}: {msg[:600]}")
        if "401" in msg:
            print("  401: the token was rejected. Check tenant, client ID and secret.")
        elif "403" in msg:
            print("  403: not allowed in yet. Check the tenant setting 'Service principals can use Fabric APIs',\n"
                  "  give the identity Contributor on the workspace, and Read on the lakehouse.")
        elif "404" in msg:
            print("  404: wrong URL, or the agent isn't published.")
        sys.exit(1)


if __name__ == "__main__":
    main()
