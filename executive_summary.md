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

## Bugs Avery flagged Friday — what was fixed

*[Section TODO — fill in once we pull Avery's specific Friday feedback.]*

Suggested shape, once we have the list:

- **[Issue 1, 1-line description]** — Fixed in `[skill]` on [date]. Verified in today's rerun of `TX_BBO_XX_G5_1.0_X` (output now [behavior]). Dashboard: link to lesson card.
- **[Issue 2 …]** — …

Each fix should point down into the relevant lesson on the dashboard for proof. The criteria for closing this section: every Avery-flagged issue has either (a) been re-verified in a May-4 rerun, or (b) been moved to BUGS.md as a known open item with rationale.

---

## What's still risky

- **`populate-lesson` `VERIFIED_EXISTS` false-positive (BUG-001).** Production-relevant for any new curriculum coming online for the first time (Odell, AAL, Guidebooks). Should fail at Phase 1, not Phase 2.
- **`--from=pick-excerpt` silent halt (BUG-002).** Breaks the exact recovery scenario `--from=` was meant to support.
- **Avery's Friday feedback not yet fully closed in this memo.** Section above is a placeholder; the verdict above assumes those fixes hold up under re-test. Re-verify before promotion.

---

## What we don't yet know

- **Cross-curriculum exemplar fallback at scale.** Only one lesson has genuinely exercised this path. Need an Odell or AAL run.
- **Throughput at scale.** Largest batch to date is 6 lessons (this one). Parallel runs across multiple lessons concurrently, or sustained throughput over a multi-day window, has not been exercised.
- **Author response.** No author has yet edited a V2-produced draft end-to-end and given structured feedback. Avery's Friday review is the closest signal; it's qualitative, on a small sample.

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
