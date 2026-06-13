# Src Production UI Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `src/` the trusted source for the production Chinese UI, then cut `release/` over from the current bundle snapshot to a reproducible Vite build.

**Architecture:** Work in two gates. First, build parity inside `src/` while production still ships the existing root `index.html` snapshot. Second, after visual/data parity is verified, change the release builder to publish `dist/` assets generated from `src/`. This avoids user-visible regression while turning the frontend back into a reproducible source build.

**Tech Stack:** React 19, Vite 6, TypeScript 5, static runtime JSON, existing `Makefile`, `scripts/build_release.py`, `scripts/verify_assets.py`, optional Playwright/browser screenshot checks.

---

## File Structure

- Modify `src/App.tsx`: Chinese app shell, tabs, header/footer, production-aligned layout.
- Modify `src/components/ModelListView.tsx`: production Chinese model list UI, filters, cURL copy, data states.
- Modify `src/components/CompareView.tsx`: production Chinese compare/ranking UI, modalities badges, category/function/overall views.
- Modify `src/components/FreeModelsView.tsx`: production Chinese free local models UI.
- Modify `src/data.ts`: path-safe runtime JSON fetch helper for root domain and GitHub Pages subpath.
- Modify `src/types.ts`: keep types aligned with runtime JSON and new UI usage.
- Modify `src/App.css` and `src/index.css`: production visual tokens and responsive rules.
- Modify `scripts/build_release.py`: after approval, copy Vite `dist/` entry/assets instead of root snapshot entry/assets.
- Modify `scripts/verify_assets.py`: verify either root snapshot mode or `dist/` release mode during transition.
- Modify `Makefile`: add explicit source preview/production cutover targets if needed.
- Modify `README.md`, `CHANGELOG.md`, `AUDIT.md`: document the final source-of-truth decision.

## Plan Decision

Recommended path: **replicate the current Chinese production UI in `src/`, then cut over release to built `dist/`**.

Do not immediately replace production with the current English `src` UI. That would be fast but would regress the product language, production layout, and existing Chinese UX.

## Task 1: Capture Current Production Baseline

**Files:**
- Create: `docs/superpowers/plans/artifacts/src-ui-baseline-notes.md`
- No product code changes.

- [ ] **Step 1: Record current production routes and UI states**

Create `docs/superpowers/plans/artifacts/src-ui-baseline-notes.md` with this structure:

```markdown
# Src UI Baseline Notes

## Routes
- `/`: model list tab, compare tab, free local models tab
- `/claude.html`: Claude essence page
- `/codex.html`: Codex essence page
- `/claude/`: redirect page
- `/codex/`: redirect page

## Required Home States
- Model list default platform
- Model list platform switch
- Model list category filter
- Model search empty state
- Compare overall ranking
- Compare category ranking
- Compare function ranking
- Free local model cards

## Desktop Viewports
- 1440x1000
- 1280x800

## Mobile Viewports
- 390x844
- 430x932
```

- [ ] **Step 2: Start the existing production release locally**

Run:

```bash
python3 -m http.server 4173 --directory release
```

Expected:

```text
Serving HTTP on :: port 4173
```

- [ ] **Step 3: Capture baseline screenshots**

Use Browser or Playwright against `http://127.0.0.1:4173/`.

Required screenshots:

```text
/tmp/llm-baseline-home-desktop.png
/tmp/llm-baseline-compare-desktop.png
/tmp/llm-baseline-free-desktop.png
/tmp/llm-baseline-home-mobile.png
/tmp/llm-baseline-compare-mobile.png
```

- [ ] **Step 4: Commit baseline notes only**

Run:

```bash
git add docs/superpowers/plans/artifacts/src-ui-baseline-notes.md
git commit -m "docs: capture src ui parity baseline"
```

## Task 2: Make Runtime Fetches Subpath-Safe

**Files:**
- Modify: `src/data.ts`
- Modify: `src/types.ts` only if type errors require it.

- [ ] **Step 1: Add a path helper in `src/data.ts`**

Replace direct absolute fetch paths with:

```ts
const dataUrl = (fileName: string) => {
  const base = import.meta.env.BASE_URL || '/';
  return `${base.replace(/\/$/, '')}/${fileName}`.replace(/^\/\//, '/');
};
```

- [ ] **Step 2: Update all runtime JSON fetches**

Use:

```ts
const response = await fetch(dataUrl(`${platformId}-data.json`));
const response = await fetch(dataUrl('free-models-data.json'));
const response = await fetch(dataUrl('compare-data.json'));
```

- [ ] **Step 3: Verify TypeScript**

Run:

```bash
make typecheck
```

Expected: command exits `0`.

- [ ] **Step 4: Verify source build**

Run:

```bash
make build
```

Expected: Vite builds to `dist/`.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/data.ts src/types.ts
git commit -m "fix: make runtime data fetches subpath safe"
```

## Task 3: Rebuild the Chinese App Shell in `src`

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/index.css`

- [ ] **Step 1: Replace English shell copy with Chinese product copy**

Update tabs and shell labels:

```ts
type TabId = 'models' | 'compare' | 'free';

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'models', label: '模型列表' },
  { id: 'compare', label: '对比排序' },
  { id: 'free', label: '免费本地模型' },
];
```

- [ ] **Step 2: Keep the first viewport as the product, not a marketing hero**

The first screen must render the tabbed tool immediately:

```tsx
<main className="app-main">
  {activeTab === 'models' && <ModelListView />}
  {activeTab === 'compare' && <CompareView />}
  {activeTab === 'free' && <FreeModelsView />}
</main>
```

- [ ] **Step 3: Add responsive shell classes**

In `src/App.css`, add stable shell constraints:

```css
.app-main {
  width: min(100% - 32px, 1280px);
  margin: 0 auto;
  padding: 24px 0 40px;
}

@media (max-width: 720px) {
  .app-main {
    width: min(100% - 20px, 1280px);
    padding-top: 16px;
  }
}
```

- [ ] **Step 4: Verify**

Run:

```bash
make typecheck
make build
```

Expected: both commands exit `0`.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/App.tsx src/App.css src/index.css
git commit -m "feat: align source app shell with chinese production ui"
```

## Task 4: Rebuild Model List Source UI

**Files:**
- Modify: `src/components/ModelListView.tsx`
- Modify: `src/types.ts`

- [ ] **Step 1: Preserve existing data contract**

Keep rendering from:

```ts
PlatformData.categories[].models[]
```

Do not introduce a new data file.

- [ ] **Step 2: Replace English labels with Chinese labels**

Use these labels:

```ts
const ui = {
  searchPlaceholder: '搜索模型、模型 ID 或厂商',
  allCategories: '全部分类',
  docs: '文档',
  copied: 'cURL 已复制',
  emptyTitle: '没有找到匹配模型',
  emptyHint: '尝试调整搜索词或分类筛选',
};
```

- [ ] **Step 3: Keep filter and search behavior**

Filtering must still match:

```ts
model.name
model.modelId
model.vendor
```

- [ ] **Step 4: Add visible data-health hints**

Display optional fields when present:

```tsx
{model.docsUrlNeedsReview && (
  <span className="data-warning">文档待复核</span>
)}
{model.verifiedAt && (
  <span className="data-meta">校验：{model.verifiedAt}</span>
)}
```

- [ ] **Step 5: Verify**

Run:

```bash
make typecheck
make build
```

Expected: both commands exit `0`.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/components/ModelListView.tsx src/types.ts
git commit -m "feat: align model list source ui with production data"
```

## Task 5: Rebuild Compare Source UI

**Files:**
- Modify: `src/components/CompareView.tsx`
- Modify: `src/types.ts`

- [ ] **Step 1: Preserve all three compare surfaces**

The source UI must render:

```text
overallRanking
categories[].models
functionRanking[].topModels
```

- [ ] **Step 2: Localize modalities labels**

Use:

```ts
const dataTypeLabels: Record<string, string> = {
  text: '文本',
  image: '图像',
  video: '视频',
  audio: '音频',
  music: '音乐',
  speech: '语音',
  embedding: '向量',
  ranking: '排序',
  '3d': '3D',
};
```

- [ ] **Step 3: Ensure modalities are visible in each compare surface**

Each rendered compare model must call:

```tsx
<ModalityBadges modalities={model.modalities} />
```

- [ ] **Step 4: Keep deprecated models out of recommendation UI**

Do not render a hidden exception path for deprecated items. Let `make validate` enforce that compare recommendations do not include deprecated platform models.

- [ ] **Step 5: Verify**

Run:

```bash
make validate
make typecheck
make build
```

Expected: all commands exit `0`.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/components/CompareView.tsx src/types.ts
git commit -m "feat: align compare source ui with production rankings"
```

## Task 6: Rebuild Free Models Source UI

**Files:**
- Modify: `src/components/FreeModelsView.tsx`
- Modify: `src/types.ts`

- [ ] **Step 1: Preserve all free-model fields currently used by data**

The UI must handle:

```text
rank, modelId, name, vendor, architecture, context, diskSize, ramUsage,
requirements, license, capabilities, install, usage, huggingface,
baseModelUrl, ollamaUrl, output, notes
```

- [ ] **Step 2: Add stable command rendering**

Render `install` and `usage` inside fixed-width, wrapping code blocks:

```tsx
<pre className="code-block">
  <code>{model.install}</code>
</pre>
```

- [ ] **Step 3: Verify mobile text containment**

Use CSS:

```css
.code-block {
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
```

- [ ] **Step 4: Verify**

Run:

```bash
make typecheck
make build
```

Expected: both commands exit `0`.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/components/FreeModelsView.tsx src/types.ts src/App.css
git commit -m "feat: align free models source ui with production content"
```

## Task 7: Visual Parity Review

**Files:**
- Create: `docs/superpowers/plans/artifacts/src-ui-parity-review.md`

- [ ] **Step 1: Serve source build locally**

Run:

```bash
make build
python3 -m http.server 4174 --directory dist
```

Expected:

```text
Serving HTTP on :: port 4174
```

- [ ] **Step 2: Capture source screenshots**

Capture:

```text
/tmp/llm-src-home-desktop.png
/tmp/llm-src-compare-desktop.png
/tmp/llm-src-free-desktop.png
/tmp/llm-src-home-mobile.png
/tmp/llm-src-compare-mobile.png
```

- [ ] **Step 3: Write parity review**

Create `docs/superpowers/plans/artifacts/src-ui-parity-review.md`:

```markdown
# Src UI Parity Review

## Accepted Differences
- None unless explicitly approved.

## Blocking Differences
- List every missing tab, missing data field, layout overflow, text clipping, or broken interaction.

## Verification
- `make validate`
- `make typecheck`
- `make build`
- desktop screenshots
- mobile screenshots
```

- [ ] **Step 4: Fix blocking differences**

Repeat Tasks 3-6 for any blocking difference until the review has no blockers.

- [ ] **Step 5: Commit**

Run:

```bash
git add docs/superpowers/plans/artifacts/src-ui-parity-review.md src
git commit -m "test: document source ui parity review"
```

## Task 8: Cut Release Over to Built Source

**Files:**
- Modify: `Makefile`
- Modify: `scripts/build_release.py`
- Modify: `scripts/verify_assets.py`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `AUDIT.md`

- [ ] **Step 1: Make `release` depend on `build`**

In `Makefile`, change:

```make
release: validate verify-assets
```

to:

```make
release: validate build verify-assets
```

- [ ] **Step 2: Copy `dist/index.html` as release entry**

In `scripts/build_release.py`, change `copy_file("index.html")` behavior so release entry comes from:

```python
copy_from(REPO / "dist" / "index.html", RELEASE / "index.html")
```

- [ ] **Step 3: Copy `dist/assets` into release**

Add:

```python
shutil.copytree(REPO / "dist" / "assets", RELEASE / "assets", dirs_exist_ok=True)
```

Do not copy root `assets/` after cutover.

- [ ] **Step 4: Keep static JSON and essence pages in release**

Keep the existing allowlist for:

```text
api-data.json
siliconflow-data.json
compare-data.json
free-models-data.json
bai-data.json
easyrouter-data.json
claude-data.json
codex-data.json
claude.html
codex.html
claude/index.html
codex/index.html
favicon.svg
robots.txt
sitemap.xml
```

- [ ] **Step 5: Update asset verification**

`scripts/verify_assets.py` must verify the entry that will be released. After cutover, it should inspect `dist/index.html` and `dist/assets`, or inspect generated `release/index.html` after `make release`.

- [ ] **Step 6: Verify cutover locally**

Run:

```bash
make validate
make typecheck
make build
make release
python3 scripts/verify_assets.py
```

Expected: all commands exit `0`; `release/index.html` references Vite-built assets.

- [ ] **Step 7: Commit**

Run:

```bash
git add Makefile scripts/build_release.py scripts/verify_assets.py README.md CHANGELOG.md AUDIT.md
git commit -m "build: publish release from source build"
```

## Task 9: Deploy Source-Built Release

**Files:**
- No source edits unless validation fails.

- [ ] **Step 1: Dry-run Tencent Cloud deploy**

Run:

```bash
make deploy-dry
```

Expected: only `release/` files are considered for sync.

- [ ] **Step 2: Deploy**

Run:

```bash
make deploy
```

Expected: deploy exits `0`.

- [ ] **Step 3: Production checks**

Run:

```bash
make check
make check-exposure
```

Expected:

```text
Production: 200
all core JSON: 200
/README.md: 404
/src/App.tsx: 404
/.github/workflows/deploy.yml: 404
```

- [ ] **Step 4: Push and wait for GitHub Pages**

Run:

```bash
git push origin main
gh run list --branch main --limit 3
```

Then watch the new run:

```bash
gh run watch <run-id> --exit-status
```

Expected: GitHub Pages deploy succeeds.

## Final Acceptance Criteria

- `src/` is documented as the trusted production UI source.
- Root production UI and GitHub Pages mirror are built from `src`.
- `make validate`, `make typecheck`, `make build`, `make release`, `make check`, and `make check-exposure` pass.
- Production and mirror core JSON hashes match local `release/`.
- No development materials are exposed in production.
