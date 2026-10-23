import { entity, role, uuid, text, date, set, decimal } from '@microsoft/rayfin-core';

/**
 * The team's action board: follow-ups, escalations, recovery plans and watches
 * created from agent answers. Shared by everyone who can open the app, and written
 * by the Rayfin functions in rayfin/functions/src/actions.ts (business rules live there).
 */
// Functions write to the app database as the calling user, so users need 'create'.
// Updates are limited to the status field: priority, due date, owner and amounts can
// only be set at creation, by the server-side rules in createAction / buildRecoveryPlan.
// (A user could still create rows directly through the GraphQL API; a functions-only
// role would close that, but Rayfin functions don't have a separate identity for the app DB.)
@entity()
@role('authenticated', ['read', 'create'])
@role('authenticated', 'update', { include: ['status'] })
export class ActionItem {
  @uuid() id!: string;
  @set('follow-up', 'escalation', 'recovery-plan', 'watch') kind!: 'follow-up' | 'escalation' | 'recovery-plan' | 'watch';
  @set('open', 'done') status!: 'open' | 'done';
  @text({ min: 1, max: 200 }) title!: string;
  @text({ max: 200, optional: true }) subject?: string;
  @text({ max: 4000, optional: true }) detail?: string;
  @text({ max: 200, optional: true }) owner?: string;
  @set('high', 'medium', 'low') priority!: 'high' | 'medium' | 'low';
  @decimal({ precision: 18, scale: 2, optional: true }) amountEur?: number;
  @date({ optional: true }) dueDate?: Date;
  @text({ max: 40, optional: true }) agent?: string;
  @text({ max: 1000, optional: true }) sourceQuestion?: string;
  @date() createdAt!: Date;
}
