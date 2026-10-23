import { entity, role, uuid, text, boolean, int, date, set } from '@microsoft/rayfin-core';

/**
 * A question asked of the Data Agent and the answer it gave.
 * Owned by the signed-in user: nobody else can read or change it.
 */
@entity()
@role('authenticated', '*', {
  policy: (claims, item) => claims.sub.eq(item.user_id),
})
export class Insight {
  @uuid() id!: string;
  @set('sales', 'operations', 'planning') agent!: 'sales' | 'operations' | 'planning';
  @text({ min: 1, max: 1000 }) question!: string;
  @text({ max: 4000 }) answer!: string;
  @set('saved', 'pinned') kind!: 'saved' | 'pinned';
  @text({ max: 40, optional: true }) protocol?: string;
  @int({ optional: true }) durationMs?: number;
  @boolean({ default: false }) helpful!: boolean;
  @date() createdAt!: Date;
  @text({ max: 128 }) user_id!: string;
}
