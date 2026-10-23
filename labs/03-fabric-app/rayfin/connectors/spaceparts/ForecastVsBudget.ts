import { entity, date, decimal, text, role } from '@microsoft/rayfin-core';
import { Source } from '@microsoft/rayfin-connectors';

// View app.forecast_vs_budget: 2022 forecast and budget in euros by month × product type.
// Read-only; row_key is the logical key (unique, never null).
@role('authenticated', ['read'])
@entity()
export class ForecastVsBudget extends Source({ schema: 'app', table: 'forecast_vs_budget', primaryKey: ['rowKey'] }) {
  @text({ column: 'row_key', max: 200 }) rowKey!: string;
  @date({ column: 'month' }) month!: Date;
  @text({ column: 'product_type', max: 200 }) productType!: string;
  @decimal({ column: 'forecast_eur', precision: 18, scale: 2 }) forecastEur!: number;
  @decimal({ column: 'budget_eur', precision: 18, scale: 2 }) budgetEur!: number;
}
