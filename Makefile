.PHONY: validate deploy check clean

validate:
	@echo "🔍 Validating all JSON data files..."
	@python3 scripts/validate.py

deploy: validate
	@echo "🚀 Deploying to Tencent Cloud..."
	@test -f ~/.ssh/llm-compare-hub.pem || test -f ai_video.pem || (echo "❌ SSH key not found (~/.ssh/llm-compare-hub.pem or ai_video.pem)"; exit 1)
	@rsync -avz -e "ssh -i ~/.ssh/llm-compare-hub.pem -o StrictHostKeyChecking=no" \
		--exclude='.git' \
		--exclude='*.pem' \
		--exclude='.DS_Store' \
		--exclude='.sisyphus' \
		--exclude='node_modules' \
		./ ubuntu@101.34.52.232:/opt/llm-compare-hub/html/
	@ssh -i ~/.ssh/llm-compare-hub.pem ubuntu@101.34.52.232 \
		"chmod 755 /opt/llm-compare-hub/html && chmod 755 /opt/llm-compare-hub/html/assets && chmod 644 /opt/llm-compare-hub/html/assets/*"
	@echo "✅ Deploy complete!"

redirect-dirs:
	@echo "🔗 Redirect directories are tracked in git and deployed with rsync"
	@echo "✅ (claude/index.html, codex/index.html already in project root)"

deploy-dry:
	@echo "🧪 Dry-run deploy..."
	@rsync -avz --dry-run -e "ssh -i ~/.ssh/llm-compare-hub.pem" \
		--exclude='.git' \
		--exclude='*.pem' \
		--exclude='.DS_Store' \
		--exclude='.sisyphus' \
		./ ubuntu@101.34.52.232:/opt/llm-compare-hub/html/
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

