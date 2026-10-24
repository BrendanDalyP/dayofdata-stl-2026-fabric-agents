## General knowledge
All tables are in the `SpaceParts` schema. Write T-SQL for the lakehouse SQL analytics endpoint. Bracket `[group]`, `[type]`, `[date]` and `[month]`.

## Currency rule (for invoices)
`invoices.net_invoice_value` is in local currency. Convert to euros:

    net_invoice_value / budget_rate.rate * exchange_rate.rate

- join `SpaceParts.budget_rate br ON br.from_currency = i.local_currency`
- join `SpaceParts.exchange_rate er ON er.from_currency = i.local_currency AND er.rate_type = 'Monthly Rate' AND CAST(er.[date] AS date) = i.billing_date`

`forecast.forecast_eur` and `budget.total_budget` are already euros; never convert them.

## Net sales rule
Only real invoices: join `SpaceParts.invoice_doc_type d ON d.billing_document_type_code = i.billing_document_type_code AND d.[group] = 'Invoice'`. Filter on `billing_date`.

## Grain — aggregate before joining
Forecast, budget and invoices have different grains. Always aggregate each one in its own CTE to the level you need, then join the CTEs. Never join two of them row by row.
- `forecast`: `forecast_month` × `region_territory` × `product_type`. `region_territory` matches `regions.territory`; `product_type` matches `products.[type]`.
- `budget`: `[month]` × `customer_key` × `product_key`.
- `invoices`: one row per invoice line.

## Joins
`invoices.product_key` / `budget.product_key` → `products.product_key`. `products.sub_brand_name` → `brands.sub_brand`. `customers.station` → `regions.station`.

## Dates
The data ends on 2022-08-21. Forecast exists only for 2022. Plan comparisons to date use `>= '2022-01-01' AND < '2022-08-01'` on both sides. Never use GETDATE().

## Key accounts (match these names to `customers.key_account_name`)
Government Contract, Andromeda Shipyards, Macrohard Systems, Miller Space, Pioneering Systems, Supernova Spaceparts, Sigil Interstellar, Wel Walla Ship Repair, Black Flag Spaceships, Aminu Kano Navy, Antarctic Corporation, Elysium Aerospace.
When a question names one of these, it is a **key account**: filter `customers.account_type = 'Key Account' AND customers.key_account_name = '<name>'`. Never search `customer_soldto_name` or `account_name` for them, and never ask the user to spell it differently.
A single month ("in April 2022") means that calendar month: `billing_date >= '2022-04-01' AND billing_date < '2022-05-01'`, compared with `budget.[month] = '2022-04-01'`.
