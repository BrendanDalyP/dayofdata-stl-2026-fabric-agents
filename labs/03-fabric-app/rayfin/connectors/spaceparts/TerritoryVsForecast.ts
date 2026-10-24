import { entity, date, decimal, text, role } from '@microsoft/rayfin-core';
import { Source } from '@microsoft/rayfin-connectors';

// Table app.territory_vs_forecast: 2022 forecast and actual net sales (euros) by territory × month.
@role('authenticated', ['read'])
@entity()
export class TerritoryVsForecast extends Source({ schema: 'app', table: 'territory_vs_forecast', primaryKey: ['rowKey'] }) {
  @text({ column: 'row_key', max: 300 }) rowKey!: string;
  @date({ column: 'month' }) month!: Date;
  @text({ column: 'territory', max: 200 }) territory!: string;
  @text({ column: 'interplanetary_region', max: 200 }) interplanetaryRegion!: string;
  @decimal({ column: 'forecast_eur', precision: 18, scale: 2 }) forecastEur!: number;
  @decimal({ column: 'actual_eur', precision: 18, scale: 2 }) actualEur!: number;
}
