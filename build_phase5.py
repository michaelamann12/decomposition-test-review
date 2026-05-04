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

MP_CSV = CLONE / "module_plans/Bluebonnet/G5/TX_BBO_XX_G5_M1 Unit Overview - Personal Narratives.csv"

# Per-lesson: (lesson_id, run_folder_name, build_label, build_pill_class, generated_at)
# build_pill_class controls the colored pill on the lesson tab:
#   "rerun"  → "RERUN — May 4" (lessons that halted May 1, resumed May 4)
#   "build"  → "BUILD — May 1" (first-pass batch lessons that completed cleanly)
LESSONS = [
    ("TX_BBO_XX_G5_1.0_1_v1", "2026-05-01_TX_BBO_XX_G5_1.0_1_v1_r3", "BUILD — May 1", "build", "2026-05-01"),
    ("TX_BBO_XX_G5_1.0_2_v1", "2026-05-04_TX_BBO_XX_G5_1.0_2_v1",    "RERUN — May 4", "rerun", "2026-05-04"),
    ("TX_BBO_XX_G5_1.0_3_v1", "2026-05-01_TX_BBO_XX_G5_1.0_3_v1",    "RERUN — May 4", "rerun", "2026-05-04"),
    ("TX_BBO_XX_G5_1.0_4_v1", "2026-05-01_TX_BBO_XX_G5_1.0_4_v1",    "RERUN — May 4", "rerun", "2026-05-04"),
    ("TX_BBO_XX_G5_1.0_5_v1", "2026-05-01_TX_BBO_XX_G5_1.0_5_v1",    "BUILD — May 1", "build", "2026-05-01"),
    ("TX_BBO_XX_G5_1.0_8_v1", "2026-05-01_TX_BBO_XX_G5_1.0_8_v1",    "RERUN — May 4", "rerun", "2026-05-04"),
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


def build_lesson(lesson_id: str, run_folder: str, build_label: str,
                 build_pill_class: str, generated_at: str) -> dict:
    run_dir = CLONE / "draft_outputs" / run_folder
    pipeline = run_dir / "_pipeline"
    snapshot_dir = run_dir / "_DO_NOT_EDIT"

    if not run_dir.exists():
        raise SystemExit(f"Run folder missing: {run_dir}")

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
            "v2": "Original Draft",
            "v3": "Move-to-Review",
            "v4": f"V2 Output ({generated_at})",
        },
        "version_subtitles": {
            "v1": "What the module plan asked for",
            "v2": "No Apr 20 monolith baseline exists for this lesson",
            "v3": "No contractor review version exists for this lesson",
            "v4": (
                "May 4 V2 rerun output (resumed from May 1 halt with `--from=extract-requirements`)"
                if build_pill_class == "rerun"
                else "May 1 V2 first-pass build output"
            ),
        },
        "version_availability": {
            "v1": True,
            "v2": False,
            "v3": False,
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
            "v2_original": {"activity_md": "", "questions": []},
            "v3_review": {"activity_md": "", "review_summary_md": "", "questions": []},
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


def main() -> None:
    existing = load_existing_data_js()

    if "lessons" not in existing or not isinstance(existing.get("lessons"), dict):
        raise SystemExit("data.js is not in multi-lesson shape — run build_phase4.py first")

    out = existing

    for lesson_id, folder, label, pill, generated in LESSONS:
        new_lesson = build_lesson(lesson_id, folder, label, pill, generated)
        prior = out["lessons"].get(lesson_id)
        if prior:
            # Preserve V1 monolith + contractor review history if the lesson already
            # has them — only refresh meta + v4 + artifacts. Avoids destroying the
            # Phase 3 4-version comparison when 1.0_2 gets rerun.
            new_lesson["versions"]["v2_original"] = prior.get("versions", {}).get("v2_original", new_lesson["versions"]["v2_original"])
            new_lesson["versions"]["v3_review"] = prior.get("versions", {}).get("v3_review", new_lesson["versions"]["v3_review"])
            new_lesson["version_availability"] = {
                "v1": True,
                "v2": prior.get("version_availability", {}).get("v2", False),
                "v3": prior.get("version_availability", {}).get("v3", False),
                "v4": True,
            }
            # Keep v2/v3 labels + subtitles from prior so headers stay informative
            for vk in ("v2", "v3"):
                if vk in prior.get("version_labels", {}):
                    new_lesson["version_labels"][vk] = prior["version_labels"][vk]
                if vk in prior.get("version_subtitles", {}):
                    new_lesson["version_subtitles"][vk] = prior["version_subtitles"][vk]
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

    out["executive_summary"] = build_executive_summary()

    js = "window.DATA = " + json.dumps(out, indent=2, ensure_ascii=False) + ";\n"
    DATA_JS.write_text(js, encoding="utf-8")
    print(f"Wrote {DATA_JS} ({len(js):,} bytes)")
    for lid in out["lesson_order"]:
        meta = out["lessons"][lid]["meta"]
        pill = meta.get("build_label") or "—"
        print(f"  {lid:<32} {pill}")


if __name__ == "__main__":
    main()
