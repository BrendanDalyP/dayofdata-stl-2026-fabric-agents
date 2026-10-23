// Business rules for the action buttons. They run server-side, so a user can't
// change priorities, due dates or plan maths from the browser.

export type ActionKind = 'follow-up' | 'escalation' | 'recovery-plan' | 'watch';
export type Priority = 'high' | 'medium' | 'low';

export const KINDS: ActionKind[] = ['follow-up', 'escalation', 'recovery-plan', 'watch'];

// The browser sends '-' for "nothing" (the functions runtime rejects empty parameters).
const clean = (s: string | undefined, max: number) => {
  const v = (s ?? '').replace(/[ 	]+/g, ' ').trim().slice(0, max);
  return v === '-' ? '' : v;
};

/** Due date and priority by kind: escalations are urgent, watches are a monthly check-in. */
export function rulesFor(kind: ActionKind, gapPct?: number): { priority: Priority; dueInDays: number } {
  switch (kind) {
    case 'escalation':
      return { priority: 'high', dueInDays: 2 };
    case 'recovery-plan':
      return { priority: gapPct !== undefined && gapPct <= -5 ? 'high' : 'medium', dueInDays: 7 };
    case 'follow-up':
      return { priority: 'medium', dueInDays: 5 };
    case 'watch':
      return { priority: 'low', dueInDays: 30 };
  }
}

export function sanitizeAction(input: {
  kind: string;
  title: string;
  subject?: string;
  detail?: string;
  owner?: string;
  agent?: string;
  sourceQuestion?: string;
}) {
  if (!KINDS.includes(input.kind as ActionKind)) throw new Error(`Unknown action kind "${input.kind}".`);
  const title = clean(input.title, 200);
  if (!title) throw new Error('An action needs a title.');
  return {
    kind: input.kind as ActionKind,
    title,
    subject: clean(input.subject, 200) || undefined,
    detail: clean(input.detail, 4000) || undefined,
    owner: clean(input.owner, 200) || undefined,
    agent: clean(input.agent, 40) || undefined,
    sourceQuestion: clean(input.sourceQuestion, 1000) || undefined,
  };
}

export interface RecoveryPlan {
  subject: string;
  actualYtdEur: number;
  budgetYtdEur: number;
  gapYtdEur: number;
  gapYtdPct: number;
  budgetFullYearEur: number;
  remainingBudgetEur: number;
  requiredRestOfYearEur: number;
  monthsRemaining: number;
  requiredMonthlyEur: number;
  budgetMonthlyEur: number;
  upliftPct: number;
  verdict: 'on track' | 'recoverable' | 'stretch' | 'reset the plan';
  steps: string[];
}

/**
 * What it takes to land the full-year budget: the run-rate needed for the rest of
 * the year against the run-rate the budget assumed.
 */
export function planRecovery(subject: string, actualYtdEur: number, budgetYtdEur: number, budgetFullYearEur: number, monthsRemaining: number): RecoveryPlan {
  const n = (v: number) => (Number.isFinite(v) ? v : 0);
  actualYtdEur = n(actualYtdEur);
  budgetYtdEur = n(budgetYtdEur);
  budgetFullYearEur = n(budgetFullYearEur);
  monthsRemaining = Math.max(1, Math.min(12, Math.round(n(monthsRemaining))));
  if (budgetFullYearEur <= 0 || budgetYtdEur <= 0) throw new Error('A recovery plan needs a budget.');

  const gapYtdEur = actualYtdEur - budgetYtdEur;
  const gapYtdPct = (actualYtdEur / budgetYtdEur - 1) * 100;
  const remainingBudgetEur = budgetFullYearEur - budgetYtdEur;
  const requiredRestOfYearEur = Math.max(0, budgetFullYearEur - actualYtdEur);
  const requiredMonthlyEur = requiredRestOfYearEur / monthsRemaining;
  const budgetMonthlyEur = remainingBudgetEur / monthsRemaining;
  const upliftPct = budgetMonthlyEur > 0 ? (requiredMonthlyEur / budgetMonthlyEur - 1) * 100 : 0;

  const verdict: RecoveryPlan['verdict'] =
    gapYtdEur >= 0 ? 'on track' : upliftPct <= 5 ? 'recoverable' : upliftPct <= 15 ? 'stretch' : 'reset the plan';

  const eur = (v: number) => `€${Math.round(v).toLocaleString('en-US')}`;
  const steps =
    verdict === 'on track'
      ? [`Ahead of budget by ${eur(gapYtdEur)}; protect the run-rate.`, 'Check the backlog and on-time delivery with Operations so the lead holds.']
      : [
          `Lift monthly net sales from ${eur(budgetMonthlyEur)} (budget) to ${eur(requiredMonthlyEur)} for the next ${monthsRemaining} months (+${upliftPct.toFixed(1)}%).`,
          'Ask Operations for open and overdue orders for this account — shipping the backlog is the fastest revenue.',
          'Ask Planning whether the forecast already assumes the shortfall.',
          verdict === 'reset the plan'
            ? 'The uplift is above 15%: agree a re-forecast with the key account manager rather than chase the budget.'
            : 'Agree the plan with the key account manager and review it in the monthly business review.',
        ];

  return {
    subject, actualYtdEur, budgetYtdEur, gapYtdEur, gapYtdPct, budgetFullYearEur, remainingBudgetEur,
    requiredRestOfYearEur, monthsRemaining, requiredMonthlyEur, budgetMonthlyEur, upliftPct, verdict, steps,
  };
}

export function addDays(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
