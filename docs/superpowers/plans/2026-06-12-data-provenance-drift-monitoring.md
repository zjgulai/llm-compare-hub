# Data Provenance And Drift Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add provenance metadata and drift monitoring so model data changes are traceable, reviewable, and less likely to silently go stale.

**Architecture:** Extend existing JSON governance incrementally. First add provenance field validation without breaking current data. Then enrich data coverage in provider-sized batches. Finally add a monitor script and scheduled workflow that reports docs/source drift without modifying data automatically.

**Tech Stack:** Python standard library, existing runtime JSON files, `scripts/validate.py`, GitHub Actions, optional `gh` issue creation for drift reports.

---

## File Structure

- Modify `scripts/validate.py`: validate provenance fields and add coverage reporting.
- Create `scripts/provenance_report.py`: local report for sourceUrl/verifiedAt/confidence coverage by file/provider/category.
- Create `scripts/check_data_drift.py`: network monitor for docsUrl/sourceUrl status, content hash snapshots, and known discontinued marker checks.
- Create `data-provenance-snapshots.json`: stable hash/status snapshot for monitored source pages.
- Modify `api-data.json`, `siliconflow-data.json`, `bai-data.json`, `easyrouter-data.json`, `compare-data.json`, `free-models-data.json`: add provenance fields in controlled batches.
- Create `.github/workflows/data-drift.yml`: scheduled/manual drift monitor.
- Modify `README.md`, `CHANGELOG.md`, `AUDIT.md`: document provenance policy and monitor workflow.

## Provenance Field Policy

Each model-level record should eventually support:

```json
{
  "sourceUrl": "https://example.com/docs/model",
  "verifiedAt": "2026-06-12",
  "confidence": "high",
  "sourceType": "official-docs"
}
```

Allowed values:

```text
confidence: high | medium | low
sourceType: official-docs | official-release-notes | official-api-list | vendor-site | curated-manual
```

Rules:

- `sourceUrl` must be an http(s) URL.
- `verifiedAt` must use `YYYY-MM-DD`.
- `confidence=high` requires `sourceType` beginning with `official-`.
- `confidence=low` is allowed only with `notes` explaining uncertainty.
- Drift monitor reports changes; it does not edit data automatically.

## Task 1: Add Provenance Validation Helpers

**Files:**
- Modify: `scripts/validate.py`

- [ ] **Step 1: Add allowed provenance constants**

Add near existing constants:

```python
VALID_CONFIDENCE = {'high', 'medium', 'low'}
VALID_SOURCE_TYPES = {
    'official-docs',
    'official-release-notes',
    'official-api-list',
    'vendor-site',
    'curated-manual',
}
```

- [ ] **Step 2: Add `expect_choice` helper**

Add:

```python
def expect_choice(obj, owner, key, choices, required=True):
    if key not in obj:
        if required:
            msg('ERROR', f"{owner} missing required field: {key}")
        return False
    value = obj.get(key)
    if value not in choices:
        msg('ERROR', f"{owner_key(owner, key)} must be one of {sorted(choices)}")
        return False
    return True
```

- [ ] **Step 3: Add `check_provenance` helper**

Add:

```python
def check_provenance(owner, item, required=False):
    has_structured = any(key in item for key in ['confidence', 'sourceType'])
    if 'sourceUrl' in item:
        expect_url(item, owner, 'sourceUrl')
    if 'verifiedAt' in item:
        expect_iso_date(item, owner, 'verifiedAt')

    if required or has_structured:
        expect_url(item, owner, 'sourceUrl')
        expect_iso_date(item, owner, 'verifiedAt')
        expect_choice(item, owner, 'confidence', VALID_CONFIDENCE)
        expect_choice(item, owner, 'sourceType', VALID_SOURCE_TYPES)

    if item.get('confidence') == 'high' and not str(item.get('sourceType', '')).startswith('official-'):
        msg('ERROR', f"{owner}.confidence=high requires an official sourceType")
    if item.get('confidence') == 'low' and is_blank(item.get('notes')):
        msg('ERROR', f"{owner}.confidence=low requires notes")
```

- [ ] **Step 4: Call `check_provenance` for platform models**

In `check_platform_file`, after optional `sourceUrl` / `verifiedAt` checks, call:

```python
check_provenance(model_owner, model, required=False)
```

- [ ] **Step 5: Call `check_provenance` for compare and free-model entries**

For compare/free entries, call with `required=False` initially:

```python
check_provenance(item_owner, item, required=False)
```

- [ ] **Step 6: Verify**

Run:

```bash
make validate
python3 scripts/validate.py --check-urls
```

Expected: both commands exit `0`.

- [ ] **Step 7: Commit**

Run:

```bash
git add scripts/validate.py
git commit -m "chore: validate provenance metadata fields"
```

## Task 2: Add Provenance Coverage Report

**Files:**
- Create: `scripts/provenance_report.py`

- [ ] **Step 1: Create report script**

Create `scripts/provenance_report.py`:

```python
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
```

- [ ] **Step 2: Make it executable**

Run:

```bash
chmod +x scripts/provenance_report.py
```

- [ ] **Step 3: Run report**

Run:

```bash
python3 scripts/provenance_report.py
```

Expected: coverage report prints counts per platform file.

- [ ] **Step 4: Commit**

Run:

```bash
git add scripts/provenance_report.py
git commit -m "chore: add provenance coverage report"
```

## Task 3: Enrich BAI And EasyRouter Provenance

**Files:**
- Modify: `bai-data.json`
- Modify: `easyrouter-data.json`

- [ ] **Step 1: Add provenance to every BAI model**

For each model in `bai-data.json`, add:

```json
"confidence": "high",
"sourceType": "official-docs"
```

Keep existing `sourceUrl` and `verifiedAt`.

- [ ] **Step 2: Add provenance to every EasyRouter model**

For each model in `easyrouter-data.json`, add:

```json
"confidence": "high",
"sourceType": "official-api-list"
```

Keep existing `sourceUrl` and `verifiedAt`.

- [ ] **Step 3: Verify schema and report**

Run:

```bash
make validate
python3 scripts/provenance_report.py
```

Expected: BAI and EasyRouter show full coverage for all four provenance fields.

- [ ] **Step 4: Commit**

Run:

```bash
git add bai-data.json easyrouter-data.json
git commit -m "data: add provenance metadata for bai and easyrouter"
```

## Task 4: Enrich Confirmed SiliconFlow Provenance

**Files:**
- Modify: `siliconflow-data.json`

- [ ] **Step 1: Add provenance to deprecated entries**

For every model with `"deprecated": true`, add:

```json
"confidence": "high",
"sourceType": "official-release-notes"
```

- [ ] **Step 2: Add provenance to currently verified replacement models**

For replacement models recently used in compare rankings, add:

```json
"sourceUrl": "https://docs.siliconflow.cn/en/release-notes/overview",
"verifiedAt": "2026-06-12",
"confidence": "high",
"sourceType": "official-release-notes"
```

Target modelIds:

```text
deepseek-ai/DeepSeek-V4-Pro
moonshotai/Kimi-K2.6
zai-org/GLM-5.1
BAAI/bge-m3
BAAI/bge-large-zh-v1.5
```

- [ ] **Step 3: Verify**

Run:

```bash
make validate
python3 scripts/provenance_report.py
```

Expected: validation exits `0`; report coverage increases for SiliconFlow.

- [ ] **Step 4: Commit**

Run:

```bash
git add siliconflow-data.json
git commit -m "data: add provenance metadata for siliconflow verified models"
```

## Task 5: Enrich PoYo Provenance In Batches

**Files:**
- Modify: `api-data.json`

- [ ] **Step 1: Add provenance to already verified PoYo entries**

For models already carrying `sourceUrl` and `verifiedAt`, add:

```json
"confidence": "high",
"sourceType": "official-docs"
```

- [ ] **Step 2: Add provenance for category-level official docs fallbacks**

For PoYo models whose model-level source page is not yet confirmed, use:

```json
"sourceUrl": "https://docs.poyo.ai/api-manual/overview",
"verifiedAt": "2026-06-12",
"confidence": "medium",
"sourceType": "official-docs"
```

Only use this fallback when the model already has a valid `docsUrl`.

- [ ] **Step 3: Preserve review flags**

If a model has:

```json
"docsUrlNeedsReview": true
```

keep it, and do not upgrade `confidence` above `medium`.

- [ ] **Step 4: Verify**

Run:

```bash
make validate
python3 scripts/provenance_report.py
```

Expected: validation exits `0`; PoYo provenance coverage increases.

- [ ] **Step 5: Commit**

Run:

```bash
git add api-data.json
git commit -m "data: add provenance metadata for poyo models"
```

## Task 6: Add Drift Snapshot File

**Files:**
- Create: `data-provenance-snapshots.json`

- [ ] **Step 1: Create initial snapshot structure**

Create:

```json
{
  "generatedAt": "2026-06-12",
  "sources": {}
}
```

- [ ] **Step 2: Commit**

Run:

```bash
git add data-provenance-snapshots.json
git commit -m "chore: add data provenance snapshot store"
```

## Task 7: Add Drift Monitor Script

**Files:**
- Create: `scripts/check_data_drift.py`
- Modify: `data-provenance-snapshots.json`

- [ ] **Step 1: Create script skeleton**

Create `scripts/check_data_drift.py`:

```python
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
        SNAPSHOT.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + '\\n')

    for item in failures:
        print('FAIL', item)
    for item in changes:
        print('DRIFT', item)

    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
```

- [ ] **Step 2: Make script executable**

Run:

```bash
chmod +x scripts/check_data_drift.py
```

- [ ] **Step 3: Generate initial snapshot**

Run:

```bash
python3 scripts/check_data_drift.py --update-snapshot
```

Expected: `data-provenance-snapshots.json` fills with source URL status and hashes.

- [ ] **Step 4: Verify no failures**

Run:

```bash
python3 scripts/check_data_drift.py
```

Expected: command exits `0`; any `DRIFT` lines are review-only.

- [ ] **Step 5: Commit**

Run:

```bash
git add scripts/check_data_drift.py data-provenance-snapshots.json
git commit -m "chore: add data source drift monitor"
```

## Task 8: Add Scheduled Drift Workflow

**Files:**
- Create: `.github/workflows/data-drift.yml`

- [ ] **Step 1: Add workflow**

Create `.github/workflows/data-drift.yml`:

```yaml
name: Data drift monitor

on:
  workflow_dispatch:
  schedule:
    - cron: '17 3 * * 1'

permissions:
  contents: read

jobs:
  drift:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v6

      - name: Check data drift
        run: python3 scripts/check_data_drift.py
```

- [ ] **Step 2: Verify workflow syntax by pushing through CI**

Run locally first:

```bash
python3 scripts/check_data_drift.py
git diff --check
```

Then commit:

```bash
git add .github/workflows/data-drift.yml
git commit -m "ci: add scheduled data drift monitor"
```

- [ ] **Step 3: Push and manually trigger**

Run:

```bash
git push origin main
gh workflow run data-drift.yml
gh run list --workflow "Data drift monitor" --limit 3
```

Expected: workflow run succeeds.

## Task 9: Add Strict Provenance Gate For Future Full Coverage

**Files:**
- Modify: `scripts/validate.py`
- Modify: `Makefile`
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Add strict flag**

In `scripts/validate.py`, add:

```python
strict_provenance = '--strict-provenance' in sys.argv
```

- [ ] **Step 2: Require provenance in strict mode**

When checking platform models:

```python
check_provenance(model_owner, model, required=strict_provenance)
```

- [ ] **Step 3: Add Makefile target**

In `Makefile`, add:

```make
validate-provenance:
	@python3 scripts/validate.py --strict-provenance
```

- [ ] **Step 4: Keep deploy workflow on normal validation until coverage is complete**

Do not add `validate-provenance` to `.github/workflows/deploy.yml` until `python3 scripts/provenance_report.py` shows full coverage for all platform data files.

- [ ] **Step 5: Verify**

Run:

```bash
make validate
python3 scripts/validate.py --strict-provenance || true
```

Expected:

- `make validate` exits `0`.
- strict provenance may still report missing fields until every provider has full coverage.
- The task is acceptable when the strict mode reports actionable missing provenance without breaking normal deploy validation.

- [ ] **Step 6: Commit**

Run:

```bash
git add scripts/validate.py Makefile .github/workflows/deploy.yml
git commit -m "chore: add strict provenance validation gate"
```

## Task 10: Document The Data Governance Workflow

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `AUDIT.md`

- [ ] **Step 1: Update README data section**

Add:

```markdown
### 数据 provenance 与漂移监控

- `sourceUrl`: 字段来源或验证入口。
- `verifiedAt`: 最近人工或脚本验证日期，格式 `YYYY-MM-DD`。
- `confidence`: `high`、`medium`、`low`。
- `sourceType`: `official-docs`、`official-release-notes`、`official-api-list`、`vendor-site`、`curated-manual`。

常用命令：

```bash
python3 scripts/provenance_report.py
python3 scripts/check_data_drift.py
python3 scripts/check_data_drift.py --update-snapshot
```
```

- [ ] **Step 2: Update changelog**

Add an entry for provenance and drift monitoring.

- [ ] **Step 3: Update audit**

Move data governance residual risk from “missing schema” to “external source drift and provenance coverage”.

- [ ] **Step 4: Verify docs and release**

Run:

```bash
make validate
make release
git diff --check
```

Expected: all commands exit `0`.

- [ ] **Step 5: Commit**

Run:

```bash
git add README.md CHANGELOG.md AUDIT.md
git commit -m "docs: document data provenance workflow"
```

## Final Acceptance Criteria

- Every BAI and EasyRouter model has `sourceUrl`, `verifiedAt`, `confidence`, and `sourceType`.
- Confirmed deprecated SiliconFlow entries have official release-note provenance.
- PoYo entries have at least medium-confidence provenance or explicit review flags.
- `make validate` still exits `0`.
- `python3 scripts/provenance_report.py` shows coverage by provider.
- `python3 scripts/check_data_drift.py` runs locally and in GitHub Actions.
- Scheduled drift workflow exists and can be triggered manually.
- Strict provenance validation is available and documented, even if not yet enforced in deploy CI until coverage is complete.
