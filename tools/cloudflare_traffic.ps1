# Cloudflare 内容访问量查询
#
# 统计来自 Pages Function 写入 Cloudflare Analytics Engine 的内容请求。
# "other" 表示未命中已知 AI 爬虫特征的请求，不能等同于绝对真人。
#
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

$cfg = "$env:APPDATA\xdg.config\.wrangler\config\default.toml"
if (-not (Test-Path $cfg)) { throw "找不到 Wrangler 凭据，请先登录 Cloudflare。" }

$token = ([regex]::Match((Get-Content $cfg -Raw), 'oauth_token\s*=\s*"([^"]+)"')).Groups[1].Value
if (-not $token) { throw "Wrangler 凭据中没有可用的访问令牌。" }

$column = $columns[$Group]
$sql = @"
SELECT $column AS k, count() AS requests
FROM life_ai_traffic
WHERE timestamp >= now() - INTERVAL '$Days' DAY AND double1 = 3
GROUP BY k
ORDER BY requests DESC
LIMIT $Limit
"@

$account = '1f7db8889923eb171722453103a61e65'
$uri = "https://api.cloudflare.com/client/v4/accounts/$account/analytics_engine/sql"
$response = Invoke-RestMethod -Method Post -Uri $uri `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType 'text/plain' -Body $sql -TimeoutSec 45

if (-not $response.data -or $response.data.Count -eq 0) {
  Write-Host "近 $Days 天还没有内容访问记录。部署后首次访问可能需要等待几分钟。" -ForegroundColor Yellow
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
"合计 $total 次内容请求 · 近 $Days 天 · 查询于 $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
