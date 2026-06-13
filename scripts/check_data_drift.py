#!/usr/bin/env python3
"""Check sourceUrl/docsUrl availability and source-page drift."""

import argparse
import hashlib
import json
import sys
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path


REPO = Path(__file__).resolve().parents[1]
DATA_FILES = [
    'api-data.json',
    'siliconflow-data.json',
    'bai-data.json',
    'easyrouter-data.json',
]
SNAPSHOT = REPO / 'data-provenance-snapshots.json'


def fetch(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'llm-models-hub-drift/1.0'})
    with urllib.request.urlopen(request, timeout=15) as response:
        body = response.read()
    return response.status, hashlib.sha256(body).hexdigest()


def collect_urls():
    urls = {}
    for file_name in DATA_FILES:
        data = json.loads((REPO / file_name).read_text())
        for category in data.get('categories', []):
            for model in category.get('models', []):
                for key in ['docsUrl', 'sourceUrl']:
                    url = model.get(key)
                    if url:
                        urls.setdefault(url, set()).add(f"{file_name}:{model.get('modelId')}:{key}")
    return urls


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--update-snapshot', action='store_true')
    args = parser.parse_args()

    snapshot = json.loads(SNAPSHOT.read_text()) if SNAPSHOT.exists() else {'sources': {}}
    sources = snapshot.setdefault('sources', {})
    failures = []
    changes = []

    for url, owners in sorted(collect_urls().items()):
        try:
            status, digest = fetch(url)
        except urllib.error.HTTPError as exc:
            status, digest = exc.code, None
        except Exception as exc:
            failures.append(f"{url} failed: {type(exc).__name__}: {exc}")
            continue

        if status != 200:
            failures.append(f"{url} returned {status}")
            continue

        previous = sources.get(url, {})
        if previous.get('sha256') and previous.get('sha256') != digest:
            changes.append(url)

        if args.update_snapshot:
            sources[url] = {
                'status': status,
                'sha256': digest,
                'checkedAt': date.today().isoformat(),
                'owners': sorted(owners),
            }

    if args.update_snapshot:
        snapshot['generatedAt'] = date.today().isoformat()
        SNAPSHOT.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n')

    for item in failures:
        print('FAIL', item)
    for item in changes:
        print('DRIFT', item)

    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
