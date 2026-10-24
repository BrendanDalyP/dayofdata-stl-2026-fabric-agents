import { entity, date, decimal, int, text, role } from '@microsoft/rayfin-core';
import { Source } from '@microsoft/rayfin-connectors';

// Table app.delivery_by_region: on-time lines, invoice lines and late-delivery penalties (positive euros), region × month, 2022.
@role('authenticated', ['read'])
@entity()
export class DeliveryByRegion extends Source({ schema: 'app', table: 'delivery_by_region', primaryKey: ['rowKey'] }) {
  @text({ column: 'row_key', max: 300 }) rowKey!: string;
  @date({ column: 'month' }) month!: Date;
  @text({ column: 'interplanetary_region', max: 200 }) interplanetaryRegion!: string;
  @int({ column: 'on_time_lines' }) onTimeLines!: number;
  @int({ column: 'invoice_lines' }) invoiceLines!: number;
  @decimal({ column: 'late_penalties_eur', precision: 18, scale: 2 }) latePenaltiesEur!: number;
}
