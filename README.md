# Decomposition Test Review Dashboard

Static dashboard for reviewing parity / readiness tests of the decomposed authoring pipeline. Multi-lesson — switch between lessons via the tab strip at the top of the page.

**Live URL:** https://michaelamann12.github.io/decomposition-test-review/

## Lessons covered

- **Bluebonnet G5 L2** (`TX_BBO_XX_G5_1.0_2_v1`) — Phase 3, first clean Axis A parity test. Four-version comparison: module plan, Apr 20 monolith, Apr 21 move-to-review, Apr 30 refactor.
- **StudySync G7 L2** (`MG_STS_XX_G7_1.0_2_v1`) — Phase 4, readiness + Axis B/C re-test. Two-version comparison only (no monolith baseline, no contractor review): module plan + May 1 refactor output.

## Per-lesson views

- **Question Comparison** — what the module plan asked for vs. what each pipeline version produced. Side-by-side or stacked.
- **Run Artifacts** — every intermediate file the new pipeline produced for the lesson, in chain order.
- **About** — phase-specific context and key findings.

## Companion documents

- `2026-04-24_Decomposition-Eval-Plan.md` — eval framework + 2026-04-30 status update
- `2026-04-24_Testing-Execution-Log.md` — phase-by-phase log

Both live in the personal Google Drive product folder.

## Architecture

Single-page static site. Multi-lesson data model:

```
build_data.py     → builds the original Bluebonnet (Phase 3) lesson data
build_phase4.py   → reads existing data.js and merges in Phase 4 (StudySync G7) lesson
data.js           → window.DATA = {active_lesson_id, lesson_order, lessons: {<id>: {...}}}
index.html        → page structure + lesson tabs + sub-tabs
styles.css        → all styling
app.js            → lesson switching, sub-tab switching, rendering, markdown via marked.js
```

To regenerate after a new pipeline run on a covered lesson, re-run the relevant build script. To add a new lesson, add a new `build_<phase>.py` that follows the `build_phase4.py` pattern (read existing `data.js`, append to `lessons` and `lesson_order`).

## License / use

Internal CourseMojo review tool. Public GitHub Pages deployment for ease of access — content includes lesson plan excerpts and refactor test artifacts.
