"""Runs every example query in agents/*/fewshots.json against the lakehouse SQL endpoint.

Usage (after `az login`):
    pip install mssql-python
    set SQL_SERVER=<your-endpoint>.datawarehouse.fabric.microsoft.com
    set SQL_DB=lh__spaceparts
    python validate_fewshots.py
An example query that fails here will mislead the agent, so fix it before you publish.
"""
import json, os, pathlib, sys, time
import mssql_python

root = pathlib.Path(__file__).parent / "agents"
conn = mssql_python.connect(
    f"Server={os.environ['SQL_SERVER']},1433;Database={os.environ['SQL_DB']};Encrypt=yes;Authentication=ActiveDirectoryDefault;"
)
cur = conn.cursor()
failures = 0
for f in sorted(root.glob("*/fewshots.json")):
    for shot in json.loads(f.read_text(encoding="utf-8")):
        t = time.time()
        try:
            cur.execute(shot["query"])
            rows = cur.fetchall()
            first = rows[0] if rows else None
            print(f"PASS  {f.parent.name:<14} {len(rows):>4} rows {time.time()-t:5.1f}s  {shot['question']}\n      first row: {first}")
        except Exception as e:  # noqa: BLE001
            failures += 1
            print(f"FAIL  {f.parent.name:<14} {shot['question']}\n      {str(e)[:400]}")
conn.close()
sys.exit(1 if failures else 0)
