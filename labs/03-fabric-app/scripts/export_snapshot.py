"""Export the app's lakehouse tables (and the Action board) to JSON for local screenshot reviews.

The local dev server can't sign in to Fabric, so `npm run dev` with VITE_DATA_SNAPSHOT=1 reads these
files instead of the connector. Field names match the connector entities exactly, so the pages run the
same code on the same rows. Dev only: production builds never include or read them.

Usage (after `az login`; needs pip install mssql-python):
    python scripts/export_snapshot.py --out <folder>
"""
import argparse, datetime as dt, decimal, json, pathlib

import mssql_python

SQL_ENDPOINT = ("fhhjzyywk65ehmt5dpoy7vtzae-bc3wrksfpmaupk7qxqojdpq4le.datawarehouse.fabric.microsoft.com", "lh__spaceparts")
APP_DB = ("fhhjzyywk65ehmt5dpoy7vtzae-bc3wrksfpmaupk7qxqojdpq4le.database.fabric.microsoft.com", "spaceparts-mission-control-d0999c56-453e-45b6-932f-4b950b9d37a4")

TABLES = {
    "SalesVsBudget": "SELECT month, interplanetary_region AS interplanetaryRegion, key_account_name AS keyAccountName, net_sales_eur AS netSalesEur, budget_eur AS budgetEur FROM app.sales_vs_budget",
    "DeliveryByMonth": "SELECT month, on_time_lines AS onTimeLines, invoice_lines AS invoiceLines, late_penalties_eur AS latePenaltiesEur FROM app.delivery_by_month",
    "ForecastVsBudget": "SELECT month, product_type AS productType, forecast_eur AS forecastEur, budget_eur AS budgetEur FROM app.forecast_vs_budget",
    "OrderBacklog": "SELECT status_text AS statusText, interplanetary_region AS interplanetaryRegion, key_account_name AS keyAccountName, order_lines AS orderLines, value_eur AS valueEur FROM app.order_backlog",
    "DeliveryByRegion": "SELECT month, interplanetary_region AS interplanetaryRegion, on_time_lines AS onTimeLines, invoice_lines AS invoiceLines, late_penalties_eur AS latePenaltiesEur FROM app.delivery_by_region",
    "CancellationsByType": "SELECT product_type AS productType, cancelled_eur AS cancelledEur, ordered_eur AS orderedEur FROM app.cancellations_by_type",
    "TerritoryVsForecast": "SELECT month, territory, interplanetary_region AS interplanetaryRegion, forecast_eur AS forecastEur, actual_eur AS actualEur FROM app.territory_vs_forecast",
    "BrandVsBudget": "SELECT month, brand, brand_class AS brandClass, actual_eur AS actualEur, budget_eur AS budgetEur FROM app.brand_vs_budget",
}


def to_json(v):
    if isinstance(v, (dt.date, dt.datetime)):
        return v.isoformat()
    if isinstance(v, decimal.Decimal):
        return float(v)
    return v if isinstance(v, (str, int, float, bool, type(None))) else str(v)


def dump(conn_info, queries, out):
    server, db = conn_info
    conn = mssql_python.connect(f"Server={server},1433;Database={db};Encrypt=yes;Authentication=ActiveDirectoryDefault;")
    cur = conn.cursor()
    for name, sql in queries.items():
        cur.execute(sql)
        cols = [c[0] for c in cur.description]
        rows = [{c: to_json(v) for c, v in zip(cols, r)} for r in cur.fetchall()]
        (out / f"{name}.json").write_text(json.dumps(rows), encoding="utf-8")
        print(f"{name}: {len(rows)} rows")
    conn.close()


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    out = pathlib.Path(p.parse_args().out)
    out.mkdir(parents=True, exist_ok=True)
    dump(SQL_ENDPOINT, TABLES, out)
    dump(APP_DB, {"ActionItem": "SELECT id, kind, status, title, subject, detail, owner, priority, amountEur, dueDate, agent, createdAt FROM dbo.ActionItems"}, out)


if __name__ == "__main__":
    main()
