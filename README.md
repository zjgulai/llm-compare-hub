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
| **模型列表** | PoYo.ai / 硅基流动 / BAI / EasyRouter 四平台全量模型，含分类筛选、关键词搜索、curl 示例一键复制 | 内联于 bundle |
| **对比排序** | 综合 TOP10 / 按类别对比 / 13大功能场景排序，稳定性+性价比双维度评分 | 内联于 bundle |
| **免费模型** | 8个可本地运行的开源模型（Apple Silicon 优化），含安装命令 | `free-models-data.json`（运行时 fetch）|

---

## 技术架构

```
纯静态站点（已预编译）
├── index.html              # SPA 入口，lang=zh-CN，含 SEO/OG meta
├── assets/
│   ├── index-Cc57_kM7.js  # React bundle（~415KB，含全部 4 平台数据内联）
│   └── index-B9Mdr3s6.css # Tailwind CSS（~87KB）
├── free-models-data.json  # 唯一运行时 fetch 的数据文件
├── favicon.svg            # LLM Hub 图标
├── robots.txt             # 爬虫配置
└── sitemap.xml            # SEO 站点地图
```

**前端框架**：React 19 + React Router + Vite（已编译，无需 build 即可运行）  
**样式**：Tailwind CSS  
**数据**：纯 JSON，无后端，无数据库

---

## 关键架构约束（二次开发必读）

> ⚠️ **4 of 5 JSON 文件已内联进 JS bundle，修改磁盘文件对线上无效**

| 文件 | 状态 | 修改方式 |
|------|------|---------|
| `api-data.json` | **已内联**（bundle 变量 `P2`）| 需修改源码后重新 `npm run build` |
| `siliconflow-data.json` | **已内联**（bundle 变量 `W2`）| 需修改源码后重新 `npm run build` |
| `compare-data.json` | **已内联**（bundle 变量 `Vl`）| 需修改源码后重新 `npm run build` |
| `models-data.json` | **已内联**（compare/API 数据的一部分）| 需修改源码后重新 `npm run build` |
| `free-models-data.json` | ✅ **运行时 fetch** | **直接修改文件即生效** |

磁盘上的 JSON 文件仅作为"源码参考"和未来重建的数据基准，**不被浏览器直接加载**（`free-models-data.json` 除外）。

---

## 数据文件说明

| 文件 | 内容 | 平台 |
|------|------|------|
| `api-data.json` | PoYo.ai 完整 API 文档（68 个模型，6 类别：image/video/chat/music/3d/audio）| PoYo.ai |
| `siliconflow-data.json` | 硅基流动 API 文档（62 个模型，6 类别：chat/image/video/embedding/rerank/audio）| 硅基流动 |
| `models-data.json` | PoYo.ai 全量模型展示数据（58 个模型，4 类别）| PoYo.ai |
| `compare-data.json` | 四平台横向对比（6 类别对比 + TOP10 综合排名 + 13 场景功能排名）| 跨平台 |
| `free-models-data.json` | 本地可运行开源模型（8 个，含安装/使用命令）| 本地 |

---

## 本地预览

```bash
# 任意静态服务器即可，无需 Node/npm
python3 -m http.server 8080
# 或
npx serve .
```

访问 `http://localhost:8080`

---

## 生产部署（腾讯云 101.34.52.232）

### 服务器信息

| 项目 | 值 |
|------|-----|
| 服务器 | 101.34.52.232 (VM-0-16-ubuntu, Ubuntu 22.04) |
| 用户 | ubuntu |
| SSH Key | `ai_video.pem`（本地，已 gitignore） |
| 静态文件目录 | `/opt/llm-compare-hub/html/` |
| 反向代理 | `ai_video_nginx` 容器（与其他应用共用，在 `/opt/ai-video/deploy/lighthouse/` 管理）|
| SSL 证书 | Let's Encrypt `*.lute-tlz-dddd.top`，有效至 2026-08-26 |

### 更新静态文件（常规更新）

```bash
# 从本地同步文件到服务器（排除敏感文件）
rsync -avz \
  -e "ssh -i ai_video.pem" \
  --exclude='.git' --exclude='*.pem' --exclude='.DS_Store' --exclude='.sisyphus' \
  ./ ubuntu@101.34.52.232:/opt/llm-compare-hub/html/

# 文件权限确认（nginx worker 需要 755 才能读取）
ssh -i ai_video.pem ubuntu@101.34.52.232 \
  "chmod 755 /opt/llm-compare-hub/html && chmod 755 /opt/llm-compare-hub/html/assets"
```

> ✅ **nginx 通过 volume mount `:ro` 直接读取文件，rsync 后立即生效，无需 reload。**

### nginx 配置位置（只读参考，勿随意修改）

```
/opt/ai-video/deploy/lighthouse/nginx.conf          # 主配置，含 llm server block（行 270-295）
/opt/ai-video/deploy/lighthouse/docker-compose.prod.yml  # nginx volume mount（行 131）
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

| 项目 | 描述 | 解决方案 |
|------|------|---------|
| Bundle 中 Seedream 厂商 badge 无色 | `vendor:"Seedream"` 在 badge 颜色 map 中无对应 key（map 只有 `Seedance`），图像模型显示无色 | 在源码 `sy={}` 中补充 `Seedream` 颜色后重新 build |
| 51 个模型 docsUrl 为占位符 | `https://docs.poyo.ai` 通用占位，非具体文档路径 | 补充真实文档 URL 后重新 build |
| 16 个 siliconflow 模型 pricing="按需" | 无具体价格 | 补充实际价格后重新 build |
| 磁盘 JSON vs bundle 数据可能漂移 | 磁盘 JSON 是"注释"而非运行数据，随时间可能脱离同步 | 重新 build 时以磁盘 JSON 为单一数据源重新内联 |

---

## 相关链接

- [PoYo.ai](https://poyo.ai/zh) | [PoYo API 文档](https://docs.poyo.ai)
- [硅基流动](https://www.siliconflow.cn) | [硅基 API 文档](https://docs.siliconflow.cn)
- [GitHub 仓库](https://github.com/zjgulai/llm-compare-hub)
- [Lute 数据科学平台入口](https://lute-tlz-dddd.top)
