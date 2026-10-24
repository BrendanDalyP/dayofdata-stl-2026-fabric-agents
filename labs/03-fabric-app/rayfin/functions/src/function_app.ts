import {
  UserDataFunctions,
  AudienceType,
  type RayfinContext,
} from '@microsoft/fabric-user-data-functions';

import { askDataAgent, type AgentAuth } from './data-agent.js';
import { AGENTS, isAgentKey } from './agents.js';
import { addDays, planRecovery as computePlan, rulesFor, sanitizeAction, type RecoveryPlan } from './actions.js';

const udf = new UserDataFunctions();

// The app's own data, as the functions see it (structural copy of rayfin/data/ActionItem.ts).
interface ActionRow {
  id: string;
  kind: 'follow-up' | 'escalation' | 'recovery-plan' | 'watch';
  status: 'open' | 'done';
  title: string;
  subject?: string;
  detail?: string;
  owner?: string;
  priority: 'high' | 'medium' | 'low';
  amountEur?: number;
  dueDate?: Date | string;
  agent?: string;
  sourceQuestion?: string;
  createdAt: Date | string;
}
type AppSchema = { ActionItem: ActionRow };

export interface TeamReply {
  agent: string;
  agentName: string;
  answer: string;
  /** Opaque state to send back with the next question to the same agent. */
  conversation: string;
  protocol: 'mcp' | 'assistants';
  /** The identity the agent ran the query as: the Rayfin app (the app item's owner). */
  identity: 'app identity';
  elapsedMs: number;
}

// NOTE: the context parameter must be annotated as RayfinContext<…> right here, not through a
// type alias — typegen finds the injected context by that annotation. With an alias it is
// treated as a request parameter and every call fails with "MissingInput".

/**
 * Ask one agent of the team a question. The browser sends only the question;
 * the URL, the token and any secret stay on the server. It returns the answer, never the token.
 */
udf.func(
  'askDataAgent',
  async (agent: string, question: string, conversation: string, ctx: RayfinContext<AppSchema, AudienceType.Fabric>): Promise<TeamReply> => {
    if (!isAgentKey(agent)) throw new Error(`Unknown agent "${agent}".`);
    const q = (question ?? '').trim();
    if (!q) throw new Error('Ask a question.');
    if (q.length > 1000) throw new Error('Keep questions under 1,000 characters.');

    // The app calls the agent as itself: a Fabric token for the Rayfin app identity.
    // No app registration, no secrets.
    const auth: AgentAuth = { getToken: async () => ctx.Tokens.Fabric };
    const state = conversation && conversation !== '-' ? conversation : undefined;
    const reply = await askDataAgent({ agentUrl: AGENTS[agent].url, question: q, conversation: state, auth });

    return {
      agent,
      agentName: AGENTS[agent].name,
      answer: reply.answer,
      conversation: reply.conversation,
      protocol: reply.protocol,
      identity: 'app identity',
      elapsedMs: reply.durationMs,
    };
  },
  [],
);

/**
 * Turn an agent answer into a tracked action (follow-up, escalation or watch).
 * Priority and due date come from the server-side rules, not the browser.
 */
udf.func(
  'createAction',
  async (
    kind: string,
    title: string,
    subject: string,
    detail: string,
    agent: string,
    sourceQuestion: string,
    ctx: RayfinContext<AppSchema, AudienceType.Fabric>,
  ): Promise<{ id: string; title: string; priority: string; dueDate: string }> => {
    const a = sanitizeAction({ kind, title, subject, detail, agent, sourceQuestion });
    if (a.kind === 'recovery-plan') throw new Error('Use buildRecoveryPlan for recovery plans.');
    const rule = rulesFor(a.kind);
    const due = addDays(rule.dueInDays);
    const owner = a.subject ? `Key account manager · ${a.subject}` : 'Sales operations';
    const created = await ctx.getDataClient().ActionItem.create({
      ...a,
      owner,
      status: 'open',
      priority: rule.priority,
      dueDate: due,
      createdAt: new Date(),
    });
    return { id: (created as ActionRow).id, title: a.title, priority: rule.priority, dueDate: due.toISOString() };
  },
  [],
);

/**
 * What it takes to land the full-year budget for an account or region, saved to the
 * action board as a recovery plan.
 */
udf.func(
  'buildRecoveryPlan',
  async (
    subject: string,
    actualYtdEur: number,
    budgetYtdEur: number,
    budgetFullYearEur: number,
    monthsRemaining: number,
    agent: string,
    ctx: RayfinContext<AppSchema, AudienceType.Fabric>,
  ): Promise<RecoveryPlan & { actionId: string }> => {
    const name = (subject ?? '').trim().slice(0, 200);
    if (!name) throw new Error('A recovery plan needs an account or region.');
    const plan = computePlan(name, Number(actualYtdEur), Number(budgetYtdEur), Number(budgetFullYearEur), Number(monthsRemaining));
    const rule = rulesFor('recovery-plan', plan.gapYtdPct);
    const created = await ctx.getDataClient().ActionItem.create({
      kind: 'recovery-plan',
      status: 'open',
      title: `Recovery plan · ${name} (${plan.verdict})`,
      subject: name,
      detail: plan.steps.join('\n'),
      owner: `Key account manager · ${name}`,
      priority: rule.priority,
      amountEur: Math.round(plan.requiredRestOfYearEur * 100) / 100,
      dueDate: addDays(rule.dueInDays),
      agent: (agent ?? '').slice(0, 40) || 'sales',
      createdAt: new Date(),
    });
    return { ...plan, actionId: (created as ActionRow).id };
  },
  [],
);

/** Mark an action done (or reopen it). */
udf.func(
  'setActionStatus',
  async (id: string, status: string, ctx: RayfinContext<AppSchema, AudienceType.Fabric>): Promise<string> => {
    if (status !== 'open' && status !== 'done') throw new Error('Status must be open or done.');
    if (!/^[0-9a-fA-F-]{36}$/.test(id ?? '')) throw new Error('Unknown action.');
    await ctx.getDataClient().ActionItem.update({ id }, { status });
    return status;
  },
  [],
);
