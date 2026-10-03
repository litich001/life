# AI 爬虫流量查询
#
# Cloudflare Web Analytics 会主动排除机器人，所以 AI 爬虫在那里看不到。
# 这个脚本查的是 functions/_middleware.js 自己写进 Analytics Engine 的那份数据。
#
#   .\tools\ai_traffic.ps1                 近 7 天，按厂商汇总
#   .\tools\ai_traffic.ps1 -Days 30         近 30 天
#   .\tools\ai_traffic.ps1 -Group country   按国家/地区分布
#   .\tools\ai_traffic.ps1 -Group path      看哪些页面被抓得最多
#   .\tools\ai_traffic.ps1 -Group kind      区分「训练」还是「搜索」
#   .\tools\ai_traffic.ps1 -Group day       按天看趋势
#
# 需要 wrangler 登录过同一个 Cloudflare 账号。

param(
  [int]$Days = 7,
  [ValidateSet('vendor', 'token', 'kind', 'country', 'path', 'day')]
  [string]$Group = 'vendor',
  [int]$Limit = 25
)

# The middleware writes TWO points per hit into the one dataset, and they reuse
# the same blob columns. Analytics Engine has exactly one index (index1), so
# double1 carries the layout: 1 = vendor/country/path, 2 = token/kind.
# Without this filter every group double-counts or mixes the two layouts.
$layouts = @{
  vendor  = @{ col = 'index1';            other = 'double1 = 1' }
  country = @{ col = 'blob2';             other = 'double1 = 1' }
  path    = @{ col = 'blob3';             other = 'double1 = 1' }
  token   = @{ col = 'blob1';             other = 'double1 = 2' }
  kind    = @{ col = 'blob2';             other = 'double1 = 2' }
  day     = @{ col = 'toDate(timestamp)'; other = '' }
}
$layout = $layouts[$Group]

try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }

$cfg = "$env:APPDATA\xdg.config\.wrangler\config\default.toml"
if (-not (Test-Path $cfg)) { throw "找不到 wrangler 凭据：$cfg（先跑 npx wrangler login）" }

$token = ([regex]::Match((Get-Content $cfg -Raw), 'oauth_token\s*=\s*"([^"]+)"')).Groups[1].Value
if (-not $token) { throw "凭据里没有 oauth_token" }

$sql = @"
SELECT $($layout.col) AS k, count() AS hits
FROM life_ai_traffic
WHERE timestamp >= now() - INTERVAL '$Days' DAY $(if ($layout.other) { "AND $($layout.other)" })
GROUP BY k
ORDER BY hits DESC
LIMIT $Limit
"@

$acct = '1f7db8889923eb171722453103a61e65'
$uri = "https://api.cloudflare.com/client/v4/accounts/$acct/analytics_engine/sql"

try {
  $r = Invoke-RestMethod -Method Post -Uri $uri `
    -Headers @{ Authorization = "Bearer $token" } `
    -ContentType 'text/plain' -Body $sql -TimeoutSec 45
} catch {
  $sr = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())
  throw "查询失败：$($sr.ReadToEnd())"
}

if (-not $r.data -or $r.data.Count -eq 0) {
  Write-Host "近 $Days 天没有记录到 AI 爬虫。" -ForegroundColor Yellow
  Write-Host "（Analytics Engine 有几分钟延迟；也可以先用 curl 带 GPTBot 的 UA 打一下站点验证。）"
  exit 0
}

"{0,-26} {1,8}  {2}" -f $Group, 'hits', 'share'
'-' * 46
$total = ($r.data | Measure-Object -Property hits -Sum).Sum
foreach ($row in $r.data) {
  $pct = if ($total) { '{0,6:P1}' -f ($row.hits / $total) } else { '  -' }
  "{0,-26} {1,8}  {2}" -f $row.k, $row.hits, $pct
}
''
"合计 $total 次 · 近 $Days 天 · 抓取于 $(Get-Date -Format 'yyyy-MM-dd HH:mm')"