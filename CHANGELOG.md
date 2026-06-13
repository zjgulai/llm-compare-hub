# Changelog

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
