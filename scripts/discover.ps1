<#
.SYNOPSIS
  Lists Fabric workspaces, lakehouses/warehouses, data agents and (optionally) the tables
  in a lakehouse's SQL analytics endpoint. Uses your `az login` session.

.EXAMPLE
  ./scripts/discover.ps1                                   # all workspaces you can see
  ./scripts/discover.ps1 -Workspace "SpaceParts Demo"      # items in one workspace
  ./scripts/discover.ps1 -Workspace "SpaceParts Demo" -Lakehouse "SpaceParts" -Tables
#>
param(
    [string]$Workspace,
    [string]$Lakehouse,
    [switch]$Tables
)
$ErrorActionPreference = 'Stop'
$api = 'https://api.fabric.microsoft.com/v1'

function Get-FabricToken {
    $t = az account get-access-token --resource https://api.fabric.microsoft.com --query accessToken -o tsv
    if (-not $t) { throw "Run 'az login' first." }
    $t
}
$headers = @{ Authorization = "Bearer $(Get-FabricToken)" }

function Get-All($url) {
    $items = @()
    while ($url) {
        $r = Invoke-RestMethod -Headers $headers -Uri $url
        $items += $r.value
        $url = $r.continuationUri
    }
    $items
}

$workspaces = Get-All "$api/workspaces"
if (-not $Workspace) {
    $workspaces | Sort-Object displayName | Select-Object displayName, id, capacityId | Format-Table -AutoSize
    return
}

$ws = $workspaces | Where-Object { $_.displayName -eq $Workspace -or $_.id -eq $Workspace } | Select-Object -First 1
if (-not $ws) { throw "Workspace '$Workspace' not found." }
Write-Host "Workspace: $($ws.displayName)  ($($ws.id))" -ForegroundColor Cyan

$items = Get-All "$api/workspaces/$($ws.id)/items"
$items | Where-Object type -in 'Lakehouse','Warehouse','SQLEndpoint','SemanticModel','DataAgent','SQLDatabase' |
    Sort-Object type, displayName | Select-Object type, displayName, id | Format-Table -AutoSize

if ($Lakehouse) {
    $lh = $items | Where-Object { $_.type -eq 'Lakehouse' -and ($_.displayName -eq $Lakehouse -or $_.id -eq $Lakehouse) } | Select-Object -First 1
    if (-not $lh) { throw "Lakehouse '$Lakehouse' not found." }
    $props = (Invoke-RestMethod -Headers $headers -Uri "$api/workspaces/$($ws.id)/lakehouses/$($lh.id)").properties
    $sql = $props.sqlEndpointProperties
    Write-Host "`nLakehouse : $($lh.displayName) ($($lh.id))" -ForegroundColor Cyan
    Write-Host "SQL host  : $($sql.connectionString)"
    Write-Host "SQL item  : $($sql.id)"

    if ($Tables) {
        $tables = Get-All "$api/workspaces/$($ws.id)/lakehouses/$($lh.id)/tables"
        $tables | Select-Object name, type, format | Format-Table -AutoSize
    }
}
