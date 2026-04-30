# Bluebonnet G5 L2 — Decomposition Test Review Dashboard

Static dashboard for reviewing the Phase 3 parity test of the decomposed authoring pipeline.

**Live URL:** _populated after GitHub Pages deploy_

## What's in here

- **Question Comparison** — module plan vs. Apr 20 monolith vs. Apr 21 move-to-review vs. Apr 30 refactor output. Side-by-side or stacked.
- **Run Artifacts** — every file the new pipeline produced for `TX_BBO_XX_G5_1.0_2_v1`, in chain order.

## Companion documents

- `2026-04-24_Decomposition-Eval-Plan.md` — eval framework + 2026-04-30 status update
- `2026-04-24_Testing-Execution-Log.md` — phase-by-phase log including full Phase 3 entry

Both live in the personal Google Drive product folder.

## Architecture

Single-page static site. No build step beyond regenerating `data.js`:

```
build_data.py    → reads source files in data/ and writes data.js
data.js          → all dashboard data embedded as window.DATA
index.html       → page structure + tabs
styles.css       → all styling
app.js           → tab switching, rendering, markdown via marked.js
```

To regenerate after pulling in updated source files:

```bash
python3 build_data.py
```

## License / use

Internal CourseMojo review tool. Public GitHub Pages deployment for ease of access — content includes lesson plan excerpts and refactor test artifacts.
