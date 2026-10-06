# Query content requests written by the Pages Function to Analytics Engine.
# "other" means the request did not match a known AI crawler signature.
# It must not be interpreted as a verified human visitor.
#
# Examples:
#   .\tools\cloudflare_traffic.ps1
#   .\tools\cloudflare_traffic.ps1 -Days 30 -Group day
#   .\tools\cloudflare_traffic.ps1 -Group country
#   .\tools\cloudflare_traffic.ps1 -Group path

param(
  [int]$Days = 7,
  [ValidateSet('class', 'country', 'path', 'day')]
  [string]$Group = 'class',
  [int]$Limit = 25
)

$columns = @{
  class   = 'blob1'
  country = 'blob2'
  path    = 'blob3'
  day     = 'toDate(timestamp)'
}

try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }

$configPath = "$env:APPDATA\xdg.config\.wrangler\config\default.toml"
if (-not (Test-Path $configPath)) {
  throw 'Wrangler credentials were not found. Run wrangler login first.'
}

$configText = Get-Content $configPath -Raw
$tokenMatch = [regex]::Match($configText, 'oauth_token\s*=\s*"([^"]+)"')
$token = $tokenMatch.Groups[1].Value
if (-not $token) {
  throw 'No usable OAuth token was found in the Wrangler credentials.'
}

$column = $columns[$Group]
$sql = @"
SELECT $column AS k, count() AS requests
FROM life_ai_traffic
WHERE timestamp >= now() - INTERVAL '$Days' DAY AND double1 = 3
GROUP BY k
ORDER BY requests DESC
LIMIT $Limit
"@

$accountId = '1f7db8889923eb171722453103a61e65'
$uri = "https://api.cloudflare.com/client/v4/accounts/$accountId/analytics_engine/sql"
$response = Invoke-RestMethod -Method Post -Uri $uri `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType 'text/plain' -Body $sql -TimeoutSec 45

if (-not $response.data -or $response.data.Count -eq 0) {
  Write-Host "No content-request records were found in the last $Days day(s)." -ForegroundColor Yellow
  Write-Host 'Analytics Engine ingestion can take a few minutes after the first request.'
  exit 0
}

"{0,-28} {1,10}  {2}" -f $Group, 'requests', 'share'
'-' * 52
$total = ($response.data | Measure-Object -Property requests -Sum).Sum
foreach ($row in $response.data) {
  $percent = if ($total) { '{0,6:P1}' -f ($row.requests / $total) } else { '  -' }
  "{0,-28} {1,10}  {2}" -f $row.k, $row.requests, $percent
}
''
"Total: $total content request(s) in the last $Days day(s). Queried at $(Get-Date -Format 'yyyy-MM-dd HH:mm')."
