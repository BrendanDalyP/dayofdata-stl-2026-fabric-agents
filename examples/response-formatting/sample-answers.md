# Sample answers

What the template in [`agent-instructions-template.md`](agent-instructions-template.md) produces. The figures are real SpaceParts answers, checked against `labs/01-data-agent/verify_answers.sql`.

## 1. A full answer

> **Which key accounts are furthest behind budget this year?**

Five key accounts are behind budget for January–July 2022; **Government Contract** is furthest behind at **−€104,564,389 (−8.2%)**.

- **Government Contract** alone accounts for more than half of the combined shortfall.
- **Supernova Spaceparts** is close behind in percentage terms at **−7.9%**.
- The other three are within 5% of budget; **Sigil Interstellar** is nearly on plan at **−1.8%**.

| Key account | Actual (EUR) | Budget (EUR) | Gap (EUR) | Gap (%) |
| --- | ---: | ---: | ---: | ---: |
| Government Contract | 1,168,869,267 | 1,273,433,656 | −104,564,389 | −8.2 |
| Supernova Spaceparts | 342,380,213 | 371,872,861 | −29,492,648 | −7.9 |
| Pioneering Systems | 346,142,027 | 363,579,984 | −17,437,957 | −4.8 |
| Black Flag Spaceships | 268,780,019 | 281,906,391 | −13,126,372 | −4.7 |
| Sigil Interstellar | 355,404,464 | 361,737,958 | −6,333,494 | −1.8 |

Chart: diverging bar chart of the gap (%) by key account.

Notes: real invoices only · euros at monthly rates · complete months Jan–Jul 2022 · key accounts with a negative gap.

**Why it works:** the first line answers the question; the table has units in the headers and is sorted by the shortfall, so an app can chart it without guessing; the Notes say what was assumed.

## 2. A single number

> **What were net sales this year?**

Net sales were **€9,026,084,019** in 2022 to 21 Aug.

Notes: real invoices only · euros at monthly rates · the data ends 21 Aug 2022.

## 3. Asking for clarification (rarely)

> **How is Supernova doing?**

Do you mean net sales against budget, or growth against the same period last year? (Against budget it's −7.9% for Jan–Jul 2022.)

**Why it works:** one question, the likeliest options, and a useful number anyway.

## 4. Stating an assumption instead of asking

> **Sales by region**

Net sales were **€9,026,084,019** across 15 regions in 2022 to 21 Aug; **Îlos V Region** led with **€2,399,631,496**.

*(table and chart line as in example 1)*

Notes: assumed "this year" (2022 to 21 Aug) because no period was given.

## 5. Declining, and pointing somewhere useful

> **Which orders are overdue for Government Contract?**

Orders and deliveries are answered by the **Operations** agent. I can tell you Government Contract's net sales against budget instead: −€104,564,389 (−8.2%) for Jan–Jul 2022.

> **Will we hit budget by December?**

I can't predict from the data, which ends on 21 Aug 2022. I can show how far behind each key account is and what monthly run-rate would close the gap.
