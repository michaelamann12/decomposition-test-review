# V2 Decomposed Pipeline — Readiness Memo

**As of:** 2026-05-04 · **Verdict:** 🟡 In zone (conditional on 2 fixes) · **Sample:** 9 runs across 3 curricula

**Companion docs:** [Testing Execution Log](https://docs.google.com/document/...) · [BUGS.md](https://docs.google.com/document/...) · this dashboard's per-lesson views

---

## Verdict

V2 is **🟡 In zone**. The decomposed pipeline produces author-ready output across nine runs spanning three curricula and three grade bands, with measurable quality improvements over V1 (canonical header compliance, no question-tag leakage, richer Match Reports). Two systemic bugs remain that should be fixed before promotion: `populate-lesson` falsely reports source files as verified, and `--from=pick-excerpt` silently halts on reuse mode. Both are scoped, both have known fix shapes, neither requires architectural change. Recommendation: fix both, then promote — covered in *Ask*.

---

## What V2 is, vs V1

**V1** was one large authoring skill (the monolith) doing everything in a single context window: reading source material, picking exemplars, choosing an excerpt, drafting the activity, validating it.

**V2** splits that into six smaller skills (`populate-lesson`, `extract-requirements`, `find-exemplars`, `pick-excerpt`, `generate-activity`, `edit-draft`) coordinated by a thin orchestrator (`draft-activity`). Each runs in its own fresh context window and hands off to the next via files on disk. The point of the split was to make each step independently inspectable, restartable, and replaceable.

---

## Evidence — what the reruns show

| Axis | Status | n | Headline |
|---|---|---|---|
| Parity with V1 (output equivalent or better) | 🟢 Ready | 3 lessons w/ V1 baseline | No regressions; two clear improvements |
| Quality improvements (header spec, type-tag stripping) | 🟢 Ready | 9 runs | Consistent across all runs |
| Regressions vs. V1 | 🟢 Ready | 9 runs | None observed |
| Harness / API tokens / isolation | 🟢 Ready | 9 runs | Verified end-to-end after `apiKeyHelper` fix |
| Scaffolding (manifest, summary files) | 🟡 In zone | 9 runs | Two diagnostic-quality bugs persist (BUG-003, BUG-004) |
| Recovery path (`--from=`) | 🟡 In zone | 6 runs | Works for `generate-activity`; bug for `pick-excerpt` (BUG-002) |
| Source-text procurement | 🟡 In zone | 9 runs | Works in production; clone surfaces a latent `populate-lesson` lie (BUG-001) |
| Cross-curriculum exemplar fallback | 🟠 Promising | 1 lesson exercised | Output looks right but undertested; need an Odell or AAL run |

### Parity with V1 — 🟢 Ready `[strong]`

Three lessons (Bluebonnet G5 L2, StudySync G6, StudySync G7) produced equivalent or better activity content than the V1 monolith baseline. Specifically:

- **Header spec compliance restored.** V1 routinely emitted non-canonical headers (e.g., `#### Assessment — Target Task (TDQ Target Task ELEM)` instead of the canonical spec). V2 produces canonical headers across all 9 runs.
- **A monolith bug went away.** V1 left question-type tags in rendered question stems on at least one lesson (`Literal Comprehension What is the narrator hoping to find in Houston?`). V2 strips the tag cleanly.
- **Match Report is substantially richer.** ~80% larger on average; includes pattern synthesis with cross-curriculum rationale and assessment-decision context. Useful for reviewer triage.

### Quality improvements — 🟢 Ready `[strong]`

The two improvements above replicate across every V2 run we have. There is no run in the sample where V2 produces a worse activity than V1. There are zero observed regressions on activity content.

### Scaffolding bugs — 🟡 In zone `[strong]`

The diagnostic instrumentation V2 emits has two persistent gaps that show up on every run since Phase 3:

- `_pipeline/_manifest.json` resolves `skill_versions` to `"unknown"` for all six sub-skills (BUG-003).
- `phase_durations_sec` field is present but always `{}` (BUG-004).

Neither affects activity quality. Both reduce debuggability and should be batched into one fix to the manifest writer.

### Recovery path — 🟡 In zone `[suggestive]`

`/draft-activity {LESSON} --from=PHASE` correctly resumes from a partial run when `PHASE` is `extract-requirements`, `find-exemplars`, or `generate-activity`. We verified this on 6 lessons today (the resume runs that produced this batch's outputs). One known bug: `--from=pick-excerpt` silently halts when pick-excerpt enters its reuse-mode short-circuit (BUG-002, surfaced Phase 6).

### Cross-curriculum exemplar fallback — 🟠 Promising `[single-run]`

When the activity catalog has no same-curriculum exemplars, V2's `find-exemplars` falls back to cross-curriculum exemplars and produces a populated `Cross-Curriculum Constraints` section in `pattern_synthesis.md` with named source curriculum, concrete avoid patterns, and exemplar disagreements captured. This worked correctly on Bluebonnet G5 L2. Today's batch reused the same Bluebonnet fallback set — it didn't add evidence on the cross-curriculum path's robustness across other curricula. Until we run an Odell, AAL, or Guidebooks lesson, we cannot say this path is solid for the curricula it'll matter for.

---

## Skill improvements made Friday — before running these lessons

This batch was deliberately run *after* a round of fixes on Friday, May 1, that targeted three patterns flagged in Bluebonnet G5 reviews the week of 4/20–4/27. The fixes went into the live skills Friday morning and were synced to the test version of the skills (the clone) Friday afternoon, so the May-1 batch and today's resumes ran against the updated rules.

**Three patterns the reviews surfaced:**

1. **A required question got moved to a different position** (Activity 1.0_1) — when the lesson plan specified the exact wording for a question, the editing step reordered it into a different slot, justifying the move as "better pedagogical flow." Required wording is supposed to stay where the lesson plan put it, not be optimized.
2. **A multi-part required task got split into separate questions** (Activity 1.0_8) — a single required Target Task with multiple parts came out as two separate questions instead of one. The author had specified one task; the pipeline turned it into two.
3. **The same format label produced different shapes across lessons** — `TDQ Target Task ELEM` (a format label used in module plans) was rendering four different ways across lessons 1, 3, 7, 9, 10. The pipeline was treating that label as a recipe instead of as a description; each lesson should have followed its own specified wording, not a generic template.

**What changed in the skills (May 1):**

- **In the drafting step (`generate-activity`):** added three rules the pipeline now enforces every time it writes a draft —
  - **Count:** you get exactly as many required questions as the lesson plan supplies — no more, no fewer.
  - **Position:** required questions appear in the same order the lesson plan put them; generated questions fill the remaining slots.
  - **Whole-piece boundary:** a single required item stays one rendered item — no splitting.
  Also rewrote the rule about how the format label works: when the lesson plan provides exact wording for the assessment, the count and shape now come from that wording, not from a format-label default. `TDQ Target Task ELEM` is now treated as a description, not a template.
- **In the editing step (`edit-draft`):** the verbatim-fidelity check now flags three new failure modes — count mismatch (stops the run), position drift (automatically corrected by putting the question back where the plan put it), and a single required item being split (stops the run). The progression check also got a carveout: it can no longer reorder required questions even if the progression looks off — those cases are now flagged for manual review instead.
- **A pre-delivery gate** was added to the drafting step: before the activity is finalized, the pipeline re-reads what the author committed to and verifies all four rules against the rendered draft. Failures stop delivery and force a regeneration — they can't be quietly papered over.

**How this batch's runs validate the fixes** `[suggestive]`:

- **Lesson 1.0_1's V2 output** keeps the required question in the position the lesson plan specified — the same position the original 4/20 monolith run had moved.
- **Lesson 1.0_8's V2 output** kept the multi-part Target Task as one task, not split into two.
- **Lessons 1.0_1 and 1.0_3** both received `TDQ Target Task ELEM` specs and produced shapes that match each lesson's specified wording — not a uniform template applied across both. The pattern of "same label rendering four different ways" doesn't appear in this batch.
- **The new "progression vs. required-question conflict" flag was raised on lesson 1.0_1's edit pass and waived** per the new carveout, rather than the question getting silently reordered. That's the new control working as designed.

---

## Ask: recommended next steps

**Before promoting V2 to live (estimate: ½ day total):**

1. Fix `populate-lesson` `VERIFIED_EXISTS` false-positive (BUG-001).
2. Fix `--from=pick-excerpt` silent halt on reuse mode (BUG-002).
3. Close the Avery / Friday fixes section above with re-verification evidence from this batch.

**Before declaring the cross-curriculum path solid:**

4. Run one Odell or AAL lesson end-to-end on V2.

**Promote when 1 + 2 + 3 are verified via re-runs of the affected scenarios.** Item 4 can land in parallel.

The diagnostic-quality manifest bugs (BUG-003, BUG-004) are not promotion blockers. They degrade debuggability but don't affect output.

---

## Appendix

- **Per-lesson detail and artifacts:** see the lesson tabs above. New batch lessons are marked with the **RERUN — May 4** or **BUILD — May 1** pill.
- **Run-by-run narrative:** Testing Execution Log (`~/My Drive/product/2026-04-24_Testing-Execution-Log.md`)
- **Open bug punchlist:** BUGS.md (`~/My Drive/product/BUGS.md`)
- **Confidence-tag legend:** `[strong]` 3+ runs agree · `[suggestive]` 2 runs agree · `[single-run]` 1 data point · `[inferred]` no data, reasoned.
