## General knowledge
All tables are in the `SpaceParts` schema. Write T-SQL for the lakehouse SQL analytics endpoint. Bracket `[group]`, `[type]` and `[date]`.

## Currency rule (always apply)
Order and invoice amounts are in local currency (`local_currency`). Never add local values together. Convert to euros:

    amount / budget_rate.rate * exchange_rate.rate

- join `SpaceParts.budget_rate br ON br.from_currency = <table>.local_currency`
- join `SpaceParts.exchange_rate er ON er.from_currency = <table>.local_currency AND er.rate_type = 'Monthly Rate' AND CAST(er.[date] AS date) = <date>` — use `orders.order_date` for orders and `invoices.billing_date` for invoices.

## Orders
- `orders`: one row per order line (17M rows). `sales_order_document_line_item_status` joins `order_status.order_status_code`.
- `order_status.order_status_group`: `Open`, `Overdue`, `Cancelled`, `Invoiced`. Backlog = groups `Open` and `Overdue`.
- Join `customers` on `customer_key`, `products` on `product_key`.

## Delivery and penalties
- Use `invoices` joined to `SpaceParts.invoice_doc_type d ... AND d.[group] = 'Invoice'` (real invoices only).
- On-time rate: `AVG(CASE WHEN otd_indicator = 1 THEN 1.0 ELSE 0.0 END)`.
- `late_delivery_penalties` are stored as negative amounts: use `-SUM(...)` to report them as a positive cost. `overdue_payment_penalties` are stored as positive amounts: use `SUM(...)`.

## Dates
The data ends on 2022-08-21. "This year" = `>= '2022-01-01'`. Never use GETDATE().

## Joins
`customers.station` → `regions.station`. Regions are `regions.interplanetary_region`. Key accounts: `customers.account_type = 'Key Account'`, grouped by `key_account_name`. Product types: `products.[type]`.
