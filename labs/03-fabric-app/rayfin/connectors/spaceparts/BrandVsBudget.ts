import { entity, date, decimal, text, role } from '@microsoft/rayfin-core';
import { Source } from '@microsoft/rayfin-connectors';

// Table app.brand_vs_budget: net sales and budget (euros) by brand × month, 2021–2022.
@role('authenticated', ['read'])
@entity()
export class BrandVsBudget extends Source({ schema: 'app', table: 'brand_vs_budget', primaryKey: ['rowKey'] }) {
  @text({ column: 'row_key', max: 300 }) rowKey!: string;
  @date({ column: 'month' }) month!: Date;
  @text({ column: 'brand', max: 200 }) brand!: string;
  @text({ column: 'brand_class', max: 200 }) brandClass!: string;
  @decimal({ column: 'actual_eur', precision: 18, scale: 2 }) actualEur!: number;
  @decimal({ column: 'budget_eur', precision: 18, scale: 2 }) budgetEur!: number;
}
