// Source: spaceparts (fabric-sqlanalytics) — the SpaceParts lakehouse SQL endpoint.
// Entities are hand-written over the small app.* Delta tables built by fabric/build_app_tables.sql,
// which apply the same euro and net-sales rules as the data agents.
import type { GraphQLBackedConnector } from '@microsoft/rayfin-connector-fabric-graphql';
import type { ConnectorConfig } from '@microsoft/rayfin-connectors';

import { BrandVsBudget } from './BrandVsBudget.js';
import { CancellationsByType } from './CancellationsByType.js';
import { DeliveryByMonth } from './DeliveryByMonth.js';
import { DeliveryByRegion } from './DeliveryByRegion.js';
import { ForecastVsBudget } from './ForecastVsBudget.js';
import { OrderBacklog } from './OrderBacklog.js';
import { SalesVsBudget } from './SalesVsBudget.js';
import { TerritoryVsForecast } from './TerritoryVsForecast.js';

export { BrandVsBudget, CancellationsByType, DeliveryByMonth, DeliveryByRegion, ForecastVsBudget, OrderBacklog, SalesVsBudget, TerritoryVsForecast };

export const connectorConfig = {
  connector: 'fabric-sqlanalytics',
  operations: ['read'],
  entities: { SalesVsBudget, DeliveryByMonth, ForecastVsBudget, OrderBacklog, DeliveryByRegion, CancellationsByType, TerritoryVsForecast, BrandVsBudget },
} as const satisfies ConnectorConfig;

export type SpacepartsSchema = GraphQLBackedConnector<
  {
    SalesVsBudget: typeof SalesVsBudget;
    DeliveryByMonth: typeof DeliveryByMonth;
    ForecastVsBudget: typeof ForecastVsBudget;
    OrderBacklog: typeof OrderBacklog;
    DeliveryByRegion: typeof DeliveryByRegion;
    CancellationsByType: typeof CancellationsByType;
    TerritoryVsForecast: typeof TerritoryVsForecast;
    BrandVsBudget: typeof BrandVsBudget;
  },
  typeof connectorConfig
>;
