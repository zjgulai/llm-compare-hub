# Changelog

## 2026-06-09 — Sprint F: 深度审计 + 全维度修复

### 审计结果
- **源码已丢失**：`llm-compare-hub-src` 临时目录已被系统清理（~500 行 TSX）
- 项目进入**数据维护模式**（仅 JSON 修改可用，无法构建 bundle）

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
