// Client for a published Microsoft Fabric Data Agent.
//
// Two ways to talk to a published agent are supported, picked from the URL:
//   * MCP     https://api.fabric.microsoft.com/v1/mcp/workspaces/{ws}/dataagents/{id}/agent
//   * Legacy  .../workspaces/{ws}/dataagents/{id}/aiassistant/openai   (OpenAI Assistants-style)
// Microsoft now documents MCP as the way to call an agent; the legacy path is kept because
// existing samples (and some tenants) still use it.

export type AgentAuth =
  | { kind: 'servicePrincipal'; tenantId: string; clientId: string; clientSecret: string }
  | { kind: 'token'; getToken: () => Promise<string> };

export interface AgentReply {
  answer: string;
  /** Opaque state to send back with the next question so the agent keeps context. */
  conversation: string;
  protocol: 'mcp' | 'assistants';
  durationMs: number;
}

interface AskOptions {
  agentUrl: string;
  question: string;
  conversation?: string;
  auth: AgentAuth;
}

const FABRIC_SCOPE = 'https://api.fabric.microsoft.com/.default';
const POWERBI_SCOPE = 'https://analysis.windows.net/powerbi/api/.default';

export async function askDataAgent(opts: AskOptions): Promise<AgentReply> {
  const started = Date.now();
  const url = opts.agentUrl.trim().replace(/\/+$/, '');
  const isLegacy = /\/aiassistant\/openai$/i.test(url);

  const reply = isLegacy
    ? await askAssistants(url, opts.question, opts.conversation, await getToken(opts.auth, POWERBI_SCOPE))
    : await askMcp(url, opts.question, opts.conversation, await getToken(opts.auth, FABRIC_SCOPE));

  return { ...reply, durationMs: Date.now() - started };
}

// ── Auth ─────────────────────────────────────────────────────────────────────

async function getToken(auth: AgentAuth, scope: string): Promise<string> {
  if (auth.kind === 'token') return auth.getToken();

  const res = await fetch(`https://login.microsoftonline.com/${auth.tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: auth.clientId,
      client_secret: auth.clientSecret,
      scope,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, string>;
  if (!res.ok || !body.access_token) {
    throw new Error(`Entra sign-in failed (${res.status}): ${body.error_description ?? body.error ?? 'no token returned'}`);
  }
  return body.access_token;
}

function describeHttpError(status: number, body: string): string {
  if (status === 401) return 'The agent rejected the token (401). Check the app registration credentials.';
  if (status === 403)
    return "Access denied (403). Check: 'Service principals can use Fabric APIs' tenant setting, the identity has workspace access, and Read on each data source.";
  if (status === 404) return 'Agent not found (404). Check the URL and that the agent is published.';
  return `HTTP ${status}: ${body.slice(0, 500)}`;
}

// ── MCP (streamable HTTP, JSON-RPC) ──────────────────────────────────────────

interface McpState {
  p: 'mcp';
  session?: string;
  tool?: string;
  arg?: string;
}

async function askMcp(url: string, question: string, conversation: string | undefined, token: string) {
  const prior = parseState<McpState>(conversation, 'mcp');
  let session = prior?.session;
  let tool = prior?.tool;
  let arg = prior?.arg;
  let nextId = 1;

  const rpc = async (method: string, params?: unknown, notification = false): Promise<any> => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2025-06-18',
    };
    if (session) headers['Mcp-Session-Id'] = session;
    const payload: Record<string, unknown> = { jsonrpc: '2.0', method };
    if (params !== undefined) payload.params = params;
    if (!notification) payload.id = nextId++;

    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
    const sid = res.headers.get('mcp-session-id');
    if (sid) session = sid;
    const text = await res.text();
    if (!res.ok) throw new Error(`MCP ${method} failed. ${describeHttpError(res.status, text)}`);
    if (notification || !text.trim()) return undefined;

    const msg = parseJsonRpc(text, payload.id as number);
    if (msg?.error) throw new Error(`MCP ${method} error: ${msg.error.message ?? JSON.stringify(msg.error)}`);
    return msg?.result;
  };

  const handshake = async () => {
    session = undefined;
    await rpc('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'spaceparts-mission-control', version: '1.0.0' },
    });
    await rpc('notifications/initialized', undefined, true);
    const list = await rpc('tools/list', {});
    const first = list?.tools?.[0];
    if (!first) throw new Error('The agent exposed no MCP tools. Is it published?');
    tool = first.name as string;
    const props = Object.entries((first.inputSchema?.properties ?? {}) as Record<string, { type?: string }>);
    arg = (props.find(([, p]) => p.type === 'string') ?? props[0])?.[0] ?? 'question';
  };

  if (!tool || !arg) await handshake();

  let result: any;
  try {
    result = await rpc('tools/call', { name: tool, arguments: { [arg!]: question } });
  } catch (err) {
    // Sessions expire; retry once with a fresh handshake.
    if (!prior) throw err;
    await handshake();
    result = await rpc('tools/call', { name: tool, arguments: { [arg!]: question } });
  }

  const answer =
    (result?.content ?? [])
      .map((c: { type?: string; text?: string }) => (c.type === 'text' || c.text ? c.text ?? '' : ''))
      .join('\n')
      .trim() ||
    (result?.structuredContent ? JSON.stringify(result.structuredContent, null, 2) : '') ||
    'The agent returned no answer.';

  if (result?.isError) throw new Error(answer);

  const state: McpState = { p: 'mcp', session, tool, arg };
  return { answer, conversation: JSON.stringify(state), protocol: 'mcp' as const };
}

function parseJsonRpc(text: string, id: number): any {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return JSON.parse(trimmed);
  // Server-sent events: take the data line(s) carrying the response for our id.
  let last: any;
  for (const block of trimmed.split(/\r?\n\r?\n/)) {
    const data = block
      .split(/\r?\n/)
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim())
      .join('\n');
    if (!data) continue;
    try {
      const msg = JSON.parse(data);
      if (msg.id === id) return msg;
      last = msg;
    } catch {
      /* ignore keep-alives */
    }
  }
  return last;
}

// ── Legacy Assistants-style endpoint ─────────────────────────────────────────

interface AssistantsState {
  p: 'assistants';
  thread: string;
  assistant: string;
}

const API_VERSION = '2024-05-01-preview';

async function askAssistants(base: string, question: string, conversation: string | undefined, token: string) {
  const u = (path: string) => `${base}${path}${path.includes('?') ? '&' : '?'}api-version=${API_VERSION}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ActivityId: crypto.randomUUID(),
  };
  const call = async (path: string, init: RequestInit, label: string) => {
    const res = await fetch(u(path), { ...init, headers });
    if (!res.ok) throw new Error(`Failed to ${label}. ${describeHttpError(res.status, await res.text())}`);
    return res.json() as Promise<any>;
  };

  const prior = parseState<AssistantsState>(conversation, 'assistants');
  const assistant =
    prior?.assistant ?? (await call('/assistants', { method: 'POST', body: JSON.stringify({ model: 'not used' }) }, 'create assistant')).id;
  const thread = prior?.thread ?? (await call('/threads', { method: 'POST', body: '{}' }, 'create thread')).id;

  await call(`/threads/${thread}/messages`, { method: 'POST', body: JSON.stringify({ role: 'user', content: question }) }, 'add message');
  const run = await call(`/threads/${thread}/runs`, { method: 'POST', body: JSON.stringify({ assistant_id: assistant }) }, 'start run');

  let status: string = run.status;
  const deadline = Date.now() + 180_000;
  while (!['completed', 'failed', 'cancelled', 'expired'].includes(status)) {
    if (Date.now() > deadline) throw new Error('The agent did not answer within 180 seconds.');
    await new Promise((r) => setTimeout(r, 1500));
    status = (await call(`/threads/${thread}/runs/${run.id}`, { method: 'GET' }, 'poll run')).status;
  }
  if (status !== 'completed') throw new Error(`Agent run ended with status "${status}".`);

  const msgs = await call(`/threads/${thread}/messages?order=desc&limit=20`, { method: 'GET' }, 'read answer');
  type Msg = { role: string; run_id?: string; content?: Array<{ text?: { value?: string } }> };
  const list: Msg[] = msgs.data ?? [];
  const msg = list.find((m) => m.role === 'assistant' && m.run_id === run.id) ?? list.find((m) => m.role === 'assistant');
  const answer = msg?.content?.map((c) => c.text?.value ?? '').join('\n').trim() || 'The agent returned no answer.';

  const state: AssistantsState = { p: 'assistants', thread, assistant };
  return { answer, conversation: JSON.stringify(state), protocol: 'assistants' as const };
}

function parseState<T extends { p: string }>(raw: string | undefined, p: T['p']): T | undefined {
  if (!raw) return undefined;
  try {
    const s = JSON.parse(raw) as T;
    return s.p === p ? s : undefined;
  } catch {
    return undefined;
  }
}
