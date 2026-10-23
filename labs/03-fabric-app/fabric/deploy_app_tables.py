"""Creates (or updates) the notebook nb__build_app_tables in your workspace, attaches the
SpaceParts lakehouse, runs it, and waits. The notebook runs build_app_tables.sql in Spark and
writes three small Delta tables (app.sales_vs_budget, app.delivery_by_month,
app.forecast_vs_budget) that the app's Overview page reads through the Rayfin connector.

Why tables and not SQL views: the Rayfin lakehouse connector reads through Fabric's GraphQL
layer, which needs table metadata — views are rejected ("Could not find metadata").

Usage (after `az login`):
    python deploy_app_tables.py --workspace-id <guid> --lakehouse-id <guid> --lakehouse-name lh__spaceparts
"""
import argparse, base64, json, pathlib, re, subprocess, sys, time, urllib.error, urllib.request

API = "https://api.fabric.microsoft.com/v1"
HERE = pathlib.Path(__file__).parent
NAME = "nb__build_app_tables"


def token() -> str:
    out = subprocess.run(["az", "account", "get-access-token", "--resource", "https://api.fabric.microsoft.com",
                          "--query", "accessToken", "-o", "tsv"], capture_output=True, text=True, shell=sys.platform == "win32")
    if out.returncode or not out.stdout.strip():
        sys.exit("Run 'az login' first.")
    return out.stdout.strip()


TOKEN = ""


def call(method, url, body=None, raw=False):
    req = urllib.request.Request(url, method=method, data=None if body is None else json.dumps(body).encode())
    req.add_header("Authorization", f"Bearer {TOKEN}")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as r:
            data = r.read()
            if raw:
                return r
            if r.status == 202 and r.headers.get("Location") and method == "POST" and "jobs/instances" not in url:
                return poll(r.headers["Location"])
            return json.loads(data) if data else None
    except urllib.error.HTTPError as e:
        sys.exit(f"{method} {url} → {e.code}\n{e.read().decode()[:2000]}")


def poll(loc):
    while True:
        time.sleep(3)
        op = call("GET", loc)
        if op and op.get("status") in ("Succeeded", "Failed", "Completed", "Cancelled"):
            return op


def notebook_definition(ws: str, lh: str, lh_name: str) -> dict:
    sql = (HERE / "build_app_tables.sql").read_text(encoding="utf-8")
    statements = [s.strip() for s in re.split(r";\s*$", re.sub(r"^\s*--.*$", "", sql, flags=re.M), flags=re.M) if s.strip()]
    cells = [{"cell_type": "markdown", "metadata": {}, "source": ["# Build app tables\n", "Small Delta tables for the SpaceParts app's Overview page. Generated from `labs/03-fabric-app/fabric/build_app_tables.sql`."]}]
    for s in statements:
        cells.append({"cell_type": "code", "metadata": {"microsoft": {"language": "sparksql"}}, "execution_count": None, "outputs": [],
                      "source": ["%%sql\n", s + "\n"]})
    cells.append({"cell_type": "code", "metadata": {}, "execution_count": None, "outputs": [],
                  "source": ["for t in ['sales_vs_budget', 'delivery_by_month', 'forecast_vs_budget']:\n",
                             "    print(t, spark.table(f'app.{t}').count())\n"]})
    nb = {
        "nbformat": 4, "nbformat_minor": 5, "cells": cells,
        "metadata": {
            "language_info": {"name": "python"},
            "kernel_info": {"name": "synapse_pyspark"},
            "dependencies": {"lakehouse": {"default_lakehouse": lh, "default_lakehouse_name": lh_name, "default_lakehouse_workspace_id": ws}},
        },
    }
    payload = base64.b64encode(json.dumps(nb).encode()).decode()
    return {"format": "ipynb", "parts": [{"path": "notebook-content.ipynb", "payload": payload, "payloadType": "InlineBase64"}]}


def main():
    global TOKEN
    p = argparse.ArgumentParser()
    p.add_argument("--workspace-id", required=True)
    p.add_argument("--lakehouse-id", required=True)
    p.add_argument("--lakehouse-name", required=True)
    p.add_argument("--folder-id", help="workspace folder for the notebook")
    a = p.parse_args()
    TOKEN = token()
    ws = a.workspace_id
    definition = notebook_definition(ws, a.lakehouse_id, a.lakehouse_name)

    existing = [n for n in call("GET", f"{API}/workspaces/{ws}/notebooks")["value"] if n["displayName"] == NAME]
    if existing:
        nb_id = existing[0]["id"]
        print(f"Updating {NAME} ({nb_id})")
        call("POST", f"{API}/workspaces/{ws}/notebooks/{nb_id}/updateDefinition", {"definition": definition})
    else:
        print(f"Creating {NAME}")
        body = {"displayName": NAME, "definition": definition}
        if a.folder_id:
            body["folderId"] = a.folder_id
        call("POST", f"{API}/workspaces/{ws}/notebooks", body)
        nb_id = [n for n in call("GET", f"{API}/workspaces/{ws}/notebooks")["value"] if n["displayName"] == NAME][0]["id"]

    print("Running… (Spark start-up takes a minute or two)")
    r = call("POST", f"{API}/workspaces/{ws}/items/{nb_id}/jobs/instances?jobType=RunNotebook", {}, raw=True)
    loc = r.headers["Location"]
    while True:
        time.sleep(10)
        job = call("GET", loc)
        status = job.get("status")
        print(f"  {status}")
        if status in ("Completed", "Failed", "Cancelled", "Deduped"):
            break
    if status != "Completed":
        sys.exit(f"Notebook run {status}: {json.dumps(job.get('failureReason'))[:1500]}")
    print("Done. Tables: app.sales_vs_budget, app.delivery_by_month, app.forecast_vs_budget")


if __name__ == "__main__":
    main()
