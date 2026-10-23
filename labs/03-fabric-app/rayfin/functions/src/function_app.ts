import {
  UserDataFunctions,
  AudienceType,
  type RayfinContext,
} from '@microsoft/fabric-user-data-functions';

import { askDataAgent, type AgentAuth } from './data-agent.js';
import { AGENTS, isAgentKey } from './agents.js';

const udf = new UserDataFunctions();

type AgentContext = RayfinContext<Record<string, any>, AudienceType.Fabric>;

export interface TeamReply {
  agent: string;
  agentName: string;
  answer: string;
  /** Opaque state to send back with the next question to the same agent. */
  conversation: string;
  protocol: 'mcp' | 'assistants';
  /** Which identity the agent ran the query as. */
  identity: 'service principal' | 'app identity';
  elapsedMs: number;
}

/** Reads an optional secret (`npx rayfin secret set <NAME>`; falls back to process.env locally). */
function optionalSecret(ctx: AgentContext, name: string): string | undefined {
  try {
    const value = (ctx.Secrets as unknown as Record<string, string | undefined>)[name];
    return value?.trim() || undefined;
  } catch {
    return process.env[name]?.trim() || undefined;
  }
}

/**
 * Two ways to get a token. Choose on purpose:
 *  - AGENT_TENANT_ID + AGENT_CLIENT_ID + AGENT_CLIENT_SECRET set → the app registration
 *    (service principal) from Lab 02. Sees only what you granted it.
 *  - otherwise → the Rayfin app identity (ctx.Tokens.Fabric), i.e. the owner of the app item.
 */
function getFabricAuth(ctx: AgentContext): { auth: AgentAuth; identity: TeamReply['identity'] } {
  const tenantId = optionalSecret(ctx, 'AGENT_TENANT_ID');
  const clientId = optionalSecret(ctx, 'AGENT_CLIENT_ID');
  const clientSecret = optionalSecret(ctx, 'AGENT_CLIENT_SECRET');
  if (tenantId && clientId && clientSecret) {
    return { auth: { kind: 'servicePrincipal', tenantId, clientId, clientSecret }, identity: 'service principal' };
  }
  return { auth: { kind: 'token', getToken: async () => ctx.Tokens.Fabric }, identity: 'app identity' };
}

/**
 * Ask one agent of the team a question. The browser sends only the question;
 * the URL, the token and any secret stay on the server. It returns the answer, never the token.
 */
udf.func(
  'askDataAgent',
  async (agent: string, question: string, conversation: string, ctx: AgentContext): Promise<TeamReply> => {
    if (!isAgentKey(agent)) throw new Error(`Unknown agent "${agent}".`);
    const q = (question ?? '').trim();
    if (!q) throw new Error('Ask a question.');
    if (q.length > 1000) throw new Error('Keep questions under 1,000 characters.');

    const { auth, identity } = getFabricAuth(ctx);
    const reply = await askDataAgent({ agentUrl: AGENTS[agent].url, question: q, conversation: conversation || undefined, auth });

    return {
      agent,
      agentName: AGENTS[agent].name,
      answer: reply.answer,
      conversation: reply.conversation,
      protocol: reply.protocol,
      identity,
      elapsedMs: reply.durationMs,
    };
  },
  [],
);
