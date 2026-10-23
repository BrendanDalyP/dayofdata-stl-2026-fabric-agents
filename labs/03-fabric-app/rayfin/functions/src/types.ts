/**
 * Function schema types for RayfinClient.
 *
 * Export a single schema type that maps each function name to its
 * input/output type pair.  Import this from your frontend app when
 * constructing RayfinClient so invocations are fully type-checked.
 *
 * The schema is a closed object type: only the function names listed
 * below are accepted by `client.functions.<name>.invoke(...)`.  This file
 * is regenerated automatically by `rayfin dev functions apply` whenever
 * `udf.func()` registrations change.
 *
 * IMPORTANT: This file must NOT import any Node.js packages — it is
 * resolved by the frontend app's TypeScript compiler.
 */

export type RecoveryPlanResult = {
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
  actionId: string;
};

export type AppFunctionsSchema = {
  askDataAgent: {
    input: { agent: string; question: string; conversation: string };
    output: {
      agent: string;
      agentName: string;
      answer: string;
      conversation: string;
      protocol: 'mcp' | 'assistants';
      identity: 'service principal' | 'app identity';
      elapsedMs: number;
    };
  };
  createAction: {
    input: { kind: string; title: string; subject: string; detail: string; agent: string; sourceQuestion: string };
    output: { id: string; title: string; priority: string; dueDate: string };
  };
  buildRecoveryPlan: {
    input: { subject: string; actualYtdEur: number; budgetYtdEur: number; budgetFullYearEur: number; monthsRemaining: number; agent: string };
    output: RecoveryPlanResult;
  };
  setActionStatus: {
    input: { id: string; status: string };
    output: string;
  };
};
