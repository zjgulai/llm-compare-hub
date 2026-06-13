# LLM Models Hub — 深度债务审计与治理计划

> 审计日期：初始 2026-06-11；最新复核 2026-06-13
> 范围：本地仓库、腾讯云生产站点、GitHub Pages 发布链路、部署脚本、文档与数据资产  
> 原则：本报告不记录任何密钥明文；所有 secret 仅按风险类别描述。

## 0. 当前状态快照

| 维度 | 结论 |
| --- | --- |
| 主生产站 | `https://llm.lute-tlz-dddd.top/` 返回 200，主入口和 8 个核心 JSON 与本地文件哈希一致 |
| 生产服务器 | Ubuntu 22.04，nginx 容器 `ai_video_nginx`，磁盘 `/` 使用 45%，可用内存约 3.4GiB，swap 已满 |
| TLS | Let's Encrypt 证书有效期至 2026-09-07，SAN 覆盖 `llm.lute-tlz-dddd.top` |
| 安全头 | 有 `X-Content-Type-Options`、`X-Frame-Options`、CSP；但 CSP 仍含 `unsafe-inline` |
| GitHub Pages | 作为镜像发布目标；push 到 `main` 后通过 `make data-update-check` 上传 `release/` |
| 本地依赖 | `npm audit` 0 漏洞；React 19.2.7、Vite 8.0.16、TypeScript 5.9.3、Tailwind Vite plugin 4.3.1 |
| 本地安全即时处理 | 已将 `origin` 从带 token URL 改为标准 HTTPS URL；仍需在 GitHub 侧轮换该 token |

## 1. 核心诊断

项目的主要风险不是单点 bug，而是多套“事实来源”同时存在并相互漂移：

1. **生产事实**：腾讯云主站由干净 `release/` artifact 发布，runtime JSON 与静态入口共同构成当前产品事实。
2. **仓库事实**：根 `index.html` 和根 `assets/` 仅保留为 legacy fallback；正常发布优先使用 `dist/` 生成的 `release/`。
3. **源码事实**：`src/` 已恢复为当前可信 UI 修改入口，主应用、模型列表、对比排序和免费本地模型页已完成中文文案与基础视觉一致性复核。
4. **构建事实**：Vite 输出目录已固定到 `dist/`，Tailwind v4 通过 `@tailwindcss/vite` 编译 utilities，构建不会覆盖仓库根入口。
5. **文档事实**：README、CHANGELOG 和本审计已更新最新状态；历史 `.sisyphus` 计划仅作为归档参考。

这些 P0 发布风险已通过 release-only 链路、源码 UI 复核、构建工具链修复、CI UI smoke 门禁和阈值化视觉 diff 降级；当前主要剩余风险转为凭据轮换、可访问性深度门禁和持续数据时效复核。

## 2. 债务清单

| ID | 类别 | 严重度 | 发现 | 影响 |
| --- | --- | --- | --- | --- |
| D-01 | 脆弱点债务 | 已缓解/P1 | 生产曾公开发布 `README.md`、`AUDIT.md`、`Makefile`、`scripts/*.py`、`src/*.tsx`、`.github/workflows/deploy.yml`、`.essence-cache/*.json` 等开发材料；当前 release-only 部署和 nginx deny 已阻断 | 后续需防止部署边界回退 |
| D-02 | 工程债务 | 已缓解/P2 | `release/` 现在由 `dist/` 构建生成；根入口与根 assets 仅作 legacy fallback | 后续风险转为 legacy fallback 维护成本 |
| D-03 | 技术债务 | 已缓解/P2 | `src/` 已可 typecheck/build，并完成中文 UI 与对比页模式复核 | 仍缺自动化视觉回归和可访问性门禁 |
| D-04 | 工程债务 | 已缓解/P2 | Vite `outDir` 已改为 `dist/`，不会覆盖仓库根目录 | 仍需保持 release-only 发布边界 |
| D-05 | 脆弱点债务 | P0 | 本地曾在 git remote URL 中嵌入 GitHub token；生产共享 nginx 配置中存在硬编码 API key；工作区保留 SSH 私钥 | 凭据泄露后可导致仓库或服务被控；已清理 remote，但仍需轮换凭据 |
| D-06 | 工程债务 | 已缓解/P2 | 腾讯云部署已改为 `release/` + `rsync --delete` | 后续需保持备份与回滚演练 |
| D-07 | 项目管理债务 | 已缓解/P2 | GitHub Pages 已定位为镜像发布目标，主 canonical 是腾讯云 | 仍需关注镜像发布延迟和失败告警 |
| D-08 | 工程债务 | P2 | CI 已跑数据校验、provenance、typecheck、build、asset release；仍缺 secret scan、视觉回归和可访问性检查 | UI/安全回归仍依赖人工复核 |
| D-09 | 技术债务 | P1 | 数据 fetch 使用绝对根路径 `/xxx-data.json` | 自有根域可用，GitHub Pages 子路径部署存在环境耦合风险 |
| D-10 | 文档债务 | 已缓解/P2 | README/CHANGELOG/AUDIT 已更新 release-first 与源码 UI 最新状态；历史计划仍作为归档存在 | 后续需要维护“以当前 README/AUDIT 为准”的约束 |
| D-11 | 文档债务 | P1 | `robots.txt` 指向 GitHub Pages sitemap；`sitemap.xml` 未覆盖 `claude`/`codex` 页面 | 已通过 Phase 3 缓解；后续需随新增页面维护 sitemap |
| D-12 | 技术债务 | P2 | `scripts/validate.py` 已增强为轻量 schema 校验器；BAI/EasyRouter/PoYo/SiliconFlow 已补齐 provenance 字段 | 数据质量已从人工检查转向 CI 门禁；后续风险集中在 provenance 时效复核、价格漂移与来源页语义变化 |
| D-13 | 工程债务 | 已缓解/P2 | `make smoke-ui` 已接入 GitHub Pages workflow，并对桌面/移动截图执行阈值化视觉 diff；`make smoke-ui-production` 可做生产冒烟 | 高风险 UI 回归已有 CI/本地/生产命令兜底，深度 a11y 仍需后续治理 |
| D-14 | 脆弱点债务 | P2 | nginx 是多应用共享入口，单配置文件承载多个业务 | 任一 vhost 配置错误可能影响全站入口 |

## 3. 治理路线

### Phase 0：当天止血（0.5 天）

目标：先把公开暴露面和不可复现发布风险压下去。

1. 立即轮换曾出现在 git remote URL 中的 GitHub token。
2. 轮换生产 nginx 配置中硬编码的第三方 API key，并改用环境变量或后端服务注入。
3. 将 `ai_video.pem` 移出项目目录，仅保留在 `~/.ssh/`，设置 `chmod 600`。
4. 生产 nginx 增加 deny 规则或清理发布目录，禁止访问 `.git*`、`.github/`、`src/`、`scripts/`、`*.md`、`Makefile`、`.essence-cache/`、旧 `data/`。
5. 做一次 `rsync --dry-run --delete`，确认只发布 allowlist：`index.html`、当前被引用的 assets、运行时 JSON、`claude/`、`codex/`、`claude.html`、`codex.html`、`favicon.svg`、`robots.txt`、`sitemap.xml`。

验收：`/README.md`、`/src/App.tsx`、`/.github/workflows/deploy.yml`、`/.essence-cache/aiho_claude.json` 返回 403 或 404。

### Phase 1：建立唯一可信发布产物（1 天）

目标：让“源码 -> 构建 -> 发布”重新闭环。

1. 修复 `src/types.ts` 的字面量换行问题，让 `cd src && npx tsc --noEmit` 通过。
2. 把类型导入改为 `import type`，避免构建工具隐式绕过类型文件问题。
3. 修改 Vite 输出到独立目录，例如 `../dist/`，禁止直接写仓库根目录。
4. 明确生产 bundle 策略：
   - 应急方案：把当前生产引用的 `DltUXhyr` / `CdBRW1VH` assets 拉回仓库，先恢复 fresh clone 可部署性。
   - 正式方案：让 `src/` 复刻当前中文生产 UI，重新构建并更新 `index.html` 引用。
5. 增加 `make build`、`make typecheck`、`make verify-assets`，检查 `index.html` 中引用的 assets 是否真实存在。

验收：fresh clone 后执行 `npm ci --prefix src && make validate && make typecheck && make build` 全部通过，且本地静态预览不缺资源。

### Phase 2：重建 CI/CD 与发布边界（1-2 天）

目标：CI 放行的是发布产物，不是整个仓库。

1. GitHub Actions 增加 typecheck、build、asset 引用检查、secret scan。
2. Pages artifact 改为发布 `dist/` 或 `release/`，不要上传仓库根目录。
3. 腾讯云部署也从 `release/` 同步，使用 allowlist 或干净目录 + `--delete-after`。
4. 增加生产 smoke test：主站、核心 JSON、assets、`claude`/`codex` 页面、安全头、开发文件不可访问。
5. 设定 rollback：保留上一版 release tarball 或 timestamp 目录。

验收：GitHub Pages 与腾讯云内容一致，或在文档中明确声明一个为主站、一个为归档镜像。

### Phase 3：文档与数据治理（1 周）

目标：让文档描述真实系统，让数据质量可追溯。

1. 重写 README：当前架构、真实部署目录、构建/部署流程、主站与 Pages 关系、禁止发布内容。
2. 更新 CHANGELOG：标记“源码丢失”结论已过期，记录 `src/` 与生产不一致的新事实。
3. 增加架构图：浏览器、静态文件、runtime JSON、nginx、GitHub Pages、腾讯云目录映射。
4. 继续补齐 SiliconFlow 剩余模型 provenance，并在覆盖完成后把 `make validate-provenance` 接入 CI。
5. 建立数据来源字段：`sourceUrl`、`verifiedAt`、`confidence`，降低人工维护漂移。

验收：新成员只看 README + Makefile 就能安全完成一次 dry-run 部署。

### Phase 4：长期硬化（持续）

1. 将 `llm` 站点从共享 nginx 配置中拆出可独立发布、独立回滚的静态站点配置。
2. CSP 去掉 `unsafe-inline`，用构建期 CSS/JS 或 nonce/hash 管理内联资源。
3. 增加 uptime、证书到期、404 暴露面、数据 JSON hash 漂移监控。
4. 加入最小视觉回归测试：首页、模型列表、对比页、免费模型页、Claude/Codex 精粹页。
5. 定期清理远端旧 assets 与旧 data，只保留当前 release 和上一 release。

## 4. 下一步建议

优先顺序不要从“重写 UI”开始，而是先做发布边界和凭据止血：

1. **先止血**：凭据轮换 + 生产静态目录 deny/清理。
2. **再闭环**：修复 `src`、Vite 输出目录、asset 引用一致性。
3. **再自动化**：CI/CD 只发布 release artifact。
4. **最后治理内容**：README、schema、SEO 和监控。

只要 D-01、D-02、D-03、D-04 没解决，任何 UI 或数据功能迭代都会继续建立在不可复现的生产状态上。

## 5. Phase 0 执行记录

> 执行时间：2026-06-11

已完成：

1. 本地 `origin` 已从带 token 的 URL 改为 `https://github.com/zjgulai/llm-compare-hub.git`。
2. 工作区内重复的 `ai_video.pem` 已删除；Makefile 改为只使用 `~/.ssh/llm-compare-hub.pem`。
3. Makefile 的 rsync 默认排除规则已收紧，不再同步 `.github/`、`src/`、`scripts/`、`pages/`、`.essence-cache/`、`.playwright-mcp/`、文档和 Makefile。
4. 生产 nginx 的 `llm.lute-tlz-dddd.top` vhost 已增加开发材料访问拦截；配置备份在服务器：
   `/opt/ai-video/deploy/lighthouse/nginx.conf.bak-20260611035140`
5. nginx 配置已通过 `nginx -t` 并 reload。

验证通过：

| 检查项 | 结果 |
| --- | --- |
| 主站 `/` | 200 |
| 核心 JSON | 200 |
| 当前生产 JS/CSS assets | 200 |
| `/README.md`、`/AUDIT.md`、`/Makefile` | 404 |
| `/scripts/validate.py`、`/src/App.tsx` | 404 |
| `/.github/workflows/deploy.yml`、`/.essence-cache/aiho_claude.json`、`/data/api-data.json` | 404 |

仍需人工完成：

1. 在 GitHub 侧撤销并轮换曾经出现在 remote URL 中的 token。
2. 轮换生产 nginx 配置中硬编码的第三方 API key，并迁移到更安全的注入方式。
3. 进入 Phase 1，解决生产 assets 不在 git、`src/` 与生产不一致、Vite 输出目录危险这三项可复现发布问题。

## 6. Phase 1 执行记录

> 执行时间：2026-06-11

已完成：

1. 将当前生产 `index.html` 引用但本地缺失的 `assets/index-DltUXhyr.js` 和 `assets/index-CdBRW1VH.css` 补回仓库工作区。
2. 移除根 `assets/` 中未被当前入口引用的英文重建产物：`assets/index-DzkFJv4U.js`、`assets/index-yNO6DToo.css`。
3. 修复 `src/types.ts` 中的字面量 `\n`，`cd src && npx tsc --noEmit` 已通过。
4. 将 type-only imports 改为 `import type`。
5. 将 Vite 输出目录从仓库根目录改为 `dist/`，并设置 `base: "./"`；构建不再覆盖根 `index.html`。
6. `.gitignore` 增加 `dist/`。
7. Makefile 增加：
   - `typecheck`
   - `build`
   - `verify-assets`
8. 新增 `scripts/verify_assets.py`，递归验证 `index.html` 和 JS chunks 的资产引用。

验证通过：

| 命令 | 结果 |
| --- | --- |
| `make validate` | 0 errors, 0 warnings |
| `make verify-assets` | 当前入口、主 bundle、懒加载 chunks、constants 全部存在 |
| `make typecheck` | 通过 |
| `make build` | 通过，输出到 `dist/` |
| `make deploy-dry` | 不再同步 `src/`、`scripts/`、文档、缓存或 `dist/` |

仍需后续处理：

1. `src/` 当前仍是英文重建版，不是生产中文 UI bundle 的完整源码；它现在只能证明“可编译”，不能作为无风险生产 UI 修改入口。
2. 腾讯云远端目录仍残留旧文件，只是已被 nginx 拦截访问；Phase 2 应改为发布干净 release artifact 并执行受控清理。
3. GitHub Pages 仍落后于腾讯云主站；需要在 CI/CD 重建后统一发布策略。

## 7. Phase 2 执行记录

> 执行时间：2026-06-11

已完成：

1. 新增 `scripts/build_release.py`，生成只包含公网依赖的 `release/` artifact。
2. `.gitignore` 增加 `release/`。
3. Makefile 的 `release` 目标会先跑 `validate` 和 `verify-assets`，再生成干净发布物。
4. Makefile 的 `deploy` 已改为从 `release/` 发布，并使用 `rsync --delete` 清理远端残留。
5. Makefile 的 `deploy-dry` 已改为基于 `release/` 预演删除/同步。
6. GitHub Pages workflow 已改为：
   - `npm ci --prefix src`
   - `make validate`
   - `make verify-assets`
   - `make build`
   - `make release`
   - 只上传 `release/`
7. 腾讯云正式部署前已创建远端备份：
   `/opt/llm-compare-hub/backups/html-before-release-20260611122711.tar.gz`
8. 已执行腾讯云 release 部署，远端 `/opt/llm-compare-hub/html` 现在只剩 22 个公开文件。

release 当前文件清单：

```text
api-data.json
assets/CompareView-BlF0-htG.js
assets/FreeModelsView-DsAg-F9x.js
assets/ModelListView-Dw6-gfbn.js
assets/constants-O-8j2ZiH.js
assets/index-CdBRW1VH.css
assets/index-DltUXhyr.js
bai-data.json
claude-data.json
claude.html
claude/index.html
codex-data.json
codex.html
codex/index.html
compare-data.json
easyrouter-data.json
favicon.svg
free-models-data.json
index.html
robots.txt
siliconflow-data.json
sitemap.xml
```

验证通过：

| 检查项 | 结果 |
| --- | --- |
| `make validate` | 0 errors, 0 warnings |
| `make verify-assets` | 入口和递归 JS chunks 全部存在 |
| `make typecheck` / `make build` | 通过 |
| `make deploy-dry` | 只同步 `release/`，预期删除远端开发材料 |
| 腾讯云正式部署 | 成功 |
| release 文件与公网哈希 | 22/22 一致 |
| 远端 forbidden leftovers | 0 |
| 开发材料公网访问 | 404 |

仍需后续处理：

1. 本地 commit/push 后 GitHub Pages 才会通过新 workflow 更新；当前 Pages 仍取决于远端 `origin/main`。
2. GitHub token 和生产 nginx 硬编码 API key 仍需人工轮换。
3. 下一阶段可选择：统一 Pages 与腾讯云的 canonical/robots/sitemap 策略，或重建 `src/` 使其完全等价当前中文生产 UI。

## 8. Phase 3 执行记录

> 执行时间：2026-06-11

已完成：

1. 重写 README，移除过期的“源码已丢失 / 数据维护模式”紧急状态。
2. README 现在记录真实架构、release-first 发布链路、腾讯云/GitHub Pages 关系、工具命令和剩余高优先级事项。
3. 明确 `src/` 当前状态：可 typecheck/build，但不是当前中文生产 UI 的完整可信源码。
4. 更新 CHANGELOG，新增 2026-06-11 债务治理记录，并标记 2026-06-09 的源码丢失判断已被后续状态更新。
5. 更新 `robots.txt`：sitemap 指向主站 `https://llm.lute-tlz-dddd.top/sitemap.xml`。
6. 更新 `sitemap.xml`：只收录主站 canonical URL：
   - `https://llm.lute-tlz-dddd.top/`
   - `https://llm.lute-tlz-dddd.top/claude.html`
   - `https://llm.lute-tlz-dddd.top/codex.html`
7. GitHub Pages 被明确定位为镜像发布目标，不作为 sitemap 主索引入口。

验证目标：

| 检查项 | 期望 |
| --- | --- |
| `make release` | 新 robots/sitemap 进入 release |
| `make deploy` | 腾讯云主站发布最新 release |
| `/robots.txt` | 指向主站 sitemap |
| `/sitemap.xml` | 含 3 个主站 URL，不含 GitHub Pages URL |
| `/README.md` | 404，文档不进入公网 release |

仍需后续处理：

1. 本地改动 commit/push 后，GitHub Pages 才会应用新的 release-only workflow。
2. 如果新增公开页面，需要同步更新 `sitemap.xml` 和 README 的 SEO 策略。
3. 历史 `.sisyphus` 计划仍包含旧状态描述，建议后续移动到归档目录或在 README 中保持“以当前 README/AUDIT 为准”的约束。

## 9. 对比页多模态与数据类型治理记录

> 执行时间：2026-06-12

已完成：

1. 诊断确认：旧对比页只在自由文本和“多模态 / 视觉理解”功能分组中间接表达多模态能力；综合榜、类别榜和功能榜没有统一、结构化、显式的输入/输出类型展示。
2. `compare-data.json` 为全部 112 个对比条目补充 `modalities` 字段：
   - `multimodal`: 是否跨模态
   - `input`: 支持的输入数据类型
   - `output`: 支持的输出数据类型
   - `note`: 可读说明
3. 生产 `assets/CompareView-BlF0-htG.js` 已在三个对比模式中显示同一套 badge：
   - 综合 TOP 排序
   - 按类别对比
   - 按功能排序
4. `src/types.ts` 已补充 `CompareModalities`、`overallRanking` 和 `functionRanking` 类型。
5. `src/components/CompareView.tsx` 已增加源码版多模态 badge，并对历史可选字段做容错处理。
6. `scripts/validate.py` 已增加 `modalities` 完整性校验，避免后续新增榜单项遗漏输入/输出类型。

验证通过：

| 检查项 | 结果 |
| --- | --- |
| `make validate` | 0 errors, 0 warnings |
| `make verify-assets` | 入口和递归 JS chunks 全部存在 |
| `make typecheck` / `make build` | 通过 |
| `make release` | 22 个公网文件 |
| `make deploy-dry` | 只更新 release 范围内文件 |
| `make deploy` | 腾讯云部署成功 |
| 线上 `compare-data.json` 哈希 | 与本地 release 一致 |
| 线上 `CompareView` chunk 哈希 | 与本地 release 一致 |
| 线上开发材料暴露面 | 仍为 404 |

后续债务：

1. `functionRanking.topModels` 的 modelId 交叉引用仍有少量历史不一致，当前未在本轮强制启用 warning；建议下一步统一 compare-data 与平台数据的 modelId。
2. 生产发布链路已切到 `src/` 构建产物；仍需继续复核中文文案与视觉一致性，避免产品体验漂移。
3. 多模态字段目前由现有产品描述和模型场景推断，下一步应增加 `sourceUrl`、`verifiedAt`、`confidence` 以降低人工判断漂移。

## 10. 数据更新验收与回滚治理记录

> 执行时间：2026-06-13

已完成：

1. `make release` 已收敛为“validate -> build -> verify-assets -> build_release”，发布物优先来自 Vite `dist/` 构建产物。
2. 新增 `make provenance-report`，快速输出四个平台模型的 provenance 覆盖。
3. 新增 `make data-update-check`，统一执行数据校验、严格 provenance、覆盖报告、治理快照、源码构建和 release 打包。
4. 新增 `make data-update-dry` 与 `make data-update-deploy`，把数据更新的部署演练和正式验收流程固化为命令。
5. GitHub Pages workflow 已收敛到 `make data-update-check`，避免 CI 与本地流程分叉。
6. 新增 `docs/ROLLBACK.md`，明确只回滚 `/opt/llm-compare-hub/html/` 静态站点，不触碰共享 nginx/Docker/其他应用目录。

验证通过：

| 检查项 | 结果 |
| --- | --- |
| `make data-update-check` | 通过 |
| provenance 覆盖 | `api`、`siliconflow`、`bai`、`easyrouter` 均为 100% |
| `make deploy-dry` | 通过，仅预演 LLM release 文件范围 |
| `make check` | 腾讯云主站 200，GitHub Pages 200，核心 JSON 200 |
| `make check-exposure` | 开发材料仍为 404 |

后续债务：

1. 继续轮换历史 GitHub token 与生产 nginx 中的硬编码第三方 API key。
2. 对 `src/` 做中文文案和视觉一致性复核，避免源码构建切换后产品体验漂移。
3. 为 `make data-update-deploy` 增加部署前远端备份目标，进一步缩短生产回滚时间。

## 11. 源码 UI 中文化与 Tailwind 构建修复记录

> 执行时间：2026-06-13

已完成：

1. `src/App.tsx`、`ModelListView`、`CompareView`、`FreeModelsView` 完成中文文案与工具型视觉风格复核。
2. 源码版对比页恢复并显式展示三个模式：综合 TOP、按类别对比、按功能排序。
3. 三个对比模式均显示统一的多模态 badge：是否支持多模态、输入数据类型、输出数据类型。
4. 修复 PoYo.ai 数据文件映射，`poyo` 平台现在加载 `api-data.json`。
5. 接入 `@tailwindcss/vite` 并升级 Vite / React plugin，修复 Tailwind v4 utilities 未编译导致的页面样式失效问题。

本地验证通过：

| 检查项 | 结果 |
| --- | --- |
| `make typecheck` | 通过 |
| `make data-update-check` | 通过 |
| Browser 桌面预览 | 中文导航、PoYo.ai 数据、三种对比模式、多模态输入/输出、免费模型页均可见；控制台无 error |
| Browser 390px 移动预览 | 无横向溢出；中文导航、副标题、搜索占位符和调用概览可见 |
| `npm --prefix src audit --audit-level=high` | 0 vulnerabilities |
| `make deploy-dry` | 只更新 release 范围文件，并预期删除旧 bundle |
| `make deploy` | 腾讯云部署成功，release 文件数 18 |
| `make check` | 腾讯云主站、GitHub Pages 与 6 个核心 JSON 均为 200 |
| `make check-exposure` | README、AUDIT、Makefile、scripts、src、.github、缓存和旧 data 路径均为 404 |
| 生产哈希校验 | `index.html`、`assets/index-B8PoeCzJ.css`、`assets/index-TVkii31w.js` 与本地 release 一致 |
| Browser 生产实点 | PoYo.ai、综合 TOP、按类别对比、按功能排序、免费模型页均可切换；控制台无 error |

后续债务：

1. 补充更深的可访问性检查，尤其是颜色对比度、焦点顺序和键盘导航。
2. 后续可继续扩展视觉基线覆盖对比页三模式和免费模型页。

## 12. UI smoke 自动化与 assets 404 硬化记录

> 执行时间：2026-06-13

已完成：

1. 新增 `scripts/ui_smoke_check.mjs`，通过 Chrome headless/CDP 执行可重复 UI 冒烟检查。
2. 新增 `make smoke-ui`：本地生成 `release/`，启动临时静态服务，并检查：
   - 中文导航、搜索占位符和首页调用概览；
   - PoYo.ai 数据加载不再失败；
   - 对比页综合 TOP、按类别对比、按功能排序三种模式均显示输入/输出类型；
   - 免费本地模型页显示安装和使用示例；
   - 390px 移动视口无横向溢出；
   - 按钮/input 具备基础可访问性命名；
   - 缺失 `/assets/*` 返回 404。
3. 新增 `make smoke-ui-production`，对腾讯云生产域名执行同一组检查。
4. 腾讯云 `llm.lute-tlz-dddd.top` vhost 新增 `/assets/` 精确规则：
   - 真实 hash 资源继续 200；
   - 缺失 hash 资源直接 404；
   - `/assets/` 响应保留 `Cache-Control`、`X-Content-Type-Options`、`X-Frame-Options` 与 CSP 安全头。

远端备份：

- `/opt/ai-video/deploy/lighthouse/nginx.conf.bak-assets-404-20260613174152`
- `/opt/ai-video/deploy/lighthouse/nginx.conf.bak-assets-csp-fix-20260613174240`

验证通过：

| 检查项 | 结果 |
| --- | --- |
| `make smoke-ui` | 通过，生成桌面与移动截图到 `artifacts/ui-smoke/` |
| `make smoke-ui-production` | 通过 |
| 新 CSS/JS asset | 200，content-type 分别为 `text/css` 与 `application/javascript` |
| 旧 hash asset / 缺失 asset | 404 |
| `/assets/` 安全头 | CSP 保持 `'self'` / `'unsafe-inline'` 引号语义，且保留 nosniff 与 DENY |
| `make check` | 腾讯云主站、GitHub Pages 与 6 个核心 JSON 均为 200 |
| `make check-exposure` | 开发材料路径仍为 404 |

后续债务：

1. 当前截图是冒烟产物而非像素基线；后续可增加阈值化视觉 diff。
2. 当前 a11y 检查覆盖命名和布局溢出；后续可增加颜色对比度和键盘路径检查。

## 13. GitHub Pages UI smoke 门禁记录

> 执行时间：2026-06-13

已完成：

1. GitHub Pages deploy workflow 在 `make data-update-check` 后增加 Chrome/Chromium 探测步骤。
2. workflow 会将探测到的浏览器路径写入 `CHROME_PATH`，供 `scripts/ui_smoke_check.mjs` 使用。
3. workflow 在 `Setup Pages` 和上传 artifact 前执行 `make smoke-ui`，确保镜像发布前已真实打开本地 `release/` 并完成 UI 冒烟检查。
4. workflow 在失败时上传 `artifacts/ui-smoke/` 为 `ui-smoke-screenshots-${{ github.run_id }}`，保留 7 天，便于远端 CI 失败复盘。

本地验证通过：

| 检查项 | 结果 |
| --- | --- |
| workflow 内容检查 | 已包含 `Configure Chrome for UI smoke checks`、`CHROME_PATH` 和 `make smoke-ui` |
| `CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' make smoke-ui` | 通过 |
| GitHub Pages workflow run `27463360482` | 成功，runner 使用 `/usr/bin/google-chrome-stable` 并完成 `make smoke-ui` |

后续债务：

1. 如果未来 runner 镜像移除 Chrome/Chromium，可改为显式 setup Chrome action 或安装固定浏览器包。
2. 当前 artifact 只在失败时上传；如需长期视觉审计，可增加成功运行的截图 artifact 或阈值化视觉 diff。

## 14. 阈值化视觉 diff 基线记录

> 执行时间：2026-06-13

已完成：

1. `scripts/ui_smoke_check.mjs` 新增 PNG 解码、像素差异统计和 diff PNG 输出。
2. 新增 `--update-baselines`，用于刷新 `tests/visual-baselines/`。
3. 新增 `--visual-threshold`，默认阈值为 `0.15`，即当前截图超过 15% 像素差异时失败。
4. 新增 `make smoke-ui-update-baselines`，先生成 `release/`，再刷新桌面/移动基线。
5. 新增并纳入版本管理：
   - `tests/visual-baselines/desktop-home.png`
   - `tests/visual-baselines/mobile-home.png`

验证通过：

| 检查项 | 结果 |
| --- | --- |
| `node --check scripts/ui_smoke_check.mjs` | 通过 |
| `make smoke-ui-update-baselines` | 成功生成桌面/移动视觉基线 |
| `make smoke-ui` | 桌面与移动视觉 diff 均为 0.00%，低于 15% 阈值 |

后续债务：

1. 当前视觉基线只覆盖首页首屏；后续可扩展到对比页三模式和免费模型页。
2. 当前差异阈值偏向“阻止大面积回归”；如需精细审美回归，可引入更严格的分区阈值。
