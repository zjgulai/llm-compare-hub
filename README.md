# LLM Compare Hub — 大模型选型指南

> 大模型 API 横向对比、选型参考、费用计算一站式查询平台

🌐 **在线访问**: [https://zjgulai.github.io/llm-compare-hub/](https://zjgulai.github.io/llm-compare-hub/)

## 功能概览

- **模型横向对比** — PoYo.ai vs 硅基流动，覆盖文本对话、图像生成、视频生成、音乐生成等多类别
- **API Explorer** — 各模型完整参数文档、调用示例、定价说明
- **免费模型列表** — 可本地运行的开源模型（Apple Silicon 优化）
- **综合评分** — 稳定性 / 性价比双维度评分，附推荐理由

## 技术栈

- 前端框架：React + Vite（已编译为静态站点）
- 样式：Tailwind CSS
- 数据：纯 JSON，无后端依赖

## 数据文件说明

| 文件 | 内容 |
|---|---|
| `models-data.json` | PoYo.ai 全量模型列表（图像/视频/音乐/对话） |
| `api-data.json` | PoYo.ai API 文档与调用参数 |
| `siliconflow-data.json` | 硅基流动 API 文档与调用参数 |
| `compare-data.json` | 两平台模型横向对比数据（含评分） |
| `free-models-data.json` | 本地免费开源模型列表 |

## 本地预览

```bash
# 任意静态服务器即可
npx serve .
# 或
python3 -m http.server 8080
```

## 相关链接

- [PoYo.ai](https://poyo.ai/zh) | [PoYo API 文档](https://docs.poyo.ai)
- [硅基流动](https://www.siliconflow.cn) | [硅基 API 文档](https://docs.siliconflow.cn)
