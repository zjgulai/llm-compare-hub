# LLM Compare Hub — 大模型选型指南

> 大模型 API 横向对比、选型参考、费用计算一站式查询平台

## 访问地址

| 环境 | URL | 说明 |
|------|-----|------|
| 🏭 **生产（腾讯云）** | **[https://llm.lute-tlz-dddd.top](https://llm.lute-tlz-dddd.top)** | 主部署，nginx 静态服务 |
| 🌐 **GitHub Pages** | [https://zjgulai.github.io/llm-compare-hub/](https://zjgulai.github.io/llm-compare-hub/) | 自动 CI/CD，push main 即更新 |
| 🔗 **入口页** | [https://lute-tlz-dddd.top](https://lute-tlz-dddd.top) | 宿主 landing，已展示卡片链接 |

---

## 功能概览

| 页面 | 功能 | 数据来源 |
|------|------|---------|
| **模型列表** | PoYo.ai / 硅基流动 / BAI / EasyRouter 四平台全量模型，含分类筛选、关键词搜索、curl 示例一键复制 | **runtime fetch**（各平台 JSON）|
| **对比排序** | 综合 TOP13 / 按类别对比 / 14大功能场景排序，稳定性+性价比双维度评分 | **runtime fetch**（compare-data.json）|
| **免费模型** | 10个可本地运行的开源模型（Apple Silicon 优化），含完整规格/安装命令 | **runtime fetch**（free-models-data.json）|

---

## 技术架构

```
纯静态站点（Vite + React 19 重建，2026-05-28）
├── index.html                        # SPA 入口，lang=zh-CN，含 SEO/OG meta
├── assets/
│   ├── index-DltUXhyr.js            # React 主包（~194KB，含路由和公共依赖）
│   ├── index-CdBRW1VH.css           # Tailwind CSS（~20KB）
│   ├── CompareView-BlF0-htG.js      # 对比排序页（懒加载 chunk）
│   ├── FreeModelsView-DsAg-F9x.js   # 免费模型页（懒加载 chunk）
│   ├── ModelListView-Dw6-gfbn.js    # 模型列表页（懒加载 chunk）
│   └── constants-O-8j2ZiH.js       # 共享常量（vendor badge、platform map）
├── api-data.json                     # PoYo.ai API 文档（runtime fetch）
├── siliconflow-data.json             # 硅基流动 API 文档（runtime fetch）
├── compare-data.json                 # 横向对比数据（runtime fetch）
├── free-models-data.json             # 本地免费模型（runtime fetch）
├── favicon.svg                       # LLM Hub 图标
├── robots.txt                        # 爬虫配置
└── sitemap.xml                       # SEO 站点地图
```

**前端框架**：React 19 + Vite 8 + TypeScript  
**样式**：Tailwind CSS v4  
**数据**：全部 JSON 运行时 fetch，无后端，无数据库

> ⚠️ `models-data.json` 和 `bai-data.json` / `easyrouter-data.json` 目前**不存在**于仓库。
> BAI/EasyRouter 平台数据下一步需创建独立 JSON 文件（当前 fetch 失败时 graceful fallback 为 null，UI 显示"该平台数据暂未加载"）。

---

## 数据文件说明

| 文件 | 内容 | 模型数 | 修改是否立即生效 |
|------|------|--------|----------------|
| `api-data.json` | PoYo.ai API 文档（image/video/chat/music/3d/audio）| 68 | ✅ rsync 后立即生效 |
| `siliconflow-data.json` | 硅基流动 API 文档（chat/image/video/embedding/rerank/audio）| 42 | ✅ rsync 后立即生效 |
| `compare-data.json` | 四平台横向对比（TOP13 综合排名 + 14 场景功能排名）| - | ✅ rsync 后立即生效 |
| `free-models-data.json` | 本地可运行开源模型，含完整规格 | 10 | ✅ rsync 后立即生效 |
| `bai-data.json` | BAI 平台 API 文档 | **待创建** | - |
| `easyrouter-data.json` | EasyRouter 平台 API 文档 | **待创建** | - |

> **重要**：Sprint D（2026-05-28）完成后，所有 JSON 均为 runtime fetch。**修改任意 JSON 文件 + rsync 到服务器即可立即上线，无需重新 build。**

---

## 源码位置

源码在临时目录（非 git 管理），需保存以便下次开发：

```
/var/folders/wp/t77hdxr93bs86v8r0dbwf8940000gn/T/opencode/llm-compare-hub-src/
├── src/
│   ├── main.tsx           # React 入口
│   ├── App.tsx            # 主布局 + Tab 导航
│   ├── ModelListView.tsx  # 模型列表页
│   ├── CompareView.tsx    # 对比排序页
│   ├── FreeModelsView.tsx # 免费模型页
│   ├── data.ts            # 所有 JSON fetch 逻辑（D2 runtime fetch 核心）
│   ├── constants.ts       # vendor badge map（含 Seedream 修复）、platform map、curl 生成
│   ├── types.ts           # TypeScript 类型定义
│   └── index.css          # Tailwind v4 + CSS 变量 + 自定义类
├── vite.config.ts         # base: './' 相对路径
└── package.json           # React 19, Vite 8, Tailwind 4
```

**下次开发前先将源码提交到 git 或复制到项目目录。**

---

## 开发工作流

### 数据更新（无需 build）

```bash
cd /Users/lute/project/Agent/product/llm_models_hub

# 1. 直接修改 JSON 文件
vim api-data.json  # 或 compare-data.json / free-models-data.json 等

# 2. 验证 JSON 有效
python3 -c "import json; json.load(open('api-data.json')); print('valid')"

# 3. 同步到服务器（立即生效）
rsync -avz -e "ssh -i ai_video.pem" \
  --exclude='.git' --exclude='*.pem' --exclude='.DS_Store' --exclude='.sisyphus' \
  ./ ubuntu@101.34.52.232:/opt/llm-compare-hub/html/

# 4. 确认权限
ssh -i ai_video.pem ubuntu@101.34.52.232 \
  "chmod 755 /opt/llm-compare-hub/html && chmod 755 /opt/llm-compare-hub/html/assets"

# 5. 验证
curl -sk -o /dev/null -w "%{http_code}" https://llm.lute-tlz-dddd.top/api-data.json
```

### UI 功能开发（需要 build）

```bash
# 进入源码目录（临时，需先保存到正式位置）
cd /var/folders/.../llm-compare-hub-src

# 开发模式
npm run dev

# 构建
npm run build

# 替换产物
cp dist/assets/* /Users/lute/project/Agent/product/llm_models_hub/assets/
cp dist/index.html /Users/lute/project/Agent/product/llm_models_hub/index.html

# 同步到服务器
rsync -avz -e "ssh -i ai_video.pem" \
  --exclude='.git' --exclude='*.pem' --exclude='.DS_Store' --exclude='.sisyphus' \
  /Users/lute/project/Agent/product/llm_models_hub/ \
  ubuntu@101.34.52.232:/opt/llm-compare-hub/html/

# 修复权限（新 assets 文件权限为 644，目录需 755）
ssh -i ai_video.pem ubuntu@101.34.52.232 \
  "chmod 755 /opt/llm-compare-hub/html/assets && chmod 644 /opt/llm-compare-hub/html/assets/*"
```

---

## 生产部署（腾讯云 101.34.52.232）

### 服务器信息

| 项目 | 值 |
|------|-----|
| 服务器 | 101.34.52.232 (VM-0-16-ubuntu, Ubuntu 22.04) |
| 用户 | ubuntu |
| SSH Key | `ai_video.pem`（本地，已 gitignore）|
| 静态文件目录 | `/opt/llm-compare-hub/html/` |
| 反向代理 | `ai_video_nginx` 容器（与其他应用共用，在 `/opt/ai-video/deploy/lighthouse/` 管理）|
| SSL 证书 | Let's Encrypt `*.lute-tlz-dddd.top`，有效至 2026-08-26 |

### nginx 配置位置（只读参考，勿随意修改）

```
/opt/ai-video/deploy/lighthouse/nginx.conf              # 主配置，含 llm server block（行 270）
/opt/ai-video/deploy/lighthouse/docker-compose.prod.yml # nginx volume mount（行 131）
```

修改 nginx 配置后须执行：
```bash
ssh -i ai_video.pem ubuntu@101.34.52.232 "
  docker exec ai_video_nginx nginx -t && \
  docker exec ai_video_nginx nginx -s reload
"
```

### 服务器现有应用（不可污染）

| 容器前缀 | 域名 | 说明 |
|---------|------|------|
| `ai_video_*` | video.lute-tlz-dddd.top | AI 视频生成平台 |
| `voc_superset*` | voc.lute-tlz-dddd.top | 客户声音分析 |
| `promptforge_*` | kg.lute-tlz-dddd.top | 灵词知识库 |
| `ai_video_nginx` | 所有域名共用 | 全局唯一入口 |

---

## GitHub Pages 自动部署

- **触发**：push 到 `main` 分支自动触发
- **配置**：`.github/workflows/deploy.yml`
- **注意**：GitHub Pages 部署的是**当前 git 仓库的静态文件**（含已编译的 bundle），与腾讯云服务器独立，互不影响

---

## 已知技术债务

| 优先级 | 项目 | 描述 | 解决方案 |
|--------|------|------|---------|
| 🔴 高 | BAI/EasyRouter 独立 JSON 文件缺失 | `bai-data.json` 和 `easyrouter-data.json` 未创建，两个平台的模型列表页显示空 | 按 api-data.json schema 创建这两个文件，rsync 后立即生效 |
| 🟡 中 | 51 个模型 docsUrl 为占位符 | `https://docs.poyo.ai` 通用占位，点击无法打开具体文档 | 补充真实文档 URL 到 api-data.json |
| 🟡 中 | 16 个 siliconflow 模型 pricing="按需" | 价格字段未填充 | 补充实际 ¥ 价格到 siliconflow-data.json（需登录 cloud.siliconflow.cn 核实）|
| 🟢 低 | 源码未纳入 git 管理 | 源码在临时目录，机器重启后丢失 | 将 `llm-compare-hub-src/` 提交到 git 或迁移到 `/Users/lute/project/Agent/product/llm_models_hub/src/` |

> **已解决（2026-05-28）**：~~Bundle 中 Seedream badge 无色~~ ✅ / ~~4/5 JSON 内联进 bundle，修改无效~~ ✅ / ~~免费模型 fetch 错误静默吞掉~~ ✅

---

## 相关链接

- [PoYo.ai](https://poyo.ai/zh) | [PoYo API 文档](https://docs.poyo.ai)
- [硅基流动](https://www.siliconflow.cn) | [硅基 API 文档](https://docs.siliconflow.cn)
- [GitHub 仓库](https://github.com/zjgulai/llm-compare-hub)
- [Lute 数据科学平台入口](https://lute-tlz-dddd.top)
