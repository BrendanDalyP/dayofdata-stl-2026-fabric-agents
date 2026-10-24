// Ask a published Fabric data agent one question over MCP, from Node 20+ with no dependencies.
// The same four messages the Fabric app's askDataAgent function sends
// (labs/03-fabric-app/rayfin/functions/src/data-agent.ts has the full version).
//
//   az login
//   node ask-agent.mjs "<agent MCP URL>" "Which key accounts are furthest behind budget this year?"
//
// The MCP URL is in labs/01-data-agent/published-agents.json, or on the agent's
// Settings → "Model Context Protocol" page in Fabric. You need access to the agent
// and Read on its data sources; the agent queries as you.

import { execSync } from "node:child_process";

const [url, question] = process.argv.slice(2);
if (!url || !question) {
  console.error('Usage: node ask-agent.mjs "<agent MCP URL>" "<question>"');
  process.exit(1);
}

// A Fabric API token for whoever ran `az login`. In a server, use your platform's
// managed identity or the Fabric app's ctx.Tokens.Fabric instead; never send it to a browser.
const token = execSync(
  "az account get-access-token --resource https://api.fabric.microsoft.com --query accessToken -o tsv",
  { encoding: "utf8" },
).trim();

let session;
let id = 0;

async function rpc(method, params, notification = false) {
  const body = { jsonrpc: "2.0", method, ...(params ? { params } : {}), ...(notification ? {} : { id: ++id }) };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-06-18",
      ...(session ? { "Mcp-Session-Id": session } : {}),
    },
    body: JSON.stringify(body),
  });
  session = res.headers.get("mcp-session-id") ?? session;
  const text = await res.text();
  if (!res.ok) throw new Error(`${method}: HTTP ${res.status} ${text.slice(0, 300)}`);
  if (notification || !text.trim()) return undefined;
  // The reply is plain JSON or a server-sent event ("data: {...}").
  const json = text.trim().startsWith("{")
    ? JSON.parse(text)
    : JSON.parse(text.split(/\r?\n/).filter((l) => l.startsWith("data:")).map((l) => l.slice(5)).join(""));
  if (json.error) throw new Error(`${method}: ${json.error.message}`);
  return json.result;
}

const started = Date.now();
await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "ask-agent", version: "1.0.0" } });
await rpc("notifications/initialized", undefined, true);
const { tools } = await rpc("tools/list", {});
const tool = tools[0]; // one tool per agent, named after it
const arg = Object.keys(tool.inputSchema?.properties ?? { question: {} })[0];
console.log(`Tool: ${tool.name}\n`);

const result = await rpc("tools/call", { name: tool.name, arguments: { [arg]: question } });
console.log(result.content.map((c) => c.text ?? "").join("\n"));
console.log(`\n(${((Date.now() - started) / 1000).toFixed(1)} s)`);
