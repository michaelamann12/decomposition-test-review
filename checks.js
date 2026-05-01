/* Edit-Draft Checks Reference — structured view of every validation
 * the edit-draft skill runs against a generated activity draft.
 * Source: project-clone/.claude/skills/edit-draft/SKILL.md
 */
window.CHECKS = {
  intro: "Every activity produced by <code>/draft-activity</code> is auto-routed through <code>/edit-draft</code> before any human sees it. This reference lists every validation that runs — what it looks for, what flag it raises, whether it auto-fixes, and where the rule lives. Reviewers surprised to learn a rule exists (e.g., the criteria-length rule that triggered this reference) can find the full surface area here. Counts: <strong>17 LLM-judgment checks</strong> with sub-checks (~37 distinct validations), <strong>1 PIA coverage step</strong> with 4 sub-validations, <strong>2 deterministic Python validators</strong> running 12 more checks. Total surface area: ~50 individual rules.",
  groups: [
    {
      id: "structural",
      title: "Structural integrity",
      blurb: "What the module plan asked for must be what shows up — verbatim content, position, count, atomicity. Then sequence and basic reference integrity.",
      checks: [
        {
          id: "1",
          title: "Verbatim Fidelity",
          severity: "HIGH",
          desc: "Every verbatim entry from the module plan (Driving Questions Verbatim, Target Task Verbatim) must round-trip through the activity exactly. Four sub-invariants — content, count, position, atomicity.",
          flags: ["VERBATIM_MODIFIED (1a, content)", "VERBATIM_COUNT_MISMATCH (1b, halts run — no auto-fix)", "VERBATIM_POSITION_DRIFT (1c, position)", "VERBATIM_SPLIT_ATOMIC (1d, halts run — no auto-fix)"],
          autofix: "1a + 1c only. 1b and 1d halt for regeneration.",
          ref: "module_plans/{curriculum}/{grade}/*.csv + author_commitments.md"
        },
        {
          id: "2",
          title: "Paragraph Reference Integrity",
          desc: "For every paragraph reference in any question (\"in paragraph 3\", \"paragraphs 5-8\"), the cited paragraph must exist in the Reader Content section AND its content must support the question's ask.",
          flags: ["PARA_REF_INVALID"],
          autofix: "Yes — adjust to a paragraph whose content actually supports the question, or rewrite the question."
        },
        {
          id: "3",
          title: "Question Progression Integrity",
          desc: "Driving questions must scaffold low → high cognitive demand. First 1–2 are LCQ/MC. At least one Highlight before the assessment. No more than 2 consecutive same-type Qs. ≥3 different formats across DQs.",
          flags: ["PROGRESSION_BREAK", "PROGRESSION_BREAK_VERBATIM_CONFLICT (when fix would require moving a verbatim DQ)"],
          autofix: "Yes — reorder, retype, add/remove. NEVER reorders a verbatim DQ; surfaces conflict instead."
        }
      ]
    },
    {
      id: "assessment",
      title: "Assessment & excerpt",
      blurb: "The Target Task scope and the Reader Content text — both must be complete and aligned with the source.",
      checks: [
        {
          id: "4",
          title: "Assessment Alignment",
          desc: "Claim + ShortWrite (or paired-MC) must match the assessment target exactly: same scope as PIA Assessment Scope, same terminology between Claim and ShortWrite (both \"claim\" or both \"topic statement\" — never mixed).",
          flags: ["ASSESSMENT_DRIFT"],
          autofix: "Yes — rewrite assessment to match target scope."
        },
        {
          id: "5",
          title: "Excerpt Completeness",
          desc: "Reader Content must contain actual extracted text. No placeholders (\"[Source text to be inserted]\"), no truncations, no summaries.",
          flags: ["EXCERPT_INCOMPLETE"],
          autofix: "Yes — re-extract from source."
        },
        {
          id: "5b",
          title: "Source Cross-Reference (poetry + preserve-curricula paragraph numbers)",
          desc: "For curricula whose numbering convention is <code>preserve</code> (paragraph numbers inherited from source), every numbered paragraph in the activity must match the same-numbered paragraph in the source text. Poetry/verse drama must match line numbers regardless of curriculum.",
          flags: ["LINE_NUM_DRIFT (poetry)", "PARA_NUM_DRIFT (preserve curricula)"],
          autofix: "Yes when source text accessible; warning otherwise.",
          ref: ".claude/reference_docs/excerpt_numbering_rules.md"
        }
      ]
    },
    {
      id: "quality",
      title: "Question quality",
      blurb: "Per-question discipline: criteria writing, brevity, extension shape. Maura's surprise about the criteria-length rule lives here (Check 7 → brevity → criteria word limits).",
      checks: [
        {
          id: "6",
          title: "Criteria Quality (5 sub-checks)",
          desc: "For every non-MC question, the Criteria field must be: scoped to the question (no sneak-adds), text-specific (names, quotes, paragraph numbers — not generic), use the contextual word sense (not the common one), reference the right paragraph, and be present at all.",
          flags: ["CRITERIA_SNEAK_ADD (6a)", "CRITERIA_GENERIC (6b)", "CRITERIA_WRONG_SENSE (6c)", "CRITERIA_PARA_MISMATCH (6d)", "CRITERIA_MISSING (6e)"],
          autofix: "Yes — rewrite per question-type calibration table.",
          ref: ".claude/reference_docs/criteria-writing-guidance.md"
        },
        {
          id: "7",
          title: "Brevity Verification",
          desc: "Per-question word-limit caps + structural sanity. Hard limits: LCQ 20 / MC stem 20 / Highlight 25 / TDQ 30 / Claim 40 / Write prompt 50 / Extension 35. Plus three structural flags: context summaries, compound asks, excess quoted material. <em>This is the surface area Maura noticed.</em>",
          flags: ["Over-limit (per type)", "CONTEXT_SUMMARY (preamble before question)", "COMPOUND_QUESTION (two asks joined by \"and\")", "EXCESS_QUOTES (>6 words quoted)"],
          autofix: "Yes — shorten, drop context, drop quotes."
        },
        {
          id: "11",
          title: "Extension Question Compliance",
          desc: "Extension must be: type <code>extension</code> (not tdq/shortwrite), single open-ended question, anchored to existing excerpt, no new text, no traumatic placement, no single correct answer, format = one setup sentence + one question.",
          flags: ["EXTENSION_VIOLATION"],
          autofix: "Yes — rewrite extension to comply."
        }
      ]
    },
    {
      id: "field-hygiene",
      title: "Field hygiene & types",
      blurb: "Disallowed fields stripped, content blocks well-formed, every question's declared type matches its actual cognitive demand.",
      checks: [
        {
          id: "8",
          title: "No Excluded Fields + Content Block Validation",
          desc: "Strip excluded V22 fields (Connection to End-of-Unit Assessment Task, Unit-Level Connection, Image Ideas, Key Understandings, backpocket guidance, input method, scoring rubrics). Strip standard codes from Alignment/Objective. Validate content blocks (intro, transition, conclusion) per the content-block-types reference (sub-checks 8a–8i).",
          flags: ["EXCLUDED_FIELD", "CONTENT_BLOCK_INTRO_NO_REDIRECT", "CONTENT_BLOCK_TT_PREVIEW", "CONTENT_BLOCK_CONCLUSION_NO_GENERALIZE", "CONTENT_BLOCK_MISPLACED", "CONTENT_BLOCK_TONE", "CONTENT_BLOCK_REGISTER", "CONTENT_BLOCK_DUPLICATE_INTRO", "CONTENT_BLOCK_TYPE5_FORMAT"],
          autofix: "Yes — delete excluded blocks; reposition/repair content blocks. Author-added Type 4/5 blocks are fixed but never removed.",
          ref: ".claude/reference_docs/content-block-types.md"
        },
        {
          id: "9",
          title: "Question Type Classification",
          desc: "Every question's declared type must match its cognitive demand per the question-type glossary. Decision tests for LCQ (\"could a student answer by highlighting a single phrase?\"), TDQ (\"does it require inference / interpretation / connection?\"), Highlight (\"identify, not explain — must follow [scope] from [location] that [connector] [target]\"), Extension. Plus curriculum allowance check.",
          flags: ["TYPE_MISMATCH", "UNKNOWN_QTYPE (type not in glossary)", "CURRICULUM_BANNED_QTYPE (also caught at Check 10b)"],
          autofix: "Yes — reclassify or rewrite question.",
          ref: ".claude/reference_docs/question-type-glossary.md"
        }
      ]
    },
    {
      id: "curriculum",
      title: "Curriculum-specific compliance",
      blurb: "Each curriculum has hard rules — banned types, required elements, scaffolding patterns, MC pairing conventions. Driven by curriculum-guidance files; rules iterate from a machine-readable table at the bottom of each guidance file.",
      checks: [
        {
          id: "10a",
          title: "Activity Type Classification",
          desc: "Some curricula (e.g., HMH) have multiple activity types with different rules. Determine which type this lesson is, then validate ONLY against that type's rules.",
          flags: ["CURRICULUM_WRONG_TYPE"]
        },
        {
          id: "10b",
          title: "Allowed Question Types",
          desc: "Each curriculum specifies valid types (e.g., Fishtank: zero LCQ, zero MC; HMH Literal Comp: all LCQ).",
          flags: ["CURRICULUM_BANNED_QTYPE"]
        },
        {
          id: "10c",
          title: "Question Stem Rules",
          desc: "Single-stem vs. multi-stem allowance, by question position (e.g., HMH/Fishtank: single-stem driving Qs, multi-stem TTs).",
          flags: ["CURRICULUM_STEM_VIOLATION"]
        },
        {
          id: "10d",
          title: "Assessment Type",
          desc: "Hard constraints + defaults (e.g., Fishtank never MC/QuickWrite; WW default is QuickWrite at 42%). Module plan overrides for soft defaults; hard constraints always apply.",
          flags: ["CURRICULUM_ASSESSMENT_VIOLATION"]
        },
        {
          id: "10e",
          title: "MC Assessment Pairing",
          desc: "Paired Part A/B vs. singleton conventions per curriculum (StudySync/Amplify default paired; HMH Second Read singleton; HMH Literal Comp paired).",
          flags: ["CURRICULUM_MC_PAIRING"]
        },
        {
          id: "10f",
          title: "Scaffolding Arc",
          desc: "Curriculum-specific question progression patterns (e.g., Fishtank: Highlight → Claim → Short Write → Grammar → Extension; WW: minimum 2 TDQs).",
          flags: ["CURRICULUM_ARC_VIOLATION"]
        },
        {
          id: "10g",
          title: "Required Elements",
          desc: "Elements the curriculum requires (e.g., Fishtank requires a grammar step in 100% of activities; Amplify requires paragraph-level claim+evidence scaffolding).",
          flags: ["CURRICULUM_MISSING_ELEMENT"]
        },
        {
          id: "10h",
          title: "Prohibited Elements",
          desc: "Elements explicitly banned (e.g., Fishtank prohibits LCQ/MC driving Qs/MC assessment/brainstorm scaffolding).",
          flags: ["CURRICULUM_PROHIBITED_ELEMENT"]
        },
        {
          id: "10i",
          title: "Lifted-vs-Authored Boundary",
          desc: "Some curricula specify what's lifted directly from source vs. authored by the team (e.g., Fishtank: only TT is lifted; all DQs are custom). Boundary must be respected.",
          flags: ["CURRICULUM_SOURCE_VIOLATION"]
        },
        {
          id: "10j",
          title: "Cross-Curriculum Contamination",
          desc: "When exemplars from a different curriculum are used (cross-curriculum fallback), no foreign patterns may leak through. (Flag fires if e.g. a Fishtank pattern shows up in an Amplify activity.)",
          flags: ["CURRICULUM_CONTAMINATION"]
        }
      ]
    },
    {
      id: "grade-band",
      title: "Grade-band rules (G4–G6 only)",
      blurb: "G4, G5, and G6 each have a profile of grade-specific sub-checks (assessment type, evidence count, TDQ ratio, signal words, claim terminology, register). G7–G8 use system defaults — Check 12 skips for those grades. <em>G4 norms are provisional</em> (based on 22 activities, CKLA + HMH); <em>G6 has medium confidence</em>.",
      checks: [
        {
          id: "12",
          title: "Grade-Appropriateness Validation",
          desc: "Loads <code>grade-bands/{G4,G5,G6}.md</code> and runs every sub-check listed in the profile. Each profile documents its own flags and auto-fixes.",
          flags: ["GRADE_* family (varies per profile — assessment type, evidence count, TDQ count/ratio, analytical signal words, question count, claim terminology, extension register, overall register)"],
          autofix: "Yes — per profile. Grade-band fixes outrank PIA coverage if they conflict.",
          ref: ".claude/reference_docs/grade-bands/{G4,G5,G6}.md"
        }
      ]
    },
    {
      id: "pedagogy",
      title: "Pedagogical arc",
      blurb: "Whether the questions actually scaffold to the Target Task without giving it away or doubling back. The TT-leak check (14) is the safety net for the most common pedagogical failure.",
      checks: [
        {
          id: "13",
          title: "Paragraph Qualifier Restraint",
          desc: "Paragraph references in non-verbatim DQs must be wide enough (≥5 paragraphs, ≥10 for G4–G5) and only used when the module plan or excerpt size justifies them. Narrow refs (<5p) without justification, or refs to small excerpts (<30p), trigger.",
          flags: ["PARA_QUALIFIER_NARROW", "PARA_QUALIFIER_UNNECESSARY"],
          autofix: "Yes — widen the range or remove the reference."
        },
        {
          id: "14",
          title: "Target Task Insight Leaking",
          severity: "HIGH",
          desc: "Driving questions must NOT reveal the Target Task's analytical insight. Same analytical language as TT, restating the TT's conclusion as a given, or asking students to do the TT's analytical work in a DQ — all leak. Highlight prompts especially must not contain the insight.",
          flags: ["TT_LEAK"],
          autofix: "Yes — rewrite DQ to target the same text moment without using TT's analytical language."
        },
        {
          id: "15",
          title: "Driving Question Mutual Exclusivity",
          desc: "Each DQ must target a distinct text moment or analytical angle (15a). No DQ may overlap with the Target Task (15b) — most common offender is the last DQ trying to synthesize.",
          flags: ["DQ_OVERLAP (15a)", "DQ_TT_OVERLAP (15b — HIGH)"],
          autofix: "Yes — rewrite to a different text moment or observation."
        },
        {
          id: "16",
          title: "Sequential Text Progression",
          desc: "DQs that reference specific paragraphs should walk through the text roughly in order. Backward jumps (Q4 references p8 after Q3 referenced p25) flag. Exceptions: compare/contrast, multi-excerpt, verbatim-specified ordering.",
          flags: ["OUT_OF_SEQUENCE"],
          autofix: "Yes — reorder, unless reordering breaks cognitive progression."
        }
      ]
    },
    {
      id: "numbering",
      title: "Numbering validation (5 sub-checks)",
      blurb: "Absorbed from the deprecated <code>/qa-numbering</code> skill. Convention correctness, completeness, format, multi-excerpt continuity, manifest consistency.",
      checks: [
        {
          id: "17a",
          title: "Convention Correctness",
          desc: "<code>preserve</code> curricula: numbers must match source. <code>sequential</code> curricula: must start at (1) and be continuous.",
          flags: ["NUMBERING_CONVENTION_WRONG"]
        },
        {
          id: "17b",
          title: "Completeness",
          desc: "Every paragraph in the excerpt section must have a number. No duplicates, no gaps.",
          flags: ["NUMBERING_INCOMPLETE"]
        },
        {
          id: "17c",
          title: "Format Consistency",
          desc: "All numbers use the same format (<code>(N)</code> for Amplify/StudySync/WW/EL/Fishtank; bare <code>N</code> for HMH; <code>N.</code> or <code>(N)</code> for MyPerspectives).",
          flags: ["NUMBERING_FORMAT_MIXED"]
        },
        {
          id: "17d",
          title: "Multi-Excerpt Continuity",
          desc: "Multi-excerpt activities: <code>preserve</code> curricula must label correct source ranges; <code>sequential</code> must continue numbering across excerpt boundaries.",
          flags: ["NUMBERING_MULTI_EXCERPT_BREAK"]
        },
        {
          id: "17e",
          title: "Manifest Consistency",
          desc: "If <code>excerpt_selection.md</code> contains a numbering manifest, manifest entries' first words and word counts must match the activity's actual content.",
          flags: ["NUMBERING_MANIFEST_DRIFT"]
        }
      ]
    },
    {
      id: "pia",
      title: "PIA coverage (Step 3)",
      blurb: "Did the activity address every analytical move the Pedagogical Intent Analysis identified? Plus: does each question encode the right relationship type, and is the Emphasis Hierarchy honored?",
      checks: [
        {
          id: "3a",
          title: "PIA Presence Validation",
          desc: "PIA section must exist in the Match Report. If absent, distinguish between (a) compilation dropped it (auto-fix: re-include from <code>pia.md</code>) and (b) producer Tier 3 halted upstream (legitimate — no auto-fix).",
          flags: ["PIA_COMPILATION_DROPPED (actionable)", "PIA_TIER3_UPSTREAM_HALT (informational)", "PIA_UPGRADE_AVAILABLE (informational)"]
        },
        {
          id: "3b",
          title: "Analytical Inventory Coverage",
          desc: "Every item in the PIA's Analytical Inventory must be addressed by at least one question. Coverage targets: 100% if planning notes say \"1-1 hit\" or \"lift\"; ≥80% otherwise. Any omission must be justified, never silent.",
          flags: ["Coverage shortfall (manual review when fold-in not possible)"]
        },
        {
          id: "3c",
          title: "Relationship Type Verification",
          desc: "Each question that addresses an analytical move with a classified relationship type must encode that relationship correctly (e.g., HIERARCHICAL SUPPORT, not CO-EQUAL COLLABORATION).",
          flags: ["RELATIONSHIP_DRIFT"]
        },
        {
          id: "3d",
          title: "Emphasis Hierarchy Verification",
          desc: "PRIMARY moves get 60–70% of DQ budget. SUPPORTING moves ≤30% (1–2 max). EXTENSION-tier moves only inform the Extension question, not DQs or assessment.",
          flags: ["EMPHASIS_IMBALANCE"]
        }
      ]
    },
    {
      id: "deterministic",
      title: "Deterministic Python validators",
      blurb: "After the LLM checks, two Python scripts run as a deterministic safety net. They overlap with edit-draft checks deliberately (belt-and-suspenders) and cover several things the LLM checks don't.",
      checks: [
        {
          id: "verify_objective",
          title: "verify_objective.py (Step 4.5)",
          desc: "Confirms that edit-draft's rewrites didn't drop a named entity from the Objective. Loops until PASS.",
          flags: ["FAIL → list of missing entities"],
          autofix: "Yes — Objective is rewritten to preserve the listed entities."
        },
        {
          id: "vq1",
          title: "verify_questions.py #1: Verbatim fidelity",
          desc: "Belt-and-suspenders overlap with edit-draft Check 1.",
          autofix: "Yes — Check 1 stack."
        },
        {
          id: "vq2",
          title: "verify_questions.py #2: Paragraph references in scope",
          desc: "Belt-and-suspenders overlap with edit-draft Check 2.",
          autofix: "Yes — Check 2 stack."
        },
        {
          id: "vq3",
          title: "verify_questions.py #3: No template placeholders",
          desc: "Catches <code>[TBD]</code>, <code>[insert]</code>, etc. that may have leaked through. NEW deterministic coverage.",
          autofix: "Yes — strip placeholder, regenerate field per position."
        },
        {
          id: "vq4",
          title: "verify_questions.py #4: Standards coverage",
          desc: "Every standard in <code>author_commitments.md</code> must be addressed by at least one question. NEW deterministic coverage.",
          flags: ["STANDARDS_COVERAGE_GAP — surfaces in Manual Review Required"],
          autofix: "No — standards mapping too domain-specific to auto-fix."
        },
        {
          id: "vq5",
          title: "verify_questions.py #5: Driving question count",
          desc: "Matches plan-specified count (default 5). NEW deterministic coverage.",
          autofix: "Yes — add or remove DQs using PIA analytical inventory."
        },
        {
          id: "vq6",
          title: "verify_questions.py #6: Criteria quotes exist in Reader Content",
          desc: "Belt-and-suspenders overlap with Check 6 (CRITERIA_GENERIC).",
          autofix: "Yes — Check 6 stack."
        },
        {
          id: "vq7",
          title: "verify_questions.py #7: Criteria quotes match cited paragraphs",
          desc: "Belt-and-suspenders overlap with Check 6 (CRITERIA_PARA_MISMATCH).",
          autofix: "Yes — Check 6 stack."
        },
        {
          id: "vq8",
          title: "verify_questions.py #8: Question type validity per glossary",
          desc: "Belt-and-suspenders overlap with Check 9.",
          autofix: "Yes — Check 9 stack."
        },
        {
          id: "vq9",
          title: "verify_questions.py #9: LCQ inference leakage",
          desc: "LCQ criteria must be literal-only — no causal connectors (because, therefore, so, since). NEW deterministic coverage.",
          autofix: "Yes — rewrite criteria to literal-only; remove connectors."
        },
        {
          id: "vq10",
          title: "verify_questions.py #10: MC option length balance",
          desc: "Correct MC option length ≤ 1.4× the mean of the distractors (catches \"the longest option is correct\" tells). NEW deterministic coverage.",
          autofix: "Yes — extend short distractors or shorten correct answer's elaboration."
        },
        {
          id: "vq11",
          title: "verify_questions.py #11: 'Black' capitalization",
          desc: "Capitalize 'Black' as a racial/ethnic identifier per house style. NEW deterministic coverage.",
          autofix: "Yes — capitalize as specified."
        }
      ]
    }
  ]
};
