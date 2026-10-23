import type { VisualizationSpec } from "@microsoft/fabric-visuals";

export const salesVsBudgetSpec: VisualizationSpec = {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    data: {},
    encoding: {
        x: { field: "month", type: "temporal", title: null, axis: { format: "%b %y", labelAngle: 0 } },
    },
    layer: [
        {
            mark: { type: "bar", opacity: 0.85, cornerRadiusTopLeft: 2, cornerRadiusTopRight: 2 },
            encoding: {
                y: { field: "net", type: "quantitative", title: "EUR", axis: { format: "~s" } },
                tooltip: [
                    { field: "month", type: "temporal", format: "%b %Y", title: "Month" },
                    { field: "net", type: "quantitative", format: ",.0f", title: "Net sales (EUR)" },
                    { field: "budget", type: "quantitative", format: ",.0f", title: "Budget (EUR)" },
                ],
            },
        },
        {
            mark: { type: "line", strokeWidth: 2, point: true, color: "#f2c811" },
            encoding: { y: { field: "budget", type: "quantitative" } },
        },
    ],
} as VisualizationSpec;

export const regionSpec: VisualizationSpec = {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    data: {},
    mark: { type: "bar", cornerRadiusEnd: 2 },
    encoding: {
        y: { field: "region", type: "nominal", sort: "-x", title: null },
        x: { field: "net", type: "quantitative", title: "Net sales 2022 YTD (EUR)", axis: { format: "~s" } },
        tooltip: [
            { field: "region", type: "nominal", title: "Region" },
            { field: "net", type: "quantitative", format: ",.0f", title: "Net sales (EUR)" },
        ],
    },
} as VisualizationSpec;

export const deliverySpec: VisualizationSpec = {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    data: {},
    mark: { type: "line", strokeWidth: 2, point: true },
    encoding: {
        x: { field: "month", type: "temporal", title: null, axis: { format: "%b %y", labelAngle: 0 } },
        y: { field: "otd", type: "quantitative", title: "On time (%)", scale: { zero: false } },
        tooltip: [
            { field: "month", type: "temporal", format: "%b %Y", title: "Month" },
            { field: "otd", type: "quantitative", format: ".1f", title: "On-time delivery (%)" },
        ],
    },
} as VisualizationSpec;

export const forecastSpec: VisualizationSpec = {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    data: {},
    mark: { type: "bar", cornerRadiusEnd: 2 },
    encoding: {
        y: { field: "productType", type: "nominal", sort: { field: "gapPct" }, title: null },
        x: { field: "gapPct", type: "quantitative", title: "2022 forecast vs budget (%)" },
        color: {
            condition: { test: "datum.gapPct < 0", value: "#d9534f" },
            value: "#0078d4",
        },
        tooltip: [
            { field: "productType", type: "nominal", title: "Product type" },
            { field: "forecast", type: "quantitative", format: ",.0f", title: "Forecast (EUR)" },
            { field: "budget", type: "quantitative", format: ",.0f", title: "Budget (EUR)" },
            { field: "gapPct", type: "quantitative", format: "+.1f", title: "Gap (%)" },
        ],
    },
} as VisualizationSpec;
