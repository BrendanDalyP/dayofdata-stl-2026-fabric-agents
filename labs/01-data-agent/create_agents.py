"""Creates (or updates) and publishes the SpaceParts agent team from the files in ./agents.

Each agents/<name>/ folder holds:
    agent.json                   name, description (becomes the MCP tool description), tables
    instructions.md              agent instructions
    datasource-instructions.md   data source instructions
    fewshots.json                example queries (run validate_fewshots.py first)

Usage (after `az login` to the tenant that owns the workspace):
    pip install mssql-python
    python create_agents.py --workspace-id <guid> --lakehouse-id <guid> --lakehouse-name lh__spaceparts \
        --sql-server <endpoint>.datawarehouse.fabric.microsoft.com [--schema SpaceParts] [--only sales-analyst] [--folder-id <guid>]

Prints each agent's MCP URL. Re-running updates the agents in place and republishes them.
"""
from __future__ import annotations

import argparse, base64, json, pathlib, subprocess, sys, time, uuid, urllib.error, urllib.request

API = "https://api.fabric.microsoft.com/v1"
SCHEMA_BASE = "https://developer.microsoft.com/json-schemas/fabric/item/dataAgent/definition"
ROOT = pathlib.Path(__file__).parent / "agents"


def az_token(resource: str) -> str:
    out = subprocess.run(
        ["az", "account", "get-access-token", "--resource", resource, "--query", "accessToken", "-o", "tsv"],
        capture_output=True, text=True, shell=sys.platform == "win32",
    )
    if out.returncode != 0 or not out.stdout.strip():
        sys.exit(f"Could not get a token. Run 'az login' first.\n{out.stderr}")
    return out.stdout.strip()


TOKEN = None


def call(method: str, url: str, body: dict | None = None):
    req = urllib.request.Request(url, method=method, data=None if body is None else json.dumps(body).encode())
    req.add_header("Authorization", f"Bearer {TOKEN}")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            if r.status == 202 and r.headers.get("Location"):
                return wait(r.headers["Location"])
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        sys.exit(f"{method} {url} → {e.code}\n{e.read().decode()[:2000]}")


def wait(location: str):
    while True:
        time.sleep(2)
        op = call("GET", location)
        if op and op.get("status") in ("Succeeded", "Failed"):
            if op["status"] == "Failed":
                sys.exit(f"Operation failed: {json.dumps(op)[:2000]}")
            try:
                return call("GET", location.rstrip("/") + "/result")
            except SystemExit:
                return None


def columns_for(sql_server: str, db: str, schema: str, tables: list[str]) -> dict[str, list[tuple[str, str]]]:
    import mssql_python

    conn = mssql_python.connect(f"Server={sql_server},1433;Database={db};Encrypt=yes;Authentication=ActiveDirectoryDefault;")
    cur = conn.cursor()
    cur.execute(
        "SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, ORDINAL_POSITION",
        (schema,),
    )
    cols: dict[str, list[tuple[str, str]]] = {}
    for t, c, d in cur.fetchall():
        if t in tables:
            cols.setdefault(t, []).append((c, d))
    conn.close()
    missing = set(tables) - set(cols)
    if missing:
        sys.exit(f"Tables not found in {schema}: {sorted(missing)}")
    return cols


def element(name: str, type_: str, selected: bool, children: list | None = None, data_type: str | None = None) -> dict:
    e = {"id": str(uuid.uuid4()), "is_selected": selected, "display_name": name, "type": type_, "description": None, "children": children or []}
    if data_type:
        e["data_type"] = data_type
    return e


def b64(obj) -> str:
    return base64.b64encode(json.dumps(obj, ensure_ascii=False, indent=2).encode("utf-8")).decode()


def build_definition(folder: pathlib.Path, args, cols, blank: bool = False) -> tuple[dict, dict]:
    meta = json.loads((folder / "agent.json").read_text(encoding="utf-8"))
    # blank: same tables, but no instructions and no example queries (the live-build starting point)
    instructions = "" if blank else (folder / "instructions.md").read_text(encoding="utf-8")
    ds_instructions = "" if blank else (folder / "datasource-instructions.md").read_text(encoding="utf-8")
    shots = [] if blank else json.loads((folder / "fewshots.json").read_text(encoding="utf-8"))

    tables = [
        element(t, "lakehouse_tables.table", True, [element(c, "lakehouse_tables.column", True, data_type=d) for c, d in cols[t]])
        for t in meta["tables"]
    ]
    elements = [
        element("Schemas", "schema_grouping", False, [
            element(args.schema, "lakehouse_tables.schema", True, [element("Tables", "table_grouping", False, tables)])
        ])
    ]
    ds_folder = f"Files/Config/draft/lakehouse-tables-{args.lakehouse_name}"
    parts = [
        {"path": "Files/Config/data_agent.json", "payload": b64({"$schema": f"{SCHEMA_BASE}/dataAgent/2.1.0/schema.json"}), "payloadType": "InlineBase64"},
        {"path": "Files/Config/draft/stage_config.json", "payload": b64({"$schema": f"{SCHEMA_BASE}/stageConfiguration/1.0.0/schema.json", "aiInstructions": instructions}), "payloadType": "InlineBase64"},
        {"path": f"{ds_folder}/datasource.json", "payload": b64({
            "$schema": f"{SCHEMA_BASE}/dataSource/1.0.0/schema.json",
            "artifactId": args.lakehouse_id, "workspaceId": args.workspace_id,
            "dataSourceInstructions": ds_instructions, "displayName": args.lakehouse_name,
            "type": "lakehouse_tables", "userDescription": meta["description"], "metadata": {}, "elements": elements,
        }), "payloadType": "InlineBase64"},
        {"path": f"{ds_folder}/fewshots.json", "payload": b64({
            "$schema": f"{SCHEMA_BASE}/fewShots/1.0.0/schema.json",
            "fewShots": [{"id": str(uuid.uuid4()), "question": s["question"], "query": s["query"]} for s in shots],
        }), "payloadType": "InlineBase64"},
    ]
    return meta, {"parts": parts}


LIVE_NAME = "SpaceParts Sales Analyst (live)"


def live_reset(args):
    """Create or reset the live-build agent: Sales Analyst tables, empty instructions, no examples, unpublished."""
    global TOKEN
    folder = ROOT / "sales-analyst"
    meta = json.loads((folder / "agent.json").read_text(encoding="utf-8"))
    cols = columns_for(args.sql_server, args.lakehouse_name, args.schema, meta["tables"])
    _, definition = build_definition(folder, args, cols, blank=True)
    TOKEN = az_token("https://api.fabric.microsoft.com")
    ws = args.workspace_id
    existing = {a["displayName"]: a["id"] for a in (call("GET", f"{API}/workspaces/{ws}/dataAgents") or {}).get("value", [])}
    if LIVE_NAME in existing:
        print(f"Resetting {LIVE_NAME} ({existing[LIVE_NAME]})")
        call("POST", f"{API}/workspaces/{ws}/dataAgents/{existing[LIVE_NAME]}/updateDefinition", {"definition": definition})
    else:
        print(f"Creating  {LIVE_NAME}")
        body = {"displayName": LIVE_NAME, "description": "Live-build copy of the Sales Analyst for Demo 1. Not used by the app.", "definition": definition}
        if args.folder_id:
            body["folderId"] = args.folder_id
        call("POST", f"{API}/workspaces/{ws}/dataAgents", body)
    print("Done: 8 tables selected, no instructions, no example queries, not published.")


def main():
    global TOKEN
    p = argparse.ArgumentParser()
    p.add_argument("--workspace-id", required=True)
    p.add_argument("--lakehouse-id", required=True)
    p.add_argument("--lakehouse-name", required=True)
    p.add_argument("--sql-server", required=True)
    p.add_argument("--schema", default="SpaceParts")
    p.add_argument("--only", help="agent folder name to build, e.g. sales-analyst")
    p.add_argument("--folder-id", help="workspace folder to create the agents in (e.g. Day of Data STL)")
    p.add_argument("--live-reset", action="store_true",
                   help="create or reset 'SpaceParts Sales Analyst (live)': the Sales tables only, no instructions, no examples, "
                        "not published. The starting point for the live build in Demo 1; re-run to reset it.")
    args = p.parse_args()

    if args.live_reset:
        live_reset(args)
        return

    folders = [f for f in sorted(ROOT.iterdir()) if (f / "agent.json").exists() and (not args.only or f.name == args.only)]
    all_tables = sorted({t for f in folders for t in json.loads((f / "agent.json").read_text(encoding="utf-8"))["tables"]})
    cols = columns_for(args.sql_server, args.lakehouse_name, args.schema, all_tables)

    TOKEN = az_token("https://api.fabric.microsoft.com")
    ws = args.workspace_id
    existing = {a["displayName"]: a["id"] for a in (call("GET", f"{API}/workspaces/{ws}/dataAgents") or {}).get("value", [])}

    results = {}
    for folder in folders:
        meta, definition = build_definition(folder, args, cols)
        name = meta["name"]
        if name in existing:
            agent_id = existing[name]
            print(f"Updating  {name} ({agent_id})")
            call("POST", f"{API}/workspaces/{ws}/dataAgents/{agent_id}/updateDefinition", {"definition": definition})
        else:
            print(f"Creating  {name}")
            body = {"displayName": name, "description": meta["description"][:256], "definition": definition}
            if args.folder_id:
                body["folderId"] = args.folder_id
            created = call("POST", f"{API}/workspaces/{ws}/dataAgents", body)
            agent_id = (created or {}).get("id") or {a["displayName"]: a["id"] for a in call("GET", f"{API}/workspaces/{ws}/dataAgents")["value"]}[name]
        print(f"Publishing {name}")
        call("POST", f"{API}/workspaces/{ws}/dataAgents/{agent_id}/staging/publish", {"publishedDescription": meta["description"]})
        results[folder.name] = {
            "name": name,
            "id": agent_id,
            "mcpUrl": f"{API}/mcp/workspaces/{ws}/dataagents/{agent_id}/agent",
        }

    out = pathlib.Path(__file__).parent / "published-agents.json"
    merged = json.loads(out.read_text(encoding="utf-8")) if out.exists() else {}
    merged.update(results)
    out.write_text(json.dumps(merged, indent=2), encoding="utf-8")
    print(json.dumps(results, indent=2))
    print(f"\nSaved to {out.name}")


if __name__ == "__main__":
    main()
