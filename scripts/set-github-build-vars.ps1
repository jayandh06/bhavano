#Requires -Version 5.1
<#
.SYNOPSIS
  Copies the five NEXT_PUBLIC_* build values from .env.prod.build into the GitHub repository's Actions variables,
  so .github/workflows/build-images.yml builds the web image the same way the local deploy script did.

.DESCRIPTION
  These values end up in the browser bundle, so they are variables rather than secrets. Needs the GitHub CLI signed in with
  access to this repository (gh auth status). Prints names only, never values. Run once, and again whenever one of them changes.
#>
param([string] $EnvFile = ".env.prod.build")

$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path (Join-Path $PSScriptRoot ".."))
if (-not (Test-Path $EnvFile)) { throw "Env file '$EnvFile' not found." }

$names = @("NEXT_PUBLIC_BFF_URL", "NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_GTM_ID", "NEXT_PUBLIC_META_PIXEL_ID", "NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY")
$lines = Get-Content $EnvFile
foreach ($name in $names) {
  $line = $lines | Where-Object { $_ -match "^\s*$name\s*=" } | Select-Object -First 1
  $value = if ($line) { ($line -replace "^\s*$name\s*=\s*", "").Trim().Trim('"').Trim("'") } else { "" }
  if ($value -eq "") {
    # An unset variable reads as empty in the workflow, which is what an empty value means here.
    Write-Host "    $name is empty in $EnvFile - skipped"
    continue
  }
  gh variable set $name --body $value | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "gh variable set failed for $name" }
  Write-Host "    set $name"
}
Write-Host "==> Done. Check them under the repository's Settings > Secrets and variables > Actions > Variables."
