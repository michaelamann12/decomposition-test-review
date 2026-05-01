/* Decomposition Test Review — app.js (multi-lesson) */

(function () {
  const D = window.DATA;
  if (!D) return;

  // Configure marked.js
  if (window.marked) {
    marked.setOptions({ breaks: false, gfm: true });
  }
  function md(s) {
    if (!s) return "";
    return window.marked ? marked.parse(s) : escapeHTML(s);
  }
  function escapeHTML(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ---------- Lesson selector tabs ----------
  function renderLessonTabs() {
    const container = document.getElementById("lesson-tabs");
    container.innerHTML = "";
    (D.lesson_order || Object.keys(D.lessons)).forEach((lid) => {
      const lesson = D.lessons[lid];
      const btn = document.createElement("button");
      btn.className = "lesson-tab" + (lid === D.active_lesson_id ? " active" : "");
      btn.dataset.lesson = lid;
      btn.innerHTML = `<span class="lt-eyebrow">${escapeHTML(lesson.meta.curriculum)} ${escapeHTML(lesson.meta.grade)}</span><span class="lt-title">${escapeHTML(lesson.meta.lesson_title || lid)}</span>`;
      btn.addEventListener("click", () => {
        D.active_lesson_id = lid;
        renderLessonTabs();
        renderLesson();
      });
      container.appendChild(btn);
    });
  }

  // ---------- Sub-tab switching (Question Comparison / Artifacts / About) ----------
  function attachSubTabHandlers() {
    const tabs = document.querySelectorAll(".tab");
    const views = document.querySelectorAll(".view");
    tabs.forEach((t) => {
      t.addEventListener("click", () => {
        tabs.forEach((x) => x.classList.remove("active"));
        views.forEach((v) => v.classList.remove("active"));
        t.classList.add("active");
        const target = document.getElementById("view-" + t.dataset.tab);
        if (target) target.classList.add("active");
      });
    });
  }

  // ---------- Per-lesson rendering ----------
  function activeLesson() {
    return D.lessons[D.active_lesson_id];
  }

  function renderHeader() {
    const L = activeLesson();
    document.getElementById("lesson-title").textContent =
      `${L.meta.curriculum} ${L.meta.grade} — ${L.meta.lesson_title || L.meta.lesson_id}`;
    document.getElementById("meta-line").textContent =
      [L.meta.lesson_id, L.meta.activity_type, L.meta.standard].filter(Boolean).join(" · ");
    document.getElementById("phase-label").textContent =
      L.phase_label || "Decomposition Test Review";
    document.getElementById("generated-at").textContent = L.meta.generated_at;
    const sourcePath = D.active_lesson_id === "TX_BBO_XX_G5_1.0_2_v1"
      ? "project-clone/draft_outputs/2026-04-30_TX_BBO_XX_G5_1.0_2_v1/"
      : `project-clone/draft_outputs/2026-05-01_${D.active_lesson_id}/`;
    document.getElementById("generated-source").textContent = sourcePath;
  }

  function renderModulePlanPanel() {
    const L = activeLesson();
    const mp = L.module_plan;
    const mpBody = document.getElementById("module-plan-body");
    const mpFields = [
      ["Curriculum Objective", mp.row["Curriculum Objective"]],
      ["Anchor Text", mp.row["Anchor Text (if applicable)"] || mp.row["Anchor Text"]],
      ["Text Segment", mp.row["Text Segment (description)"] || mp.row["Text Segment"]],
      ["Activity Type", L.meta.activity_type],
      ["TT Format/Type", mp.tt_format_type],
      ["Standard(s)", mp.row["Target Task Standard(s)"]],
    ];
    let mpHtml = "<dl>";
    mpFields.forEach(([k, v]) => {
      if (!v) return;
      mpHtml += `<dt>${escapeHTML(k)}</dt><dd>${escapeHTML(v)}</dd>`;
    });
    mpHtml += "</dl>";
    if (mp.target_task_verbatim) {
      mpHtml += `<div class="mp-quote"><strong>Target Task (verbatim):</strong>\n${escapeHTML(mp.target_task_verbatim)}</div>`;
    }
    if (mp.target_task_outline) {
      mpHtml += `<div class="mp-quote"><strong>Target Task (outline):</strong>\n${escapeHTML(mp.target_task_outline)}</div>`;
    }
    if (mp.driving_questions_verbatim) {
      mpHtml += `<div class="mp-quote"><strong>Driving Questions (verbatim from module plan):</strong>\n${escapeHTML(mp.driving_questions_verbatim)}</div>`;
    }
    if (mp.driving_questions_outline) {
      mpHtml += `<div class="mp-quote"><strong>Driving Questions (outline):</strong>\n${escapeHTML(mp.driving_questions_outline)}</div>`;
    }
    if (mp.planning_notes) {
      mpHtml += `<div class="mp-quote"><strong>Planning Notes:</strong>\n${escapeHTML(mp.planning_notes)}</div>`;
    }
    mpBody.innerHTML = mpHtml;
  }

  function renderReviewSummaryPanel() {
    const L = activeLesson();
    const rsBody = document.getElementById("review-summary-body");
    const rsPanel = rsBody.closest("details");
    const v3Available = L.version_availability && L.version_availability.v3;
    if (!v3Available) {
      rsPanel.style.display = "none";
      return;
    }
    rsPanel.style.display = "";
    rsBody.innerHTML = md(L.versions.v3_review.review_summary_md || "_No review summary available._");
  }

  // ---------- Question comparison ----------
  function activeColumns() {
    const L = activeLesson();
    const av = L.version_availability || { v1: true, v2: true, v3: true, v4: true };
    return ["v1", "v2", "v3", "v4"].filter((k) => av[k]);
  }

  function buildRows() {
    const L = activeLesson();
    const v2 = L.versions.v2_original.questions || [];
    const v3 = L.versions.v3_review.questions || [];
    const v4 = L.versions.v4_current.questions || [];
    const moduleDQs = parseModuleDQs(L.module_plan.driving_questions_combined ||
      ((L.module_plan.driving_questions_verbatim || "") + "\n\n" + (L.module_plan.driving_questions_outline || "")));
    const maxLen = Math.max(moduleDQs.length, v2.length, v3.length, v4.length, 1);
    const rows = [];
    for (let i = 0; i < maxLen; i++) {
      rows.push({
        idx: i,
        v1: moduleDQs[i] || null,
        v2: v2[i] || null,
        v3: v3[i] || null,
        v4: v4[i] || null,
      });
    }
    return rows;
  }

  function renderSideBySide(rows, hideEmpty, cols) {
    const L = activeLesson();
    const colCount = cols.length;
    let html = `<div class="col-headers" style="grid-template-columns: 60px repeat(${colCount}, 1fr);">`;
    html += `<div></div>`;
    cols.forEach((k) => {
      html += `<div class="col-header col-${k}">${escapeHTML(L.version_labels[k])}<span class="sub">${escapeHTML(L.version_subtitles[k])}</span></div>`;
    });
    html += `</div>`;
    rows.forEach((r) => {
      if (hideEmpty && cols.every((k) => !r[k])) return;
      html += `<div class="qrow" style="grid-template-columns: 60px repeat(${colCount}, 1fr);">`;
      html += `<div class="row-label">Q${r.idx + 1}</div>`;
      cols.forEach((k) => { html += cellHtml(r[k], k); });
      html += `</div>`;
    });
    return html;
  }

  function isMC(q) {
    return (q.type || "").toLowerCase().includes("mpchoice")
      || (q.type || "").toLowerCase().includes("multiple choice")
      || (q.options && q.options.length > 0);
  }

  function renderQuestionBody(q) {
    let html = "";
    html += `<div class="qstem">${escapeHTML(q.question || "")}</div>`;
    if (isMC(q) && q.options && q.options.length) {
      html += `<ul class="qopts">`;
      q.options.forEach((o) => {
        const isCorrect = o.letter === q.correct_letter;
        html += `<li class="qopt${isCorrect ? " qopt-correct" : ""}"><span class="qopt-letter">${escapeHTML(o.letter)}</span><span class="qopt-text">${escapeHTML(o.text)}</span>${isCorrect ? `<span class="qopt-mark">✓</span>` : ""}</li>`;
      });
      html += `</ul>`;
    }
    if (q.criteria) {
      html += `<span class="qcrit-label">Criteria</span><div class="qcrit">${escapeHTML(q.criteria)}</div>`;
    }
    if (q.correct_rationale) {
      html += `<span class="qcrit-label">Correct answer rationale</span><div class="qcrit">${escapeHTML(q.correct_rationale)}</div>`;
    }
    if (q.distractor_rationales && Object.keys(q.distractor_rationales).length) {
      html += `<details class="qdistractors"><summary>Distractor rationale (${Object.keys(q.distractor_rationales).length})</summary><ul class="qdr-list">`;
      ["A", "B", "C", "D"].forEach((L) => {
        if (q.distractor_rationales[L]) {
          html += `<li><span class="qdr-letter">${L}</span> ${escapeHTML(q.distractor_rationales[L])}</li>`;
        }
      });
      html += `</ul></details>`;
    }
    return html;
  }

  function cellHtml(q, vKey) {
    if (!q) return `<div class="qcell empty col-${vKey}">—</div>`;
    return `<div class="qcell col-${vKey}">
      <div class="qtitle">${escapeHTML(q.title || "")}</div>
      ${q.type ? `<div class="qtype-badge">${escapeHTML(q.type)}</div>` : ""}
      ${renderQuestionBody(q)}
    </div>`;
  }

  function renderStacked(rows, hideEmpty, cols) {
    const L = activeLesson();
    let html = "";
    rows.forEach((r) => {
      if (hideEmpty && cols.every((k) => !r[k])) return;
      html += `<div class="stacked-question"><h3>Q${r.idx + 1}</h3><div class="stacked-versions">`;
      cols.forEach((k) => { html += stackedRow(L, k, r[k]); });
      html += `</div></div>`;
    });
    return html;
  }

  function stackedRow(L, vKey, q) {
    const label = L.version_labels[vKey];
    const subtitle = L.version_subtitles[vKey];
    if (!q) {
      return `<div class="stacked-version ${vKey}">
        <div class="v-label">${escapeHTML(label)}<div class="vsub">${escapeHTML(subtitle)}</div></div>
        <div class="v-content"><span class="empty">— no question at this position —</span></div>
      </div>`;
    }
    let content = "";
    if (q.title) content += `<div class="qtitle">${escapeHTML(q.title)}</div>`;
    if (q.type) content += `<div class="qtype-badge">${escapeHTML(q.type)}</div>`;
    content += renderQuestionBody(q);
    return `<div class="stacked-version ${vKey}">
      <div class="v-label">${escapeHTML(label)}<div class="vsub">${escapeHTML(subtitle)}</div></div>
      <div class="v-content">${content}</div>
    </div>`;
  }

  function renderComparison() {
    const cols = activeColumns();
    const rows = buildRows();
    const cmpContainer = document.getElementById("comparison-container");
    const mode = document.getElementById("comparison-mode").value;
    const hideEmpty = document.getElementById("hide-empty").checked;
    if (mode === "stacked") {
      cmpContainer.innerHTML = renderStacked(rows, hideEmpty, cols);
    } else {
      cmpContainer.innerHTML = renderSideBySide(rows, hideEmpty, cols);
    }
  }

  // ---------- Module-plan DQ parser ----------
  function parseModuleDQs(s) {
    if (!s) return [];
    s = s.trim();
    const numMatches = s.split(/(?:^|\s)(\d+)\.\s+/).filter(Boolean);
    if (numMatches.length > 1) {
      const result = [];
      for (let i = 0; i < numMatches.length; i++) {
        const part = numMatches[i].trim();
        if (!part || /^\d+$/.test(part)) continue;
        result.push({
          title: `DQ ${result.length + 1}`,
          type: detectQType(part),
          question: part,
          criteria: "",
        });
      }
      if (result.length > 1) return result;
    }
    return s
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p, i) => ({
        title: `DQ ${i + 1}`,
        type: detectQType(p),
        question: p,
        criteria: "",
      }));
  }

  function detectQType(text) {
    const m = text.match(/^(Literal Comprehension|Highlight|Multiple Choice|Vocabulary|Inferential Comprehension|Short Write|Quick Write|Claim)\s/i);
    return m ? m[1] : "";
  }

  // ---------- Run artifacts ----------
  function renderArtifacts() {
    const L = activeLesson();
    const artContainer = document.getElementById("artifacts-container");
    artContainer.innerHTML = "";
    const artifactOrder = [
      ["_manifest.json", "Run manifest", "Machine-readable record of this run — phases, durations, halts, warnings, file fingerprints, skill versions."],
      ["_summary.md", "Chain summary digest", "The 'open this first' digest auto-generated by edit-draft Step 5c. Combines key fields from every intermediate artifact."],
      ["run_meta.json", "Run metadata", "Initial state captured by the orchestrator at run start."],
      ["requirements.json", "Extracted requirements", "Structured fields that extract-requirements pulled from the module plan and source materials."],
      ["pia.md", "Pedagogical Intent Analysis", "What the lesson is trying to teach and assess. Reconstructed from unit and lesson materials."],
      ["source_assessment.md", "Source assessment", "What materials were available, what's missing, confidence."],
      ["curriculum_context.md", "Curriculum context", "Curriculum-specific conventions and constraints that downstream phases need to honor."],
      ["author_commitments.md", "Author commitments", "Verbatim text and binding directives extracted from the module plan that must be preserved."],
      ["exemplars.json", "Selected exemplars", "Past activities pulled from the catalog as structural references for this lesson."],
      ["pattern_synthesis.md", "Pattern synthesis", "Analytical synthesis of what the selected exemplars share, including cross-curriculum constraints when applicable."],
      ["excerpt_selection.md", "Excerpt selection", "Which paragraphs of the source text were chosen as the activity's reading excerpt and why."],
      ["excerpt_text.md", "Excerpt text", "The actual text excerpt, paragraph-numbered, that the activity questions reference."],
      ["question_plan.json", "Question plan", "The structured plan generate-activity built before writing each driving question."],
      ["assessment_decision.json", "Assessment decision", "How generate-activity chose between paired-MC, ShortWrite, QuickWrite, or LightQuickWrite."],
      ["edit_draft_report.md", "Edit-draft report", "What edit-draft validated, what auto-fixes it applied, what it left for the author."],
    ];
    artifactOrder.forEach(([fname, title, blurb]) => {
      const content = (L.artifacts || {})[fname];
      const isMissing = !content;
      const block = document.createElement("details");
      block.className = "artifact-block" + (isMissing ? " missing" : "");
      const summary = document.createElement("summary");
      summary.innerHTML = `<strong>${escapeHTML(title)}</strong> <span class="hint">— ${escapeHTML(blurb)}</span>`;
      block.appendChild(summary);
      const body = document.createElement("div");
      body.className = "artifact-body";
      if (isMissing) {
        body.innerHTML = `<em style="color:#8a4d00;">This file was not produced by this run.</em>`;
      } else if (fname.endsWith(".json")) {
        let pretty;
        try { pretty = JSON.stringify(JSON.parse(content), null, 2); } catch (e) { pretty = content; }
        body.innerHTML = `<pre>${escapeHTML(pretty)}</pre>`;
      } else if (fname.endsWith(".md")) {
        body.className = "artifact-body markdown-body";
        body.innerHTML = md(content);
      } else {
        body.innerHTML = `<pre>${escapeHTML(content)}</pre>`;
      }
      block.appendChild(body);
      artContainer.appendChild(block);
    });
  }

  // ---------- About panel ----------
  const ABOUT_BLURBS = {
    "TX_BBO_XX_G5_1.0_2_v1": {
      intro: "This lesson was the first clean Axis A parity test of the decomposed authoring pipeline. Bluebonnet is a brand-new curriculum (added March 2026), so the activity catalog has no same-lesson prior-year exemplars — meaning the input conditions were guaranteed equivalent between the Apr 20 monolith baseline and the Apr 30 refactor run.",
      findings: [
        "The refactor produced equivalent or better activity content than the monolith. No regressions.",
        "Two small quality wins: header naming now matches the canonical spec; the monolith bug that leaked the question-type tag into Q1 (\"Literal Comprehension What is the narrator...\") is fixed.",
        "The cross-curriculum exemplar path works correctly — <code>pattern_synthesis.md</code> produced lesson-specific Cross-Curriculum Constraints (named HMH as source, listed 3 specific avoid patterns with reasons, captured exemplar disagreements with rationale).",
        "One small instrumentation regression on this run: the <code>_summary.md</code> chain-trace digest wasn't written and the Step 6 report came out in a non-canonical shape. Closed in Phase 3.5 — both producer-side spec tightening and validator coverage are in place for the next run.",
      ],
    },
    "MG_STS_XX_G7_1.0_2_v1": {
      intro: "This lesson is a readiness + Axis B/C re-test on a Grade 7 lesson. There is no Apr 20 monolith baseline for this lesson and no contractor review version, so this is <strong>not</strong> an Axis A parity test — only sub-skill conformance (Axis B) and handoff information fidelity (Axis C) are scored. The run also doubled as a recoverability check after yesterday's network-induced ENOTFOUND failure on the same lesson.",
      findings: [
        "Pipeline ran end-to-end successfully: 6 phases, exit 0, 25.0 min wall-clock on Opus 4.6, 0 halts, 0 warnings. Fastest run in the test sequence so far.",
        "Validator: 16 PASS / 0 FAIL (highest score in the sequence — Phase 3 was 14/14, Phase 2 was 13/14 after 2.5 fixes).",
        "Phase 3's <code>_summary.md</code> and <code>edit_draft_report.md</code> regressions did not recur — both came out correctly here.",
        "Match gate PASSED with same-curriculum G6 exemplars rather than cross-curriculum, despite zero G7 StudySync entries in the catalog. Grade-band fallback logic working as designed.",
        "Edit-draft passed all 17 quality checks with zero auto-fixes — first run in the sequence with a draft that needed no intervention. Both Python deterministic validators (<code>verify_objective.py</code>, <code>verify_questions.py</code>) passed clean.",
        "Two manifest gaps remain: <code>skill_versions</code> all resolve to \"unknown\", <code>phase_durations_sec</code> is empty <code>{}</code>. Both are diagnostic-quality, not output-affecting — should be batched into one fix.",
        "Billed via API tokens (logged out of Max OAuth, sourced <code>ANTHROPIC_API_KEY</code>). Auth flip was clean — first time the API-token path has been validated on the post-Phase-2.5 isolation pattern.",
      ],
    },
  };

  function renderAbout() {
    const lid = D.active_lesson_id;
    const blurb = ABOUT_BLURBS[lid] || { intro: "", findings: [] };
    const aboutBody = document.getElementById("about-body");
    let html = `
      <p>${blurb.intro}</p>
      <p>The companion documents are:</p>
      <ul>
        <li><strong>Decomposition Eval Plan</strong> — the framework, three axes, and 2026-04-30 status update at the top</li>
        <li><strong>Testing Execution Log</strong> — phase-by-phase record of every test</li>
      </ul>
      <p>Both live in the personal Google Drive product folder.</p>
      <h3>How to use</h3>
      <ul>
        <li><strong>Lesson tabs (top of page)</strong> — switch between the lessons covered in this dashboard.</li>
        <li><strong>Question Comparison tab</strong> — best place to start. Compare what the module plan asked for vs. what each pipeline version produced, side-by-side or stacked.</li>
        <li><strong>Run Artifacts tab</strong> — every intermediate file the new pipeline produced for this lesson, in chain order. Useful for technical drill-downs.</li>
      </ul>
      <h3>Key findings</h3>
      <ul>
    `;
    blurb.findings.forEach((f) => { html += `<li>${f}</li>`; });
    html += `</ul>`;
    aboutBody.innerHTML = html;
  }

  // ---------- Edit-Draft Checks reference ----------
  function renderChecks() {
    const C = window.CHECKS;
    if (!C) return;
    document.getElementById("checks-intro").innerHTML = C.intro;
    const container = document.getElementById("checks-container");
    container.innerHTML = "";
    C.groups.forEach((g) => {
      const block = document.createElement("details");
      block.className = "checks-group";
      const summary = document.createElement("summary");
      summary.innerHTML = `<strong>${escapeHTML(g.title)}</strong> <span class="check-count">(${g.checks.length} ${g.checks.length === 1 ? "check" : "checks"})</span>`;
      block.appendChild(summary);
      const body = document.createElement("div");
      body.className = "checks-group-body";
      let html = `<p class="checks-blurb">${g.blurb}</p>`;
      g.checks.forEach((c) => {
        html += `<div class="check-card${c.severity === "HIGH" ? " sev-high" : ""}">`;
        html += `<div class="check-head"><span class="check-id">${escapeHTML(c.id)}</span><span class="check-title">${escapeHTML(c.title)}</span>`;
        if (c.severity) html += `<span class="check-sev sev-${c.severity.toLowerCase()}">${escapeHTML(c.severity)}</span>`;
        html += `</div>`;
        html += `<div class="check-desc">${c.desc}</div>`;
        if (c.flags && c.flags.length) {
          html += `<div class="check-row"><span class="check-row-label">Flags:</span><ul class="check-flags">`;
          c.flags.forEach((f) => { html += `<li><code>${escapeHTML(f)}</code></li>`; });
          html += `</ul></div>`;
        }
        if (c.autofix) {
          html += `<div class="check-row"><span class="check-row-label">Auto-fix:</span><span class="check-autofix">${escapeHTML(c.autofix)}</span></div>`;
        }
        if (c.ref) {
          html += `<div class="check-row"><span class="check-row-label">Reference:</span><code>${escapeHTML(c.ref)}</code></div>`;
        }
        html += `</div>`;
      });
      body.innerHTML = html;
      block.appendChild(body);
      container.appendChild(block);
    });
  }

  // ---------- Render dispatch ----------
  function renderLesson() {
    renderHeader();
    renderModulePlanPanel();
    renderReviewSummaryPanel();
    renderComparison();
    renderArtifacts();
    renderAbout();
  }

  // ---------- Init ----------
  attachSubTabHandlers();
  document.getElementById("comparison-mode").addEventListener("change", renderComparison);
  document.getElementById("hide-empty").addEventListener("change", renderComparison);
  if (!D.active_lesson_id || !D.lessons[D.active_lesson_id]) {
    D.active_lesson_id = (D.lesson_order && D.lesson_order[0]) || Object.keys(D.lessons)[0];
  }
  renderLessonTabs();
  renderLesson();
  renderChecks();
})();
