.PHONY: validate validate-provenance typecheck build verify-assets release deploy deploy-dry check check-exposure clean weekly-snapshot

# SSH key: keep production credentials outside the worktree.
SSH_KEY := $(HOME)/.ssh/llm-compare-hub.pem
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

typecheck:
	@echo "🧪 Type-checking React source..."
	@cd src && npx tsc --noEmit

build: typecheck
	@echo "🏗️  Building React source to dist/..."
	@npm --prefix src run build

verify-assets:
	@echo "🔗 Verifying index.html asset references..."
	@python3 scripts/verify_assets.py

release: validate verify-assets
	@echo "📦 Building clean release artifact..."
	@python3 scripts/build_release.py

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
