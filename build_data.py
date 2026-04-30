#!/usr/bin/env python3
"""Assemble all data sources into data.js for the static dashboard."""
import csv
import json
import re
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
OUT_FILE = Path(__file__).parent / "data.js"


def read_text(rel: str) -> str:
    p = DATA_DIR / rel
    return p.read_text(encoding="utf-8") if p.exists() else ""


def read_pipeline_artifact(name: str) -> str:
    p = DATA_DIR / "v4_current_pipeline" / name
    if not p.exists():
        return ""
    return p.read_text(encoding="utf-8")


def parse_module_plan_row() -> dict:
    """Read the module plan CSV row from the pre-extracted JSON file."""
    p = DATA_DIR / "v1_module_plan_row.json"
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    # Fallback to flat-file extraction if the JSON isn't available
    header_line = (DATA_DIR / "v1_module_plan_header.txt").read_text(encoding="utf-8").strip()
    row_line = (DATA_DIR / "v1_module_plan_row.txt").read_text(encoding="utf-8").strip()
    reader = csv.reader([header_line, row_line])
    header = next(reader)
    row = next(reader)
    return dict(zip(header, row))


def combined_dq_text(row: dict) -> str:
    """Combine Driving Questions (Verbatim) + (Outline) into one numbered list."""
    verbatim = (row.get("Driving Questions (Verbatim)") or "").strip()
    outline = (row.get("Driving Questions (Outline)") or "").strip()
    pieces = []
    if verbatim:
        pieces.append(verbatim)
    if outline:
        pieces.append(outline)
    return "\n\n".join(pieces)


def extract_questions(activity_md: str) -> list:
    """Extract question blocks from an Activity Content markdown file.

    Returns list of {n, type, question, criteria, raw} dicts.
    Heuristic — looks for `#### Question N` or `#### Part A/B` blocks
    and gathers their bulleted fields.
    """
    questions = []
    # Match #### Question N, #### Part A, #### Part B, #### Extension, #### Claim Question, #### Short Write Question, etc.
    pattern = re.compile(
        r"^####\s+(.+?)\s*$",
        re.MULTILINE,
    )
    matches = list(pattern.finditer(activity_md))
    for i, m in enumerate(matches):
        title = m.group(1).strip()
        if not (
            title.lower().startswith("question")
            or title.lower().startswith("part ")
            or title.lower() == "extension"
            or title.lower() == "claim question"
            or "short write" in title.lower()
            or "quick write" in title.lower()
        ):
            continue
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(activity_md)
        block = activity_md[start:end].strip()
        # parse bulleted fields like - **Field:** value
        fields = {}
        for line in block.splitlines():
            field_match = re.match(r"^-\s+\*\*([^:]+):\*\*\s*(.*)$", line)
            if field_match:
                k = field_match.group(1).strip().lower().replace(" ", "_")
                v = field_match.group(2).strip()
                fields[k] = v
        questions.append({
            "title": title,
            "type": fields.get("question_type", ""),
            "question": fields.get("question", ""),
            "criteria": fields.get("criteria", ""),
            "explanation": fields.get("explanation", ""),
            "highlight_target": fields.get("highlight_target", ""),
            "options_correct": fields.get("correct_answer", ""),
            "raw": block,
        })
    return questions


def main():
    module_plan = parse_module_plan_row()
    v2_activity = read_text("v2_original_activity.md")
    v3_activity = read_text("v3_review_activity.md")
    v3_summary = read_text("v3_review_summary.md")
    v4_activity = read_text("v4_current_activity.md")
    v4_match = read_text("v4_current_match_report.md")
    v4_snapshot = read_text("v4_current_snapshot.md")

    # Pipeline artifacts (View 1)
    pipeline_files = [
        "_manifest.json",
        "_summary.md",  # may not exist on this run
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
    artifacts = {}
    for fname in pipeline_files:
        content = read_pipeline_artifact(fname)
        artifacts[fname] = content if content else None

    # View 2: question sequences extracted
    q2 = extract_questions(v2_activity)
    q3 = extract_questions(v3_activity)
    q4 = extract_questions(v4_activity)

    data = {
        "meta": {
            "lesson_id": "TX_BBO_XX_G5_1.0_2_v1",
            "lesson_title": module_plan.get("Lesson Name/Number", "") or "",
            "curriculum": "Bluebonnet",
            "grade": "Grade 5",
            "module": "Module 1",
            "anchor_text": module_plan.get("Anchor Text", "") or "",
            "activity_type": module_plan.get("Activity Type", "") or "",
            "objective": module_plan.get("Curriculum Objective", "") or "",
            "standard": module_plan.get("Target Task Standard(s)", "") or "",
            "generated_at": "2026-04-30",
        },
        "version_labels": {
            "v1": "Module Plan",
            "v2": "Original Draft (Apr 20)",
            "v3": "Move-to-Review (Apr 21)",
            "v4": "Refactor Output (Apr 30)",
        },
        "version_subtitles": {
            "v1": "What the module plan asked for",
            "v2": "Apr 20 monolith pipeline output",
            "v3": "Apr 21 contractor's edited version submitted to lead review",
            "v4": "Apr 30 decomposed pipeline output (this test)",
        },
        "module_plan": {
            "row": module_plan,
            "target_task_verbatim": module_plan.get("Target Task Verbatim", "") or "",
            "target_task_outline": module_plan.get("Target Task Outline", "") or "",
            "tt_format_type": module_plan.get("TT Format/Type", "") or "",
            "driving_questions_verbatim": module_plan.get("Driving Questions (Verbatim)", "") or "",
            "driving_questions_outline": module_plan.get("Driving Questions (Outline)", "") or "",
            "driving_questions_combined": combined_dq_text(module_plan),
            "planning_notes": module_plan.get("Planning Notes (optional)", "") or "",
        },
        "versions": {
            "v2_original": {
                "activity_md": v2_activity,
                "questions": q2,
            },
            "v3_review": {
                "activity_md": v3_activity,
                "review_summary_md": v3_summary,
                "questions": q3,
            },
            "v4_current": {
                "activity_md": v4_activity,
                "match_report_md": v4_match,
                "snapshot_md": v4_snapshot,
                "questions": q4,
            },
        },
        "artifacts": artifacts,
    }

    js = "window.DATA = " + json.dumps(data, indent=2, ensure_ascii=False) + ";\n"
    OUT_FILE.write_text(js, encoding="utf-8")
    print(f"Wrote {OUT_FILE} ({len(js):,} bytes)")
    print(f"  Versions: v2={len(q2)}q v3={len(q3)}q v4={len(q4)}q")
    print(f"  Artifacts: {sum(1 for v in artifacts.values() if v)} present, {sum(1 for v in artifacts.values() if not v)} missing")


if __name__ == "__main__":
    main()
