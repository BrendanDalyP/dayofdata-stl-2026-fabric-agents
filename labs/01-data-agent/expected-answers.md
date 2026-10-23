# Expected answers (from verify_answers.sql)

## S1 · sales · What were net sales in euros this year?

| Net sales (eur) |
|---|
| €9,026,084,019 |

## S2 · sales · What were net sales in euros by region this year?

| Interplanetary region | Net sales (eur) |
|---|---|
| Îlos V Region | €2,399,631,496 |
| Îlos IV Region | €1,279,339,327 |
| Îlos VI-VII Region | €985,838,728 |
| Sol IV Region | €937,428,218 |
| Lakonía II Region | €853,627,661 |
| Sol III Region | €732,974,087 |
| Lakonía III-VIII Region | €462,458,164 |
| Transit Gate Region | €436,608,980 |
| Sol Belt Region | €291,461,881 |
| Lakonía IX Region | €289,570,918 |
| Eliad V Region | €167,647,592 |
| Arcadia III Region | €147,951,495 |
| Sol V Region | €38,325,640 |
| Lakonía Belt Region | €1,789,641 |
| Sol VI-VIII Region | €1,430,191 |

## S3 · sales · Which key accounts are furthest behind budget this year?

| Key account name | Actual (eur) | Budget (eur) | Gap (eur) | Gap (%) |
|---|---|---|---|---|
| Government Contract | €1,168,869,267 | €1,273,433,656 | €-104,564,389 | -8.2% |
| Supernova Spaceparts | €342,380,213 | €371,872,861 | €-29,492,648 | -7.9% |
| Pioneering Systems | €346,142,027 | €363,579,984 | €-17,437,957 | -4.8% |
| Black Flag Spaceships | €268,780,019 | €281,906,391 | €-13,126,372 | -4.7% |
| Sigil Interstellar | €355,404,464 | €361,737,958 | €-6,333,494 | -1.8% |

## S4 · sales · How did net sales grow against last year by product type?

| Product type | Ytd 2022 (eur) | Same period 2021 (eur) | Growth (%) |
|---|---|---|---|
| Life Support | €846,776,246 | €728,336,646 | 16.3% |
| Engine & Propulsion | €860,404,898 | €782,120,992 | 10.0% |
| Structural | €796,802,027 | €737,031,442 | 8.1% |
| Projectiles | €2,272,624,262 | €2,136,474,563 | 6.4% |
| Modules | €722,281,661 | €690,401,122 | 4.6% |
| Electrical | €358,204,551 | €349,077,289 | 2.6% |
| Fuel & Piping | €675,466,887 | €680,650,585 | -0.8% |
| Hull & Shields | €2,055,583,143 | €2,158,885,933 | -4.8% |
| Planetary Systems | €437,940,345 | €529,017,433 | -17.2% |

## S5 · sales · Who are the top 5 account managers by net sales this year?

| Account manager | Net sales (eur) |
|---|---|
| Felix Kratochvílová | €290,099,471 |
| Przemysław Bocca | €225,953,651 |
| Sára Menendez | €213,126,925 |
| Josh Blanc | €212,442,160 |
| Františka Tyma | €200,820,204 |

## O1 · operations · What is the open order backlog in euros by order status?

| Order status group | Order status text | Order lines | Order value (eur) |
|---|---|---|---|
| Open | Late Order | 63,903 | €196,442,880 |
| Open | WIP Order | 58,456 | €178,679,898 |
| Open | Future Order | 179,049 | €552,717,878 |
| Overdue | Overdue Order | 104,965 | €326,331,459 |

## O2 · operations · What was the on-time delivery rate by month this year?

| Month | On time (%) | Invoice lines |
|---|---|---|
| Jan 2022 | 70.9% | 284,712 |
| Feb 2022 | 69.5% | 270,709 |
| Mar 2022 | 69.2% | 325,164 |
| Apr 2022 | 67.5% | 298,291 |
| May 2022 | 65.8% | 293,088 |
| Jun 2022 | 67.2% | 307,561 |
| Jul 2022 | 66.2% | 293,857 |
| Aug 2022 | 64.9% | 199,881 |

## O3 · operations · Which regions paid the most late-delivery penalties this year, in euros?

| Interplanetary region | Late penalties (eur) |
|---|---|
| Îlos V Region | €16,948,143 |
| Îlos IV Region | €8,373,001 |
| Sol IV Region | €6,201,410 |
| Îlos VI-VII Region | €5,797,986 |
| Sol III Region | €5,130,048 |

## O4 · operations · Which key accounts have the most overdue order value?

| Key account name | Overdue lines | Overdue value (eur) |
|---|---|---|
| Government Contract | 19,244 | €48,835,506 |
| Antarctic Corporation  | 10,218 | €33,709,730 |
| Macrohard Systems | 7,617 | €23,595,231 |
| Elysium Aerospace | 5,992 | €21,489,006 |
| Andromeda Shipyards | 7,661 | €19,852,745 |

## O5 · operations · What share of order value was cancelled this year, by product type?

| Product type | Cancelled (%) |
|---|---|
| Electrical | 5.0% |
| Fuel & Piping | 4.6% |
| Structural | 4.5% |
| Hull & Shields | 4.3% |
| Projectiles | 4.3% |
| Planetary Systems | 4.3% |
| Engine & Propulsion | 4.2% |
| Modules | 4.1% |
| Life Support | 3.5% |

## P1 · planning · How does the 2022 forecast compare with the 2022 budget by product type?

| Product type | Forecast (eur) | Budget (eur) | Gap (eur) | Gap (%) |
|---|---|---|---|---|
| Hull & Shields | €3,013,150,780 | €3,241,038,379 | €-227,887,598 | -7.0% |
| Electrical | €516,542,653 | €676,676,570 | €-160,133,917 | -23.7% |
| Planetary Systems | €647,385,508 | €761,057,579 | €-113,672,071 | -14.9% |
| Fuel & Piping | €952,469,343 | €1,008,079,430 | €-55,610,087 | -5.5% |
| Projectiles | €3,269,458,787 | €3,315,349,519 | €-45,890,732 | -1.4% |
| Modules | €1,004,483,744 | €1,037,399,507 | €-32,915,763 | -3.2% |
| Structural | €1,110,758,675 | €1,124,672,409 | €-13,913,735 | -1.2% |
| Life Support | €1,145,300,226 | €1,082,082,252 | €63,217,974 | 5.8% |
| Engine & Propulsion | €1,211,004,876 | €1,074,556,934 | €136,447,941 | 12.7% |

## P2 · planning · Which territories are furthest behind their forecast so far this year?

| Territory | Actual (eur) | Forecast (eur) | Gap (eur) | Gap (%) |
|---|---|---|---|---|
| Lakonía II | €779,988,794 | €1,266,726,922 | €-486,738,128 | -38.4% |
| Sol III Gate | €230,399,730 | €591,491,683 | €-361,091,953 | -61.0% |
| Lakonía IX | €197,546,781 | €353,560,578 | €-156,013,797 | -44.1% |
| Îlos Gate | €89,272,002 | €222,007,433 | €-132,735,431 | -59.8% |
| Lakonía Gate | €40,790,225 | €138,138,117 | €-97,347,892 | -70.5% |

## P3 · planning · How are SpaceParts brands doing against private brands this year compared with last year?

| Brand class | Ytd 2022 (eur) | Same period 2021 (eur) | Growth (%) |
|---|---|---|---|
| SpaceParts Brand | €6,573,393,562 | €6,651,588,258 | -1.2% |
| Private Brand | €2,452,690,457 | €2,140,407,746 | 14.6% |

## P4 · planning · Which brands are furthest behind budget this year?

| Brand | Actual (eur) | Budget (eur) | Gap (eur) | Gap (%) |
|---|---|---|---|---|
| Volcanic | €1,146,887,557 | €1,148,262,320 | €-1,374,763 | -0.1% |
| Galileo | €444,204,928 | €438,745,278 | €5,459,650 | 1.2% |
| TH Morgan | €439,405,832 | €431,423,114 | €7,982,718 | 1.9% |
| GateRite | €430,756,392 | €420,532,899 | €10,223,493 | 2.4% |
| Newton | €153,331,686 | €138,186,165 | €15,145,522 | 11.0% |
