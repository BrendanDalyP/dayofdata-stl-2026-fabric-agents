"""Seed demo actions: puts a handful of realistic items on the app's Action board, so it isn't
empty on stage. Re-runnable: it first removes the rows it seeded before (sourceQuestion starts
with 'seed: demo'), then inserts them again. Items you created in the app are left alone.

The rows follow the same rules as the Rayfin functions (rayfin/functions/src/actions.ts):
priority and due date by kind, owner text, and the recovery maths of buildRecoveryPlan.
The numbers come from labs/01-data-agent/expected-answers.md.

Usage (after `az login`; needs pip install mssql-python):
    python fabric/seed_demo_actions.py --workspace-id <ws>              # finds the app's SQL database
    python fabric/seed_demo_actions.py --server <fqdn> --database <db>  # or name it yourself
"""
import argparse, datetime as dt, json, subprocess, sys, uuid

import mssql_python

APP_DB_PREFIX = "spaceparts-mission-control"
MONTHS_REMAINING = 5  # Aug–Dec 2022
SEED = "seed: demo action"
RULES = {"escalation": ("high", 2), "follow-up": ("medium", 5), "watch": ("low", 30)}  # recovery-plan: see plan()


def find_db(ws: str) -> tuple[str, str]:
    out = subprocess.run(["az", "rest", "--resource", "https://api.fabric.microsoft.com", "-u",
                          f"https://api.fabric.microsoft.com/v1/workspaces/{ws}/sqlDatabases"],
                         capture_output=True, text=True, shell=sys.platform == "win32")
    if out.returncode:
        sys.exit(f"Couldn't list SQL databases (run 'az login'?): {out.stderr[:400]}")
    for d in json.loads(out.stdout)["value"]:
        if d["displayName"].startswith(APP_DB_PREFIX):
            return d["properties"]["serverFqdn"].split(",")[0], d["properties"]["databaseName"]
    sys.exit(f"No SQL database named {APP_DB_PREFIX}* in workspace {ws}. Deploy the app first (npx rayfin up).")


def due(days: int) -> dt.datetime:
    d = dt.datetime.now(dt.timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
    return d + dt.timedelta(days=days)


def plan(subject: str, actual: float, budget_ytd: float, budget_fy: float) -> dict:
    """Same maths as planRecovery() in rayfin/functions/src/actions.ts."""
    gap_pct = (actual / budget_ytd - 1) * 100
    required = max(0.0, budget_fy - actual)
    monthly_needed = required / MONTHS_REMAINING
    monthly_budget = (budget_fy - budget_ytd) / MONTHS_REMAINING
    uplift = (monthly_needed / monthly_budget - 1) * 100
    verdict = "on track" if actual >= budget_ytd else "recoverable" if uplift <= 5 else "stretch" if uplift <= 15 else "reset the plan"
    e = lambda v: f"€{round(v):,}"
    steps = [
        f"Lift monthly net sales from {e(monthly_budget)} (budget) to {e(monthly_needed)} for the next {MONTHS_REMAINING} months (+{uplift:.1f}%).",
        "Ask Operations for open and overdue orders for this account — shipping the backlog is the fastest revenue.",
        "Ask Planning whether the forecast already assumes the shortfall.",
        "Agree the plan with the key account manager and review it in the monthly business review."
        if verdict != "reset the plan" else "The uplift is above 15%: agree a re-forecast with the key account manager rather than chase the budget.",
    ]
    return {"kind": "recovery-plan", "title": f"Recovery plan · {subject} ({verdict})", "subject": subject, "detail": "\n".join(steps),
            "priority": "high" if gap_pct <= -5 else "medium", "due_days": 7, "amount": round(required, 2), "agent": "sales"}


def action(kind: str, title: str, subject: str | None, detail: str, agent: str, status: str = "open") -> dict:
    priority, days = RULES[kind]
    return {"kind": kind, "title": title, "subject": subject, "detail": detail, "priority": priority, "due_days": days, "amount": None, "agent": agent, "status": status}


ITEMS = [
    plan("Government Contract", 1_168_869_267, 1_273_433_656, 2_241_183_800),
    action("escalation", "Escalate overdue orders · Government Contract", "Government Contract",
           "€48.8m of overdue orders across 19,244 lines — the largest overdue balance of any key account.", "operations"),
    action("follow-up", "Forecast below budget · Electrical", "Electrical",
           "2022 forecast €516.5m vs budget €676.7m (−23.7%, −€160.1m) — the widest gap of any product type.", "planning"),
    action("follow-up", "Follow up with Supernova Spaceparts", "Supernova Spaceparts",
           "−€29.5m (−7.9%) against budget Jan–Jul 2022; second-furthest behind of the 13 key accounts.", "sales"),
    action("watch", "Watch Sigil Interstellar", "Sigil Interstellar",
           "−1.8% against budget Jan–Jul 2022 — at-watch; check again after August closes.", "sales"),
    action("follow-up", "Follow up with Black Flag Spaceships", "Black Flag Spaceships",
           "−4.7% against budget Jan–Jul 2022. Account manager confirmed two delayed orders ship in August.", "sales", status="done"),
]


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--workspace-id")
    p.add_argument("--server")
    p.add_argument("--database")
    a = p.parse_args()
    if a.server and a.database:
        server, db = a.server, a.database
    elif a.workspace_id:
        server, db = find_db(a.workspace_id)
    else:
        sys.exit("Pass --workspace-id, or --server and --database.")

    conn = mssql_python.connect(f"Server={server},1433;Database={db};Encrypt=yes;Authentication=ActiveDirectoryDefault;")
    cur = conn.cursor()
    cur.execute("DELETE FROM dbo.ActionItems WHERE sourceQuestion LIKE ?", (f"{SEED}%",))
    removed = cur.rowcount
    now = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)
    for i, it in enumerate(ITEMS):
        subject = it["subject"]
        cur.execute(
            "INSERT INTO dbo.ActionItems (id, kind, status, title, subject, detail, owner, priority, amountEur, dueDate, agent, sourceQuestion, createdAt) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), it["kind"], it.get("status", "open"), it["title"], subject, it["detail"],
             f"Key account manager · {subject}" if subject else "Sales operations",
             it["priority"], it["amount"], due(it["due_days"]), it["agent"], SEED,
             now - dt.timedelta(minutes=10 * (len(ITEMS) - i))))
    conn.commit()
    cur.execute("SELECT priority, status, title FROM dbo.ActionItems ORDER BY createdAt")
    rows = cur.fetchall()
    conn.close()
    print(f"Removed {max(removed, 0)} earlier seed rows; added {len(ITEMS)}. The board now has {len(rows)} items:")
    for r in rows:
        print(f"  [{r[1]:4}] {r[0]:6}  {r[2]}")


if __name__ == "__main__":
    main()
