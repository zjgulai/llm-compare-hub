#!/usr/bin/env python3
"""LLM Compare Hub — Data Validation Script

Validates all JSON data files for structural integrity, cross-references, and consistency.
Usage:
    python3 scripts/validate.py          # validate everything
    python3 scripts/validate.py --quiet  # only show errors
    python3 scripts/validate.py --check-urls  # also probe unique docsUrl HTTP status
"""

import json, sys, os
import urllib.error
import urllib.request

REPO_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = ['api-data.json', 'siliconflow-data.json', 'compare-data.json', 
         'free-models-data.json', 'bai-data.json', 'easyrouter-data.json']

errors = 0
warnings = 0
quiet = '--quiet' in sys.argv
check_urls = '--check-urls' in sys.argv

def msg(level, text):
    global errors, warnings
    if level == 'ERROR':
        errors += 1
        print(f"  ❌ {text}")
    elif level == 'WARN':
        warnings += 1
        if not quiet:
            print(f"  ⚠️  {text}")
    else:
        if not quiet:
            print(f"  ✅ {text}")

print(f"\n=== LLM Compare Hub Data Validation ===\n")

# 1. Basic JSON parse check
for fname in FILES:
    path = os.path.join(REPO_DIR, fname)
    try:
        with open(path) as f:
            data = json.load(f)
        msg('OK', f"{fname} — valid JSON ({len(json.dumps(data))} bytes)")
    except FileNotFoundError:
        msg('WARN', f"{fname} — not found (expected for new files)")
    except json.JSONDecodeError as e:
        msg('ERROR', f"{fname} — invalid JSON: {e}")

# 2. Platform data files structure check
def check_platform(fname, required_keys, require_models=True):
    path = os.path.join(REPO_DIR, fname)
    if not os.path.exists(path):
        return
    with open(path) as f:
        d = json.load(f)
    for k in required_keys:
        if k not in d:
            msg('ERROR', f"{fname} — missing key: {k}")
    if require_models and 'categories' in d:
        total = sum(len(c.get('models', [])) for c in d['categories'])
        if total == 0:
            msg('WARN', f"{fname} — no models in any category (skeleton?)")
        else:
            msg('OK', f"{fname} — {total} models across {len(d['categories'])} categories")

check_platform('api-data.json', ['platform', 'platformName', 'platformUrl', 'categories'])
check_platform('siliconflow-data.json', ['platform', 'platformName', 'platformUrl', 'categories'])
check_platform('bai-data.json', ['platform', 'platformName', 'platformUrl', 'categories'])
check_platform('easyrouter-data.json', ['platform', 'platformName', 'platformUrl', 'categories'])

# 3. Cross-reference: compare-data.json modelIds exist in platform files
platform_data = {}
for plat_file in ['api-data.json', 'siliconflow-data.json', 'bai-data.json', 'easyrouter-data.json']:
    path = os.path.join(REPO_DIR, plat_file)
    if not os.path.exists(path):
        continue
    with open(path) as f:
        d = json.load(f)
    for cat in d.get('categories', []):
        for m in cat.get('models', []):
            platform_data[m.get('modelId', '')] = {
                'file': plat_file,
                'category': cat.get('id'),
                'model': m,
            }

path = os.path.join(REPO_DIR, 'compare-data.json')
with open(path) as f:
    comp = json.load(f)

VALID_COMPARE_TYPES = {'text', 'image', 'video', 'audio', 'music', 'speech', 'embedding', 'ranking', '3d'}

def check_modalities(owner, item):
    mod = item.get('modalities')
    if not isinstance(mod, dict):
        msg('ERROR', f"{owner}: missing modalities")
        return

    if not isinstance(mod.get('multimodal'), bool):
        msg('ERROR', f"{owner}: modalities.multimodal must be boolean")

    for key in ['input', 'output']:
        values = mod.get(key)
        if not isinstance(values, list) or not values:
            msg('ERROR', f"{owner}: modalities.{key} must be a non-empty list")
            continue
        invalid = [value for value in values if value not in VALID_COMPARE_TYPES]
        if invalid:
            msg('ERROR', f"{owner}: invalid modalities.{key}: {invalid}")

    if not mod.get('note'):
        msg('ERROR', f"{owner}: modalities.note is required")

def check_compare_model_ref(owner, item):
    mid = item.get('modelId', '')
    if not mid:
        return

    platform_entry = platform_data.get(mid)
    if not platform_entry:
        msg('WARN', f"{owner}: modelId={mid} not in platform data")
        return

    if item.get('deprecated') or platform_entry['model'].get('deprecated'):
        replacement = item.get('replacementModelId') or platform_entry['model'].get('replacementModelId')
        suffix = f"; replacement={replacement}" if replacement else ""
        msg('WARN', f"{owner}: deprecated model remains in compare ranking{suffix}")

for item in comp.get('overallRanking', []):
    owner = f"compare-data overallRanking: '{item.get('name')}'"
    check_modalities(owner, item)
    check_compare_model_ref(owner, item)

for cat in comp.get('categories', []):
    for item in cat.get('models', []):
        owner = f"compare-data categories [{cat.get('categoryId')}]: '{item.get('name')}'"
        check_modalities(owner, item)
        check_compare_model_ref(owner, item)

for fr in comp.get('functionRanking', []):
    for r in fr.get('rankings', []):
        owner = f"compare-data functionRanking [{fr.get('functionId')}]: '{r.get('name')}'"
        check_compare_model_ref(owner, r)
    for r in fr.get('topModels', []):
        owner = f"compare-data functionRanking [{fr.get('functionId')}]: '{r.get('name')}'"
        check_modalities(owner, r)
        check_compare_model_ref(owner, r)

# 4. Check for missing docsUrl on platform models
docs_urls = []
for plat_file in ['api-data.json', 'siliconflow-data.json', 'bai-data.json', 'easyrouter-data.json']:
    path = os.path.join(REPO_DIR, plat_file)
    with open(path) as f:
        d = json.load(f)
    placeholder_count = 0
    for cat in d.get('categories', []):
        for m in cat.get('models', []):
            url = m.get('docsUrl', '')
            if not url:
                placeholder_count += 1
            else:
                docs_urls.append((plat_file, m.get('name'), url))
    if placeholder_count:
        msg('WARN', f"{plat_file}: {placeholder_count} models missing docsUrl")
    else:
        msg('OK', f"{plat_file}: all models have docsUrl")

if check_urls:
    checked = {}
    for plat_file, model_name, url in docs_urls:
        if url in checked:
            continue
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'llm-models-hub-validate/1.0'})
            with urllib.request.urlopen(request, timeout=12) as response:
                checked[url] = response.status
        except urllib.error.HTTPError as e:
            checked[url] = e.code
        except Exception as e:
            checked[url] = f"{type(e).__name__}: {e}"

    bad = {url: status for url, status in checked.items() if status != 200}
    if bad:
        for url, status in bad.items():
            msg('WARN', f"docsUrl check: {url} returned {status}")
    else:
        msg('OK', f"docsUrl check: {len(checked)} unique URLs returned 200")

# 5. Check for BAI/EasyRouter URLs
for plat_file in ['bai-data.json', 'easyrouter-data.json']:
    path = os.path.join(REPO_DIR, plat_file)
    with open(path) as f:
        d = json.load(f)
    if not d.get('platformUrl'):
        msg('WARN', f"{plat_file}: platformUrl is empty")
    else:
        msg('OK', f"{plat_file}: platformUrl = {d['platformUrl']}")

# Summary
total = len(FILES)
print(f"\n=== Summary: {errors} errors, {warnings} warnings ===")
sys.exit(1 if errors > 0 else 0)
