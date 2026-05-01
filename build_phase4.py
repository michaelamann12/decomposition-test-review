#!/usr/bin/env python3
"""Merge Phase 4 (StudySync G7 L2) lesson into the existing dashboard data.

Reads:
  - Existing data.js (Bluebonnet G5 L2 — the lesson the dashboard was built for)
  - StudySync G7 Unit 1 module plan CSV → row for MG_STS_XX_G7_1.0_2_v1
  - Phase 4 run artifacts in ~/My Drive/project-clone/draft_outputs/2026-05-01_MG_STS_XX_G7_1.0_2_v1/

Writes:
  - data.js with multi-lesson structure: {active_lesson_id, lessons: {<id>: {...}}}
"""
import csv
import json
import os
import re
from pathlib import Path

REPO_DIR = Path(__file__).parent
DATA_JS = REPO_DIR / "data.js"
HOME = Path(os.environ["HOME"])
GDRIVE = HOME / "Library/CloudStorage/GoogleDrive-michaela.mann@coursemojo.com"

# Phase 4 source paths
PHASE4_RUN = GDRIVE / "My Drive/project-clone/draft_outputs/2026-05-01_MG_STS_XX_G7_1.0_2_v1"
PHASE4_PIPELINE = PHASE4_RUN / "_pipeline"
STUDYSYNC_G7_CSV = GDRIVE / "My Drive/project-clone/module_plans/StudySync/G7/MG_STS_XX_G7_1.0 Planning Prep - Unit 1.csv"

PHASE4_LESSON_ID = "MG_STS_XX_G7_1.0_2_v1"
BLUEBONNET_LESSON_ID = "TX_BBO_XX_G5_1.0_2_v1"


# ---------------------------------------------------------------------------
# Question extraction — line-by-line state-machine parser.
#
# The activity content uses a mix of formats inside a single question block:
#   - bulleted fields:        - **Question Type:** mpchoice
#   - standalone bold fields: **Criteria:** Student identifies...
#   - MC option list:         - A. text / - A: text
#   - Answer line:            - Answer: C
#   - Distractor Rationale block: - **Distractor Rationale:**
#                                   - A: ...
#                                   - B: ...
#
# The previous parser only matched the bulleted form, so non-MC criteria
# (which are written as standalone bold lines) were silently empty for every
# question. Maura's "criteria are invisible in the dashboard" feedback traces
# back to this. New parser captures all three forms.
# ---------------------------------------------------------------------------
def extract_questions(activity_md: str) -> list:
    if not activity_md:
        return []

    questions = []
    cur = None
    cur_field = None        # field currently accumulating (for multi-line standalone fields)
    cur_lines: list = []    # accumulated value lines for cur_field
    in_distractor = False   # inside "- **Distractor Rationale:**" sub-bullet block

    def is_question_heading(title: str) -> bool:
        tl = title.lower()
        return (
            tl.startswith("question")
            or tl.startswith("part ")
            or tl == "extension"
            or tl == "claim question"
            or "short write" in tl
            or "quick write" in tl
            or "extension question" in tl
            or "assessment" in tl
        )

    def flush_field():
        nonlocal cur_field, cur_lines
        if cur is not None and cur_field is not None:
            val = "\n".join(cur_lines).strip()
            if val:
                cur[cur_field] = val
        cur_field = None
        cur_lines = []

    def flush_question():
        nonlocal cur, in_distractor
        flush_field()
        if cur is not None:
            questions.append(cur)
        cur = None
        in_distractor = False

    heading_re = re.compile(r"^####\s+(.+?)\s*$")
    bullet_field_re = re.compile(r"^-\s+\*\*([^:]+):\*\*\s*(.*)$")
    standalone_field_re = re.compile(r"^\*\*([^:]+):\*\*\s*(.*)$")
    option_re = re.compile(r"^-\s+([A-D])[\.\:]\s+(.+)$")
    answer_re = re.compile(r"^-\s+Answer:\s+([A-D])\s*$")
    distractor_sub_re = re.compile(r"^\s+-\s+([A-D]):\s*(.+)$")
    section_break_re = re.compile(r"^(?:---|##\s|###\s)")

    for line in activity_md.split("\n"):
        h = heading_re.match(line)
        if h:
            flush_question()
            title = h.group(1).strip()
            if is_question_heading(title):
                cur = {
                    "title": title,
                    "type": "",
                    "question": "",
                    "criteria": "",
                    "options": [],
                    "correct_letter": "",
                    "correct_rationale": "",
                    "distractor_rationales": {},
                }
            continue

        if cur is None:
            continue

        if section_break_re.match(line):
            flush_question()
            continue

        b = bullet_field_re.match(line)
        if b:
            flush_field()
            in_distractor = False
            field = b.group(1).strip().lower()
            value = b.group(2).strip()
            if field == "question type":
                cur["type"] = value
            elif field == "question":
                cur["question"] = value
            elif field == "criteria":
                cur_field = "criteria"
                cur_lines = [value] if value else []
            elif field == "correct answer rationale":
                cur_field = "correct_rationale"
                cur_lines = [value] if value else []
            elif field == "distractor rationale":
                in_distractor = True
            continue

        s = standalone_field_re.match(line)
        if s:
            flush_field()
            in_distractor = False
            field = s.group(1).strip().lower()
            value = s.group(2).strip()
            if field == "criteria":
                cur_field = "criteria"
                cur_lines = [value] if value else []
            elif field == "correct answer rationale":
                cur_field = "correct_rationale"
                cur_lines = [value] if value else []
            continue

        if in_distractor:
            d = distractor_sub_re.match(line)
            if d:
                cur["distractor_rationales"][d.group(1)] = d.group(2).strip()
                continue
            if line.strip() == "":
                # blank line ends the distractor sub-list
                in_distractor = False

        o = option_re.match(line)
        if o:
            cur["options"].append({"letter": o.group(1), "text": o.group(2).strip()})
            continue

        a = answer_re.match(line)
        if a:
            cur["correct_letter"] = a.group(1)
            continue

        # Multi-line continuation of the active standalone/bullet field.
        # A blank line ends accumulation (criteria + rationales are typically
        # single paragraphs in this format).
        if cur_field is not None:
            if line.strip() == "" and cur_lines:
                flush_field()
            else:
                cur_lines.append(line)

    flush_question()
    return questions


# ---------------------------------------------------------------------------
# Module-plan extraction for StudySync G7
# ---------------------------------------------------------------------------
def parse_studysync_g7_row() -> dict:
    """Find the MG_STS_XX_G7_1.0_2_v1 row in the StudySync G7 Unit 1 CSV."""
    with STUDYSYNC_G7_CSV.open(encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            id_field = (row.get("Activity ID Info ") or row.get("Activity ID Info") or "").strip()
            if id_field == PHASE4_LESSON_ID:
                # Normalize the ID column key so downstream code can find it as "Activity ID"
                row["Activity ID"] = id_field
                # Map StudySync's "Lesson" column to Bluebonnet's "Lesson Name/Number" name
                # so the existing dashboard rendering picks it up
                if "Lesson" in row and "Lesson Name/Number" not in row:
                    row["Lesson Name/Number"] = row.get("Lesson", "")
                # Map StudySync's "This Mojo Activity Replaces..." → Bluebonnet's "This Activity Replaces..."
                if "This Mojo Activity Replaces..." in row and "This Activity Replaces..." not in row:
                    row["This Activity Replaces..."] = row.get("This Mojo Activity Replaces...", "")
                return row
    raise SystemExit(f"Could not find {PHASE4_LESSON_ID} in {STUDYSYNC_G7_CSV}")


def combined_dq_text(row: dict) -> str:
    verbatim = (row.get("Driving Questions (Verbatim)") or "").strip()
    outline = (row.get("Driving Questions (Outline)") or "").strip()
    pieces = []
    if verbatim:
        pieces.append(verbatim)
    if outline:
        pieces.append(outline)
    return "\n\n".join(pieces)


# ---------------------------------------------------------------------------
# Existing data.js loader (extract the JSON object literal)
# ---------------------------------------------------------------------------
def load_existing_data_js() -> dict:
    raw = DATA_JS.read_text(encoding="utf-8")
    # Strip the JS wrapping: "window.DATA = {...};\n"
    m = re.match(r"\s*window\.DATA\s*=\s*", raw)
    if not m:
        raise SystemExit("data.js does not start with `window.DATA =`")
    body = raw[m.end():]
    # Trim trailing semicolon + whitespace
    body = body.rstrip().rstrip(";").rstrip()
    return json.loads(body)


# ---------------------------------------------------------------------------
# Phase 4 lesson assembler
# ---------------------------------------------------------------------------
def read_artifact(name: str) -> str:
    p = PHASE4_PIPELINE / name
    return p.read_text(encoding="utf-8") if p.exists() else ""


def read_top(name: str) -> str:
    p = PHASE4_RUN / name
    return p.read_text(encoding="utf-8") if p.exists() else ""


def build_phase4_lesson() -> dict:
    mp_row = parse_studysync_g7_row()

    activity_md = read_top(f"{PHASE4_LESSON_ID}_Activity_Content.md")
    match_md = read_top(f"{PHASE4_LESSON_ID}_Match_Report.md")
    snapshot_md = (PHASE4_RUN / "_DO_NOT_EDIT" / f"{PHASE4_LESSON_ID}_Activity_Content_ORIGINAL.md")
    snapshot_md = snapshot_md.read_text(encoding="utf-8") if snapshot_md.exists() else ""

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
    ]
    artifacts = {fname: (read_artifact(fname) or None) for fname in pipeline_files}

    # Phase 4 has only v1 (module plan) and v4 (refactor output) — no v2 monolith, no v3 contractor review
    raw_title = mp_row.get("Lesson Name/Number", "") or mp_row.get("Lesson", "")
    cleaned_title = " — ".join(s.strip() for s in raw_title.splitlines() if s.strip())

    # Backfill standard from requirements.json if the module plan didn't carry one.
    standard = (mp_row.get("Target Task Standard(s)") or "").strip()
    if not standard:
        req_raw = artifacts.get("requirements.json")
        if req_raw:
            try:
                req = json.loads(req_raw)
                code = (req.get("standard_code") or "").strip()
                desc = (req.get("standard_description") or "").strip()
                if code and desc:
                    standard = f"{code} — {desc}"
                else:
                    standard = code or desc
            except Exception:
                pass

    # Anchor text fallback: pull text_title from requirements.json
    # (StudySync Skills Practice plans don't fill an anchor text but the pipeline reconstructs it)
    anchor = (mp_row.get("Anchor Text (if applicable)") or mp_row.get("Anchor Text", "") or "").strip()
    if not anchor:
        try:
            req = json.loads(artifacts.get("requirements.json") or "{}")
            tt = (req.get("text_title") or "").strip()
            ta = (req.get("text_author") or "").strip()
            if tt and ta:
                anchor = f"{tt} (by {ta})"
            else:
                anchor = tt
        except Exception:
            pass

    return {
        "meta": {
            "lesson_id": PHASE4_LESSON_ID,
            "lesson_title": cleaned_title,
            "curriculum": "StudySync",
            "grade": "Grade 7",
            "module": "Unit 1",
            "anchor_text": anchor,
            "activity_type": mp_row.get("Activity Type", "") or "",
            "objective": mp_row.get("Curriculum Objective", "") or "",
            "standard": standard,
            "generated_at": "2026-05-01",
        },
        "version_labels": {
            "v1": "Module Plan",
            "v2": "Original Draft",
            "v3": "Move-to-Review",
            "v4": "Refactor Output (May 1)",
        },
        "version_subtitles": {
            "v1": "What the module plan asked for",
            "v2": "No Apr 20 monolith baseline exists for this lesson",
            "v3": "No contractor review version exists for this lesson",
            "v4": "May 1 decomposed pipeline output (Phase 4 readiness + Axis B/C test)",
        },
        "version_availability": {
            "v1": True,
            "v2": False,
            "v3": False,
            "v4": True,
        },
        "module_plan": {
            "row": mp_row,
            "target_task_verbatim": mp_row.get("Target Task Verbatim", "") or "",
            "target_task_outline": mp_row.get("Target Task Outline", "") or "",
            "tt_format_type": mp_row.get("TT Format/Type", "") or "",
            "driving_questions_verbatim": mp_row.get("Driving Questions (Verbatim)", "") or "",
            "driving_questions_outline": mp_row.get("Driving Questions (Outline)", "") or "",
            "driving_questions_combined": combined_dq_text(mp_row),
            "planning_notes": mp_row.get("Planning Notes (optional)", "") or "",
        },
        "versions": {
            "v2_original": {
                "activity_md": "",
                "questions": [],
            },
            "v3_review": {
                "activity_md": "",
                "review_summary_md": "",
                "questions": [],
            },
            "v4_current": {
                "activity_md": activity_md,
                "match_report_md": match_md,
                "snapshot_md": snapshot_md,
                "questions": extract_questions(activity_md),
            },
        },
        "artifacts": artifacts,
        "phase_label": "Phase 4 — readiness + Axis B/C (no monolith baseline, no Axis A parity claim)",
    }


# ---------------------------------------------------------------------------
# Migrate the existing single-lesson data.js into the multi-lesson shape, if
# it isn't already in that shape, and merge the Phase 4 lesson in.
# ---------------------------------------------------------------------------
def main():
    existing = load_existing_data_js()

    if "lessons" in existing and isinstance(existing.get("lessons"), dict):
        # Already multi-lesson. Just inject/replace the Phase 4 entry.
        out = existing
    else:
        # Single-lesson: wrap as multi-lesson, with Bluebonnet as lesson 1.
        bluebonnet = dict(existing)
        # Mark v1 v2 v3 v4 as available for Bluebonnet (it has all four)
        bluebonnet["version_availability"] = {"v1": True, "v2": True, "v3": True, "v4": True}
        bluebonnet["phase_label"] = "Phase 3 — first clean Axis A parity test"
        out = {
            "active_lesson_id": BLUEBONNET_LESSON_ID,
            "lesson_order": [BLUEBONNET_LESSON_ID, PHASE4_LESSON_ID],
            "lessons": {BLUEBONNET_LESSON_ID: bluebonnet},
        }

    phase4 = build_phase4_lesson()
    out["lessons"][PHASE4_LESSON_ID] = phase4
    if PHASE4_LESSON_ID not in out.get("lesson_order", []):
        out.setdefault("lesson_order", [BLUEBONNET_LESSON_ID]).append(PHASE4_LESSON_ID)

    # Re-parse every stored activity_md so the criteria + MC option/rationale
    # fields get populated under the new schema. The previous parser missed
    # standalone bold fields, so all `criteria` slots have been silently empty.
    for lid, lesson in out["lessons"].items():
        for vkey in ("v2_original", "v3_review", "v4_current"):
            ver = lesson.get("versions", {}).get(vkey)
            if not ver:
                continue
            md_text = ver.get("activity_md") or ""
            ver["questions"] = extract_questions(md_text)

    js = "window.DATA = " + json.dumps(out, indent=2, ensure_ascii=False) + ";\n"
    DATA_JS.write_text(js, encoding="utf-8")
    print(f"Wrote {DATA_JS} ({len(js):,} bytes)")
    for lid in out["lesson_order"]:
        lesson = out["lessons"][lid]
        v_have = [k for k, v in lesson["version_availability"].items() if v]
        n_q = sum(len(lesson["versions"][f"{k}_{'original' if k=='v2' else 'review' if k=='v3' else 'current'}"]["questions"]) for k in ["v2", "v3", "v4"] if lesson["version_availability"].get(k))
        print(f"  {lid}: versions {v_have}, {n_q} questions across non-empty versions")


if __name__ == "__main__":
    main()
