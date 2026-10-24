import { entity, decimal, text, role } from '@microsoft/rayfin-core';
import { Source } from '@microsoft/rayfin-connectors';

// Table app.cancellations_by_type: 2022 order value cancelled and ordered (euros) by product type.
@role('authenticated', ['read'])
@entity()
export class CancellationsByType extends Source({ schema: 'app', table: 'cancellations_by_type', primaryKey: ['rowKey'] }) {
  @text({ column: 'row_key', max: 200 }) rowKey!: string;
  @text({ column: 'product_type', max: 200 }) productType!: string;
  @decimal({ column: 'cancelled_eur', precision: 18, scale: 2 }) cancelledEur!: number;
  @decimal({ column: 'ordered_eur', precision: 18, scale: 2 }) orderedEur!: number;
}
