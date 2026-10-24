-- Spark SQL. Builds the small Delta tables the app's tabs read through the
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

-- ---------------------------------------------------------------------------------------------
-- Operations tab
-- ---------------------------------------------------------------------------------------------

-- Open and overdue order book (all order dates), by status × region × key account.
CREATE OR REPLACE TABLE app.order_backlog AS
SELECT concat(trim(os.order_status_text), '|', trim(r.interplanetary_region), '|', trim(c.key_account_name)) AS row_key,
       trim(os.order_status_group) AS status_group,
       trim(os.order_status_text) AS status_text,
       CAST(os.order_status_ordinal AS INT) AS status_ordinal,
       trim(r.interplanetary_region) AS interplanetary_region,
       trim(c.key_account_name) AS key_account_name,
       CAST(COUNT(*) AS INT) AS order_lines,
       CAST(SUM(o.net_order_value / br.rate * er.rate) AS DECIMAL(18,2)) AS value_eur
FROM SpaceParts.orders o
JOIN SpaceParts.order_status os ON trim(os.order_status_code) = trim(o.sales_order_document_line_item_status) AND trim(os.order_status_group) IN ('Open', 'Overdue')
JOIN SpaceParts.budget_rate br ON trim(br.from_currency) = trim(o.local_currency)
JOIN SpaceParts.exchange_rate er ON trim(er.from_currency) = trim(o.local_currency) AND trim(er.rate_type) = 'Monthly Rate' AND to_date(er.`date`) = o.order_date
JOIN SpaceParts.customers c ON trim(c.customer_key) = trim(o.customer_key)
JOIN SpaceParts.regions r ON trim(r.station) = trim(c.station)
GROUP BY trim(os.order_status_group), trim(os.order_status_text), os.order_status_ordinal, trim(r.interplanetary_region), trim(c.key_account_name);

-- On-time delivery and late-delivery penalties (positive euros) by region × month, 2022.
CREATE OR REPLACE TABLE app.delivery_by_region AS
SELECT concat(date_format(trunc(i.billing_date, 'MM'), 'yyyy-MM'), '|', trim(r.interplanetary_region)) AS row_key,
       trunc(i.billing_date, 'MM') AS month,
       trim(r.interplanetary_region) AS interplanetary_region,
       CAST(SUM(CASE WHEN i.otd_indicator THEN 1 ELSE 0 END) AS INT) AS on_time_lines,
       CAST(COUNT(*) AS INT) AS invoice_lines,
       CAST(-SUM(i.late_delivery_penalties / br.rate * er.rate) AS DECIMAL(18,2)) AS late_penalties_eur
FROM SpaceParts.invoices i
JOIN SpaceParts.invoice_doc_type d ON trim(d.billing_document_type_code) = trim(i.billing_document_type_code) AND trim(d.`group`) = 'Invoice'
JOIN SpaceParts.budget_rate br ON trim(br.from_currency) = trim(i.local_currency)
JOIN SpaceParts.exchange_rate er ON trim(er.from_currency) = trim(i.local_currency) AND trim(er.rate_type) = 'Monthly Rate' AND to_date(er.`date`) = i.billing_date
JOIN SpaceParts.customers c ON trim(c.customer_key) = trim(i.customer_key)
JOIN SpaceParts.regions r ON trim(r.station) = trim(c.station)
WHERE i.billing_date >= DATE'2022-01-01' AND i.billing_date < DATE'2023-01-01'
GROUP BY trunc(i.billing_date, 'MM'), trim(r.interplanetary_region);

-- Share of 2022 order value cancelled, by product type.
CREATE OR REPLACE TABLE app.cancellations_by_type AS
SELECT trim(p.`type`) AS row_key,
       trim(p.`type`) AS product_type,
       CAST(SUM(CASE WHEN trim(o.sales_order_document_line_item_status) = 'Cancelled' THEN o.net_order_value / br.rate * er.rate ELSE 0 END) AS DECIMAL(18,2)) AS cancelled_eur,
       CAST(SUM(o.net_order_value / br.rate * er.rate) AS DECIMAL(18,2)) AS ordered_eur
FROM SpaceParts.orders o
JOIN SpaceParts.budget_rate br ON trim(br.from_currency) = trim(o.local_currency)
JOIN SpaceParts.exchange_rate er ON trim(er.from_currency) = trim(o.local_currency) AND trim(er.rate_type) = 'Monthly Rate' AND to_date(er.`date`) = o.order_date
JOIN SpaceParts.products p ON trim(p.product_key) = trim(o.product_key)
WHERE o.order_date >= DATE'2022-01-01' AND o.order_date < DATE'2023-01-01'
GROUP BY trim(p.`type`);

-- ---------------------------------------------------------------------------------------------
-- Plan tab
-- ---------------------------------------------------------------------------------------------

-- 2022 forecast against actual net sales by territory × month (actuals run to 21 Aug 2022).
CREATE OR REPLACE TABLE app.territory_vs_forecast AS
WITH terr AS (
    SELECT trim(territory) AS territory, first(trim(interplanetary_region)) AS interplanetary_region
    FROM SpaceParts.regions GROUP BY trim(territory)),
fc AS (
    SELECT forecast_month AS month, trim(region_territory) AS territory, SUM(forecast_eur) AS forecast_eur
    FROM SpaceParts.forecast
    WHERE forecast_month >= DATE'2022-01-01' AND forecast_month < DATE'2023-01-01'
    GROUP BY forecast_month, trim(region_territory)),
act AS (
    SELECT trunc(i.billing_date, 'MM') AS month, trim(r.territory) AS territory, SUM(i.net_invoice_value / br.rate * er.rate) AS actual_eur
    FROM SpaceParts.invoices i
    JOIN SpaceParts.invoice_doc_type d ON trim(d.billing_document_type_code) = trim(i.billing_document_type_code) AND trim(d.`group`) = 'Invoice'
    JOIN SpaceParts.budget_rate br ON trim(br.from_currency) = trim(i.local_currency)
    JOIN SpaceParts.exchange_rate er ON trim(er.from_currency) = trim(i.local_currency) AND trim(er.rate_type) = 'Monthly Rate' AND to_date(er.`date`) = i.billing_date
    JOIN SpaceParts.customers c ON trim(c.customer_key) = trim(i.customer_key)
    JOIN SpaceParts.regions r ON trim(r.station) = trim(c.station)
    WHERE i.billing_date >= DATE'2022-01-01' AND i.billing_date < DATE'2023-01-01'
    GROUP BY trunc(i.billing_date, 'MM'), trim(r.territory))
SELECT concat(date_format(coalesce(fc.month, act.month), 'yyyy-MM'), '|', coalesce(fc.territory, act.territory)) AS row_key,
       coalesce(fc.month, act.month) AS month,
       coalesce(fc.territory, act.territory) AS territory,
       coalesce(terr.interplanetary_region, 'Unknown') AS interplanetary_region,
       CAST(coalesce(fc.forecast_eur, 0) AS DECIMAL(18,2)) AS forecast_eur,
       CAST(coalesce(act.actual_eur, 0) AS DECIMAL(18,2)) AS actual_eur
FROM fc
FULL OUTER JOIN act ON act.month = fc.month AND act.territory = fc.territory
LEFT JOIN terr ON terr.territory = coalesce(fc.territory, act.territory);

-- Net sales and budget by brand × month, 2021–2022.
CREATE OR REPLACE TABLE app.brand_vs_budget AS
WITH act AS (
    SELECT trunc(i.billing_date, 'MM') AS month, trim(b.brand) AS brand, trim(b.class) AS brand_class,
           SUM(i.net_invoice_value / br.rate * er.rate) AS actual_eur
    FROM SpaceParts.invoices i
    JOIN SpaceParts.invoice_doc_type d ON trim(d.billing_document_type_code) = trim(i.billing_document_type_code) AND trim(d.`group`) = 'Invoice'
    JOIN SpaceParts.budget_rate br ON trim(br.from_currency) = trim(i.local_currency)
    JOIN SpaceParts.exchange_rate er ON trim(er.from_currency) = trim(i.local_currency) AND trim(er.rate_type) = 'Monthly Rate' AND to_date(er.`date`) = i.billing_date
    JOIN SpaceParts.products p ON trim(p.product_key) = trim(i.product_key)
    JOIN SpaceParts.brands b ON trim(b.sub_brand) = trim(p.sub_brand_name)
    WHERE i.billing_date >= DATE'2021-01-01'
    GROUP BY trunc(i.billing_date, 'MM'), trim(b.brand), trim(b.class)),
bud AS (
    SELECT bg.month, trim(b.brand) AS brand, trim(b.class) AS brand_class, SUM(bg.total_budget) AS budget_eur
    FROM SpaceParts.budget bg
    JOIN SpaceParts.products p ON trim(p.product_key) = trim(bg.product_key)
    JOIN SpaceParts.brands b ON trim(b.sub_brand) = trim(p.sub_brand_name)
    WHERE bg.month >= DATE'2021-01-01'
    GROUP BY bg.month, trim(b.brand), trim(b.class))
SELECT concat(date_format(coalesce(act.month, bud.month), 'yyyy-MM'), '|', coalesce(act.brand, bud.brand)) AS row_key,
       coalesce(act.month, bud.month) AS month,
       coalesce(act.brand, bud.brand) AS brand,
       coalesce(act.brand_class, bud.brand_class) AS brand_class,
       CAST(coalesce(act.actual_eur, 0) AS DECIMAL(18,2)) AS actual_eur,
       CAST(coalesce(bud.budget_eur, 0) AS DECIMAL(18,2)) AS budget_eur
FROM act
FULL OUTER JOIN bud ON bud.month = act.month AND bud.brand = act.brand;
