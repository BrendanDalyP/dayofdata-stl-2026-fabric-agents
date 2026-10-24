// #region rayfin:app-owned — copied verbatim by the Rayfin CLI; edit freely.
//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

// Connector wiring for the app's Rayfin client (`src/lib/rayfin-client.ts`). Below the
// `@generated` line it declares each connector's typed schema (`AppConnectorsSchema`), routing
// config (`connectorConfigs`) and client-side runtime (`connectorRuntimes`), keyed by connector
// name. The template ships with no connectors, so all three are empty until the first
// `npx rayfin connector add`.

import type { TypedConnectorsApi } from "@microsoft/rayfin-connectors";
import type { FabricSemanticModel } from "@microsoft/rayfin-connector-fabric-semanticmodel";

/**
 * The connectors as `useSemanticModelQuery` addresses them: by a connector name chosen at
 * run time. The generated `AppConnectorsSchema` lists only the names scaffolded so far,
 * and it is empty in the template.
 */
export type SemanticModelConnectors = TypedConnectorsApi<Record<string, FabricSemanticModel<"executeQuery">>>;
// #endregion rayfin:app-owned

// Connector wiring, owned by the app (the @generated marker was removed so the CLI
// prints wiring instead of rewriting it; connector entities are hand-written over views).

import type {
  ConnectorConfig,
  ConnectorsRuntime,
} from '@microsoft/rayfin-connectors';
import type { SpacepartsSchema } from '../../rayfin/connectors/spaceparts/schema';

// Browser-side config. Entities are listed as field-name arrays, not the decorated
// classes: a decorated class can't be bundled (the app would fail to parse).
const spacepartsConfig = {
  connector: 'fabric-sqlanalytics',
  operations: ['read'],
  entities: {
    SalesVsBudget: ['rowKey', 'month', 'interplanetaryRegion', 'keyAccountName', 'netSalesEur', 'budgetEur'],
    DeliveryByMonth: ['rowKey', 'month', 'onTimeLines', 'invoiceLines', 'latePenaltiesEur'],
    ForecastVsBudget: ['rowKey', 'month', 'productType', 'forecastEur', 'budgetEur'],
    OrderBacklog: ['rowKey', 'statusGroup', 'statusText', 'statusOrdinal', 'interplanetaryRegion', 'keyAccountName', 'orderLines', 'valueEur'],
    DeliveryByRegion: ['rowKey', 'month', 'interplanetaryRegion', 'onTimeLines', 'invoiceLines', 'latePenaltiesEur'],
    CancellationsByType: ['rowKey', 'productType', 'cancelledEur', 'orderedEur'],
    TerritoryVsForecast: ['rowKey', 'month', 'territory', 'interplanetaryRegion', 'forecastEur', 'actualEur'],
    BrandVsBudget: ['rowKey', 'month', 'brand', 'brandClass', 'actualEur', 'budgetEur'],
  },
} as const satisfies ConnectorConfig;

export type AppConnectorsSchema = { spaceparts: SpacepartsSchema };

export const connectorConfigs: Record<string, ConnectorConfig> = { spaceparts: spacepartsConfig };

export const connectorRuntimes: ConnectorsRuntime = {};
