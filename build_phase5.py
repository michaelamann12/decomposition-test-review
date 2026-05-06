#!/usr/bin/env python3
"""Merge the May-1/May-4 Bluebonnet G5 Module 1 batch into the dashboard.

Six lessons added:
  - 1.0_1, 1.0_5: first-pass builds completed on May 1
  - 1.0_2, 1.0_3, 1.0_4, 1.0_8: halted May 1 on missing source text,
    resumed May 4 with --from=extract-requirements after the Bowman anthology
    text was hand-copied into the clone (BUG-007 + BUG-001 surfaced this).

Also injects an `executive_summary` block at the top of window.DATA holding
the V2 Readiness Memo so the dashboard can render it as its own page.

Reuses build_phase4's question parser via import.
"""
import csv
import json
import os
import re
import sys
from pathlib import Path

REPO_DIR = Path(__file__).parent
sys.path.insert(0, str(REPO_DIR))
from build_phase4 import extract_questions, load_existing_data_js  # type: ignore

DATA_JS = REPO_DIR / "data.js"
HOME = Path(os.environ["HOME"])
GDRIVE = HOME / "Library/CloudStorage/GoogleDrive-michaela.mann@coursemojo.com"
CLONE = GDRIVE / "My Drive/project-clone"

MP_CSV = CLONE / "module_plans/Bluebonnet/G5/TX_BBO_XX_G5_M1 Unit Overviews - 1 Personal Narratives.csv"

LIVE_DRIVE = GDRIVE / "Shared drives/2026-27 Activity Creation"

# Per-lesson: (lesson_id, v4_run_folder_name, review_ready_folder_name,
#             build_label, build_pill_class, generated_at)
# review_ready folder is in LIVE_DRIVE/review_ready/ and supplies v2 (Apr 20
# monolith snapshot in _DO_NOT_EDIT/) and v3 (top-level contractor edit + Review_Summary.md).
# Set review_ready_folder_name to "" if no review history exists for that lesson.
LESSONS = [
    # Updated 2026-05-05: 5 of 6 lessons re-ran today through the rebuilt Python orchestrator
    # (post BUG-012/013/014 fixes). 1.0_3 was last verified 2026-05-04 under the prior orchestrator;
    # not re-run today (out of scope for the day's bug-affected batch: 1.0_2, 1.0_4, 1.0_5, 1.0_8 + 1.0_1 control).
    ("TX_BBO_XX_G5_1.0_1_v1", "2026-05-05_TX_BBO_XX_G5_1.0_1_v1", "2026-04-20_TX_BBO_XX_G5_1.0_1_v1", "RERUN — May 5", "rerun", "2026-05-05"),
    ("TX_BBO_XX_G5_1.0_2_v1", "2026-05-05_TX_BBO_XX_G5_1.0_2_v1", "",                                  "RERUN — May 5", "rerun", "2026-05-05"),  # v2/v3 already in dashboard
    ("TX_BBO_XX_G5_1.0_3_v1", "2026-05-04_TX_BBO_XX_G5_1.0_3_v1", "2026-04-20_TX_BBO_XX_G5_1.0_3_v1", "RERUN — May 4", "rerun", "2026-05-04"),
    ("TX_BBO_XX_G5_1.0_4_v1", "2026-05-05_TX_BBO_XX_G5_1.0_4_v1", "2026-04-21_TX_BBO_XX_G5_1.0_4_v1", "RERUN — May 5", "rerun", "2026-05-05"),
    ("TX_BBO_XX_G5_1.0_5_v1", "2026-05-05_TX_BBO_XX_G5_1.0_5_v1", "2026-04-21_TX_BBO_XX_G5_1.0_5_v1", "RERUN — May 5", "rerun", "2026-05-05"),
    ("TX_BBO_XX_G5_1.0_8_v1", "2026-05-05_TX_BBO_XX_G5_1.0_8_v1", "2026-04-21_TX_BBO_XX_G5_1.0_8_v1", "RERUN — May 5", "rerun", "2026-05-05"),
]


def parse_mp_row(lesson_id: str) -> dict:
    with MP_CSV.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if (row.get("Activity ID") or "").strip() == lesson_id:
                return row
    raise SystemExit(f"Module plan row not found for {lesson_id} in {MP_CSV}")


def read_text(p: Path) -> str:
    return p.read_text(encoding="utf-8") if p.exists() else ""


def combined_dq_text(row: dict) -> str:
    v = (row.get("Driving Questions (Verbatim)") or "").strip()
    o = (row.get("Driving Questions (Outline)") or "").strip()
    parts = [x for x in (v, o) if x]
    return "\n\n".join(parts)


def build_lesson(lesson_id: str, run_folder: str, review_ready_folder: str,
                 build_label: str, build_pill_class: str, generated_at: str) -> dict:
    run_dir = CLONE / "draft_outputs" / run_folder
    pipeline = run_dir / "_pipeline"
    snapshot_dir = run_dir / "_DO_NOT_EDIT"

    if not run_dir.exists():
        raise SystemExit(f"Run folder missing: {run_dir}")

    # ----- v2 (Apr 20 monolith) + v3 (Apr 21 contractor edit) from review_ready/ -----
    v2_md, v3_md, v3_review_md = "", "", ""
    if review_ready_folder:
        rr = LIVE_DRIVE / "review_ready" / review_ready_folder
        if rr.exists():
            v2_md = read_text(rr / "_DO_NOT_EDIT" / f"{lesson_id}_Activity_Content_ORIGINAL.md")
            v3_md = read_text(rr / f"{lesson_id}_Activity_Content.md")
            v3_review_md = read_text(rr / f"{lesson_id}_Review_Summary.md")
            # If v2 snapshot is missing, fall back to the contractor's content as v2 baseline
            # (rare; some folders only have post-edit state)
            if not v2_md:
                v2_md = v3_md
        else:
            print(f"  ! review_ready folder missing for {lesson_id}: {rr}")

    mp_row = parse_mp_row(lesson_id)

    activity_md = read_text(run_dir / f"{lesson_id}_Activity_Content.md")
    match_md = read_text(run_dir / f"{lesson_id}_Match_Report.md")
    snapshot_md = read_text(snapshot_dir / f"{lesson_id}_Activity_Content_ORIGINAL.md")

    pipeline_files = [
        "_manifest.json",
        "_summary.md",
        "run_meta.json",
        "requirements.json",
        "pia.md",
        "source_assessment.md",
        "curriculum_context.md",
        "author_commitments.md",
        "exemplars.json",
        "pattern_synthesis.md",
        "excerpt_selection.md",
        "excerpt_text.md",
        "question_plan.json",
        "assessment_decision.json",
        "edit_draft_report.md",
        "reuse_audit.md",  # appears on some smart-resume runs
    ]
    artifacts = {fname: (read_text(pipeline / fname) or None) for fname in pipeline_files}

    raw_title = mp_row.get("Lesson Name/Number", "") or mp_row.get("Lesson", "")
    cleaned_title = " — ".join(s.strip() for s in raw_title.splitlines() if s.strip())

    standard = (mp_row.get("Target Task Standard(s)") or "").strip()
    if not standard:
        try:
            req = json.loads(artifacts.get("requirements.json") or "{}")
            code = (req.get("standard_code") or "").strip()
            desc = (req.get("standard_description") or "").strip()
            standard = f"{code} — {desc}" if (code and desc) else (code or desc)
        except Exception:
            pass

    anchor = (mp_row.get("Anchor Text") or "").strip()
    if not anchor:
        try:
            req = json.loads(artifacts.get("requirements.json") or "{}")
            tt = (req.get("text_title") or "").strip()
            ta = (req.get("text_author") or "").strip()
            anchor = f"{tt} (by {ta})" if (tt and ta) else tt
        except Exception:
            pass

    phase_label = (
        f"V2 Readiness Batch — {build_label} (Bluebonnet G5 M1 batch run)"
    )

    return {
        "meta": {
            "lesson_id": lesson_id,
            "lesson_title": cleaned_title,
            "curriculum": "Bluebonnet",
            "grade": "Grade 5",
            "module": "Module 1",
            "anchor_text": anchor,
            "activity_type": (mp_row.get("Activity Type") or "").strip(),
            "objective": (mp_row.get("Curriculum Objective") or "").strip(),
            "standard": standard,
            "generated_at": generated_at,
            "build_label": build_label,
            "build_pill_class": build_pill_class,
        },
        "version_labels": {
            "v1": "Module Plan",
            "v2": "Original Draft (Apr 20)",
            "v3": "Move-to-Review (Apr 21)",
            "v4": f"V2 Output ({generated_at})",
        },
        "version_subtitles": {
            "v1": "What the module plan asked for",
            "v2": (
                "Apr 20 monolith pipeline output (V1)"
                if v2_md
                else "No Apr 20 monolith baseline exists for this lesson"
            ),
            "v3": (
                "Apr 21 contractor's edited version submitted to lead review"
                if v3_md
                else "No contractor review version exists for this lesson"
            ),
            "v4": (
                "May 4 V2 rerun output (resumed from May 1 halt with `--from=extract-requirements`)"
                if build_pill_class == "rerun"
                else "May 1 V2 first-pass build output"
            ),
        },
        "version_availability": {
            "v1": True,
            "v2": bool(v2_md),
            "v3": bool(v3_md),
            "v4": True,
        },
        "module_plan": {
            "row": mp_row,
            "target_task_verbatim": (mp_row.get("Target Task Verbatim") or "").strip(),
            "target_task_outline": (mp_row.get("Target Task Outline") or "").strip(),
            "tt_format_type": (mp_row.get("TT Format/Type") or "").strip(),
            "driving_questions_verbatim": (mp_row.get("Driving Questions (Verbatim)") or "").strip(),
            "driving_questions_outline": (mp_row.get("Driving Questions (Outline)") or "").strip(),
            "driving_questions_combined": combined_dq_text(mp_row),
            "planning_notes": (mp_row.get("Planning Notes (optional)") or "").strip(),
        },
        "versions": {
            "v2_original": {
                "activity_md": v2_md,
                "questions": extract_questions(v2_md),
            },
            "v3_review": {
                "activity_md": v3_md,
                "review_summary_md": v3_review_md,
                "questions": extract_questions(v3_md),
            },
            "v4_current": {
                "activity_md": activity_md,
                "match_report_md": match_md,
                "snapshot_md": snapshot_md,
                "questions": extract_questions(activity_md),
            },
        },
        "artifacts": artifacts,
        "phase_label": phase_label,
    }


def build_executive_summary() -> dict:
    """Returns the V2 Readiness Memo as a structured doc the dashboard renders."""
    md = (REPO_DIR / "executive_summary.md").read_text(encoding="utf-8")
    return {
        "title": "V2 Decomposed Pipeline — Readiness Memo",
        "as_of": "2026-05-04",
        "verdict_status": "in-zone",
        "verdict_label": "🟡 In zone (conditional on 2 fixes)",
        "sample_size": "9 runs across 3 curricula",
        "markdown": md,
    }


# ---------------------------------------------------------------------------
# Per-question module-plan-fidelity comparison
# ---------------------------------------------------------------------------
# For each lesson, build a `comparison_rows` array driven by the module plan.
# Each row pairs ONE plan instruction with the v2/v3/v4 questions that
# implement it. This lets reviewers see "did Claude listen to the author?"
# row-by-row, with explicit labels distinguishing:
#   - Verbatim (Claude must use exact wording)
#   - Outline  (Claude has latitude on phrasing, judges intent)
#   - Discretion (no plan instruction — Claude invented)
#
# Matching rules in priority order:
#   1. Verbatim DQ → exact-string match against question stems (normalized).
#      Locks regardless of position. Robust to Claude reordering for flow.
#   2. Outline DQ → positional within remaining unmatched driving slots.
#   3. Target Task → section match (questions tagged "Target Task ..." or
#      "Assessment ...") + order.
#   4. Extension → section match.
#
# Unmatched questions in v2/v3/v4 are emitted as "extra" rows with a
# discretion plan_instruction, so reviewers can see Claude added these.
# ---------------------------------------------------------------------------

_LEADING_LABEL_RE = re.compile(
    r"^(?:"
    r"\d+\s*[\.\)\:]?\s*"                       # "1. ", "1) ", "1: "
    r"|q\s*\d+\s*[\.\)\:]?\s*"                  # "Q1. ", "Q1: "
    r"|question\s*\d+\s*[\.\)\:]?\s*"           # "Question 1. ", "Question 4: "
    r"|literal\s*comprehension\s*[\:\-]?\s*"    # "Literal Comprehension "
    r"|lcq\s*[\:\-]?\s*"
    r"|tdq\s*[\:\-]?\s*"
    r"|mc\s*[\:\-]?\s*"
    r"|multiple\s*choice\s*[\:\-]?\s*"
    r"|highlight\s*[\:\-]?\s*"
    r"|short\s*answer\s*[\:\-]?\s*"
    r"|sa\s*[\:\-]?\s*"
    r"|claim\s*[\:\-]?\s*"
    r")+",
    re.I,
)


def _normalize_for_match(s: str) -> str:
    """Lowercase, collapse whitespace, strip punctuation — for fuzzy equality.

    Also strips leading enumeration markers and inline question-type labels
    that authors use as design tags in the verbatim cells (e.g.,
    "1. Literal Comprehension What is..." → "What is..."). Without this,
    Q1 of TX_BBO_XX_G5_1.0_2_v1 false-flags as a verbatim deviation when
    the rendered question is in fact a clean match.
    """
    if not s:
        return ""
    s = _LEADING_LABEL_RE.sub("", s.strip())
    s = s.strip().lower()
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"[^\w\s]", "", s)
    return s


def _split_lines(s: str) -> list[str]:
    return [line.strip() for line in (s or "").split("\n") if line.strip()]


def parse_module_plan_instructions(mp: dict) -> list[dict]:
    """Parse a lesson's module_plan dict into ordered plan instructions."""
    instructions = []
    for line in _split_lines(mp.get("driving_questions_verbatim", "")):
        instructions.append({"role": "driving", "source": "verbatim", "text": line})
    for line in _split_lines(mp.get("driving_questions_outline", "")):
        instructions.append({"role": "driving", "source": "outline", "text": line})
    tt_v = (mp.get("target_task_verbatim") or "").strip()
    tt_o = (mp.get("target_task_outline") or "").strip()
    tt_fmt = (mp.get("tt_format_type") or "").strip()
    if tt_v:
        instructions.append({"role": "target_task", "source": "verbatim", "text": tt_v, "format": tt_fmt})
    elif tt_o:
        instructions.append({"role": "target_task", "source": "outline", "text": tt_o, "format": tt_fmt})
    return instructions


def role_of_question(q: dict) -> str:
    """Infer role (driving/target_task/extension) from a question's title."""
    title = (q.get("title") or "").lower()
    if "target task" in title or "assessment" in title or "claim question" in title:
        return "target_task"
    if "extension" in title or "short write" in title or "quick write" in title:
        return "extension"
    return "driving"


def match_instruction(inst: dict, questions: list, used: set) -> int | None:
    """Return the best-match index in `questions` for this plan instruction.

    Verbatim: exact-string match (normalized) against question stems.
    Outline / target_task: positional within unmatched questions of the right role.
    """
    role = inst["role"]
    candidates = [(i, q) for i, q in enumerate(questions) if i not in used and role_of_question(q) == role]
    if not candidates:
        return None
    if inst["source"] == "verbatim":
        norm_inst = _normalize_for_match(inst["text"])
        for i, q in candidates:
            if _normalize_for_match(q.get("question", "")) == norm_inst:
                return i
        # No exact match — fall through to first available so reviewer sees the deviation
    return candidates[0][0]


def compute_comparison_rows(lesson: dict) -> list[dict]:
    """Build the ordered list of comparison rows for this lesson."""
    mp = lesson.get("module_plan", {})
    versions = lesson.get("versions", {})
    v2 = versions.get("v2_original", {}).get("questions") or []
    v3 = versions.get("v3_review", {}).get("questions") or []
    v4 = versions.get("v4_current", {}).get("questions") or []

    instructions = parse_module_plan_instructions(mp)
    used_v2: set = set()
    used_v3: set = set()
    used_v4: set = set()
    rows: list[dict] = []

    for inst in instructions:
        i_v2 = match_instruction(inst, v2, used_v2)
        i_v3 = match_instruction(inst, v3, used_v3)
        i_v4 = match_instruction(inst, v4, used_v4)
        if i_v2 is not None: used_v2.add(i_v2)
        if i_v3 is not None: used_v3.add(i_v3)
        if i_v4 is not None: used_v4.add(i_v4)

        flags = []
        if i_v4 is None:
            flags.append("missing_in_v4")
        elif inst["source"] == "verbatim":
            if _normalize_for_match(v4[i_v4].get("question", "")) != _normalize_for_match(inst["text"]):
                flags.append("verbatim_deviation_v4")

        rows.append({
            "plan_instruction": inst,
            "v2_question": v2[i_v2] if i_v2 is not None else None,
            "v3_question": v3[i_v3] if i_v3 is not None else None,
            "v4_question": v4[i_v4] if i_v4 is not None else None,
            "flags": flags,
        })

    # Add "discretion" rows for v4 questions with no matching plan instruction.
    # These are usually extensions (legitimate author discretion) or rare cases
    # where Claude added an unspecified question (flagged as "extra_in_v4").
    for i, q in enumerate(v4):
        if i in used_v4:
            continue
        role = role_of_question(q)
        # Pair with positionally-aligned v2/v3 of same role if available
        i_v2 = next((j for j, qq in enumerate(v2)
                     if j not in used_v2 and role_of_question(qq) == role), None)
        i_v3 = next((j for j, qq in enumerate(v3)
                     if j not in used_v3 and role_of_question(qq) == role), None)
        if i_v2 is not None: used_v2.add(i_v2)
        if i_v3 is not None: used_v3.add(i_v3)
        flags = []
        if role != "extension":
            flags.append("extra_in_v4")  # Claude added an unspecified driving / target task Q
        rows.append({
            "plan_instruction": {
                "role": role,
                "source": "discretion",
                "text": "" if role == "extension" else "(no module plan instruction for this question)",
            },
            "v2_question": v2[i_v2] if i_v2 is not None else None,
            "v3_question": v3[i_v3] if i_v3 is not None else None,
            "v4_question": q,
            "flags": flags,
        })

    return rows


def main() -> None:
    existing = load_existing_data_js()

    if "lessons" not in existing or not isinstance(existing.get("lessons"), dict):
        raise SystemExit("data.js is not in multi-lesson shape — run build_phase4.py first")

    out = existing

    for lesson_id, folder, review_folder, label, pill, generated in LESSONS:
        new_lesson = build_lesson(lesson_id, folder, review_folder, label, pill, generated)
        prior = out["lessons"].get(lesson_id)
        if prior:
            # If the new build didn't load v2/v3 (no review_ready folder configured),
            # fall back to whatever the prior data.js had so we don't blank out
            # historical comparisons that were already populated.
            if not new_lesson["versions"]["v2_original"].get("activity_md"):
                new_lesson["versions"]["v2_original"] = prior.get("versions", {}).get("v2_original", new_lesson["versions"]["v2_original"])
            if not new_lesson["versions"]["v3_review"].get("activity_md"):
                new_lesson["versions"]["v3_review"] = prior.get("versions", {}).get("v3_review", new_lesson["versions"]["v3_review"])
            # Recompute availability from the now-merged versions
            new_lesson["version_availability"] = {
                "v1": True,
                "v2": bool(new_lesson["versions"]["v2_original"].get("activity_md")),
                "v3": bool(new_lesson["versions"]["v3_review"].get("activity_md")),
                "v4": True,
            }
            new_lesson["module_plan"] = prior.get("module_plan", new_lesson["module_plan"])
        out["lessons"][lesson_id] = new_lesson
        if lesson_id not in out.get("lesson_order", []):
            out["lesson_order"].append(lesson_id)

    # Re-extract questions on every stored activity_md so any parser updates land everywhere
    for lid, lesson in out["lessons"].items():
        for vkey in ("v2_original", "v3_review", "v4_current"):
            ver = lesson.get("versions", {}).get(vkey)
            if not ver:
                continue
            ver["questions"] = extract_questions(ver.get("activity_md") or "")

    # Compute per-question module-plan-fidelity comparison rows for every lesson.
    # See compute_comparison_rows() docstring for matching rules.
    for lid, lesson in out["lessons"].items():
        lesson["comparison_rows"] = compute_comparison_rows(lesson)

    out["executive_summary"] = build_executive_summary()

    js = "window.DATA = " + json.dumps(out, indent=2, ensure_ascii=False) + ";\n"
    DATA_JS.write_text(js, encoding="utf-8")
    print(f"Wrote {DATA_JS} ({len(js):,} bytes)")
    for lid in out["lesson_order"]:
        L = out["lessons"][lid]
        meta = L["meta"]
        pill = meta.get("build_label") or "—"
        av = L.get("version_availability", {})
        flags = "".join(["v" if av.get(k) else "·" for k in ("v1","v2","v3","v4")])
        print(f"  {lid:<32} {flags}  {pill}")


if __name__ == "__main__":
    main()
