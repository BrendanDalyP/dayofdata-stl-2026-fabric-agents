import { entity, decimal, int, text, role } from '@microsoft/rayfin-core';
import { Source } from '@microsoft/rayfin-connectors';

// Table app.order_backlog: open and overdue order lines and value (euros) by status × region × key account.
@role('authenticated', ['read'])
@entity()
export class OrderBacklog extends Source({ schema: 'app', table: 'order_backlog', primaryKey: ['rowKey'] }) {
  @text({ column: 'row_key', max: 400 }) rowKey!: string;
  @text({ column: 'status_group', max: 50 }) statusGroup!: string;
  @text({ column: 'status_text', max: 50 }) statusText!: string;
  @int({ column: 'status_ordinal' }) statusOrdinal!: number;
  @text({ column: 'interplanetary_region', max: 200 }) interplanetaryRegion!: string;
  @text({ column: 'key_account_name', max: 200 }) keyAccountName!: string;
  @int({ column: 'order_lines' }) orderLines!: number;
  @decimal({ column: 'value_eur', precision: 18, scale: 2 }) valueEur!: number;
}
