## General knowledge
All tables are in the `SpaceParts` schema. Write T-SQL for the lakehouse SQL analytics endpoint. Bracket the column names `[group]`, `[type]`, `[date]` and `[month]`.

## Currency rule (always apply)
`invoices.net_invoice_value` is in the customer's local currency (`invoices.local_currency`). Never add local values together. Convert every value to euros like this:

    net_invoice_value / budget_rate.rate * exchange_rate.rate

- join `SpaceParts.budget_rate br ON br.from_currency = i.local_currency`
- join `SpaceParts.exchange_rate er ON er.from_currency = i.local_currency AND er.rate_type = 'Monthly Rate' AND CAST(er.[date] AS date) = i.billing_date`

`budget.total_budget` is already in euros; do not convert it.

## Net sales rule (always apply)
Count only real invoices: join `SpaceParts.invoice_doc_type d ON d.billing_document_type_code = i.billing_document_type_code AND d.[group] = 'Invoice'`. Filter dates on `invoices.billing_date`, never `ship_date`.

## Dates
The data ends on 2022-08-21. "This year" = `billing_date >= '2022-01-01'`. "Last year" = `billing_date BETWEEN '2021-01-01' AND '2021-08-21'`. Budget comparisons use complete months: `billing_date >= '2022-01-01' AND billing_date < '2022-08-01'` against `budget.[month] >= '2022-01-01' AND budget.[month] < '2022-08-01'`. Never use GETDATE() or YEAR(GETDATE()).

## Table descriptions and joins
- `invoices`: one row per invoice line (18M rows). Join `customers` on `customer_key`, `products` on `product_key`, `invoice_doc_type` on `billing_document_type_code`.
- `budget`: monthly budget in euros per customer and product (`[month]` is the first of the month). Aggregate budget and actuals separately in two CTEs, then join the results; never join `budget` to `invoices` row by row.
- `customers`: `customer_key`, `account_name`, `key_account_name`, `account_type`, `account_manager`, `key_account_manager`, `station`. Join `regions` on `station`.
- `regions`: one row per `station`, with `territory`, `system` and `interplanetary_region`.
- `products`: one row per `product_key`; `[type]` is the product type (9 values), `sub_brand_name` the sub-brand.
- `budget_rate`: one fixed rate per currency. `exchange_rate`: daily rates; use `rate_type = 'Monthly Rate'`.

## When asked about…
- key accounts: filter `customers.account_type = 'Key Account'` and group by `key_account_name`.
- account managers: group by `customers.account_manager`.
- product types: group by `products.[type]`.

## Key accounts (match these names to `customers.key_account_name`)
Government Contract, Andromeda Shipyards, Macrohard Systems, Miller Space, Pioneering Systems, Supernova Spaceparts, Sigil Interstellar, Wel Walla Ship Repair, Black Flag Spaceships, Aminu Kano Navy, Antarctic Corporation, Elysium Aerospace.
When a question names one of these, it is a **key account**: filter `customers.account_type = 'Key Account' AND customers.key_account_name = '<name>'`. Never search `customer_soldto_name` or `account_name` for them, and never ask the user to spell it differently.
A single month ("in April 2022") means that calendar month: `billing_date >= '2022-04-01' AND billing_date < '2022-05-01'`, compared with `budget.[month] = '2022-04-01'`.
