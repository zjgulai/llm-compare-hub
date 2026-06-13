#!/usr/bin/env python3
"""LLM Compare Hub data validation.

Validates runtime JSON data for structural integrity, schema completeness,
cross-references, and optional docsUrl reachability.

Usage:
    python3 scripts/validate.py
    python3 scripts/validate.py --quiet
    python3 scripts/validate.py --check-urls
"""

import json
import os
import re
import sys
import urllib.error
import urllib.request
from urllib.parse import urlparse


REPO_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = [
    'api-data.json',
    'siliconflow-data.json',
    'compare-data.json',
    'free-models-data.json',
    'bai-data.json',
    'easyrouter-data.json',
]
PLATFORM_FILES = [
    'api-data.json',
    'siliconflow-data.json',
    'bai-data.json',
    'easyrouter-data.json',
]

VALID_COMPARE_TYPES = {
    'text',
    'image',
    'video',
    'audio',
    'music',
    'speech',
    'embedding',
    'ranking',
    '3d',
}
ISO_DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')

PLATFORM_MODEL_STRINGS = {
    'api-data.json': ['modelId', 'name', 'vendor', 'pricing', 'docsUrl', 'output'],
    'siliconflow-data.json': ['modelId', 'name', 'vendor', 'pricing', 'docsUrl', 'output'],
    'bai-data.json': ['modelId', 'name', 'vendor', 'context', 'pricing', 'docsUrl', 'output'],
    'easyrouter-data.json': ['modelId', 'name', 'vendor', 'context', 'pricing', 'docsUrl', 'output'],
}
PLATFORM_MODEL_LISTS = {
    'api-data.json': ['capabilities', 'variants'],
    'siliconflow-data.json': ['capabilities'],
    'bai-data.json': ['capabilities', 'variants'],
    'easyrouter-data.json': ['capabilities', 'variants'],
}
PLATFORM_MODEL_OBJECTS = {
    'api-data.json': ['input'],
    'siliconflow-data.json': [],
    'bai-data.json': ['input'],
    'easyrouter-data.json': ['input'],
}

errors = 0
warnings = 0
quiet = '--quiet' in sys.argv
check_urls = '--check-urls' in sys.argv


def msg(level, text):
    global errors, warnings
    if level == 'ERROR':
        errors += 1
        print(f"  ERROR {text}")
    elif level == 'WARN':
        warnings += 1
        if not quiet:
            print(f"  WARN  {text}")
    else:
        if not quiet:
            print(f"  OK    {text}")


def is_blank(value):
    return value is None or value == '' or (isinstance(value, str) and not value.strip())


def owner_key(owner, key):
    return f"{owner}.{key}"


def expect_dict(owner, value):
    if not isinstance(value, dict) or not value:
        msg('ERROR', f"{owner} must be a non-empty object")
        return False
    return True


def expect_list(owner, value, min_items=1):
    if not isinstance(value, list) or len(value) < min_items:
        msg('ERROR', f"{owner} must be a list with at least {min_items} item(s)")
        return False
    return True


def expect_string(obj, owner, key, required=True):
    if key not in obj:
        if required:
            msg('ERROR', f"{owner} missing required field: {key}")
        return False
    value = obj.get(key)
    if not isinstance(value, str) or is_blank(value):
        msg('ERROR', f"{owner_key(owner, key)} must be a non-empty string")
        return False
    return True


def expect_bool(obj, owner, key, required=True):
    if key not in obj:
        if required:
            msg('ERROR', f"{owner} missing required field: {key}")
        return False
    if not isinstance(obj.get(key), bool):
        msg('ERROR', f"{owner_key(owner, key)} must be a boolean")
        return False
    return True


def expect_number(obj, owner, key, required=True, minimum=None, maximum=None):
    if key not in obj:
        if required:
            msg('ERROR', f"{owner} missing required field: {key}")
        return False
    value = obj.get(key)
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        msg('ERROR', f"{owner_key(owner, key)} must be a number")
        return False
    if minimum is not None and value < minimum:
        msg('ERROR', f"{owner_key(owner, key)} must be >= {minimum}")
        return False
    if maximum is not None and value > maximum:
        msg('ERROR', f"{owner_key(owner, key)} must be <= {maximum}")
        return False
    return True


def expect_int(obj, owner, key, required=True, minimum=None):
    if key not in obj:
        if required:
            msg('ERROR', f"{owner} missing required field: {key}")
        return False
    value = obj.get(key)
    if isinstance(value, bool) or not isinstance(value, int):
        msg('ERROR', f"{owner_key(owner, key)} must be an integer")
        return False
    if minimum is not None and value < minimum:
        msg('ERROR', f"{owner_key(owner, key)} must be >= {minimum}")
        return False
    return True


def expect_url(obj, owner, key, required=True):
    if key not in obj:
        if required:
            msg('ERROR', f"{owner} missing required field: {key}")
        return False
    value = obj.get(key)
    if not isinstance(value, str) or is_blank(value):
        msg('ERROR', f"{owner_key(owner, key)} must be a non-empty URL string")
        return False
    parsed = urlparse(value)
    if parsed.scheme not in {'http', 'https'} or not parsed.netloc:
        msg('ERROR', f"{owner_key(owner, key)} must be an http(s) URL")
        return False
    return True


def expect_iso_date(obj, owner, key, required=True):
    if key not in obj:
        if required:
            msg('ERROR', f"{owner} missing required field: {key}")
        return False
    value = obj.get(key)
    if not isinstance(value, str) or not ISO_DATE_RE.match(value):
        msg('ERROR', f"{owner_key(owner, key)} must use YYYY-MM-DD format")
        return False
    return True


def expect_string_list(obj, owner, key, required=True):
    if key not in obj:
        if required:
            msg('ERROR', f"{owner} missing required field: {key}")
        return False
    values = obj.get(key)
    if not expect_list(owner_key(owner, key), values):
        return False
    for index, value in enumerate(values):
        if not isinstance(value, str) or is_blank(value):
            msg('ERROR', f"{owner_key(owner, key)}[{index}] must be a non-empty string")
            return False
    return True


def expect_rank_sequence(owner, items):
    ranks = [item.get('rank') for item in items]
    expected = list(range(1, len(items) + 1))
    if ranks != expected:
        msg('ERROR', f"{owner} ranks must be sequential: expected {expected}, got {ranks}")


def check_duplicate(owner, value, seen):
    if value in seen:
        msg('ERROR', f"{owner}: duplicate value '{value}' also seen at {seen[value]}")
        return
    seen[value] = owner


def load_json_files():
    loaded = {}
    for fname in FILES:
        path = os.path.join(REPO_DIR, fname)
        try:
            with open(path, encoding='utf-8') as f:
                data = json.load(f)
            loaded[fname] = data
            msg('OK', f"{fname} valid JSON ({len(json.dumps(data, ensure_ascii=False))} bytes)")
        except FileNotFoundError:
            msg('ERROR', f"{fname} not found")
        except json.JSONDecodeError as e:
            msg('ERROR', f"{fname} invalid JSON: {e}")
    return loaded


def check_platform_file(fname, data):
    owner = fname
    for key in ['platform', 'platformName']:
        expect_string(data, owner, key)
    for key in ['platformUrl', 'docsUrl']:
        expect_url(data, owner, key)
    expect_dict(owner_key(owner, 'apiOverview'), data.get('apiOverview'))
    expect_list(owner_key(owner, 'commonApis'), data.get('commonApis'))
    if not expect_list(owner_key(owner, 'categories'), data.get('categories')):
        return []

    category_ids = {}
    model_ids = {}
    docs_urls = []
    total_models = 0

    for cat_index, category in enumerate(data['categories']):
        cat_owner = f"{fname}.categories[{cat_index}]"
        if not isinstance(category, dict):
            msg('ERROR', f"{cat_owner} must be an object")
            continue

        for key in ['id', 'name', 'description']:
            expect_string(category, cat_owner, key)

        category_id = category.get('id')
        if isinstance(category_id, str) and category_id:
            check_duplicate(f"{cat_owner}.id", category_id, category_ids)

        endpoint_fields = ['endpoint', 'ttsEndpoint', 'sttEndpoint', 'statusEndpoint']
        if not any(isinstance(category.get(key), str) and category.get(key).strip() for key in endpoint_fields):
            msg('ERROR', f"{cat_owner} must define an endpoint field")

        if not expect_list(owner_key(cat_owner, 'models'), category.get('models')):
            continue

        for model_index, model in enumerate(category['models']):
            total_models += 1
            model_owner = f"{fname}.{category_id or cat_index}.models[{model_index}]"
            if not isinstance(model, dict):
                msg('ERROR', f"{model_owner} must be an object")
                continue

            for key in PLATFORM_MODEL_STRINGS[fname]:
                expect_string(model, model_owner, key)
            for key in PLATFORM_MODEL_LISTS[fname]:
                expect_string_list(model, model_owner, key)
            for key in PLATFORM_MODEL_OBJECTS[fname]:
                expect_dict(owner_key(model_owner, key), model.get(key))

            model_id = model.get('modelId')
            if isinstance(model_id, str) and model_id:
                check_duplicate(f"{model_owner}.modelId", model_id, model_ids)

            if expect_url(model, model_owner, 'docsUrl'):
                docs_urls.append((fname, model.get('name'), model['docsUrl']))
            expect_url(model, model_owner, 'sourceUrl', required=False)
            expect_iso_date(model, model_owner, 'verifiedAt', required=False)

            if 'docsUrlNeedsReview' in model:
                expect_bool(model, model_owner, 'docsUrlNeedsReview')
                if model.get('docsUrlNeedsReview'):
                    expect_url(model, model_owner, 'sourceUrl')
                    expect_iso_date(model, model_owner, 'verifiedAt')

            if 'deprecated' in model:
                expect_bool(model, model_owner, 'deprecated')
                if model.get('deprecated'):
                    if model.get('availability') != 'deprecated':
                        msg('ERROR', f"{model_owner}.availability must be 'deprecated'")
                    expect_iso_date(model, model_owner, 'deprecatedAt')
                    expect_string(model, model_owner, 'replacementModelId')
                    expect_url(model, model_owner, 'sourceUrl')
                    expect_iso_date(model, model_owner, 'verifiedAt')

    if total_models == 0:
        msg('WARN', f"{fname} has no models in any category")
    else:
        msg('OK', f"{fname} schema: {total_models} models across {len(data['categories'])} categories")
    return docs_urls


def build_platform_index(loaded):
    platform_data = {}
    global_ids = {}
    for plat_file in PLATFORM_FILES:
        data = loaded.get(plat_file, {})
        for cat in data.get('categories', []):
            for model in cat.get('models', []):
                model_id = model.get('modelId')
                if not model_id:
                    continue
                owner = f"{plat_file}.{cat.get('id')}.{model.get('name')}"
                check_duplicate(owner, model_id, global_ids)
                platform_data[model_id] = {
                    'file': plat_file,
                    'category': cat.get('id'),
                    'model': model,
                }
    return platform_data


def check_modalities(owner, item):
    mod = item.get('modalities')
    if not isinstance(mod, dict):
        msg('ERROR', f"{owner}: missing modalities")
        return

    expect_bool(mod, f"{owner}.modalities", 'multimodal')

    for key in ['input', 'output']:
        values = mod.get(key)
        if not expect_list(f"{owner}.modalities.{key}", values):
            continue
        invalid = [value for value in values if value not in VALID_COMPARE_TYPES]
        if invalid:
            msg('ERROR', f"{owner}.modalities.{key}: invalid values {invalid}")

    expect_string(mod, f"{owner}.modalities", 'note')


def check_compare_model_ref(owner, item, platform_data, warn_missing=True):
    model_id = item.get('modelId', '')
    if not model_id:
        return

    platform_entry = platform_data.get(model_id)
    if not platform_entry:
        level = 'WARN' if warn_missing else 'ERROR'
        msg(level, f"{owner}: modelId={model_id} not in platform data")
        return

    if item.get('deprecated') or platform_entry['model'].get('deprecated'):
        replacement = item.get('replacementModelId') or platform_entry['model'].get('replacementModelId')
        suffix = f"; replacement={replacement}" if replacement else ''
        msg('WARN', f"{owner}: deprecated model remains in compare ranking{suffix}")


def check_compare_model_common(owner, item):
    expect_int(item, owner, 'rank', minimum=1)
    expect_string(item, owner, 'name')
    expect_string(item, owner, 'platform')
    check_modalities(owner, item)


def check_compare_data(comp, platform_data):
    owner = 'compare-data.json'
    for key in ['methodology']:
        expect_dict(owner_key(owner, key), comp.get(key))
    expect_iso_date(comp, owner, 'lastUpdated')
    for key in ['overallRanking', 'categories', 'functionRanking']:
        expect_list(owner_key(owner, key), comp.get(key))

    overall = comp.get('overallRanking', [])
    expect_rank_sequence('compare-data overallRanking', overall)
    for item in overall:
        item_owner = f"compare-data overallRanking[{item.get('rank')}]: {item.get('name')}"
        check_compare_model_common(item_owner, item)
        expect_string(item, item_owner, 'category')
        expect_number(item, item_owner, 'score', minimum=0, maximum=100)
        expect_string(item, item_owner, 'tag')
        expect_string(item, item_owner, 'modelId', required=False)
        check_compare_model_ref(item_owner, item, platform_data)

    category_ids = {}
    for cat_index, category in enumerate(comp.get('categories', [])):
        cat_owner = f"compare-data categories[{cat_index}]"
        for key in ['categoryId', 'categoryName', 'icon', 'summary', 'winner']:
            expect_string(category, cat_owner, key)
        if category.get('categoryId'):
            check_duplicate(f"{cat_owner}.categoryId", category['categoryId'], category_ids)
        if not expect_list(owner_key(cat_owner, 'models'), category.get('models')):
            continue
        expect_rank_sequence(f"compare-data categories[{category.get('categoryId')}].models", category['models'])

        for item in category['models']:
            item_owner = f"compare-data categories[{category.get('categoryId')}][{item.get('rank')}]: {item.get('name')}"
            check_compare_model_common(item_owner, item)
            for key in ['modelId', 'platformName', 'vendor', 'category', 'bestFor']:
                expect_string(item, item_owner, key)
            expect_string(item, item_owner, 'context', required=False)
            for key in ['pros', 'cons', 'capabilities']:
                expect_string_list(item, item_owner, key)
            for key in ['overallScore', 'valueScore', 'stability']:
                expect_number(item, item_owner, key, minimum=0, maximum=100)
            for key in ['inputPrice', 'outputPrice']:
                expect_number(item, item_owner, key, minimum=0)
            expect_url(item, item_owner, 'docsUrl')
            check_compare_model_ref(item_owner, item, platform_data, warn_missing=False)

    function_ids = {}
    for fr_index, function in enumerate(comp.get('functionRanking', [])):
        function_owner = f"compare-data functionRanking[{fr_index}]"
        for key in ['functionId', 'functionName', 'icon', 'description']:
            expect_string(function, function_owner, key)
        if function.get('functionId'):
            check_duplicate(f"{function_owner}.functionId", function['functionId'], function_ids)
        if not expect_list(owner_key(function_owner, 'topModels'), function.get('topModels')):
            continue
        expect_rank_sequence(f"compare-data functionRanking[{function.get('functionId')}].topModels", function['topModels'])

        for item in function['topModels']:
            item_owner = f"compare-data functionRanking[{function.get('functionId')}][{item.get('rank')}]: {item.get('name')}"
            check_compare_model_common(item_owner, item)
            for key in ['modelId', 'tag', 'why']:
                expect_string(item, item_owner, key)
            expect_number(item, item_owner, 'score', minimum=0, maximum=100)
            expect_url(item, item_owner, 'docsUrl', required=False)
            check_compare_model_ref(item_owner, item, platform_data, warn_missing=False)


def check_free_models(data):
    owner = 'free-models-data.json'
    for key in ['categoryId', 'categoryName', 'nameEn', 'description']:
        expect_string(data, owner, key)
    if not expect_list(owner_key(owner, 'models'), data.get('models')):
        return

    expect_rank_sequence('free-models-data models', data['models'])
    model_ids = {}
    for model in data['models']:
        item_owner = f"free-models-data models[{model.get('rank')}]: {model.get('name')}"
        expect_int(model, item_owner, 'rank', minimum=1)
        for key in [
            'modelId',
            'name',
            'vendor',
            'baseModel',
            'type',
            'architecture',
            'context',
            'diskSize',
            'ramUsage',
            'requirements',
            'license',
            'install',
            'usage',
            'output',
            'notes',
        ]:
            expect_string(model, item_owner, key)
        for key in ['capabilities']:
            expect_string_list(model, item_owner, key)
        for key in ['huggingface', 'baseModelUrl', 'ollamaUrl']:
            expect_url(model, item_owner, key, required=False)
        if model.get('modelId'):
            check_duplicate(f"{item_owner}.modelId", model['modelId'], model_ids)


def check_docs_urls(docs_urls):
    by_file = {fname: 0 for fname in PLATFORM_FILES}
    for plat_file, _model_name, _url in docs_urls:
        by_file[plat_file] += 1

    for plat_file in PLATFORM_FILES:
        model_count = sum(
            len(cat.get('models', []))
            for cat in loaded.get(plat_file, {}).get('categories', [])
        )
        if by_file[plat_file] == model_count:
            msg('OK', f"{plat_file}: all models have docsUrl")
        else:
            msg('WARN', f"{plat_file}: {model_count - by_file[plat_file]} models missing docsUrl")

    if not check_urls:
        return

    checked = {}
    for _plat_file, _model_name, url in docs_urls:
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


print("\n=== LLM Compare Hub Data Validation ===\n")

loaded = load_json_files()
docs_urls = []

if not errors:
    for platform_file in PLATFORM_FILES:
        docs_urls.extend(check_platform_file(platform_file, loaded[platform_file]))

    platform_data = build_platform_index(loaded)
    check_compare_data(loaded['compare-data.json'], platform_data)
    check_free_models(loaded['free-models-data.json'])
    check_docs_urls(docs_urls)

print(f"\n=== Summary: {errors} errors, {warnings} warnings ===")
sys.exit(1 if errors > 0 else 0)
