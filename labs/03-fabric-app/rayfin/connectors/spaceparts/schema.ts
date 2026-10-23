// Source: spaceparts (fabric-sqlanalytics) — the SpaceParts lakehouse SQL endpoint.
// Entities are hand-written over the app.* views (labs/03-fabric-app/sql/app_views.sql),
// which apply the same euro and net-sales rules as the data agents.
import type { GraphQLBackedConnector } from '@microsoft/rayfin-connector-fabric-graphql';
import type { ConnectorConfig } from '@microsoft/rayfin-connectors';

import { DeliveryByMonth } from './DeliveryByMonth.js';
import { ForecastVsBudget } from './ForecastVsBudget.js';
import { SalesVsBudget } from './SalesVsBudget.js';

export { DeliveryByMonth } from './DeliveryByMonth.js';
export { ForecastVsBudget } from './ForecastVsBudget.js';
export { SalesVsBudget } from './SalesVsBudget.js';

export const connectorConfig = {
  connector: 'fabric-sqlanalytics',
  operations: ['read'],
  entities: { SalesVsBudget, DeliveryByMonth, ForecastVsBudget },
} as const satisfies ConnectorConfig;

export type SpacepartsSchema = GraphQLBackedConnector<
  { SalesVsBudget: typeof SalesVsBudget; DeliveryByMonth: typeof DeliveryByMonth; ForecastVsBudget: typeof ForecastVsBudget },
  typeof connectorConfig
>;
