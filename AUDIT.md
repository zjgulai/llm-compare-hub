# LLM Models Hub — 深度债务审计与治理计划

> 审计日期：2026-06-11  
> 范围：本地仓库、腾讯云生产站点、GitHub Pages 发布链路、部署脚本、文档与数据资产  
> 原则：本报告不记录任何密钥明文；所有 secret 仅按风险类别描述。

## 0. 当前状态快照

| 维度 | 结论 |
| --- | --- |
| 主生产站 | `https://llm.lute-tlz-dddd.top/` 返回 200，主入口和 8 个核心 JSON 与本地文件哈希一致 |
| 生产服务器 | Ubuntu 22.04，nginx 容器 `ai_video_nginx`，磁盘 `/` 使用 45%，可用内存约 3.4GiB，swap 已满 |
| TLS | Let's Encrypt 证书有效期至 2026-09-07，SAN 覆盖 `llm.lute-tlz-dddd.top` |
| 安全头 | 有 `X-Content-Type-Options`、`X-Frame-Options`、CSP；但 CSP 仍含 `unsafe-inline` |
| GitHub Pages | 线上仍是 2026-05-28 旧版本；本地 `main` 领先 `origin/main` 7 个 commit |
| 本地依赖 | `npm audit` 0 漏洞；React 19.2.7、Vite 6.4.3、TypeScript 5.9.3 |
| 本地安全即时处理 | 已将 `origin` 从带 token URL 改为标准 HTTPS URL；仍需在 GitHub 侧轮换该 token |

## 1. 核心诊断

项目的主要风险不是单点 bug，而是多套“事实来源”同时存在并相互漂移：

1. **生产事实**：腾讯云当前可访问的是根目录 `index.html` + 旧 hash bundle + runtime JSON + essence 静态页。
2. **仓库事实**：`index.html` 指向 `assets/index-DltUXhyr.js` 和 `assets/index-CdBRW1VH.css`，但这两个文件不在当前 git 跟踪的 `assets/` 中。
3. **源码事实**：`src/` 已存在，但不是当前生产 bundle 的可信源码；`src/App.tsx` 是英文 UI，生产 bundle 是中文 UI。
4. **构建事实**：`src/vite.config.ts` 会把产物输出到仓库根目录，Vite 已警告可能覆盖源文件；实际构建会改写根 `index.html`。
5. **文档事实**：`README.md`、`CHANGELOG.md`、旧 `.sisyphus` 计划和旧审计仍描述“源码丢失”等过期状态。

这导致当前生产可用性依赖“远端残留文件”，而不是依赖一个可复现、可审计、可回滚的发布产物。

## 2. 债务清单

| ID | 类别 | 严重度 | 发现 | 影响 |
| --- | --- | --- | --- | --- |
| D-01 | 脆弱点债务 | P0 | 生产站公开发布 `README.md`、`AUDIT.md`、`Makefile`、`scripts/*.py`、`src/*.tsx`、`.github/workflows/deploy.yml`、`.essence-cache/*.json` 等开发材料 | 扩大攻击面，泄露部署方式、目录结构、历史信息和内部流程 |
| D-02 | 工程债务 | P0 | `index.html` 引用的生产 JS/CSS 不在本地 git 跟踪文件中 | fresh clone 或重新部署会缺资源；生产依赖远端旧文件残留 |
| D-03 | 技术债务 | P0 | `src/` 与生产 bundle 不一致，且 `src/types.ts` 含字面量 `\n`，`tsc --noEmit` 失败 | 源码不可作为可信修改入口，UI 改动存在回归风险 |
| D-04 | 工程债务 | P0 | Vite `outDir: "../"` 指向仓库根目录 | 构建会覆盖根 `index.html` 并污染发布目录 |
| D-05 | 脆弱点债务 | P0 | 本地曾在 git remote URL 中嵌入 GitHub token；生产共享 nginx 配置中存在硬编码 API key；工作区保留 SSH 私钥 | 凭据泄露后可导致仓库或服务被控；已清理 remote，但仍需轮换凭据 |
| D-06 | 工程债务 | P1 | 腾讯云部署目录存在旧 `data/`、旧 assets、源码、脚本和文档，且当前 `make deploy` 没有 `--delete` | 线上状态不可预测，旧资源可继续被访问 |
| D-07 | 项目管理债务 | P1 | 本地 `main` 领先远端 7 个 commit，GitHub Pages 仍为旧版 | 双生产入口不一致，自动部署承诺失效 |
| D-08 | 工程债务 | P1 | CI 只跑 JSON 验证，不跑 typecheck/build/asset 引用检查/secret scan | 会把不可构建或资源缺失的版本放行 |
| D-09 | 技术债务 | P1 | 数据 fetch 使用绝对根路径 `/xxx-data.json` | 自有根域可用，GitHub Pages 子路径部署存在环境耦合风险 |
| D-10 | 文档债务 | P1 | README/CHANGELOG/历史计划包含过期结论和旧流程 | 已通过 Phase 3 缓解；历史计划仍作为归档存在 |
| D-11 | 文档债务 | P1 | `robots.txt` 指向 GitHub Pages sitemap；`sitemap.xml` 未覆盖 `claude`/`codex` 页面 | 已通过 Phase 3 缓解；后续需随新增页面维护 sitemap |
| D-12 | 技术债务 | P2 | `scripts/validate.py` 已增强为轻量 schema 校验器，覆盖字段完整度、modelId 唯一性/交叉引用、docsUrl、rank 顺序、modalities 和 deprecated 元数据；仍需继续补 provenance 与漂移监控 | 数据质量已从人工检查转向 CI 门禁，后续风险集中在来源可信度和模型状态漂移 |
| D-13 | 工程债务 | P2 | 无 lint、formatter、单元测试、视觉回归、可访问性检查 | UI 回归只能靠人工发现 |
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
4. 继续增强 JSON 数据治理：补充来源可信度、字段 provenance、模型可用性漂移和价格变动监控。
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
2. 生产中文 UI 仍以 bundle snapshot 为准，`src/` 不是完全可信的生产 UI 源码；建议继续推进源码与生产 UI 对齐。
3. 多模态字段目前由现有产品描述和模型场景推断，下一步应增加 `sourceUrl`、`verifiedAt`、`confidence` 以降低人工判断漂移。
