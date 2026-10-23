-- Spark SQL. Builds the small Delta tables the app's Overview page reads through the
-- Rayfin lakehouse connector. Run by the notebook nb__build_app_tables (see deploy_app_tables.py)
-- with lh__spaceparts as its default lakehouse. Same rules as the data agents:
-- euros = local value / budget_rate.rate * monthly exchange rate; real invoices only.
-- Join keys are trimmed: T-SQL ignores trailing spaces in '=' comparisons, Spark does not,
-- and some SpaceParts keys carry them.

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE TABLE app.sales_vs_budget AS
WITH sales AS (
    SELECT trunc(i.billing_date, 'MM') AS month, trim(r.interplanetary_region) AS interplanetary_region, trim(c.key_account_name) AS key_account_name,
           SUM(i.net_invoice_value / br.rate * er.rate) AS net_sales_eur
    FROM SpaceParts.invoices i
    JOIN SpaceParts.invoice_doc_type d ON trim(d.billing_document_type_code) = trim(i.billing_document_type_code) AND trim(d.`group`) = 'Invoice'
    JOIN SpaceParts.budget_rate br ON trim(br.from_currency) = trim(i.local_currency)
    JOIN SpaceParts.exchange_rate er ON trim(er.from_currency) = trim(i.local_currency) AND trim(er.rate_type) = 'Monthly Rate' AND to_date(er.`date`) = i.billing_date
    JOIN SpaceParts.customers c ON trim(c.customer_key) = trim(i.customer_key)
    JOIN SpaceParts.regions r ON trim(r.station) = trim(c.station)
    WHERE i.billing_date >= DATE'2021-01-01'
    GROUP BY trunc(i.billing_date, 'MM'), trim(r.interplanetary_region), trim(c.key_account_name)),
budget AS (
    SELECT b.month, trim(r.interplanetary_region) AS interplanetary_region, trim(c.key_account_name) AS key_account_name, SUM(b.total_budget) AS budget_eur
    FROM SpaceParts.budget b
    JOIN SpaceParts.customers c ON trim(c.customer_key) = trim(b.customer_key)
    JOIN SpaceParts.regions r ON trim(r.station) = trim(c.station)
    WHERE b.month >= DATE'2021-01-01'
    GROUP BY b.month, trim(r.interplanetary_region), trim(c.key_account_name))
SELECT concat(date_format(coalesce(s.month, b.month), 'yyyy-MM'), '|', coalesce(s.interplanetary_region, b.interplanetary_region), '|', coalesce(s.key_account_name, b.key_account_name)) AS row_key,
       coalesce(s.month, b.month) AS month,
       coalesce(s.interplanetary_region, b.interplanetary_region) AS interplanetary_region,
       coalesce(s.key_account_name, b.key_account_name) AS key_account_name,
       CAST(coalesce(s.net_sales_eur, 0) AS DECIMAL(18,2)) AS net_sales_eur,
       CAST(coalesce(b.budget_eur, 0) AS DECIMAL(18,2)) AS budget_eur
FROM sales s
FULL OUTER JOIN budget b ON b.month = s.month AND b.interplanetary_region = s.interplanetary_region AND b.key_account_name = s.key_account_name;

CREATE OR REPLACE TABLE app.delivery_by_month AS
SELECT date_format(trunc(i.billing_date, 'MM'), 'yyyy-MM') AS row_key,
       trunc(i.billing_date, 'MM') AS month,
       CAST(SUM(CASE WHEN i.otd_indicator THEN 1 ELSE 0 END) AS INT) AS on_time_lines,
       CAST(COUNT(*) AS INT) AS invoice_lines,
       CAST(-SUM(i.late_delivery_penalties / br.rate * er.rate) AS DECIMAL(18,2)) AS late_penalties_eur
FROM SpaceParts.invoices i
JOIN SpaceParts.invoice_doc_type d ON trim(d.billing_document_type_code) = trim(i.billing_document_type_code) AND trim(d.`group`) = 'Invoice'
JOIN SpaceParts.budget_rate br ON trim(br.from_currency) = trim(i.local_currency)
JOIN SpaceParts.exchange_rate er ON trim(er.from_currency) = trim(i.local_currency) AND trim(er.rate_type) = 'Monthly Rate' AND to_date(er.`date`) = i.billing_date
WHERE i.billing_date >= DATE'2021-01-01'
GROUP BY trunc(i.billing_date, 'MM');

CREATE OR REPLACE TABLE app.forecast_vs_budget AS
WITH fc AS (
    SELECT forecast_month AS month, product_type, SUM(forecast_eur) AS forecast_eur
    FROM SpaceParts.forecast GROUP BY forecast_month, product_type),
bud AS (
    SELECT b.month, p.`type` AS product_type, SUM(b.total_budget) AS budget_eur
    FROM SpaceParts.budget b JOIN SpaceParts.products p ON p.product_key = b.product_key
    WHERE b.month >= DATE'2022-01-01' AND b.month < DATE'2023-01-01'
    GROUP BY b.month, p.`type`)
SELECT concat(date_format(fc.month, 'yyyy-MM'), '|', fc.product_type) AS row_key,
       fc.month, fc.product_type,
       CAST(fc.forecast_eur AS DECIMAL(18,2)) AS forecast_eur,
       CAST(coalesce(bud.budget_eur, 0) AS DECIMAL(18,2)) AS budget_eur
FROM fc LEFT JOIN bud ON bud.month = fc.month AND bud.product_type = fc.product_type;
