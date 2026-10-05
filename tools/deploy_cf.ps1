<#
.SYNOPSIS
  Build and deploy to Cloudflare Pages, then verify both hosts.

.DESCRIPTION
  Exists because the deploy was previously done by hand and the GitHub Actions
  job could not do it: the runner has no wrangler installed and `npx` refuses to
  fetch it non-interactively ("npx canceled due to missing packages and no YES
  option"), then wrangler aborts on the missing CLOUDFLARE_API_TOKEN. So every
  Cloudflare deploy silently failed for about a day and the mirror sat five
  releases behind while GitHub Pages was current.

  This path uses the LOCAL wrangler OAuth login instead, which carries
  `pages (write)`. The access token in the config expires on its own, but
  wrangler renews it from the stored refresh_token, so `npx wrangler whoami`
  keeps working as long as the refresh token is still valid.

  Usage:
    .\tools\deploy_cf.ps1
    .\tools\deploy_cf.ps1 -SkipBuild      # redeploy the existing _deploy
    .\tools\deploy_cf.ps1 -Project life

.notes
  CI still needs a real CLOUDFLARE_API_TOKEN secret; an OAuth login is local
  state and cannot be committed. Until that exists, GitHub Actions will keep
  failing on the Cloudflare job and the mirror will need this script by hand.
#>
[CmdletBinding()]
param(
  [string]$Project = 'life',
  [string]$Branch  = 'main',
  [switch]$SkipBuild
)

# PowerShell 5.1 turns a native command's stderr into a terminating error when
# ErrorActionPreference is Stop, and npx writes its proxy warning there every
# single run. So native calls are checked with $LASTEXITCODE instead, and Stop is
# only re-enabled around the pure-PowerShell work.
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }

$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  $wrangler = 'wrangler@4.86.0'

  if (-not $SkipBuild) {
    Write-Host '==> building _deploy' -ForegroundColor Cyan
    # --stamp-root is required, not optional: GitHub Pages publishes the repo as
    # -is and never sees the generated _deploy/index.html.
    python -X utf8 tools\build_deploy.py --stamp-root
    if ($LASTEXITCODE -ne 0) { throw 'build_deploy.py failed' }
  }

  Write-Host "`n==> checking wrangler login" -ForegroundColor Cyan
  $who = (npx --yes $wrangler whoami 2>&1 | Out-String)
  if ($LASTEXITCODE -ne 0 -or $who -notmatch 'Account ID') {
    Write-Host $who
    throw 'not logged in -- run: npx wrangler login'
  }
  # never echo the token itself, only the account id it belongs to
  $acctId = [regex]::Match($who, '\b([0-9a-f]{32})\b').Groups[1].Value
  Write-Host "   account $acctId"
  if ($who -notmatch 'pages \(write\)') {
    throw 'the wrangler login has no `pages (write)` scope -- run: npx wrangler login'
  }

  Write-Host "`n==> deploying" -ForegroundColor Cyan
  $out = (npx --yes $wrangler pages deploy _deploy --project-name $Project --branch $Branch 2>&1 | Out-String)
  $out -split "`n" | Where-Object { $_ -match 'Deployment complete|Uploaded|rror' } |
    ForEach-Object { Write-Host "   $_" }
  if ($LASTEXITCODE -ne 0 -or $out -notmatch 'Deployment complete') {
    Write-Host $out
    throw 'deploy did not report success'
  }

  # The hash we just stamped is what both hosts must end up serving.
  $want = [regex]::Match((Get-Content index.html -Raw), 'app\.css\?v=([0-9a-f]+)').Groups[1].Value
  if (-not $want) { throw 'could not read the version stamp out of index.html' }
  Write-Host "`n==> verifying (expect v$want on both hosts)" -ForegroundColor Cyan

  Start-Sleep -Seconds 5
  $ok = $true
  # not $host -- that is a read-only automatic variable in PowerShell
  foreach ($site in @('https://litich001.github.io/life/', "https://$Project-28v.pages.dev/")) {
    try {
      $cb = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
      $html = (Invoke-WebRequest -Uri "$site`?cb=$cb" -UseBasicParsing -TimeoutSec 30).Content
      $got = [regex]::Match($html, 'app\.css\?v=([0-9a-f]+)').Groups[1].Value
      $mark = if ($got -eq $want) { 'ok' } else { 'STALE'; $ok = $false }
      Write-Host ("   {0,-42} v{1}  {2}" -f $site, $got, $mark)
    } catch {
      Write-Host ("   {0,-42} ERR {1}" -f $site, $_.Exception.Message)
      $ok = $false
    }
  }

  if (-not $ok) {
    Write-Host "`nOne or more hosts are stale. GitHub Pages rebuilds from the pushed" -ForegroundColor Yellow
    Write-Host 'commit and can take a few minutes; re-run this script to re-check.' -ForegroundColor Yellow
    exit 1
  }
  Write-Host "`nDeployed and both hosts agree on v$want" -ForegroundColor Green
}
finally {
  Pop-Location
}