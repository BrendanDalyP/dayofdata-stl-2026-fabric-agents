import { entity, date, decimal, int, text, role } from '@microsoft/rayfin-core';
import { Source } from '@microsoft/rayfin-connectors';

// View app.delivery_by_month: on-time invoice lines, all invoice lines and late-delivery
// penalties (positive euros) by month, 2021 onwards. Read-only; row_key is the logical key (unique, never null).
@role('authenticated', ['read'])
@entity()
export class DeliveryByMonth extends Source({ schema: 'app', table: 'delivery_by_month', primaryKey: ['rowKey'] }) {
  @text({ column: 'row_key', max: 20 }) rowKey!: string;
  @date({ column: 'month' }) month!: Date;
  @int({ column: 'on_time_lines' }) onTimeLines!: number;
  @int({ column: 'invoice_lines' }) invoiceLines!: number;
  @decimal({ column: 'late_penalties_eur', precision: 18, scale: 2 }) latePenaltiesEur!: number;
}
