# Changelog

## 2026-06-13 — Threshold visual diff baselines

### Added
- `scripts/ui_smoke_check.mjs` 新增 `--update-baselines` 和 `--visual-threshold` 参数。
- 新增 `tests/visual-baselines/desktop-home.png` 与 `tests/visual-baselines/mobile-home.png`，作为 UI smoke 的桌面/移动视觉基线。
- 新增 `make smoke-ui-update-baselines`，用于在确认 UI 变化符合预期后刷新视觉基线。

### Changed
- `make smoke-ui` 和 `make smoke-ui-production` 现在会把当前截图与基线做像素差异检查，默认阈值为 15%。
- UI smoke 失败 artifact 现在会包含 `desktop-home-diff.png` / `mobile-home-diff.png` 差异图。

### Verified
- `make smoke-ui-update-baselines` 成功刷新两张基线截图。
- 本地 `make smoke-ui` 显示桌面和移动视觉 diff 均为 0.00%，低于 15% 阈值。

## 2026-06-13 — GitHub Pages UI smoke gate

### Changed
- GitHub Pages deploy workflow 在上传 artifact 前会探测 `google-chrome-stable`、`google-chrome`、`chromium` 或 `chromium-browser`，并写入 `CHROME_PATH`。
- GitHub Pages deploy workflow 现在执行 `make smoke-ui`，把本地 release UI 冒烟检查纳入镜像发布门禁。
- GitHub Pages deploy workflow 在失败时上传 `artifacts/ui-smoke/` 为 `ui-smoke-screenshots-${{ github.run_id }}`，保留 7 天用于截图复盘。

### Verified
- 本地使用显式 `CHROME_PATH` 执行 `make smoke-ui` 通过。
- GitHub Pages workflow run `27463360482` 成功，runner 使用 `/usr/bin/google-chrome-stable` 并完成 `make smoke-ui`。

## 2026-06-13 — UI smoke automation and assets 404 hardening

### Added
- 新增 `scripts/ui_smoke_check.mjs`，使用本机 Chrome headless 执行桌面/移动 UI 冒烟检查，并输出截图到 `artifacts/ui-smoke/`。
- 新增 `make smoke-ui`，先生成本地 `release/`，再验证中文导航、PoYo.ai 数据加载、对比页三模式、多模态输入/输出、免费模型页、基础可访问性命名、移动端横向溢出和缺失 asset 404。
- 新增 `make smoke-ui-production`，对腾讯云生产域名执行同一组浏览器冒烟检查。

### Fixed
- 腾讯云 `llm.lute-tlz-dddd.top` 的 nginx vhost 新增 `/assets/` 精确规则，缺失 hash 资源不再被 SPA fallback 返回 `index.html`。
- `/assets/` 真实 release 资源保留长期 immutable 缓存和原有安全头。

### Verified
- `make smoke-ui` 通过，本地桌面与 390px 移动截图均生成。
- `make smoke-ui-production` 通过。
- 生产 `assets/index-B8PoeCzJ.css` 与 `assets/index-TVkii31w.js` 返回 200；旧 hash 与缺失 asset 返回 404。
- 远端 nginx 配置已通过 `nginx -t` 并 reload，备份保存在 `/opt/ai-video/deploy/lighthouse/nginx.conf.bak-assets-404-20260613174152` 与 `/opt/ai-video/deploy/lighthouse/nginx.conf.bak-assets-csp-fix-20260613174240`。

## 2026-06-13 — Source UI localization and Tailwind build recovery

### Fixed
- 修复源码版 PoYo.ai 平台数据映射：`poyo` 现在加载 `api-data.json`，不再请求不存在的 `poyo-data.json`。
- 接入 `@tailwindcss/vite`，修复 Tailwind v4 utilities 未编译导致的页面样式失效问题。
- 升级前端构建链到 Vite 8.0.16 与 `@vitejs/plugin-react` 6.0.2，`npm audit` 回到 0 漏洞。

### Changed
- `src/` 主应用、模型列表、对比排序和免费本地模型页完成中文文案与工具型视觉风格复核。
- 源码版对比页恢复三个显式模式：综合 TOP、按类别对比、按功能排序。
- 对比页三个模式均显示是否支持多模态，以及输入/输出数据类型 badge。

### Verified
- 本地 `release/` 预览已用 Browser 检查桌面与 390px 移动视口。
- 已验证 PoYo.ai 数据可加载、三种对比模式可切换、多模态输入/输出字段可见、免费模型页中文内容可见，且控制台无 error。
- 腾讯云生产站点已部署并复验：入口、新 JS/CSS 与本地 `release/` 哈希一致，核心 JSON 200，开发材料仍为 404。

## 2026-06-13 — Data update acceptance workflow and rollback runbook

### Added
- 新增 `make provenance-report`，可直接输出平台模型 provenance 覆盖情况。
- 新增 `make data-update-check`，统一执行数据校验、严格 provenance、覆盖报告、治理快照、源码构建和 release 打包。
- 新增 `make data-update-dry` 与 `make data-update-deploy`，用于数据更新批次的部署演练和正式生产验收。
- 新增 `docs/ROLLBACK.md`，记录腾讯云静态站点的回滚边界、已知良好 commit 回滚、服务器备份回滚和验收步骤。

### Changed
- `make release` 现在会先执行 `make build`，确保发布物优先来自 Vite `dist/` 构建产物。
- GitHub Pages workflow 收敛为 `make data-update-check`，避免本地和 CI 的验收流程分叉。
- README 已更新为当前发布事实：`dist/index.html` 与 `dist/assets/` 会被拍平到 `release/` 根目录，根 `index.html` 和根 `assets/` 只作为 legacy fallback。

## 2026-06-13 — 周报治理快照与发布流程补齐

### Added
- 新增 `scripts/weekly_data_snapshot.py`，用于生成周度数据治理快照（JSON + Markdown）。
- 新增 `make weekly-snapshot`，内置报告输出路径为 `artifacts/weekly`。
- 新增 `weekly-governance-snapshot` GitHub Actions 工作流，定期采集漂移快照并上传周报制品。

### Data Governance
- 报表默认包含：平台模型规模、provenance 覆盖、compare 多模态能力覆盖、漂移源状态与与上周差异。
- 对 `artifacts/weekly/` 输出目录已加入 `.gitignore`，避免本地快照污染工作树。

## 2026-06-12 — Data provenance and drift monitoring

### Added
- Added provenance validation fields: `sourceUrl`, `verifiedAt`, `confidence`, and `sourceType`.
- Added provenance coverage reporting via `scripts/provenance_report.py`.
- Added source URL drift monitoring via `scripts/check_data_drift.py` and `data-provenance-snapshots.json`.
- Added scheduled/manual GitHub Actions workflow `Data drift monitor`.
- Added `make validate-provenance` strict provenance preflight and wired it into release CI (`Deploy to GitHub Pages`).

### Data Governance
- BAI and EasyRouter now have full model-level provenance coverage.
- PoYo now has medium-or-higher provenance coverage for every model; entries requiring follow-up retain review flags.
- SiliconFlow confirmed discontinued and replacement models now carry official release-note provenance; all SiliconFlow models now have full provenance coverage.

## 2026-06-12 — JSON schema validation hardening

### Added
- Expanded `scripts/validate.py` into a lightweight schema validator for platform, compare, and free-model JSON data.
- Validation now checks required root/category/model fields, URL and date formats, rank sequences, modelId uniqueness, compare cross-references, modalities, deprecated model metadata, and docsUrl completeness.

## 2026-06-12 — GitHub Actions Node 24 runtime compatibility

### Changed
- Upgraded GitHub Pages workflow actions to Node 24-compatible major versions:
  `actions/checkout@v6`, `actions/setup-node@v6`, `actions/configure-pages@v6`,
  `actions/upload-pages-artifact@v5`, and `actions/deploy-pages@v5`.

## 2026-06-12 — Data refresh safety fixes

### Fixed
- Repaired PoYo docs URLs for MiniMax Music 2.6 and AI Video Upscaler fallback.
- Added docs URLs for all BAI and EasyRouter model entries.
- Fixed compare-data modelId references so all compare entries with modelId resolve to platform data.
- Added DeepSeek-V4-Pro to EasyRouter platform data to match existing compare recommendations.
- Replaced or removed discontinued models from code, reasoning, and RAG function rankings.

### Data Governance
- Marked confirmed SiliconFlow discontinued models with `deprecated`, `availability`, `deprecatedAt`, and `replacementModelId`.
- Added optional `python3 scripts/validate.py --check-urls` docsUrl HTTP validation.
- `make validate` now warns when deprecated models remain in compare rankings.
- Function rankings now avoid recommending models already marked as discontinued in platform data.

## 2026-06-12 — Compare page multimodal/data-type visibility

### Added
- Added structured `modalities` metadata to all compare-page entries: overall ranking, category ranking, and function-scene ranking.
- Production compare UI now shows whether each entry is multimodal, plus supported input and output data types.
- `scripts/validate.py` now fails if compare entries are missing modalities metadata or contain invalid data type values.
- Source `CompareData` TypeScript types now include `overallRanking`, `functionRanking`, and modalities.

### Verified
- Tencent Cloud production deployed from `release/`.
- Online `compare-data.json` and `assets/CompareView-BlF0-htG.js` hashes match local release files.
- `make validate`, `make verify-assets`, `make typecheck`, `make build`, `make release`, `make deploy`, `make check`, and `make check-exposure` passed.

## 2026-06-11 — Debt remediation: release-first deployment + docs/SEO alignment

### Fixed
- Removed the obsolete "source lost / data-maintenance only" status from README.
- Set Tencent Cloud main site as the canonical SEO target.
- Updated `robots.txt` to point to `https://llm.lute-tlz-dddd.top/sitemap.xml`.
- Updated `sitemap.xml` to include only primary-domain URLs: `/`, `/claude.html`, `/codex.html`.
- Restored current production asset snapshot into the repo so a fresh checkout has all files referenced by `index.html`.
- Fixed `src/types.ts` formatting so `make typecheck` passes.
- Moved Vite build output to `dist/` instead of writing into the repository root.

### Added
- `scripts/verify_assets.py` for recursive production asset graph validation.
- `scripts/build_release.py` for generating a clean `release/` deployment artifact.
- `make typecheck`, `make build`, `make verify-assets`, and `make release`.
- Release-only GitHub Pages workflow: CI now uploads `release/`, not the repository root.
- Release-only Tencent Cloud deploy: `make deploy` now syncs `release/` with `rsync --delete`.

### Security / Operations
- Deleted the duplicate worktree SSH key copy and standardized on `~/.ssh/llm-compare-hub.pem`.
- Cleaned the local `origin` URL so it no longer embeds a GitHub token.
- Added nginx blocking for development artifacts under the `llm.lute-tlz-dddd.top` vhost.
- Cleaned Tencent Cloud static directory so only the 22 public release files remain.
- Production backup before cleanup: `/opt/llm-compare-hub/backups/html-before-release-20260611122711.tar.gz`.

### Still required
- Rotate the GitHub token that previously appeared in the local remote URL.
- Rotate the hardcoded third-party API key in the shared production nginx configuration.
- Decide whether to rebuild `src/` to match the current Chinese production UI or intentionally replace the production bundle with the current `src/` implementation.

## 2026-06-09 — Sprint F: 深度审计 + 全维度修复

### 审计结果
- 当时判断：`llm-compare-hub-src` 临时目录已被系统清理，项目只能进行数据维护。
- 当前状态：此判断已被 2026-06-11 的 release-first 修复更新；仓库中已有可 typecheck/build 的 `src/`，但它仍不是当前中文生产 UI 的完整可信源码。

### Fixed
- **api-data.json**: 新增 3 个模型（Grok Imagine Video 1.5, Veo 3.1 Official, AI Video Upscaler）
- **api-data.json**: 修复全部 35 个 docsUrl 占位符（从 sitemap 提取真实 URL）
- **siliconflow-data.json**: 修复 16 个"按需"定价（补全 ¥ 价格）
- **siliconflow-data.json**: 修复 3 个 docsUrl 占位符
- **compare-data.json**: lastUpdated → 2026-06-09
- **bai-data.json**: 创建含 9 个模型 + baseUrl (chat.b.ai)
- **easyrouter-data.json**: 创建含 13 个模型 + baseUrl (easyrouter.io)
- **sitemap.xml**: 域名指向主站 (llm.lute-tlz-dddd.top)
- **.gitignore**: 添加 sisyphus runtime 忽略规则
- **models-data.json**: 删除（Sprint D 遗留废弃文件）

### Added
- `scripts/validate.py`: 数据验证脚本（结构检查 + 交叉引用）
- `Makefile`: validate/deploy/deploy-dry/check 目标
- `src/package.json`: Vite+React 脚手架（源码重建预备）

### Infrastructure
- BAI/EasyRouter 现在模型列表页可展示 9+13 个模型（不再显示空页）

## 2026-05-28 — Sprint D+E: 技术重建 + 增量数据

### Fixed
- Vite+React 重建（原 Handlebars 单文件 -> SPA）
- bundle 大小 415KB → 194KB (-53%)
- Seedream badge 无色修复
- free-models fetch 错误处理
- Gemini modelId 引用修复
- Seedream vendor 拼写修复（Seedance→Seedream）
- overallRanking 按 score 排序
- FreeModelsView 错误 UI

### Added
- favicon, robots.txt, sitemap.xml
- SEO/OG meta tags
- CI/CD (GitHub Actions + Pages)
- BAI/EasyRouter 进对比榜（TOP13）
- 3D 对比场景
- TTS ElevenLabs V3 对比
- SiliconFlow 3 个新模型（DeepSeek-V4-Pro, Qwen3.5-27B/9B）
- 2 个免费模型（Llama 3.3 70B, DeepSeek-R1 7B）
- Wan 2.7 Video 定价

## 2026-05-27 — Initial Release
- 首个 PoC 部署
- Handlebars 单文件架构
- 4 平台模型列表
- 对比排序功能
- 免费模型推荐页
