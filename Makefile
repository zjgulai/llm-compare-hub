.PHONY: validate validate-provenance provenance-report typecheck build verify-assets secret-scan smoke-ui smoke-ui-update-baselines smoke-ui-production release deploy deploy-dry check check-exposure clean weekly-snapshot data-update-check data-update-dry data-update-deploy

# SSH key: keep production credentials outside the worktree.
SSH_KEY ?= $(HOME)/.ssh/llm-compare-hub.pem
SSH_CMD := ssh -i $(SSH_KEY) -o StrictHostKeyChecking=no
RSYNC_CMD := rsync -avz -e "$(SSH_CMD)"
REMOTE := ubuntu@101.34.52.232
REMOTE_DIR := /opt/llm-compare-hub/html
RELEASE_DIR := release

validate:
	@echo "🔍 Validating all JSON data files..."
	@python3 scripts/validate.py

validate-provenance:
	@echo "🔎 Validating strict provenance coverage..."
	@python3 scripts/validate.py --strict-provenance

provenance-report:
	@echo "📊 Reporting provenance coverage..."
	@python3 scripts/provenance_report.py

typecheck:
	@echo "🧪 Type-checking React source..."
	@cd src && npx tsc --noEmit

build: typecheck
	@echo "🏗️  Building React source to dist/..."
	@npm --prefix src run build

verify-assets:
	@echo "🔗 Verifying index.html asset references..."
	@python3 scripts/verify_assets.py

secret-scan:
	@echo "🔐 Scanning tracked files, local git config, and release artifact for likely secrets..."
	@python3 scripts/secret_scan.py --include-release

smoke-ui: release
	@echo "🖥️  Running local UI smoke checks..."
	@node scripts/ui_smoke_check.mjs

smoke-ui-update-baselines: release
	@echo "🖼️  Updating local UI smoke visual baselines..."
	@node scripts/ui_smoke_check.mjs --update-baselines

smoke-ui-production:
	@echo "🖥️  Running production UI smoke checks..."
	@node scripts/ui_smoke_check.mjs --base-url https://llm.lute-tlz-dddd.top/

release: validate build verify-assets
	@echo "📦 Building clean release artifact..."
	@python3 scripts/build_release.py
	@$(MAKE) --no-print-directory secret-scan

deploy: release
	@echo "🚀 Deploying to Tencent Cloud (key: $(SSH_KEY))..."
	@test -f $(SSH_KEY) || (echo "❌ SSH key not found: $(SSH_KEY)"; exit 1)
	@$(RSYNC_CMD) --delete $(RELEASE_DIR)/ $(REMOTE):$(REMOTE_DIR)/
	@$(SSH_CMD) $(REMOTE) \
		"find $(REMOTE_DIR) -type d -exec chmod 755 {} \; && find $(REMOTE_DIR) -type f -exec chmod 644 {} \;"
	@echo "✅ Deploy complete!"

redirect-dirs:
	@echo "🔗 Redirect directories are tracked in git and deployed with rsync"
	@echo "✅ (claude/index.html, codex/index.html already in project root)"

deploy-dry:
	@echo "🧪 Dry-run deploy from $(RELEASE_DIR)/..."
	@$(MAKE) --no-print-directory release >/dev/null
	@$(RSYNC_CMD) --dry-run --delete $(RELEASE_DIR)/ $(REMOTE):$(REMOTE_DIR)/
	@echo "✅ Dry-run complete"

weekly-snapshot:
	@echo "📅 Generating weekly governance snapshot..."
	@python3 scripts/weekly_data_snapshot.py --output-dir artifacts/weekly

data-update-check:
	@echo "🧭 Running data update acceptance workflow..."
	@$(MAKE) --no-print-directory validate
	@$(MAKE) --no-print-directory validate-provenance
	@$(MAKE) --no-print-directory provenance-report
	@$(MAKE) --no-print-directory weekly-snapshot
	@$(MAKE) --no-print-directory release
	@echo "✅ Data update acceptance workflow complete"

data-update-dry:
	@echo "🧪 Running data update dry-run deployment workflow..."
	@$(MAKE) --no-print-directory data-update-check
	@$(MAKE) --no-print-directory deploy-dry
	@echo "✅ Data update dry-run workflow complete"

data-update-deploy:
	@echo "🚀 Running data update production deployment workflow..."
	@$(MAKE) --no-print-directory data-update-check
	@$(MAKE) --no-print-directory deploy
	@$(MAKE) --no-print-directory check
	@$(MAKE) --no-print-directory check-exposure
	@echo "✅ Data update production workflow complete"

check:
	@echo "🩺 Checking production site..."
	@curl -sk -o /dev/null -w "Production: %{http_code}\n" https://llm.lute-tlz-dddd.top/
	@curl -sk -o /dev/null -w "GitHub Pages: %{http_code}\n" https://zjgulai.github.io/llm-compare-hub/
	@for f in api-data.json siliconflow-data.json compare-data.json free-models-data.json bai-data.json easyrouter-data.json; do \
		code=$$(curl -sk -o /dev/null -w "%{http_code}" https://llm.lute-tlz-dddd.top/$$f); \
		echo "  $$f: $$code"; \
	done

check-exposure:
	@echo "🔒 Checking blocked development artifacts..."
	@for p in README.md AUDIT.md Makefile scripts/validate.py src/App.tsx .github/workflows/deploy.yml .essence-cache/aiho_claude.json data/api-data.json .DS_Store; do \
		code=$$(curl -sk -o /dev/null -w "%{http_code}" https://llm.lute-tlz-dddd.top/$$p); \
		echo "  /$$p: $$code"; \
	done

clean:
	@echo "🧹 Cleaning up..."
	@rm -rf node_modules dist release
	@echo "✅ Clean complete"

# ── Essence pages ──────────────────────────────────────
ESSENCE_TOPICS = claude codex

update-essence:
	@echo "📡 Updating Claude/Codex essence data..."
	@python3 scripts/update-essence.py
	@echo "✅ Essence data updated"

update-essence-offline:
	@echo "📡 Updating with curated data only..."
	@python3 scripts/update-essence.py --offline
	@echo "✅ Essence data updated (offline)"
