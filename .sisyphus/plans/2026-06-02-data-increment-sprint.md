---
name: llm-compare-hub-next-sprint
description: LLM Compare Hub 增量更新计划。基于 2026-05-28 产品审计，制定信息增量更新方案。Sprint A/B/C 已于 2026-05-28 当天完成执行。Sprint D（技术重建）为下一阶段待办。
---

# LLM Compare Hub — 增量更新计划

> 制定时间：2026-05-28  
> ✅ **Sprint A/B/C 已于 2026-05-28 当天完成**（提前于计划执行窗口）  
> ⏳ Sprint D（技术重建）为下一阶段待办  
> 背景：网站已部署到 [https://llm.lute-tlz-dddd.top](https://llm.lute-tlz-dddd.top) 和 GitHub Pages，完成首轮技术债修复。本计划聚焦**信息增量**——让数据更新、更准、更全。

---

## ✅ 2026-05-28 执行完成记录

| 任务 | 状态 | 关键变更 | commit |
|------|------|---------|--------|
| A1 overallRanking BAI/EasyRouter | ✅ | TOP10→TOP13，EasyRouter/BAI 进榜 | `cfd7fa6` |
| A2 functionRanking chat/code/long-context | ✅ | chat+2, code+2, long-context+1 条目 | `cfd7fa6` |
| A3 3D 对比场景新增 | ✅ | functionRanking 新增 `3d` 场景 | `cfd7fa6` |
| A4 TTS ElevenLabs V3 | ✅ | TTS rank=1（score=96），超过 CosyVoice | `cfd7fa6` |
| B1 Wan 2.7 Video pricing | ✅ | `$0.060/sec(720p) \| $0.090/sec(1080p)` | `e05783e` |
| B2 SiliconFlow 新模型 | ✅ | +3（DeepSeek-V4-Pro, Qwen3.5-27B/9B），发现 6 个已存在 | `6d7c51c` |
| C1+C2 免费模型新增 | ✅ | +Llama 3.3 70B + DeepSeek-R1 7B，共 10 个 | `eb8f97b` |
| C3 补全 rank 2-8 字段 | ✅ | 全部 10 个模型 diskSize/RAM/speed/install 完整 | `eb8f97b` |
| C4 Qwen3-235B ollama 命令 | ✅ | `ollama pull qwen3:235b`，加注 SF 下线说明 | `eb8f97b` |

**librarian 关键发现（2026-05-28 实时查询）**：
- Qwen3-235B-A22B 已于 2025-12-31 从 SiliconFlow 下线（本地 ollama 仍可用）
- SiliconFlow 现有 Qwen3.5/3.6 系列（非 Qwen3），最新 Qwen3.5-397B-A17B
- DeepSeek-V4-Pro/Flash 已于 2026-04-24 上线 SiliconFlow（1049K 上下文）
- ¥ 价格需登录 cloud.siliconflow.cn 手动核实（CN 站需 JS 渲染）

---

## 当前状态速查（执行前必读）

| 维度 | 现状 |
|------|------|
| 平台数 | 4 个（PoYo.ai / 硅基流动 / BAI / EasyRouter）|
| 模型总数 | ~130 个（bundle 内联）|
| 对比类别 | 6 类 × 26 条对比条目 |
| functionRanking | 13 场景，siliconflow 占 38/64 推荐，BAI/EasyRouter 占 **0** |
| overallRanking | 10 条，BAI/EasyRouter 占 **0** |
| bundle 数据日期 | 2025-05-24（距今约 1 年）|
| 免费模型 | 8 个，全部 MoE/Dense 架构，最新为 2026 Q1 模型 |
| 唯一运行时 fetch | `free-models-data.json`（其余 4 个 JSON 已内联进 bundle）|

---

## 核心发现：三大差距

### 差距 1 — BAI/EasyRouter 在对比数据中完全缺席
- BAI 有 9 个模型、EasyRouter 有 13 个模型，已展示在"模型列表"页
- 但 `compare-data.json` 的 `functionRanking` 和 `overallRanking` **一条都没有**
- 用户在"对比排序"页看不到这两个平台的任何推荐

### 差距 2 — compare-data 覆盖类别与 API Explorer 不对称
- API Explorer 展示 6 类（含 3D、TTS），但 compare-data 只覆盖 chat/image/video/rag/audio/music
- **3D 生成**（Meshy 6 3D / Tripo3D）、**TTS 对比**（ElevenLabs vs CosyVoice）没有独立对比页

### 差距 3 — 数据时效（bundle 内联数据约 1 年前）
- bundle 数据日期 `oy = "2025-05-24"`，距今约 12 个月
- 硅基流动 chat 列表有 39 个模型，但近 6 个月新上的 Qwen3 系列、GLM-5.x 等版本未确认是否是最新
- PoYo.ai 视频类 Wan 2.7 pricing 为"按需"（未填充）

---

## 执行任务清单

### Sprint A — compare-data 补全（最高优先级，纯 JSON 修改）

**A1. 为 BAI/EasyRouter 补充 overallRanking 条目**
- 当前 TOP10 全是 siliconflow/poyo，EasyRouter DeepSeek-V4-Pro 在模型列表评分 95 分（最高），却不在 overallRanking
- 操作：在 `compare-data.json` > `overallRanking` 补充 BAI/EasyRouter 的高分模型
- 参考数据（bundle 中已有）：
  - EasyRouter DeepSeek-V4-Pro: score=95, tag="企业级+75%OFF"
  - EasyRouter DeepSeek-V4-Flash: score=94, tag="企业级85折"
  - BAI DeepSeek-V4-Flash: score=92, tag="超大上下文"
- **注意**：compare-data.json 是磁盘文件，修改后需重新 build 才对用户生效

**A2. 为 BAI/EasyRouter 补充 functionRanking 推荐**
- 13 个场景中，以下场景应补充：
  - `cost`（成本优化）：EasyRouter 全线 15% OFF
  - `chat`：EasyRouter GPT-5.4/5.5，BAI DeepSeek-V4-Pro
  - `code`：EasyRouter GPT-5.1 Codex/5.2 Codex/5.3 Codex（3 个 Codex 专用模型）
  - `long-context`：BAI DeepSeek-V4-Flash（超大上下文）

**A3. 新增 `3d` 对比场景**
- functionRanking 中添加 `functionId: "3d"` 场景
- topModels: Meshy 6 3D (poyo), Tripo3D H3.1 (poyo), Tripo3D P1 (poyo)

**A4. TTS 场景补充（当前只有 2 个模型）**
- tts 场景现有：CosyVoice2-0.5B (sf) + 1 个 poyo 模型
- 补充：ElevenLabs V3 TTS (poyo)，明确输出质量/语言支持/价格对比

---

### Sprint B — 数据质量修复（中优先级）

**B1. 修复 PoYo.ai Wan 2.7 Video pricing="按需"**
- 文件：`api-data.json` > `video` 类 > `wan-2-7-video`
- 操作：查询 PoYo.ai 官方文档，填充具体价格

**B2. 硅基流动数据新增确认**
- `siliconflow-data.json` 中 `chat` 类有 39 个模型，需确认是否包含：
  - Qwen3 系列（Qwen3-7B / 14B / 32B / 72B）
  - GLM-5.1 / GLM-5 的最新变体
  - 新增的 DeepSeek-R2（如已上线）
- 操作：访问 [docs.siliconflow.cn](https://docs.siliconflow.cn) 对比，补充缺失模型

**B3. Bundle Seedream badge 颜色修复**
- 源码问题：vendor badge 颜色 map `sy={}` 只有 `Seedance` key，`Seedream` 图像模型显示无色
- 操作：在源码 badge 颜色 map 中添加：
  ```javascript
  Seedream: "background:#EFF9F5;color:#1A7A55;border-color:#A7DFC7;"
  ```
- **需要重新 build**

---

### Sprint C — 免费模型更新（中优先级，直接修改 free-models-data.json 即生效）

**C1. 新增 Llama 3.3 70B（遗漏的主流小模型）**
- 轻量级、4-bit 可在 M3 Max 32GB 上流畅运行
- 添加位置：rank 末尾或替换 rank 8（Phi-4）

**C2. 新增 DeepSeek-R1 本地版**
- DeepSeek-R1 1.5B/7B 是目前本地推理最热门选择
- Q4_K_M 量化后在 M1 16GB 可运行 1.5B/7B 版本

**C3. 补全 rank 2-8 的 quantization/speed/requirements 字段**
- 当前只有 rank=1（GPT-OSS-20B）有完整的 `quantization`/`sampler`/`install`/`usage` 字段
- 操作：为 Llama 4 Scout、Qwen3-235B 等补充 ollama pull 命令和 RAM 要求

**C4. 更新 Qwen3-235B-A22B 安装命令**
- 确认当前 ollama 已支持（2026 Q1 版本更新后已有 `ollama pull qwen3:235b`）

---

### Sprint D — 技术重建准备（低优先级，需源码）

> 以下任务需要找到源码或重新搭建 React 项目，不建议在单日 Sprint 内完成，列为下一阶段规划。

**D1. 重建开发环境**
- 当前仓库只有已编译的 bundle，无 `src/` 源码
- 选项 A：向项目原始作者/AI 获取源码
- 选项 B：用 Vite + React 重新搭建等效项目，以磁盘 JSON 为数据源
- **优先级**：待 A/B/C 完成后再评估

**D2. 将 JSON 从 bundle 内联改为运行时 fetch**
- 目标：所有 5 个 JSON 均改为运行时 fetch，使数据更新无需重建 bundle
- 依赖 D1

---

## 执行顺序建议

```
周一上午（2h）
├── A1: overallRanking 补充 BAI/EasyRouter → compare-data.json
├── A2: functionRanking code/chat/cost 补充 → compare-data.json
└── A3: 3d 对比场景新增 → compare-data.json

周一下午（2h）
├── B1: Wan 2.7 Video pricing 查询填充 → api-data.json
├── B2: 硅基流动 chat 新模型确认 → siliconflow-data.json
└── C1+C2: 免费模型新增 Llama 3.3 / R1 → free-models-data.json（立即生效）

周一晚（1h）
├── C3: 补全 rank 2-8 字段
├── 重新 build（需要源码环境，或跳过，仅更新磁盘 JSON 备用）
└── rsync 同步到服务器 + 验证
```

---

## 重新 build 流程（如有源码）

```bash
# 1. 安装依赖
npm install

# 2. 确认磁盘 JSON 与 bundle 数据同步（以磁盘为准）
# 检查 src/ 中 import 语句，确认 5 个 JSON 文件被引用

# 3. Build
npm run build

# 4. 替换 assets/
cp dist/assets/* assets/
cp dist/index.html index.html

# 5. 同步到服务器
rsync -avz -e "ssh -i ai_video.pem" \
  --exclude='.git' --exclude='*.pem' --exclude='.DS_Store' --exclude='.sisyphus' \
  ./ ubuntu@101.34.52.232:/opt/llm-compare-hub/html/

# 6. 修复权限（仅首次或 assets 目录重建后需要）
ssh -i ai_video.pem ubuntu@101.34.52.232 \
  "chmod 755 /opt/llm-compare-hub/html && chmod 755 /opt/llm-compare-hub/html/assets"

# 7. 验证
curl -sk https://llm.lute-tlz-dddd.top/ | grep '<title>'
```

---

## 数据修改优先级汇总

| 任务 | 文件 | 需要 build | 影响用户可见性 | 工时估算 |
|------|------|-----------|--------------|---------|
| A1 overallRanking BAI/EasyRouter | compare-data.json | ✅ 是 | 对比页 TOP10 | 30 min |
| A2 functionRanking 补充 | compare-data.json | ✅ 是 | 对比页 13 场景 | 60 min |
| A3 3D 场景新增 | compare-data.json | ✅ 是 | 对比页新场景 | 30 min |
| A4 TTS 补充 | compare-data.json | ✅ 是 | 对比页 TTS | 20 min |
| B1 Wan pricing | api-data.json | ✅ 是 | 模型列表价格 | 15 min |
| B2 硅基流动新模型 | siliconflow-data.json | ✅ 是 | 模型列表 | 45 min |
| B3 Seedream badge | 源码 | ✅ 是 | 模型列表 badge | 15 min |
| C1+C2 免费模型新增 | free-models-data.json | ❌ **不需要** | 立即生效 | 45 min |
| C3 补全字段 | free-models-data.json | ❌ **不需要** | 立即生效 | 30 min |

---

## 参考资源

| 用途 | 链接 |
|------|------|
| PoYo.ai 模型定价 | https://poyo.ai/zh/pricing |
| PoYo API 文档 | https://docs.poyo.ai |
| 硅基流动模型列表 | https://siliconflow.cn/models |
| 硅基 API 文档 | https://docs.siliconflow.cn |
| BAI API | https://chat.b.ai |
| EasyRouter 文档 | https://docs.easyrouter.io |
| ollama 模型库 | https://ollama.com/library |
| 生产站点 | https://llm.lute-tlz-dddd.top |
| GitHub 仓库 | https://github.com/zjgulai/llm-compare-hub |

---

## 注意事项

1. **free-models-data.json 是唯一不需要 build 的文件** — Sprint C 可以在没有源码的情况下立即执行并生效
2. **磁盘 JSON 修改后，需要 build 才能更新 bundle** — A/B 类任务修改磁盘文件只是"记录变更"，用户看不到，除非重建 bundle
3. **服务器文件权限** — rsync 上传后需确认目录权限为 755，否则出现 403
4. **nginx 无需重载** — 静态文件更新通过 volume mount 直接生效，不需要 `nginx -s reload`
5. **不要污染其他应用** — 腾讯云服务器上有 ai_video / voc_superset / promptforge 三套独立应用，操作仅限 `/opt/llm-compare-hub/`
