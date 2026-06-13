# LLM Models Hub Rollback Runbook

> Last updated: 2026-06-13  
> Scope: static site files for `https://llm.lute-tlz-dddd.top/` only.

## Guardrails

- Only deploy or restore `/opt/llm-compare-hub/html/` on `ubuntu@101.34.52.232`.
- Do not change shared Docker containers, nginx vhosts, certificates, or other app directories during a static-site rollback.
- Use `release/` as the deployment source. Do not sync the repository root.
- Run `make check` and `make check-exposure` after every rollback.

## Normal Rollback: Redeploy A Known Good Commit

Use this when the repository has a known good commit and SSH access is healthy.

```bash
git status --short
git log --oneline -n 10
git switch main
git checkout <known-good-sha>
make release
make deploy-dry
make deploy
make check
make check-exposure
git switch main
```

Expected result:

- `/` returns `200`.
- Runtime JSON files return `200`.
- Development artifacts such as `/README.md`, `/scripts/validate.py`, and `/src/App.tsx` return `404`.

## Fast Local Rebuild Rollback

Use this when the working tree already contains the correct files and the latest production deploy failed because of packaging or stale assets.

```bash
make clean
make release
find release -maxdepth 2 -type f | sort
make deploy-dry
make deploy
make check
make check-exposure
```

Before approving `make deploy`, inspect the dry-run output. It should only create, update, or delete files under the LLM static site directory.

## Server Backup Rollback

Use this only when a timestamped server backup exists and the repository route is unavailable.

Known historical backup example:

```text
/opt/llm-compare-hub/backups/html-before-release-20260611122711.tar.gz
```

Restore pattern:

```bash
ssh -i /Users/lute/project/Agent/product/llm_models_hub/ai_video.pem ubuntu@101.34.52.232
cd /opt/llm-compare-hub
mkdir -p html-restore-check
tar -tzf backups/<backup-file>.tar.gz | head
tar -xzf backups/<backup-file>.tar.gz -C html-restore-check
rsync -av --delete html-restore-check/ html/
find html -type d -exec chmod 755 {} \;
find html -type f -exec chmod 644 {} \;
exit
make check
make check-exposure
```

If the backup expands into an extra top-level directory, adjust the `rsync` source to that extracted directory before syncing.

## GitHub Pages Rollback

GitHub Pages is a mirror target, not the canonical production site. Prefer reverting the bad commit or pushing a new fix commit to `main`; the workflow publishes `release/` only.

Verification:

```bash
curl -sk -o /dev/null -w "GitHub Pages: %{http_code}\n" https://zjgulai.github.io/llm-compare-hub/
```

## Post-Rollback Notes

- Record the bad commit, rollback commit, command sequence, and verification result in `CHANGELOG.md` or the incident thread.
- If rollback was caused by stale source data, regenerate the governance snapshot with `make weekly-snapshot`.
- If rollback was caused by packaging, run `make data-update-check` before the next deployment attempt.
