---
name: llm-compare-hub-sprint-e
description: LLM Compare Hub Sprint E 执行计划。Sprint D 完成后的下一阶段：补全 BAI/EasyRouter 独立 JSON、修复 docsUrl 占位符、源码纳入 git、SiliconFlow 价格核实。
---

# LLM Compare Hub — Sprint E 执行计划

> 制定时间：2026-05-28（今日工作收尾）
> 执行窗口：下次开发日
> 前置完成：Sprint A/B/C（数据增量）+ Sprint D（技术重建，runtime fetch）已于 2026-05-28 完成

---

## 当前状态（Sprint D 完成后）

| 维度 | 状态 |
|------|------|
| 架构 | ✅ Vite + React 19，全部 JSON runtime fetch |
| Bundle 大小 | ✅ 194KB 主包 + 5 个懒加载 chunk（原 415KB 单文件，-53%）|
| Seedream badge | ✅ 已修复（#EFF9F5 / #1A7A55）|
| 数据更新流程 | ✅ 修改 JSON + rsync = 立即生效，无需 build |
| BAI 模型列表页 | ❌ bai-data.json 不存在，显示"该平台数据暂未加载" |
| EasyRouter 模型列表页 | ❌ easyrouter-data.json 不存在，同上 |
| 源码 | ⚠️ 在临时目录，未纳入 git |
| docsUrl | ⚠️ 51 个 PoYo 模型指向通用占位 |
| SF pricing | ⚠️ 16 个模型 "按需"，无具体价格 |

---

## Sprint E 任务清单

### E1（🔴 最高优先级）— 源码纳入 git

**背景**：Sprint D 重建的源码在 `/var/folders/...` 临时目录，机器重启/清理后永久丢失，届时需从头重写。

**操作**：
```bash
# 将源码迁移到项目目录
cp -r /var/folders/wp/t77hdxr93bs86v8r0dbwf8940000gn/T/opencode/llm-compare-hub-src \
      /Users/lute/project/Agent/product/llm_models_hub/src

# 创建 src/.gitignore
echo "node_modules/\ndist/\n*.local" > /Users/lute/project/Agent/product/llm_models_hub/src/.gitignore

# 提交
cd /Users/lute/project/Agent/product/llm_models_hub
git add src/
git commit -m "feat(src): add Vite+React source code to repo"
git push origin main
```

**预计工时**：10 分钟
**风险**：不做会导致源码丢失，届时需重写 ~500 行 TSX

---

### E2（🔴 高优先级）— 创建 bai-data.json + easyrouter-data.json

**背景**：BAI 和 EasyRouter 目前在"模型列表"页显示空白。数据已存在于旧 bundle 内（BAI 9 个模型、EasyRouter 13 个模型），需提取为独立 JSON 文件。

**BAI 已知模型列表**（来自旧 bundle 提取）：
- GPT-5.4、GPT-5.5、GPT-5.2、GPT-5-nano、GPT-5-mini
- DeepSeek-V4-Flash、DeepSeek-V4-Pro、DeepSeek-V3.2
- Claude Haiku 4.5

**EasyRouter 已知模型列表**（来自旧 bundle 提取）：
- GPT-5.1 Codex、GPT-5.2 Codex、GPT-5.3 Codex
- GPT-5.2、GPT-5.4、GPT-5.4-mini、GPT-5.4-nano、GPT-5.5
- Claude Haiku 4.5、Claude Opus 4.6、Claude Opus 4.7、Claude Sonnet 4.6
- DeepSeek-V4-Flash

**Schema 参考**：与 `api-data.json` 完全相同（`platform`, `platformName`, `apiOverview`, `categories` 结构）

**BAI apiOverview**：
- baseUrl: `https://chat.b.ai/api`
- authentication: Bearer Token，获取地址 `https://chat.b.ai/key`
- syncModels: 所有模型同步调用，OpenAI 兼容格式

**EasyRouter apiOverview**：
- baseUrl: `https://easyrouter.io/v1`
- authentication: `sk-easyrouter-***`
- 特点: `$1 USD = 200 Credits`，全模型 15% OFF

**操作**：创建两个 JSON 文件 → rsync 到服务器 → 验证页面显示

**预计工时**：60 分钟（含数据填充和验证）
**立即生效**：rsync 后无需 build

---

### E3（🟡 中优先级）— 补全 PoYo docsUrl

**背景**：51 个 PoYo 模型的 `docsUrl` 均指向 `https://docs.poyo.ai`（通用占位），点击"查看官方 API 文档"跳到首页而非具体文档。

**操作**：
1. 访问 `https://docs.poyo.ai` 浏览文档结构
2. 对照 `api-data.json` 中的 68 个模型，逐一填充具体 URL
3. 已有具体 URL 的 7 个模型参考格式（如 `https://docs.poyo.ai/api-manual/video-series/seedance-2`）
4. rsync 到服务器，立即生效

**预计工时**：90 分钟（含文档爬取和逐条填充）
**不需要 build**

---

### E4（🟡 中优先级）— SiliconFlow 价格核实

**背景**：16 个 SiliconFlow 模型定价为"按需"，无具体价格，影响用户选型判断。

**已知限制**：CN 站 `cloud.siliconflow.cn` 价格页面需要 JS 渲染 + 登录，librarian 无法自动抓取。

**操作**：
1. 登录 `cloud.siliconflow.cn/me/models`
2. 手动查找以下 16 个模型的 ¥ 价格：
   - image: Qwen-Image-Edit-2509, Qwen-Image-Edit, Qwen-Image-Max-360p/720p, Kolors
   - video: Wan2.2-I2V-A14B, Wan2.2-T2V-A14B
   - embedding: Qwen3-Embedding-4B/0.6B, bce-embedding-base_v1
   - rerank: bge-reranker-v2-m3 (×2), Qwen3-Reranker-4B/0.6B
   - audio: CosyVoice2-0.5B, SenseVoiceSmall
3. 更新 `siliconflow-data.json`，rsync 到服务器

**预计工时**：30 分钟
**不需要 build**

---

### E5（🟢 低优先级）— 完善 compare categories 内容

**背景**：`compare-data.json` 的 `categories` 每个类别只有 winner 和 summary，model-level 对比内容较薄。

**操作**：为 chat/image/video 三个核心类别各补充 2-3 个具体对比维度（延迟、并发、价格精度等）

**预计工时**：60 分钟
**不需要 build**

---

## 执行顺序建议

```
第 1 天（30 分钟）
└── E1: 源码迁移到 git ← 最紧急，防止丢失

第 2 天上午（2 小时）
├── E2a: 创建 bai-data.json
└── E2b: 创建 easyrouter-data.json

第 2 天下午（2 小时）
└── E3: 补全 PoYo docsUrl（批量处理，可用 librarian 辅助抓取文档目录）

第 3 天（1 小时）
├── E4: SF 价格手动核实填充
└── E5: compare categories 补充（可选）
```

---

## 技术约束提醒

1. **无需 build 的任务（E2/E3/E4/E5）**：修改 JSON → `python3 -c "import json; json.load(open(FILE))"` 验证 → rsync → 验证 200
2. **需要 build 的情况**：修改 `src/` 源码（UI 功能/样式/逻辑）→ `cd src && npm run build` → 复制产物 → rsync
3. **权限规则**：rsync 后如出现 403，执行 `chmod 755 html && chmod 755 html/assets`
4. **不污染其他应用**：操作范围严格限于 `/opt/llm-compare-hub/html/`
5. **源码目录**（E1 完成后）：`/Users/lute/project/Agent/product/llm_models_hub/src/`

---

## 参考资源

| 用途 | 链接 |
|------|------|
| PoYo API 文档目录 | https://docs.poyo.ai |
| SiliconFlow 价格（需登录）| https://cloud.siliconflow.cn/me/models |
| BAI API | https://chat.b.ai |
| EasyRouter 文档 | https://docs.easyrouter.io |
| 生产站点 | https://llm.lute-tlz-dddd.top |
| GitHub 仓库 | https://github.com/zjgulai/llm-compare-hub |
