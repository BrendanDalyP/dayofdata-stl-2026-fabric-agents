# Lab 00 — Prerequisites

**Goal:** a Fabric workspace that can host a Data Agent and a Rayfin (Fabric Apps) app, and a machine that can build both.

**Time:** 15 minutes (plus up to an hour if a tenant admin has to flip settings).

## 1. Fabric capacity and workspace

- A workspace on a paid **F2 or higher** capacity (or P1+ with Fabric enabled). Trial capacities do not run Data Agents.
- The SpaceParts lakehouse and the Data Agent must sit on capacities in the **same region**.

## 2. Tenant settings (Fabric admin portal → Tenant settings)

| Setting | Why |
| --- | --- |
| **Users can create and share Data agent item types** | Create the agent |
| **Users can use Copilot and other features powered by Azure OpenAI** | The agent's language model |
| **Capacities can be designated as Fabric Copilot capacities** | Billing for the above |
| **Data sent to Azure OpenAI can be processed outside your capacity's geographic region…** (and the matching *stored* setting) | Only if your capacity is outside the US/EU data boundary |
| **Fabric Apps (preview)** | Rayfin apps |

> Tenant settings can take up to an hour to apply.

## 3. Tools on your machine

```bash
node --version      # 20 or later
az --version        # Azure CLI 2.60 or later
git --version
```

Sign in:

```bash
az login
```

## 4. The SpaceParts data

This repo uses the **SpaceParts** sample dataset from Tabular Editor, loaded into a **schema-enabled** Fabric lakehouse named `lh__spaceparts`, with the tables in schema `SpaceParts`. Get it from [tabulareditor.com/blog/reintroducing-the-spaceparts-dataset](https://tabulareditor.com/blog/reintroducing-the-spaceparts-dataset), which links the Fabric starter notebook that copies it into a lakehouse. Check Tabular Editor's terms before using it in your own events or products.

Python tools used by the labs:

```bash
pip install mssql-python "mcp>=1.10,<2" azure-identity
```

Confirm you can see it:

```powershell
./scripts/discover.ps1                                         # your workspaces
./scripts/discover.ps1 -Workspace "<workspace>" -Lakehouse "<lakehouse>" -Tables
```

## ✅ Checkpoint

`discover.ps1` lists the SpaceParts tables in your lakehouse.
