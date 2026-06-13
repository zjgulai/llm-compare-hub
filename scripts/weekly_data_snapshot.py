#!/usr/bin/env python3
"""Generate weekly data snapshots and a governance report."""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parents[1]
ALL_DATA_FILES = [
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
VALID_MODALITY_TYPES = {
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
PROVENANCE_FIELDS = ['sourceUrl', 'verifiedAt', 'confidence', 'sourceType']
REPORT_PREFIX = 'data-snapshot-'


def sha256sum(file_path: Path) -> str:
    hasher = hashlib.sha256()
    with file_path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b''):
            hasher.update(chunk)
    return hasher.hexdigest()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-dir', default='artifacts/weekly')
    parser.add_argument('--stale-days', type=int, default=30)
    parser.add_argument('--snapshot-file', default='data-provenance-snapshots.json')
    parser.add_argument('--date', default=date.today().isoformat())
    return parser.parse_args()


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding='utf-8'))


def parse_verified_at(raw: Any) -> date | None:
    if not isinstance(raw, str):
        return None
    try:
        return datetime.strptime(raw, '%Y-%m-%d').date()
    except ValueError:
        return None


def model_iter(data: dict[str, Any]):
    for category in data.get('categories', []):
        category_id = category.get('id') or category.get('name') or 'unknown'
        for model in category.get('models', []):
            yield category_id, model


def provenance_summary(data: dict[str, Any], stale_days: int) -> dict[str, Any]:
    field_counter = {field: 0 for field in PROVENANCE_FIELDS}
    models = []
    stale = []
    missing = []
    today = date.today()

    for category_id, model in model_iter(data):
        model_name = model.get('name') or model.get('modelId') or '(unknown)'
        model_id = model.get('modelId') or model_name
        models.append((category_id, model_name, model_id))

        for field in PROVENANCE_FIELDS:
            if field in model and model.get(field):
                field_counter[field] += 1

        verified_at = parse_verified_at(model.get('verifiedAt'))
        if verified_at and (today - verified_at).days > stale_days:
            stale.append({
                'categoryId': category_id,
                'name': model_name,
                'modelId': model_id,
                'verifiedAt': model.get('verifiedAt'),
            })
        if not all(model.get(field) for field in PROVENANCE_FIELDS):
            missing.append(f'{category_id}/{model_name}')

    total = len(models)
    return {
        'models': total,
        'coverage': {field: {'count': count, 'total': total} for field, count in field_counter.items()},
        'missing': sorted(missing)[:20],
        'staleCount': len(stale),
        'staleSample': stale[:20],
    }


def compare_summary(compare_data: dict[str, Any]) -> dict[str, Any]:
    def iter_items() -> list[dict[str, Any]]:
        overall = compare_data.get('overallRanking', [])
        function_sections = compare_data.get('functionRanking', [])
        category_sections = compare_data.get('categories', [])
        all_items = []
        all_items.extend(overall)
        for section in category_sections:
            all_items.extend(section.get('models', []))
        for section in function_sections:
            all_items.extend(section.get('topModels', []))
        return all_items

    input_counter = Counter()
    output_counter = Counter()
    modality_counter = Counter()
    missing = []
    items = iter_items()
    for item in items:
        modalities = item.get('modalities', {})
        multimodal = modalities.get('multimodal')
        if isinstance(multimodal, bool):
            modality_counter['multimodal_true' if multimodal else 'multimodal_false'] += 1
        else:
            missing.append(item.get('name', '(unknown)'))

        for dtype in modalities.get('input', []):
            if isinstance(dtype, str):
                input_counter[dtype] += 1
        for dtype in modalities.get('output', []):
            if isinstance(dtype, str):
                output_counter[dtype] += 1

    def top(counter: Counter[str], n: int = 6) -> list[dict[str, Any]]:
        return [
            {'type': item_type, 'count': count}
            for item_type, count in counter.most_common(n)
        ]

    invalid_types = sorted((set(input_counter) | set(output_counter)) - VALID_MODALITY_TYPES)

    return {
        'totalComparedModels': len(items),
        'modalities': {
            'multimodal': dict(modality_counter),
            'inputTypes': {
                'top': top(input_counter),
                'unknownCount': len(items) - sum(input_counter.values()),
            },
            'outputTypes': {
                'top': top(output_counter),
                'unknownCount': len(items) - sum(output_counter.values()),
            },
            'invalidTypes': sorted(invalid_types),
            'missingModalitiesCount': len(missing),
            'missingModalitiesSample': missing[:20],
        },
    }


def platform_file_summary(file_name: str) -> dict[str, Any]:
    path = REPO / file_name
    payload = read_json(path)
    categories = payload.get('categories', [])
    total = 0
    by_category: dict[str, int] = {}
    deprecated = 0

    for category in categories:
        category_id = category.get('id') or category.get('name') or 'unknown'
        models = list(category.get('models', []))
        by_category[category_id] = len(models)
        total += len(models)
        for model in models:
            if model.get('deprecated'):
                deprecated += 1

    return {
        'path': file_name,
        'size': path.stat().st_size,
        'sha256': sha256sum(path),
        'categories': len(categories),
        'models': total,
        'modelsByCategory': by_category,
        'deprecatedModels': deprecated,
    }


def compare_with_previous(current: dict[str, Any], previous: dict[str, Any] | None, files: list[str]) -> dict[str, Any]:
    deltas: dict[str, dict[str, Any]] = {}
    if not previous:
        return {
            'hasPrevious': False,
            'fileChanges': {},
        }

    prev_files = {entry['path']: entry for entry in previous.get('files', [])}
    for file_name in files:
        curr = current['filesByPath'][file_name]
        prev = prev_files.get(file_name, {})
        deltas[file_name] = {
            'hashChanged': prev.get('sha256') != curr['sha256'],
            'modelCountChanged': prev.get('models') != curr['models'],
            'categoryCountChanged': prev.get('categories') != curr['categories'],
            'sizeDelta': curr['size'] - (prev.get('size', 0)),
            'prevSize': prev.get('size', 0),
        }
    return {'hasPrevious': True, 'fileChanges': deltas}


def drift_summary(snapshot_path: Path) -> dict[str, Any]:
    if not snapshot_path.exists():
        return {'status': 'missing', 'generatedAt': None, 'totalSources': 0, 'statusCounts': {}}

    snapshot = read_json(snapshot_path)
    sources = snapshot.get('sources', {})
    status_counts: dict[str, int] = defaultdict(int)
    failed = []
    for source, data in sorted(sources.items()):
        status = data.get('status')
        status_counts[str(status)] += 1
        if status != 200:
            failed.append({
                'url': source,
                'status': status,
                'checkedAt': data.get('checkedAt'),
            })
    return {
        'status': 'ok',
        'generatedAt': snapshot.get('generatedAt'),
        'totalSources': len(sources),
        'statusCounts': dict(sorted(status_counts.items())),
        'failedCount': len(failed),
        'failedSamples': failed[:20],
    }


def render_markdown(report: dict[str, Any]) -> str:
    lines = [
        f'# LLM Models Hub 周报',
        f'生成时间：{report['generatedAt']}',
        f'周区间：{report['window']['from']} ~ {report['window']['to']}',
        '',
        '## 一、数据文件摘要',
        '',
        '| 文件 | 大小(B) | SHA256 | 模型/条目 | 分类数 | 弃用模型 |',
        '| --- | --- | --- | --- | --- | --- |',
    ]

    for file_entry in report['files']:
        lines.append(
            f"| {file_entry['path']} | {file_entry['size']} | "
            f"{file_entry['sha256'][:12]}... | {file_entry['models']} | "
            f"{file_entry['categories']} | {file_entry['deprecatedModels']} |"
        )

    lines.extend([
        '',
        '## 二、平台模型 provenance 覆盖',
        '',
        '| 文件 | 数量 | sourceUrl | verifiedAt | confidence | sourceType | 过期(> {}d) | 缺失样例 |'.format(report['window']['staleThresholdDays']),
        '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ])
    for file_name in PLATFORM_FILES:
        prov = report['provenance'][file_name]
        lines.append(
            f"| {file_name} | {prov['models']} | "
            f"{prov['coverage']['sourceUrl']['count']}/{prov['coverage']['sourceUrl']['total']} | "
            f"{prov['coverage']['verifiedAt']['count']}/{prov['coverage']['verifiedAt']['total']} | "
            f"{prov['coverage']['confidence']['count']}/{prov['coverage']['confidence']['total']} | "
            f"{prov['coverage']['sourceType']['count']}/{prov['coverage']['sourceType']['total']} | "
            f"{prov['staleCount']} | {len(prov['missing'])} |"
        )

    lines.extend([
        '',
        '## 三、对比页能力覆盖',
        '',
        f"- 对比页覆盖条目：{report['compare']['totalComparedModels']}",
        f"- 多模态：{report['compare']['modalities']['multimodal'].get('multimodal_true', 0)}",
        f"- 单模态：{report['compare']['modalities']['multimodal'].get('multimodal_false', 0)}",
        '',
        '### 输入类型 Top',
        '',
    ])
    for item in report['compare']['modalities']['inputTypes']['top']:
        lines.append(f"- {item['type']}: {item['count']}")
    lines.extend([
        '',
        '### 输出类型 Top',
        '',
    ])
    for item in report['compare']['modalities']['outputTypes']['top']:
        lines.append(f"- {item['type']}: {item['count']}")

    lines.extend([
        '',
        '## 四、数据漂移快照',
        '',
        f"- 来源快照：{report['drift']['status']}",
        f"- 采样时间：{report['drift']['generatedAt'] or 'N/A'}",
        f"- 监控源数：{report['drift']['totalSources']}",
        f"- 非 200 源数：{report['drift']['failedCount']}",
    ])

    if report['drift']['failedSamples']:
        lines.extend([
            '',
            '### 失败样例',
            '',
        ])
        for sample in report['drift']['failedSamples']:
            lines.append(f"- {sample['url']} -> {sample['status']} ({sample['checkedAt']})")

    lines.extend([
        '',
        '## 五、与上周差异（可用作发布要点）',
        '',
        f"- 是否有历史基线：{report['changes']['hasPrevious']}",
    ])
    if report['changes']['fileChanges']:
        for file_name, delta in report['changes']['fileChanges'].items():
            tags = []
            if delta['hashChanged']:
                tags.append('hash变更')
            if delta['modelCountChanged']:
                tags.append('模型数量变化')
            if delta['categoryCountChanged']:
                tags.append('分类数量变化')
            if not tags:
                tags.append('无变更')
            lines.append(f"- {file_name}: {', '.join(tags)}（sizeΔ: {delta['sizeDelta']}）")

    lines.extend([
        '',
        '## 六、本周建议',
        '',
        '- 重点复查 provenance 仍缺失项（若出现 > 0）',
        '- 检查来源页漂移失败条目，先补齐或更新 sourceUrl',
        '- 确认 compare 多模态与输入/输出类型与产品描述一致',
    ])
    return '\n'.join(lines) + '\n'


def latest_report(output_dir: Path, today: str) -> Path | None:
    candidates = sorted(output_dir.glob(f'{REPORT_PREFIX}*.json'))
    exclude = output_dir / f'{REPORT_PREFIX}{today}.json'
    for candidate in reversed(candidates):
        if candidate != exclude and candidate.name.startswith(REPORT_PREFIX):
            return candidate
    return None


def collect_previous(report_data: dict[str, Any], output_dir: Path, today: str) -> dict[str, Any] | None:
    previous_path = latest_report(output_dir, today)
    if not previous_path:
        return None
    return read_json(previous_path)


def main() -> int:
    args = parse_args()
    output_dir = REPO / args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)
    try:
        today = date.fromisoformat(args.date)
    except ValueError:
        print(f'ERR: --date must be YYYY-MM-DD, got {args.date!r}')
        return 1
    week_start = today - timedelta(days=today.weekday())

    file_data: list[dict[str, Any]] = []
    for file_name in ALL_DATA_FILES:
        path = REPO / file_name
        if not path.exists():
            print(f'ERR missing data file: {file_name}')
            return 1
        if file_name in PLATFORM_FILES or file_name in {'compare-data.json', 'free-models-data.json'}:
            file_data.append(platform_file_summary(file_name))

    loaded = {name: read_json(REPO / name) for name in ALL_DATA_FILES}

    provenance: dict[str, Any] = {}
    for file_name in PLATFORM_FILES:
        provenance[file_name] = provenance_summary(loaded[file_name], args.stale_days)

    compare = compare_summary(loaded['compare-data.json'])
    drift = drift_summary(REPO / args.snapshot_file)

    files_by_path = {entry['path']: entry for entry in file_data}
    report: dict[str, Any] = {
        'generatedAt': today.isoformat(),
        'window': {
            'from': str(week_start),
            'to': today.isoformat(),
            'staleThresholdDays': args.stale_days,
        },
        'files': file_data,
        'filesByPath': files_by_path,
        'provenance': provenance,
        'compare': compare,
        'drift': drift,
    }

    report['changes'] = compare_with_previous(report, collect_previous(report, output_dir, today.isoformat()), ALL_DATA_FILES)

    json_path = output_dir / f'{REPORT_PREFIX}{today.isoformat()}.json'
    md_path = output_dir / f'{REPORT_PREFIX}{today.isoformat()}.md'

    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    md_path.write_text(render_markdown(report), encoding='utf-8')

    print(f'Wrote report JSON: {json_path.relative_to(REPO)}')
    print(f'Wrote report Markdown: {md_path.relative_to(REPO)}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
