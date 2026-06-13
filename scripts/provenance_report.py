#!/usr/bin/env python3
"""Report provenance metadata coverage for runtime JSON data."""

import json
from pathlib import Path


REPO = Path(__file__).resolve().parents[1]
PLATFORM_FILES = [
    'api-data.json',
    'siliconflow-data.json',
    'bai-data.json',
    'easyrouter-data.json',
]
FIELDS = ['sourceUrl', 'verifiedAt', 'confidence', 'sourceType']


def model_rows():
    for file_name in PLATFORM_FILES:
        data = json.loads((REPO / file_name).read_text())
        for category in data.get('categories', []):
            for model in category.get('models', []):
                yield file_name, category.get('id'), model


def main():
    rows = list(model_rows())
    print('# Provenance Coverage')
    print()
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
    if missing:
        print('## Missing Provenance')
        for file_name, category, name, model_id in missing:
            print(f'- {file_name} / {category} / {name} / {model_id}')


if __name__ == '__main__':
    main()
