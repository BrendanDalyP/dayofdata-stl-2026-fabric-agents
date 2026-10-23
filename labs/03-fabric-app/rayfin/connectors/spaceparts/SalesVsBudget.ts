import { entity, date, decimal, text, role } from '@microsoft/rayfin-core';
import { Source } from '@microsoft/rayfin-connectors';

// View app.sales_vs_budget (labs/03-fabric-app/sql/app_views.sql): net sales and budget
// in euros by month × interplanetary region × key account, 2021 onwards. Read-only; row_key is the logical key (unique, never null).
@role('authenticated', ['read'])
@entity()
export class SalesVsBudget extends Source({ schema: 'app', table: 'sales_vs_budget', primaryKey: ['rowKey'] }) {
  @text({ column: 'row_key', max: 400 }) rowKey!: string;
  @date({ column: 'month' }) month!: Date;
  @text({ column: 'interplanetary_region', max: 200 }) interplanetaryRegion!: string;
  @text({ column: 'key_account_name', max: 200 }) keyAccountName!: string;
  @decimal({ column: 'net_sales_eur', precision: 18, scale: 2 }) netSalesEur!: number;
  @decimal({ column: 'budget_eur', precision: 18, scale: 2 }) budgetEur!: number;
}
