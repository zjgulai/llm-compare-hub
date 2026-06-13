#!/usr/bin/env python3
"""Report provenance metadata coverage for runtime JSON data."""

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys


REPO = Path(__file__).resolve().parents[1]
PLATFORM_FILES = [
    'api-data.json',
    'siliconflow-data.json',
    'bai-data.json',
    'easyrouter-data.json',
]
FIELDS = ['sourceUrl', 'verifiedAt', 'confidence', 'sourceType']

DEFAULT_STALE_DAYS = 30


def parse_stale_days():
    args = sys.argv[1:]
    if '--stale-days' in args:
        idx = args.index('--stale-days')
        if idx + 1 >= len(args):
            print('ERR: --stale-days requires a number', file=sys.stderr)
            sys.exit(2)
        try:
            value = int(args[idx + 1])
        except ValueError:
            print('ERR: --stale-days value must be integer', file=sys.stderr)
            sys.exit(2)
        if value < 0:
            print('ERR: --stale-days must be non-negative', file=sys.stderr)
            sys.exit(2)
        return value
    return DEFAULT_STALE_DAYS


def model_rows():
    for file_name in PLATFORM_FILES:
        data = json.loads((REPO / file_name).read_text())
        for category in data.get('categories', []):
            for model in category.get('models', []):
                yield file_name, category.get('id'), model


def main():
    stale_days = parse_stale_days()
    rows = list(model_rows())
    print('# Provenance Coverage')
    print()
    today = datetime.now(timezone.utc).date()
    for file_name in PLATFORM_FILES:
        file_rows = [row for row in rows if row[0] == file_name]
        print(f'## {file_name}')
        print(f'- models: {len(file_rows)}')
        for field in FIELDS:
            count = sum(1 for _file, _category, model in file_rows if model.get(field))
            print(f'- {field}: {count}/{len(file_rows)}')
        print()

    missing = [
        (file_name, category, model.get('name'), model.get('modelId'))
        for file_name, category, model in rows
        if not all(model.get(field) for field in FIELDS)
    ]
    stale_cutoff = today - timedelta(days=stale_days)

    stale = []
    for file_name, category, model in rows:
        verified_at = model.get('verifiedAt')
        if not verified_at:
            continue
        try:
            verified_date = datetime.strptime(verified_at, '%Y-%m-%d').date()
        except ValueError:
            continue
        if verified_date < stale_cutoff:
            stale.append((file_name, category, model.get('name'), model.get('modelId'), verified_at))

    if missing:
        print('## Missing Provenance')
        for file_name, category, name, model_id in missing:
            print(f'- {file_name} / {category} / {name} / {model_id}')
    if stale:
        print(f'## Stale Provenance (older than {stale_days} days)')
        for file_name, category, name, model_id, verified_at in stale:
            age = (today - datetime.strptime(verified_at, '%Y-%m-%d').date()).days
            print(f'- {file_name} / {category} / {name or model_id} / verifiedAt={verified_at} ({age}d)')


if __name__ == '__main__':
    main()
