.PHONY: validate deploy check clean

# SSH key: 优先使用 ~/.ssh/llm-compare-hub.pem，回退 ai_video.pem
SSH_KEY := $(shell test -f ~/.ssh/llm-compare-hub.pem && echo ~/.ssh/llm-compare-hub.pem || echo ai_video.pem)
SSH_CMD := ssh -i $(SSH_KEY) -o StrictHostKeyChecking=no
RSYNC_CMD := rsync -avz -e "$(SSH_CMD)"
REMOTE := ubuntu@101.34.52.232
REMOTE_DIR := /opt/llm-compare-hub/html

validate:
	@echo "🔍 Validating all JSON data files..."
	@python3 scripts/validate.py

deploy: validate
	@echo "🚀 Deploying to Tencent Cloud (key: $(SSH_KEY))..."
	@test -f $(SSH_KEY) || (echo "❌ SSH key not found: $(SSH_KEY)"; exit 1)
	@$(RSYNC_CMD) \
		--exclude='.git' \
		--exclude='*.pem' \
		--exclude='.DS_Store' \
		--exclude='.sisyphus' \
		--exclude='node_modules' \
		--exclude='src/node_modules' \
		--exclude='.essence-cache' \
		./ $(REMOTE):$(REMOTE_DIR)/
	@$(SSH_CMD) $(REMOTE) \
		"find $(REMOTE_DIR) -type d -exec chmod 755 {} \; && find $(REMOTE_DIR) -type f -exec chmod 644 {} \;"
	@echo "✅ Deploy complete!"

redirect-dirs:
	@echo "🔗 Redirect directories are tracked in git and deployed with rsync"
	@echo "✅ (claude/index.html, codex/index.html already in project root)"

deploy-dry:
	@echo "🧪 Dry-run deploy..."
	@$(RSYNC_CMD) --dry-run \
		--exclude='.git' \
		--exclude='*.pem' \
		--exclude='.DS_Store' \
		--exclude='.sisyphus' \
		--exclude='node_modules' \
		--exclude='src/node_modules' \
		./ $(REMOTE):$(REMOTE_DIR)/
	@echo "✅ Dry-run complete"

check:
	@echo "🩺 Checking production site..."
	@curl -sk -o /dev/null -w "Production: %{http_code}\n" https://llm.lute-tlz-dddd.top/
	@curl -sk -o /dev/null -w "GitHub Pages: %{http_code}\n" https://zjgulai.github.io/llm-compare-hub/
	@for f in api-data.json siliconflow-data.json compare-data.json free-models-data.json bai-data.json easyrouter-data.json; do \
		code=$$(curl -sk -o /dev/null -w "%{http_code}" https://llm.lute-tlz-dddd.top/$$f); \
		echo "  $$f: $$code"; \
	done

clean:
	@echo "🧹 Cleaning up..."
	@rm -rf node_modules dist
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

