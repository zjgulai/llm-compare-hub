#!/usr/bin/env python3
"""LLM Usage Essence — Data Collector & Scraper

Fetches content from aiho.virxact.com + official blogs, filters by topic
(Claude / Codex), and outputs structured JSON data files.

Usage:
    python3 scripts/update-essence.py           # update both
    python3 scripts/update-essence.py --topic claude  # update only claude
    python3 scripts/update-essence.py --topic codex   # update only codex
    python3 scripts/update-essence.py --init    # first-time bootstrap with curated data
    python3 scripts/update-essence.py --allow-regression  # allow item-count decreases
"""

import json, sys, os, subprocess, re, time
from datetime import datetime

REPO_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JINA_BASE = "https://r.jina.ai"
CACHE_DIR = os.path.join(REPO_DIR, ".essence-cache")
os.makedirs(CACHE_DIR, exist_ok=True)

def count_items(data):
    return sum(len(section.get('items', [])) for section in data.get('sections', []))

def load_existing_data(path):
    if not os.path.exists(path):
        return None
    with open(path, encoding='utf-8') as f:
        return json.load(f)

def regression_details(existing_data, generated_data, allow_regression=False):
    if allow_regression or not existing_data:
        return None
    existing_total = count_items(existing_data)
    generated_total = count_items(generated_data)
    if generated_total < existing_total:
        return existing_total, generated_total
    return None

def fetch_jina(url, cache_key=None, max_age=3600):
    """Fetch a URL through Jina Reader with caching."""
    cache_key = cache_key or re.sub(r'[^a-zA-Z0-9]', '_', url)
    cache_path = os.path.join(CACHE_DIR, cache_key + ".json")
    
    # Check cache
    if os.path.exists(cache_path):
        age = time.time() - os.path.getmtime(cache_path)
        if age < max_age:
            return json.load(open(cache_path))
    
    # Fetch
    jina_url = f"{JINA_BASE}/{url}"
    result = subprocess.run(
        ["curl", "-s", "-m", "15", jina_url],
        capture_output=True, text=True
    )
    if result.returncode != 0 or not result.stdout:
        print(f"  ⚠️  Failed: {url}")
        return None
    
    data = {"url": url, "content": result.stdout, "ts": datetime.now().isoformat()}
    with open(cache_path, 'w') as f:
        json.dump(data, f, ensure_ascii=False)
    time.sleep(0.5)  # rate limit
    return data

def parse_aiho_items(content):
    """Parse aiho content items from Jina Reader markdown output."""
    items = []
    lines = content.split('\n')
    current = {}
    
    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            if current.get('title') and current.get('url'):
                items.append(current)
                current = {}
            continue
        
        # Link lines
        link_match = re.match(r'^\[([^\]]+)\]\(([^)]+)\)', line)
        if link_match and 'title' not in current:
            current['title'] = link_match.group(1)
            current['url'] = link_match.group(2)
            continue
        
        # Source lines
        source_match = re.match(r'^(.*?)(?:@(\w+)|(?:（RSS）|(?:博客)))', line)
        if 'source' not in current and len(line) > 5 and line[0].isupper():
            current['source'] = line.strip()
            continue
        
        # Score (精选 XX)
        score_match = re.search(r'精选\s*(\d+)', line)
        if score_match:
            current['score'] = int(score_match.group(1))
            continue
        
        # Tags (智能体 教程/实践 编码)
        tag_match = re.match(r'^([\u4e00-\u9fff/\s]+)\s*$', line)
        if tag_match and len(line) > 3:
            current['tags'] = [t.strip() for t in line.split() if t.strip()]
            continue
        
        # Summary (推荐理由)
        if line.startswith('推荐理由'):
            current['summary'] = line[len('推荐理由'):].strip()
    
    if current.get('title') and current.get('url'):
        items.append(current)
    
    return items

def parse_anthropic_items(content):
    """Parse Anthropic blog for Claude-related articles."""
    items = []
    lines = content.split('\n')
    
    for line in lines:
        # Find article links with dates
        m = re.search(r'(\w{3}\s+\d+,\s+\d{4}).*?\[([^\]]+)\]\(([^)]+)\)', line)
        if m:
            items.append({
                'title': m.group(2),
                'url': m.group(3),
                'source': 'Anthropic Blog',
                'date': m.group(1),
                'tags': ['官方', '更新']
            })
        # Also find simpler pattern (date + title + link)
        pm = re.search(r'\[([^\]]+)\]\(([^)]+)\).*?(\w{3}\s+\d+,\s+\d{4})', line)
        if pm and pm.group(1) != pm.group(1):
            items.append({
                'title': pm.group(1),
                'url': pm.group(2),
                'source': 'Anthropic Blog',
                'date': pm.group(3),
                'tags': ['官方', '更新']
            })
    
    return items

def build_data_page(topic, aiho_data=None, blog_data=None):
    """Build a structured data page for Claude or Codex."""
    is_claude = topic == 'claude'
    
    if is_claude:
        sections = [
            {"id": "getting-started", "name": "入门指南", "description": "Claude 基础对话技巧与核心概念",
             "color": "blue", "items": []},
            {"id": "claude-code", "name": "Claude Code 深入实战", "description": "Agent 工作流、最佳实践与效率工具",
             "color": "emerald", "items": []},
            {"id": "prompting", "name": "提示词工程", "description": "System Prompt、多轮对话与思维链",
             "color": "purple", "items": []},
            {"id": "use-cases", "name": "场景应用", "description": "编码、研究、写作、Agent 开发等具体场景",
             "color": "amber", "items": []},
            {"id": "resources", "name": "资源导航", "description": "官方文档、社区教程与最新动态",
             "color": "rose", "items": []}
        ]
    else:
        sections = [
            {"id": "overview", "name": "Codex 概览", "description": "Codex 模型家族、能力边界与最新更新",
             "color": "blue", "items": []},
            {"id": "coding", "name": "编码工作流", "description": "代码生成、重构、调试与测试",
             "color": "emerald", "items": []},
            {"id": "agent", "name": "Agent 开发", "description": "工具调用、多步骤工作流与框架集成",
             "color": "purple", "items": []},
            {"id": "integration", "name": "部署与集成", "description": "API 接入、IDE 配置与云平台部署",
             "color": "amber", "items": []},
            {"id": "resources", "name": "资源导航", "description": "官方文档、更新日志与社区实践",
             "color": "rose", "items": []}
        ]
    
    # Classify items into sections
    if aiho_data:
        for item in aiho_data:
            classify_item(item, sections, is_claude)
    
    data = {
        "page": f"{topic}-essence",
        "title": f"{'Claude' if is_claude else 'Codex'} 用法精粹",
        "subtitle": f"{'Claude (Anthropic)' if is_claude else 'Codex (OpenAI)'} 使用技巧、最佳实践与资源导航",
        "updatedAt": datetime.now().strftime("%Y-%m-%d"),
        "sections": sections,
        "infoSources": {
            "aiho": "https://aihot.virxact.com/",
            "officialBlog": f"https://{'anthropic.com' if is_claude else 'openai.com'}/blog",
            "officialDocs": f"https://{'platform.claude.com/docs' if is_claude else 'platform.openai.com'}/docs"
        }
    }
    return data

def classify_item(item, sections, is_claude):
    """Classify an item into the appropriate section based on keywords."""
    title = item.get('title', '')
    tags = ' '.join(item.get('tags', []))
    summary = item.get('summary', '')
    text = f"{title} {tags} {summary}".lower()
    
    if is_claude:
        if any(w in text for w in ['入门', '开始', '基础', '对话', '101', 'basics', 'getting started']):
            sections[0]['items'].append(item)
        elif any(w in text for w in ['claude code', 'agent', '工作流', 'workflow', '/goal']):
            sections[1]['items'].append(item)
        elif any(w in text for w in ['prompt', 'system prompt', '提示', '指令']):
            sections[2]['items'].append(item)
        elif any(w in text for w in ['场景', '编码', '代码', 'research', '写作', '分析']):
            sections[3]['items'].append(item)
        else:
            sections[4]['items'].append(item)
    else:
        if any(w in text for w in ['概览', 'overview', '介绍', 'introduction', 'codex', '新功能']):
            sections[0]['items'].append(item)
        elif any(w in text for w in ['代码', '编码', '重构', '生成', 'coding', 'refactor']):
            sections[1]['items'].append(item)
        elif any(w in text for w in ['agent', '工具', '调用', 'function calling']):
            sections[2]['items'].append(item)
        elif any(w in text for w in ['部署', 'api', '集成', 'deploy', 'integration', 'aws']):
            sections[3]['items'].append(item)
        else:
            sections[4]['items'].append(item)

def add_curated_data(data, is_claude):
    """Add manually curated initial content from official sources."""
    if is_claude:
        curated = [
            {"section": 0, "title": "Claude 对话入门", "url": "https://docs.anthropic.com/en/docs/chat",
             "source": "Anthropic Docs", "tags": ["官方", "入门"], "summary": "官方对话 API 快速开始"},
            {"section": 0, "title": "System Prompt 编写指南", "url": "https://docs.anthropic.com/en/docs/system-prompts",
             "source": "Anthropic Docs", "tags": ["官方", "进阶"], "summary": "如何编写高效的 System Prompt"},
            {"section": 0, "title": "Claude Fable 5 介绍", "url": "https://www.anthropic.com/news/claude-fable-5-mythos-5",
             "source": "Anthropic Blog", "tags": ["官方", "模型"], "summary": "Anthropic 最新推理模型 Fable 5 与 Mythos 5"},
            {"section": 1, "title": "Claude Code 官方指南", "url": "https://docs.anthropic.com/en/docs/claude-code",
             "source": "Anthropic Docs", "tags": ["官方", "Claude Code"], "summary": "Claude Code 的完整使用文档"},
            {"section": 1, "title": "Thariq 10 条效率建议", "url": "https://x.com/rohanpaul_ai/status/2064425086409679358",
             "source": "aiho.virxact.com", "tags": ["智能体", "教程/实践", "编码"], "summary": "Claude Code 团队 Thariq 分享从\"检查对错\"到\"检查方向\"的工作流转变"},
            {"section": 1, "title": "AgentsView 为 Claude Fable 5 设置自定义价格", "url": "https://simonwillison.net/2026/Jun/9/agentsview-custom-model-price",
             "source": "Simon Willison Blog", "tags": ["教程/实践", "部署/工程"], "summary": "在 AgentsView 中为 Fable 5 设置自定义价格追踪 token 使用量"},
            {"section": 2, "title": "Claude Prompting 最佳实践", "url": "https://docs.anthropic.com/en/docs/prompting",
             "source": "Anthropic Docs", "tags": ["官方", "提示词"], "summary": "官方提示词工程指南"},
            {"section": 3, "title": "Claude + MCP 工具调用", "url": "https://docs.anthropic.com/en/docs/tool-use",
             "source": "Anthropic Docs", "tags": ["官方", "Agent"], "summary": "通过 MCP 协议扩展 Claude 能力"},
            {"section": 3, "title": "Text-To-Lottie: Codex/Claude Code 生成动画", "url": "https://x.com/shao__meng/status/2064508455051043008",
             "source": "aiho.virxact.com", "tags": ["MCP/工具", "开源/仓库"], "summary": "Agent Skill + 本地预览 Harness，让 Agent 生成 Lottie JSON 动画并在浏览器实时验收"},
            {"section": 4, "title": "Claude API 参考", "url": "https://platform.claude.com/docs/api",
             "source": "Anthropic", "tags": ["官方", "API"], "summary": "完整 API 参考文档"},
            {"section": 4, "title": "Claude 模型选择指南", "url": "https://www.anthropic.com/claude",
             "source": "Anthropic", "tags": ["官方", "模型"], "summary": "Fable / Mythos / Opus / Sonnet / Haiku 对比"},
            {"section": 4, "title": "Claude 社区教程", "url": "https://claude.com/resources/tutorials",
             "source": "Anthropic", "tags": ["官方", "教程"], "summary": "Anthropic 官方教程与使用案例"},
        ]
    else:
        curated = [
            {"section": 0, "title": "Codex 官方概览", "url": "https://openai.com/codex/",
             "source": "OpenAI", "tags": ["官方", "入门"], "summary": "Codex 产品介绍与能力概述"},
            {"section": 0, "title": "Codex for every role", "url": "https://openai.com/index/codex-for-every-role-tool-workflow/",
             "source": "OpenAI Blog", "tags": ["官方", "更新"], "summary": "2026年6月：Codex 扩展到每一种角色、工具和工作流"},
            {"section": 0, "title": "Codex on AWS", "url": "https://openai.com/index/openai-frontier-models-and-codex-are-now-available-on-aws/",
             "source": "OpenAI Blog", "tags": ["官方", "集成"], "summary": "OpenAI 前沿模型和 Codex 现已可在 AWS 上使用"},
            {"section": 1, "title": "Codex API 快速开始", "url": "https://platform.openai.com/docs/quickstart",
             "source": "OpenAI Docs", "tags": ["官方", "API"], "summary": "5分钟接入 Codex API"},
            {"section": 1, "title": "Codex 代码补全与生成指南", "url": "https://platform.openai.com/docs/guides/code",
             "source": "OpenAI Docs", "tags": ["官方", "编码"], "summary": "使用 Codex 进行代码补全、生成与重构"},
            {"section": 2, "title": "Codex + Function Calling", "url": "https://platform.openai.com/docs/guides/function-calling",
             "source": "OpenAI Docs", "tags": ["官方", "Agent"], "summary": "Codex 的工具调用与函数调用指南"},
            {"section": 2, "title": "Text-To-Lottie: Codex/Claude Code 生成动画", "url": "https://x.com/shao__meng/status/2064508455051043008",
             "source": "aiho.virxact.com", "tags": ["MCP/工具", "开源/仓库"], "summary": "Agent Skill + 本地预览，让 Codex 生成 Lottie JSON 动画"},
            {"section": 3, "title": "Codex 与 IDE 集成", "url": "https://platform.openai.com/docs/guides/code#ide-integration",
             "source": "OpenAI Docs", "tags": ["官方", "IDE"], "summary": "将 Codex 集成到 VS Code、Cursor 等 IDE"},
            {"section": 3, "title": "Codex 成本优化", "url": "https://platform.openai.com/docs/guides/rate-limits",
             "source": "OpenAI Docs", "tags": ["官方", "性能"], "summary": "管理 API 使用配额、缓存策略和成本"},
            {"section": 4, "title": "OpenAI API 参考", "url": "https://platform.openai.com/docs/api-reference",
             "source": "OpenAI", "tags": ["官方", "API"], "summary": "完整 API 参考文档"},
            {"section": 4, "title": "Codex 模型与定价", "url": "https://openai.com/pricing",
             "source": "OpenAI", "tags": ["官方", "定价"], "summary": "Codex 模型版本和定价信息"},
            {"section": 4, "title": "OpenAI 开发者论坛", "url": "https://community.openai.com/",
             "source": "OpenAI", "tags": ["社区", "支持"], "summary": "开发者社区讨论与支持"},
        ]
    
    for c in curated:
        data["sections"][c["section"]]["items"].append(c)

def main():
    args = sys.argv[1:]
    topics = ['claude', 'codex']
    
    offline = '--offline' in args or '--init' in args
    allow_regression = '--allow-regression' in args
    failures = 0
    if '--topic' in args:
        idx = args.index('--topic') + 1
        topics = [args[idx]] if idx < len(args) else topics
    
    aiho_urls = {
        'claude': 'https://aihot.virxact.com/?s=claude',
        'codex': 'https://aihot.virxact.com/?s=codex'
    }
    blog_urls = {
        'claude': 'https://www.anthropic.com/blog',
        'codex': 'https://openai.com/blog'
    }
    
    for topic in topics:
        print(f"\n{'='*60}")
        print(f"  Building {topic.upper()} data page...")
        print(f"{'='*60}")
        
        aiho_items = []
        blog_items = []
        if not offline:
            # Fetch aiho data
            print(f"\n  📡 Fetching aiho content for '{topic}'...")
            aiho_raw = fetch_jina(aiho_urls[topic], cache_key=f"aiho_{topic}", max_age=3600)
            aiho_items = parse_aiho_items(aiho_raw['content']) if aiho_raw else []
            
            # Fetch blog data
            print(f"  📡 Fetching official blog...")
            blog_raw = fetch_jina(blog_urls[topic], cache_key=f"blog_{topic}", max_age=7200)
            blog_items = parse_anthropic_items(blog_raw['content']) if blog_raw else []
        else:
            print(f"  📡 Offline mode — using curated data only")
        
        # Filter aiho items for topic relevance
        filtered = []
        keywords = ['claude', 'anthropic'] if topic == 'claude' else ['codex', 'openai']
        for item in aiho_items:
            text = f"{item.get('title', '')} {item.get('summary', '')}".lower()
            if any(k in text for k in keywords):
                item['recommendedBy'] = 'aiho'
                filtered.append(item)
        
        # Build data structure
        data = build_data_page(topic, aiho_data=filtered, blog_data=blog_items)
        add_curated_data(data, topic == 'claude')
        
        # Remove empty sections
        data['sections'] = [s for s in data['sections'] if s['items']]
        
        # Sort items within sections: aiho (with score) first, then official, then curated
        for section in data['sections']:
            scored = [i for i in section['items'] if i.get('score')]
            unscored = [i for i in section['items'] if not i.get('score')]
            scored.sort(key=lambda x: x.get('score', 0), reverse=True)
            section['items'] = scored + unscored
        
        output_file = os.path.join(REPO_DIR, f"{topic}-data.json")
        existing_data = load_existing_data(output_file)
        regression = regression_details(existing_data, data, allow_regression=allow_regression)
        total = count_items(data)

        if regression:
            existing_total, generated_total = regression
            print(f"  ❌ Refusing to overwrite {topic}-data.json: item count would drop from {existing_total} to {generated_total}")
            if not offline and not filtered:
                print("     likely cause: aiho fetch/filter returned no usable items")
            print("     use --allow-regression only after manually confirming the content removal is intended")
            failures += 1
            continue

        # Write output
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"  ✅ {topic}-data.json: {len(data['sections'])} sections, {total} items")
        print(f"     aiho items: {len(filtered)}, curated: 12")

    return 1 if failures else 0

if __name__ == '__main__':
    sys.exit(main())
