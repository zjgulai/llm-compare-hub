# LLM Models Hub — Codex Handoff

> Last updated: 2026-06-18 (America/Los_Angeles)
> Primary production: `https://llm.lute-tlz-dddd.top/`
> Mirror: `https://zjgulai.github.io/llm-compare-hub/`
> Last product artifact verification baseline: `8f5504b test: harden chrome smoke startup`

## Current Product State

LLM Models Hub is a static site for comparing hosted LLM APIs, local free models, and Claude/Codex usage resources.

Current public pages:

| Page | Route | Source data |
| --- | --- | --- |
| Model list | `/` | `api-data.json`, `siliconflow-data.json`, `bai-data.json`, `easyrouter-data.json` |
| Compare ranking | `/` tab | `compare-data.json` |
| Free local models | `/` tab | `free-models-data.json` |
| Claude essence | `/claude.html` | `claude-data.json` |
| Codex essence | `/codex.html` | `codex-data.json` |

The production source of truth is the generated `release/` directory. Do not deploy the repository root.

## Three-Way Consistency

| Surface | Current status |
| --- | --- |
| Local repo / `origin/main` | Product artifact verification baseline remains `8f5504b`; 2026-06-18 data-governance refresh updated only `data-provenance-snapshots.json`, which is not part of the public `release/` artifact |
| Tencent Cloud production | `https://llm.lute-tlz-dddd.top/` has the latest `release/` deployment and passes production smoke |
| GitHub Pages mirror | Product artifact workflow `27489295001` succeeded for head SHA `8f5504b` |

Verification evidence from the latest loop:

- `python3 scripts/check_data_drift.py --update-snapshot`: 78 source URLs returned `200`; `data-provenance-snapshots.json` refreshed to `generatedAt=2026-06-18`.
- `python3 scripts/validate.py --check-urls`: 77 unique `docsUrl` targets returned `200`.
- `make data-update-check`: JSON validation, strict provenance validation, weekly snapshot, TypeScript build, release build, and secret scan passed.
- `make smoke-ui`: local release browser smoke passed; desktop/mobile visual diff was `0.00%`.
- `make check`: production site, GitHub Pages, and six core JSON files returned `200`.
- `make check-exposure`: development files and hidden paths returned `404`.
- `make smoke-ui-production`: production UI smoke passed; desktop/mobile visual diff was `0.00%`.
- GitHub Actions `Deploy to GitHub Pages` run `27489295001`: success.

## Architecture and Deployment Rules

- `src/` is the trusted UI source for the main React app.
- `claude.html`, `codex.html`, and `pages/essence-template.html` are static essence pages and template artifacts.
- Vite builds to `dist/`; `scripts/build_release.py` copies the public allowlist into `release/`.
- Tencent Cloud deploy uses `rsync --delete release/` to `/opt/llm-compare-hub/html/`.
- GitHub Pages uploads only `release/`.
- The root `index.html` and root `assets/` are legacy fallback snapshots; do not use them as the primary edit target.
- Production must not expose `README.md`, `AUDIT.md`, `Makefile`, `scripts/`, `src/`, `.github/`, `.essence-cache/`, or hidden files.

## Quality Gates Already In Place

Core gates:

```bash
make data-update-check
make smoke-ui
make deploy-dry
make deploy
make check
make check-exposure
make smoke-ui-production
```

`make data-update-check` includes:

- JSON validation;
- strict provenance validation;
- provenance report;
- weekly governance snapshot generation;
- TypeScript build;
- `release/` build;
- secret scan after release generation.

`make smoke-ui` covers:

- local `release/` browser smoke;
- desktop and mobile screenshots;
- 360/390/768px breakpoint checks;
- app and essence page landmarks;
- tablist / tabpanel semantics;
- keyboard navigation;
- focus-visible indicator checks;
- color contrast;
- mobile touch target checks;
- missing asset `404`;
- threshold visual diff.

## Completed Governance Work

Major completed items:

- Release-only Tencent Cloud and GitHub Pages deployment.
- `src/` build recovery and Chinese UI alignment.
- Compare page multimodal/input/output data-type visibility.
- JSON schema and provenance validation.
- Weekly data governance snapshot tooling.
- UI smoke automation.
- Visual diff baselines.
- Core app and essence page accessibility gates.
- Focus-visible accessibility gate.
- Secret scan release gate.
- Tencent Cloud production exposure checks.

## Current Remaining Risks

Do not expose or print secret values when investigating these.

1. GitHub token rotation remains an external control-plane action. The local remote URL has been cleaned, and current tree/history scans did not find likely secrets, but only GitHub can revoke the old token.
2. Shared nginx still contains a hardcoded OpenAI-compatible key under the `skills.lute-tlz-dddd.top` vhost. It is not in the `llm.lute-tlz-dddd.top` vhost or `/opt/llm-compare-hub`, and it should be rotated by the owner of that adjacent app.
3. CSP still contains `unsafe-inline`; removing it requires a separate CSP hardening pass.
4. Current visual diff baselines cover the home page screenshots; future work may expand visual baselines to compare modes and essence pages.
5. Data provenance must keep `verifiedAt`, `confidence`, and `sourceUrl` fresh as model/provider data changes.
6. `scripts/update-essence.py` currently falls back to curated-only output when `aihot.virxact.com` search fetches fail through Jina Reader. Do not publish regenerated `claude-data.json` / `codex-data.json` if item counts drop unexpectedly; fix source fetching or preserve existing curated/manual content first.

## Safe Next Steps

Recommended order:

1. If the task is data-only, run `make data-update-check` before any deploy.
2. If the task changes UI or static HTML, run `make smoke-ui`; deploy only after it passes.
3. Before Tencent Cloud deploy, run `make deploy-dry` and check that only `release/` public files change.
4. After deploy, run `make check`, `make check-exposure`, and `make smoke-ui-production`.
5. After push, confirm GitHub Pages workflow success.

## Documentation Sync Rule

When product status changes, update these together:

- `README.md`: current architecture, three-way status, operational commands.
- `AUDIT.md`: debt status, execution records, verification evidence.
- `CHANGELOG.md`: user-facing change history.
- `docs/CODEX_HANDOFF.md`: next-Codex state summary and execution entrypoint.

This keeps local repo state, Tencent Cloud production, and GitHub Pages mirror understandable from one read.
