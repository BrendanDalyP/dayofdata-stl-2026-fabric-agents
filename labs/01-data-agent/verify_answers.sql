-- ─────────────────────────────────────────────────────────────────────────────
-- Ground truth for the SpaceParts agent team.
-- Run against the lakehouse SQL analytics endpoint (lh__spaceparts, schema SpaceParts).
-- Each block answers one question in ground_truth.csv. Batches are separated by GO.
--
-- House rules (the same rules the agents are given):
--   • Euros:      local value ÷ budget_rate.rate × exchange_rate.rate
--                 (exchange_rate: rate_type = 'Monthly Rate', same currency, date = billing/order date)
--   • Net sales:  invoices.net_invoice_value, invoice_doc_type.[group] = 'Invoice' only
--   • Dates:      the data ends on 2022-08-21. "This year" = 2022 to date.
--                 "Last year" = the same period of 2021 (1 Jan – 21 Aug).
--                 Budget comparisons use complete months only: Jan–Jul 2022.
-- ─────────────────────────────────────────────────────────────────────────────

-- S1 · Sales · What were net sales in euros this year?
SELECT CAST(SUM(i.net_invoice_value / br.rate * er.rate) AS decimal(18,0)) AS net_sales_eur
FROM SpaceParts.invoices i
JOIN SpaceParts.invoice_doc_type d ON d.billing_document_type_code = i.billing_document_type_code AND d.[group] = 'Invoice'
JOIN SpaceParts.budget_rate br ON br.from_currency = i.local_currency
JOIN SpaceParts.exchange_rate er ON er.from_currency = i.local_currency AND er.rate_type = 'Monthly Rate' AND CAST(er.[date] AS date) = i.billing_date
WHERE i.billing_date >= '2022-01-01' AND i.billing_date < '2023-01-01'
GO

-- S2 · Sales · What were net sales in euros by region this year?
SELECT r.interplanetary_region,
       CAST(SUM(i.net_invoice_value / br.rate * er.rate) AS decimal(18,0)) AS net_sales_eur
FROM SpaceParts.invoices i
JOIN SpaceParts.invoice_doc_type d ON d.billing_document_type_code = i.billing_document_type_code AND d.[group] = 'Invoice'
JOIN SpaceParts.budget_rate br ON br.from_currency = i.local_currency
JOIN SpaceParts.exchange_rate er ON er.from_currency = i.local_currency AND er.rate_type = 'Monthly Rate' AND CAST(er.[date] AS date) = i.billing_date
JOIN SpaceParts.customers c ON c.customer_key = i.customer_key
JOIN SpaceParts.regions r ON r.station = c.station
WHERE i.billing_date >= '2022-01-01' AND i.billing_date < '2023-01-01'
GROUP BY r.interplanetary_region
ORDER BY net_sales_eur DESC
GO

-- S3 · Sales · Which key accounts are furthest behind budget this year?
WITH actual AS (
    SELECT c.key_account_name, SUM(i.net_invoice_value / br.rate * er.rate) AS actual_eur
    FROM SpaceParts.invoices i
    JOIN SpaceParts.invoice_doc_type d ON d.billing_document_type_code = i.billing_document_type_code AND d.[group] = 'Invoice'
    JOIN SpaceParts.budget_rate br ON br.from_currency = i.local_currency
    JOIN SpaceParts.exchange_rate er ON er.from_currency = i.local_currency AND er.rate_type = 'Monthly Rate' AND CAST(er.[date] AS date) = i.billing_date
    JOIN SpaceParts.customers c ON c.customer_key = i.customer_key
    WHERE c.account_type = 'Key Account' AND i.billing_date >= '2022-01-01' AND i.billing_date < '2022-08-01'
    GROUP BY c.key_account_name),
budget AS (
    SELECT c.key_account_name, SUM(b.total_budget) AS budget_eur
    FROM SpaceParts.budget b
    JOIN SpaceParts.customers c ON c.customer_key = b.customer_key
    WHERE c.account_type = 'Key Account' AND b.[month] >= '2022-01-01' AND b.[month] < '2022-08-01'
    GROUP BY c.key_account_name)
SELECT TOP 5 b.key_account_name,
       CAST(a.actual_eur AS decimal(18,0)) AS actual_eur,
       CAST(b.budget_eur AS decimal(18,0)) AS budget_eur,
       CAST(a.actual_eur - b.budget_eur AS decimal(18,0)) AS gap_eur,
       CAST(100.0 * (a.actual_eur / b.budget_eur - 1) AS decimal(9,1)) AS gap_pct
FROM budget b
LEFT JOIN actual a ON a.key_account_name = b.key_account_name
ORDER BY gap_eur ASC
GO

-- S4 · Sales · How did net sales grow against last year by product type?
WITH s AS (
    SELECT p.[type] AS product_type, YEAR(i.billing_date) AS yr,
           SUM(i.net_invoice_value / br.rate * er.rate) AS net_sales_eur
    FROM SpaceParts.invoices i
    JOIN SpaceParts.invoice_doc_type d ON d.billing_document_type_code = i.billing_document_type_code AND d.[group] = 'Invoice'
    JOIN SpaceParts.budget_rate br ON br.from_currency = i.local_currency
    JOIN SpaceParts.exchange_rate er ON er.from_currency = i.local_currency AND er.rate_type = 'Monthly Rate' AND CAST(er.[date] AS date) = i.billing_date
    JOIN SpaceParts.products p ON p.product_key = i.product_key
    WHERE (i.billing_date >= '2022-01-01' AND i.billing_date <= '2022-08-21')
       OR (i.billing_date >= '2021-01-01' AND i.billing_date <= '2021-08-21')
    GROUP BY p.[type], YEAR(i.billing_date))
SELECT cy.product_type,
       CAST(cy.net_sales_eur AS decimal(18,0)) AS ytd_2022_eur,
       CAST(py.net_sales_eur AS decimal(18,0)) AS same_period_2021_eur,
       CAST(100.0 * (cy.net_sales_eur / py.net_sales_eur - 1) AS decimal(9,1)) AS growth_pct
FROM s cy JOIN s py ON py.product_type = cy.product_type AND py.yr = 2021
WHERE cy.yr = 2022
ORDER BY growth_pct DESC
GO

-- S5 · Sales · Who are the top 5 account managers by net sales this year?
SELECT TOP 5 c.account_manager,
       CAST(SUM(i.net_invoice_value / br.rate * er.rate) AS decimal(18,0)) AS net_sales_eur
FROM SpaceParts.invoices i
JOIN SpaceParts.invoice_doc_type d ON d.billing_document_type_code = i.billing_document_type_code AND d.[group] = 'Invoice'
JOIN SpaceParts.budget_rate br ON br.from_currency = i.local_currency
JOIN SpaceParts.exchange_rate er ON er.from_currency = i.local_currency AND er.rate_type = 'Monthly Rate' AND CAST(er.[date] AS date) = i.billing_date
JOIN SpaceParts.customers c ON c.customer_key = i.customer_key
WHERE i.billing_date >= '2022-01-01' AND i.billing_date < '2023-01-01'
GROUP BY c.account_manager
ORDER BY net_sales_eur DESC
GO

-- O1 · Operations · What is the open order backlog in euros by order status?
SELECT os.order_status_group, os.order_status_text,
       COUNT_BIG(*) AS order_lines,
       CAST(SUM(o.net_order_value / br.rate * er.rate) AS decimal(18,0)) AS order_value_eur
FROM SpaceParts.orders o
JOIN SpaceParts.order_status os ON os.order_status_code = o.sales_order_document_line_item_status
JOIN SpaceParts.budget_rate br ON br.from_currency = o.local_currency
JOIN SpaceParts.exchange_rate er ON er.from_currency = o.local_currency AND er.rate_type = 'Monthly Rate' AND CAST(er.[date] AS date) = o.order_date
WHERE os.order_status_group IN ('Open', 'Overdue')
GROUP BY os.order_status_group, os.order_status_text, os.order_status_ordinal
ORDER BY os.order_status_ordinal
GO

-- O2 · Operations · What was the on-time delivery rate by month this year?
SELECT DATEFROMPARTS(YEAR(i.billing_date), MONTH(i.billing_date), 1) AS [month],
       CAST(100.0 * AVG(CASE WHEN i.otd_indicator = 1 THEN 1.0 ELSE 0.0 END) AS decimal(5,1)) AS on_time_pct,
       COUNT_BIG(*) AS invoice_lines
FROM SpaceParts.invoices i
JOIN SpaceParts.invoice_doc_type d ON d.billing_document_type_code = i.billing_document_type_code AND d.[group] = 'Invoice'
WHERE i.billing_date >= '2022-01-01' AND i.billing_date < '2023-01-01'
GROUP BY DATEFROMPARTS(YEAR(i.billing_date), MONTH(i.billing_date), 1)
ORDER BY [month]
GO

-- O3 · Operations · Which regions paid the most late-delivery penalties this year, in euros?
-- Penalties are stored as negative amounts (they reduce the invoice); flip the sign to report them.
SELECT TOP 5 r.interplanetary_region,
       CAST(-SUM(i.late_delivery_penalties / br.rate * er.rate) AS decimal(18,0)) AS late_penalties_eur
FROM SpaceParts.invoices i
JOIN SpaceParts.invoice_doc_type d ON d.billing_document_type_code = i.billing_document_type_code AND d.[group] = 'Invoice'
JOIN SpaceParts.budget_rate br ON br.from_currency = i.local_currency
JOIN SpaceParts.exchange_rate er ON er.from_currency = i.local_currency AND er.rate_type = 'Monthly Rate' AND CAST(er.[date] AS date) = i.billing_date
JOIN SpaceParts.customers c ON c.customer_key = i.customer_key
JOIN SpaceParts.regions r ON r.station = c.station
WHERE i.billing_date >= '2022-01-01' AND i.billing_date < '2023-01-01'
GROUP BY r.interplanetary_region
ORDER BY late_penalties_eur DESC
GO

-- O4 · Operations · Which key accounts have the most overdue order value?
SELECT TOP 5 c.key_account_name,
       COUNT_BIG(*) AS overdue_lines,
       CAST(SUM(o.net_order_value / br.rate * er.rate) AS decimal(18,0)) AS overdue_value_eur
FROM SpaceParts.orders o
JOIN SpaceParts.budget_rate br ON br.from_currency = o.local_currency
JOIN SpaceParts.exchange_rate er ON er.from_currency = o.local_currency AND er.rate_type = 'Monthly Rate' AND CAST(er.[date] AS date) = o.order_date
JOIN SpaceParts.customers c ON c.customer_key = o.customer_key
WHERE o.sales_order_document_line_item_status = 'Overdue' AND c.account_type = 'Key Account'
GROUP BY c.key_account_name
ORDER BY overdue_value_eur DESC
GO

-- O5 · Operations · What share of order value was cancelled this year, by product type?
SELECT p.[type] AS product_type,
       CAST(100.0 * SUM(CASE WHEN o.sales_order_document_line_item_status = 'Cancelled' THEN o.net_order_value / br.rate * er.rate ELSE 0 END)
            / SUM(o.net_order_value / br.rate * er.rate) AS decimal(5,1)) AS cancelled_pct
FROM SpaceParts.orders o
JOIN SpaceParts.budget_rate br ON br.from_currency = o.local_currency
JOIN SpaceParts.exchange_rate er ON er.from_currency = o.local_currency AND er.rate_type = 'Monthly Rate' AND CAST(er.[date] AS date) = o.order_date
JOIN SpaceParts.products p ON p.product_key = o.product_key
WHERE o.order_date >= '2022-01-01' AND o.order_date < '2023-01-01'
GROUP BY p.[type]
ORDER BY cancelled_pct DESC
GO

-- P1 · Planning · How does the 2022 forecast compare with the 2022 budget by product type?
WITH fc AS (
    SELECT product_type, SUM(forecast_eur) AS forecast_eur
    FROM SpaceParts.forecast
    WHERE forecast_month >= '2022-01-01' AND forecast_month < '2023-01-01'
    GROUP BY product_type),
bud AS (
    SELECT p.[type] AS product_type, SUM(b.total_budget) AS budget_eur
    FROM SpaceParts.budget b
    JOIN SpaceParts.products p ON p.product_key = b.product_key
    WHERE b.[month] >= '2022-01-01' AND b.[month] < '2023-01-01'
    GROUP BY p.[type])
SELECT fc.product_type,
       CAST(fc.forecast_eur AS decimal(18,0)) AS forecast_eur,
       CAST(bud.budget_eur AS decimal(18,0)) AS budget_eur,
       CAST(fc.forecast_eur - bud.budget_eur AS decimal(18,0)) AS gap_eur,
       CAST(100.0 * (fc.forecast_eur / bud.budget_eur - 1) AS decimal(9,1)) AS gap_pct
FROM fc JOIN bud ON bud.product_type = fc.product_type
ORDER BY gap_eur ASC
GO

-- P2 · Planning · Which territories are furthest behind their forecast so far this year?
WITH fc AS (
    SELECT region_territory AS territory, SUM(forecast_eur) AS forecast_eur
    FROM SpaceParts.forecast
    WHERE forecast_month >= '2022-01-01' AND forecast_month < '2022-08-01'
    GROUP BY region_territory),
act AS (
    SELECT r.territory, SUM(i.net_invoice_value / br.rate * er.rate) AS actual_eur
    FROM SpaceParts.invoices i
    JOIN SpaceParts.invoice_doc_type d ON d.billing_document_type_code = i.billing_document_type_code AND d.[group] = 'Invoice'
    JOIN SpaceParts.budget_rate br ON br.from_currency = i.local_currency
    JOIN SpaceParts.exchange_rate er ON er.from_currency = i.local_currency AND er.rate_type = 'Monthly Rate' AND CAST(er.[date] AS date) = i.billing_date
    JOIN SpaceParts.customers c ON c.customer_key = i.customer_key
    JOIN SpaceParts.regions r ON r.station = c.station
    WHERE i.billing_date >= '2022-01-01' AND i.billing_date < '2022-08-01'
    GROUP BY r.territory)
SELECT TOP 5 fc.territory,
       CAST(COALESCE(act.actual_eur, 0) AS decimal(18,0)) AS actual_eur,
       CAST(fc.forecast_eur AS decimal(18,0)) AS forecast_eur,
       CAST(COALESCE(act.actual_eur, 0) - fc.forecast_eur AS decimal(18,0)) AS gap_eur,
       CAST(100.0 * (COALESCE(act.actual_eur, 0) / fc.forecast_eur - 1) AS decimal(9,1)) AS gap_pct
FROM fc LEFT JOIN act ON act.territory = fc.territory
ORDER BY gap_eur ASC
GO

-- P3 · Planning · How are SpaceParts brands doing against private brands this year compared with last year?
WITH s AS (
    SELECT b.class AS brand_class, YEAR(i.billing_date) AS yr,
           SUM(i.net_invoice_value / br.rate * er.rate) AS net_sales_eur
    FROM SpaceParts.invoices i
    JOIN SpaceParts.invoice_doc_type d ON d.billing_document_type_code = i.billing_document_type_code AND d.[group] = 'Invoice'
    JOIN SpaceParts.budget_rate br ON br.from_currency = i.local_currency
    JOIN SpaceParts.exchange_rate er ON er.from_currency = i.local_currency AND er.rate_type = 'Monthly Rate' AND CAST(er.[date] AS date) = i.billing_date
    JOIN SpaceParts.products p ON p.product_key = i.product_key
    JOIN SpaceParts.brands b ON b.sub_brand = p.sub_brand_name
    WHERE (i.billing_date >= '2022-01-01' AND i.billing_date <= '2022-08-21')
       OR (i.billing_date >= '2021-01-01' AND i.billing_date <= '2021-08-21')
    GROUP BY b.class, YEAR(i.billing_date))
SELECT cy.brand_class,
       CAST(cy.net_sales_eur AS decimal(18,0)) AS ytd_2022_eur,
       CAST(py.net_sales_eur AS decimal(18,0)) AS same_period_2021_eur,
       CAST(100.0 * (cy.net_sales_eur / py.net_sales_eur - 1) AS decimal(9,1)) AS growth_pct
FROM s cy JOIN s py ON py.brand_class = cy.brand_class AND py.yr = 2021
WHERE cy.yr = 2022
ORDER BY ytd_2022_eur DESC
GO

-- P4 · Planning · Which brands are furthest behind budget this year?
WITH act AS (
    SELECT b.brand, SUM(i.net_invoice_value / br.rate * er.rate) AS actual_eur
    FROM SpaceParts.invoices i
    JOIN SpaceParts.invoice_doc_type d ON d.billing_document_type_code = i.billing_document_type_code AND d.[group] = 'Invoice'
    JOIN SpaceParts.budget_rate br ON br.from_currency = i.local_currency
    JOIN SpaceParts.exchange_rate er ON er.from_currency = i.local_currency AND er.rate_type = 'Monthly Rate' AND CAST(er.[date] AS date) = i.billing_date
    JOIN SpaceParts.products p ON p.product_key = i.product_key
    JOIN SpaceParts.brands b ON b.sub_brand = p.sub_brand_name
    WHERE i.billing_date >= '2022-01-01' AND i.billing_date < '2022-08-01'
    GROUP BY b.brand),
bud AS (
    SELECT b.brand, SUM(bg.total_budget) AS budget_eur
    FROM SpaceParts.budget bg
    JOIN SpaceParts.products p ON p.product_key = bg.product_key
    JOIN SpaceParts.brands b ON b.sub_brand = p.sub_brand_name
    WHERE bg.[month] >= '2022-01-01' AND bg.[month] < '2022-08-01'
    GROUP BY b.brand)
SELECT TOP 5 bud.brand,
       CAST(act.actual_eur AS decimal(18,0)) AS actual_eur,
       CAST(bud.budget_eur AS decimal(18,0)) AS budget_eur,
       CAST(act.actual_eur - bud.budget_eur AS decimal(18,0)) AS gap_eur,
       CAST(100.0 * (act.actual_eur / bud.budget_eur - 1) AS decimal(9,1)) AS gap_pct
FROM bud LEFT JOIN act ON act.brand = bud.brand
ORDER BY gap_eur ASC
