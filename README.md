# 高性价比人生指南

用最少的钱、时间和精力，换回寿命、金钱和自由。

站内 **608 条建议、33 节**。每一条都写明四件事：
**花掉什么**（成本）、**换回什么**（说人话 + 收益原文）、**证据有多硬**（A / B / C 级）、
**来源是什么**（只引期刊论文与官方文件）。

## 在线地址

- **GitHub Pages（主）**：<https://litich001.github.io/life/>
- Cloudflare Pages（镜像）：<https://life-28v.pages.dev/>

两个地址内容相同。想更短的网址，可以在 Cloudflare 上给 `life` 项目挂自定义域名，
或加一层短链服务。

## 快捷键

`⌘K` 或 `/` 打开全站检索面板——能搜条目，也能直接跳到章节、长文和页面。

## 能做什么

- **按情况进入**：首页先问「你想了解什么情况」，19 个入口分成急 / 钱 / 活 / 家 / 心五类，
  每类带图标，点进去就是筛好的条目。
- **三条别的入口**：按证据等级筛（A 410 / B 149 / C 49）、按成本筛（不花钱 / 不占时间 /
  不需要毅力）、按章节读。
- **即时检索**：搜一件事（押金、加班费、噪声、离婚……），结果按相关度排序，命中词高亮。
  多个词默认取交集；如果没有任何条目同时命中，会自动放宽成「命中任意一个词」并在结果栏说明，
  而不是给你一个空页面。
- **条件筛选**：章节、证据等级、换回什么（寿命 / 金钱 / 时间与精力 / 人身自由）、
  花掉什么（不花钱 / 不占时间 / 不需要毅力）、收益量级、性价比、争议与待核实标记，多个条件可叠加。
- **结构化查询语法**：`证据:A` `节:8` `换:金钱` `成本:money` `量级:大` `性价比:极高` `标记:争议`。
- **章节阅读**：33 节，每节内条目按性价比从高到低排列。
- **长文**：五篇把一件事讲到底的长文（含对照表、决策表）。
- **方法论**：四种资源、受益人分档、证据分级、性价比怎么算、术语表（正文里带虚线的词都能点开看解释）。
- **标记**：右上角书签图标可以标记「我打算做」的条目，存在本地浏览器里。
- **关于作者**：李哲的介绍、两个产品（天行 GEO / Creator OS）、工作经历、能力四象、合作过的圈子、
  行业认可、联系方式与友链；另有内容作者、项目地址与授权说明。

## 键盘

| 键 | 作用 |
| --- | --- |
| `⌘K` / `Ctrl+K` / `/` | 打开全站检索面板 |
| `↑` `↓` / `j` `k` | 在结果里上下移动 |
| `Enter` / `Space` | 展开当前这一条的原文与来源 |
| `h` `e` `c` `l` `m` `a` | 概览 / 检索 / 章节 / 长文 / 方法论 / 关于 |
| `?` | 快捷键提示 |

## AI 爬虫流量

Cloudflare Web Analytics 会主动排除机器人，所以 AI 爬虫在那里看不到。
`functions/_middleware.js` 单独识别了 28 个已知的 AI 爬虫（GPTBot、ClaudeBot、
OAI-SearchBot、PerplexityBot、Google-Extended、Bytespider、CCBot……），
把它们写进 Analytics Engine 的 `life_ai_traffic` 数据集，并区分「训练」和「搜索」两类用途。

```powershell
.\tools\ai_traffic.ps1                 # 近 7 天，按厂商汇总
.\tools\ai_traffic.ps1 -Days 30         # 近 30 天
.\tools\ai_traffic.ps1 -Group country   # 按国家/地区
.\tools\ai_traffic.ps1 -Group path      # 哪些页面被抓得最多
.\tools\ai_traffic.ps1 -Group kind      # 训练 vs 搜索
.\tools\ai_traffic.ps1 -Group day       # 按天看趋势
```

它只记录、不拦截，也不会改动响应内容。Analytics Engine 有几分钟延迟。

两点说明：

- `-Group path` 会一直显示 `/`，因为这是个 hash 路由的单页应用，
  `#/about` 和 `#/ch/13` 对服务器来说是同一个 URL。想看哪个页面被抓得多，
  暂时得靠 Referer。
- 每命中一次会写**两个**数据点：一个记厂商/地区/路径，一个记爬虫名和用途。
  所以 `-Group vendor` 的总数会等于 `-Group token` 的两倍，`-Group day` 是总数，
  其余都是真实命中数。

要看**人类**流量，另外在 Cloudflare 后台给 `life` 项目开一下 Web Analytics
（Pages → `life` → Metrics and logs → Web Analytics）——这个只能在网页后台点，
API 和 wrangler 都改不了。

## 数据来源

正文与数据取自 [eternity4719/HowToLiveBetter](https://github.com/eternity4719/HowToLiveBetter)
的 PDF 版本。本站只做检索与呈现，**不改写任何一条建议**。

「收益量级」与「性价比」两栏是本站按书中公布的界线（收益 ≥20% 为大；三项成本全零且好处大为极高）
从每条的「收益」和「成本」原文自动套用出来的**估算**，用来排序，不是原书逐条标注的结论。
这一点在页面上也有标注。

## 技术

纯静态，无框架、无构建步骤、无追踪、无后端（AI 爬虫统计只记录 User-Agent，不做用户画像）。

```
index.html
assets/
  app.css          设计令牌与全部样式（Swiss grid / 墨色纸感 + 一个高亮色）
  app.js           路由与启动
  data.js          数据加载、检索、facet 计数
  ui.js            DOM 助手、术语提示、面板、主题、滚动揭示
  views-explore.js 条目卡片与检索页
  views-pages.js   概览 / 章节 / 长文 / 方法论 / 关于
  palette.js       全站检索面板（⌘K）
data/
  book.json        标题、说人话、成本、口径、标记等（首屏只需要它，约 560 KB）
  detail.json      收益原文、来源、备注（展开某一条时才按需取，约 1 MB）
functions/
  _middleware.js   AI 爬虫识别与流量记录（Cloudflare Pages Function）
tools/             重建 data/ 的脚本、对比度审计、AI 流量查询
wrangler.toml      Analytics Engine 数据集绑定
```

数据由 `tools/build_data.py` 从原始 PDF 解析生成，可复现：

```bash
python -m pip install pymupdf
python tools/build_data.py      # 重新生成 data/book.json 与 data/detail.json
python tools/serve.py           # 本地预览 http://localhost:8021
python tools/build_deploy.py    # 组装 _deploy/，并给入口资源加 ?v=<hash>
```

`build_deploy.py` 会给部署版 `index.html` 里的 `app.css`、`app.js`、`book.json`
加上 `?v=<hash>`。两个托管商都发 `cache-control: max-age=600`，不加版本号的话，
部署后浏览器最长会继续跑十分钟前的旧 JS。

`app.js` 内部相对路径动态 import 的模块（`views-pages.js` 等）拿不到这个版本号，
最坏仍可能命中十分钟前的缓存——可接受，且会自愈。

解析结果与原书自报的数字一致：33 节、608 条、A 级 410 / B 级 149 / C 级 49。

## 无障碍与配色约束

正文最低对比度 4.5:1（WCAG AA），大字 3:1。两条容易踩的规则记在这里：

1. **压在强调色上的文字必须是「不透明混色」，不能是半透明。**
   用 `color-mix(in srgb, var(--accent-ink) 88%, var(--accent-deep))`，
   不要写 `… 88%, transparent` —— 半透明会跟它背后的东西混，背景一变对比度就塌。
2. **这个混色比例不能低于 86%。** 72% 时浅色主题只有 3.73:1，不过 AA；86% 是 4.75:1。

`tools/audit_contrast.js` 会遍历页面上所有可见文字并逐个核算。它靠把颜色分别画在黑底和白底上
反解出 alpha —— 单靠 `getImageData` 拿到的是已经合成过的像素，半透明层会被误报成不透明，
顶栏那层 86% 的模糊背景就会假装不达标。

## 许可

站点代码可自由使用。正文内容版权归原作者所有，来源见上方链接。