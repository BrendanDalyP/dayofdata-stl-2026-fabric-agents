"""Builds evaluate_live_agent.ipynb and (optionally) deploys and runs it in Fabric.

The notebook scores one data agent against SQL-checked answers with the Fabric data agent
evaluation SDK: it asks each question, and an LLM judge compares the agent's answer with the
expected one. By default it scores the draft of "SpaceParts Sales Analyst (live)", the agent Abby
builds in Demo 1, so you can see the score go from 0 (blank) to all-pass (after the three pastes).

Usage:
    python build_eval_notebook.py                       # writes evaluate_live_agent.ipynb
    python build_eval_notebook.py --deploy --workspace-id <ws> --lakehouse-id <lh> --lakehouse-name lh__spaceparts [--folder-id <f>]
    python build_eval_notebook.py --deploy --run ... [--agent "SpaceParts Sales Analyst" --stage production]
"""
import argparse, base64, csv, json, pathlib, subprocess, sys, time, urllib.error, urllib.request

HERE = pathlib.Path(__file__).parent
NB_PATH = HERE / "evaluate_live_agent.ipynb"
NAME = "nb__evaluate_live_agent"
API = "https://api.fabric.microsoft.com/v1"


def md(*lines):
    return {"cell_type": "markdown", "metadata": {}, "source": [l + "\n" for l in lines]}


def code(src, tags=None):
    meta = {"tags": tags} if tags else {}
    return {"cell_type": "code", "metadata": meta, "execution_count": None, "outputs": [], "source": src.strip("\n").splitlines(keepends=True)}


def notebook() -> dict:
    with open(HERE / "ground_truth_sales.csv", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    region = next(r for r in rows if "by region this year" in r["question"])
    # The Demo 1 "before" question: same answer as "this year" (the data ends in Aug 2022)
    rows.append({"question": "What were net sales in euros by region in 2022?", "expected_answer": region["expected_answer"]})
    truth = json.dumps(rows, ensure_ascii=False, indent=1)

    cells = [
        md("# Evaluate the live agent",
           "",
           "Scores one Fabric data agent against answers we already know, checked in SQL (`labs/01-data-agent/verify_answers.sql`).",
           "",
           "**How it works.** `evaluate_data_agent` asks the agent every question in the table below. A second model, **the judge**, reads each",
           "answer (the most recent message in the conversation) next to the expected answer and replies *Yes*, *No* or *Unclear*, following the **critic prompt** (strict about numbers, relaxed about wording).",
           "The results land in two lakehouse tables: a summary and the step-by-step detail, including the SQL the agent wrote.",
           "",
           "**Use it like a unit test.** Run it after every change to instructions, example queries or data. In Demo 1, run it on the blank",
           "live agent (everything fails), paste the three pieces, and run it again (everything passes).",
           "",
           "Attach this notebook to the **lh__spaceparts** lakehouse. The evaluation SDK is in preview."),
        md("## Settings",
           "`STAGE = 'sandbox'` scores the **draft** you're editing in the agent's page (no need to publish). `'production'` scores the published version that apps call.",
           "`REPEATS`: agents don't answer identically every time; ask each question more than once (e.g. 3) to measure consistency before you put a question on stage."),
        code('''
AGENT = "SpaceParts Sales Analyst (live)"   # display name of the data agent to score
STAGE = "sandbox"                           # "sandbox" = draft, "production" = published
REPEATS = 1                                 # times each question is asked
TABLE = "live_agent_eval"                   # results table in the attached lakehouse
''', tags=["parameters"]),
        code("%pip install -q fabric-data-agent-sdk"),
        code('''
import pandas as pd
from fabric.dataagent.evaluation import evaluate_data_agent, get_evaluation_summary, get_evaluation_details
'''),
        md("## The test set",
           "Questions the Sales agent should answer, each with the SQL-checked answer. Add your own: one row per question your users really ask."),
        code("ground_truth = pd.DataFrame(" + truth + ")\nground_truth"),
        md("## The judge's marking guide (critic prompt)",
           "Lenient about formatting, strict about numbers: an answer passes only if every figure in the expected answer appears, rounded to the nearest euro or 0.1%, and the period and names match.",
           "The SDK fills in `{query}` and `{expected_answer}`; the judge reads the agent's answer from the conversation, so don't add an `{actual_answer}` placeholder."),
        code("""
critic_prompt = '''
You are grading a data agent. Compare the most recent answer in this conversation with the ground truth for the query.
Ignore formatting, headings, bullet points, extra explanation, the order of columns, currency symbols and thousands separators.
Every number in the ground truth must appear in the answer, allowing rounding to the nearest whole euro or 0.1 percentage point.
Names (regions, key accounts, managers, product types) must match.
If the answer uses a different period or currency, or adds up local currencies instead of euros, it is not equivalent.

Query: {query}

Ground Truth: {expected_answer}

Return only one word: Yes, No, or Unclear.
'''
"""),
        md("## Run the evaluation", "Each question takes 20–40 seconds."),
        code('''
evaluation_id = evaluate_data_agent(
    ground_truth,
    AGENT,
    table_name=TABLE,
    data_agent_stage=STAGE,
    critic_prompt=critic_prompt,
    num_query_repeats=REPEATS,
)
print("evaluation id:", evaluation_id)
'''),
        md("## Score"),
        code('''
summary = get_evaluation_summary(TABLE)
display(summary)
'''),
        md("## Read every answer",
           "For anything that isn't *Yes*, open the agent's steps: compare its SQL with `verify_answers.sql`, fix **one layer** (tables, instructions or an example query), and run this notebook again.",
           "A wrong answer here is also a good source of a new **example query**: copy the SQL it should have written into the agent's example queries."),
        code('''
details = get_evaluation_details(evaluation_id, TABLE, get_all_rows=True, verbose=True)
'''),
    ]
    return {"nbformat": 4, "nbformat_minor": 5, "cells": cells,
            "metadata": {"language_info": {"name": "python"}, "kernel_info": {"name": "synapse_pyspark"}}}


# --- deploy / run (same pattern as labs/03-fabric-app/fabric/deploy_app_tables.py) ---
TOKEN = ""


def token() -> str:
    out = subprocess.run(["az", "account", "get-access-token", "--resource", "https://api.fabric.microsoft.com", "--query", "accessToken", "-o", "tsv"],
                         capture_output=True, text=True, shell=sys.platform == "win32")
    if out.returncode or not out.stdout.strip():
        sys.exit("Run 'az login' first.")
    return out.stdout.strip()


def call(method, url, body=None, raw=False):
    req = urllib.request.Request(url, method=method, data=None if body is None else json.dumps(body).encode())
    req.add_header("Authorization", f"Bearer {TOKEN}")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as r:
            data = r.read()
            if raw:
                return r
            if r.status == 202 and r.headers.get("Location") and "jobs/instances" not in url:
                loc = r.headers["Location"]
                while True:
                    time.sleep(3)
                    op = call("GET", loc)
                    if op and op.get("status") in ("Succeeded", "Failed", "Completed", "Cancelled"):
                        return op
            return json.loads(data) if data else None
    except urllib.error.HTTPError as e:
        sys.exit(f"{method} {url} → {e.code}\n{e.read().decode()[:1500]}")


def main():
    global TOKEN
    p = argparse.ArgumentParser()
    p.add_argument("--deploy", action="store_true")
    p.add_argument("--run", action="store_true")
    p.add_argument("--workspace-id")
    p.add_argument("--lakehouse-id")
    p.add_argument("--lakehouse-name", default="lh__spaceparts")
    p.add_argument("--folder-id")
    p.add_argument("--agent", help="override AGENT for this run")
    p.add_argument("--stage", help="override STAGE for this run")
    p.add_argument("--repeats", type=int, help="override REPEATS for this run")
    a = p.parse_args()

    nb = notebook()
    NB_PATH.write_text(json.dumps(nb, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {NB_PATH.name}")
    if not a.deploy:
        return

    TOKEN = token()
    ws = a.workspace_id
    nb["metadata"]["dependencies"] = {"lakehouse": {"default_lakehouse": a.lakehouse_id, "default_lakehouse_name": a.lakehouse_name, "default_lakehouse_workspace_id": ws}}
    definition = {"format": "ipynb", "parts": [{"path": "notebook-content.ipynb", "payload": base64.b64encode(json.dumps(nb).encode()).decode(), "payloadType": "InlineBase64"}]}
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
    if not a.run:
        return

    params = {}
    if a.agent:
        params["AGENT"] = {"value": a.agent, "type": "string"}
    if a.stage:
        params["STAGE"] = {"value": a.stage, "type": "string"}
    if a.repeats:
        params["REPEATS"] = {"value": str(a.repeats), "type": "int"}
    print(f"Running {NAME} {params or ''} (Spark start-up takes a minute or two)")
    r = call("POST", f"{API}/workspaces/{ws}/items/{nb_id}/jobs/instances?jobType=RunNotebook", {"executionData": {"parameters": params}} if params else {}, raw=True)
    loc = r.headers["Location"]
    while True:
        time.sleep(15)
        job = call("GET", loc)
        print(f"  {job.get('status')}")
        if job.get("status") in ("Completed", "Failed", "Cancelled", "Deduped"):
            break
    if job.get("status") != "Completed":
        sys.exit(f"Run {job.get('status')}: {json.dumps(job.get('failureReason'))[:1500]}")
    print("Done. Results are in the lakehouse table live_agent_eval (and its detail table).")


if __name__ == "__main__":
    main()
