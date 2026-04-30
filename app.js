/* Decomposition Test Review — app.js */

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

  // ---------- Top metadata ----------
  document.getElementById("lesson-title").textContent =
    `${D.meta.curriculum} ${D.meta.grade} — ${D.meta.lesson_title || D.meta.lesson_id}`;
  document.getElementById("meta-line").textContent =
    `${D.meta.lesson_id} · ${D.meta.activity_type} · ${D.meta.standard}`;
  document.getElementById("generated-at").textContent = D.meta.generated_at;

  // ---------- Tab switching ----------
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

  // ---------- Module plan panel ----------
  const mpBody = document.getElementById("module-plan-body");
  const mp = D.module_plan;
  const mpFields = [
    ["Curriculum Objective", mp.row["Curriculum Objective"]],
    ["Anchor Text", mp.row["Anchor Text"]],
    ["Text Segment", mp.row["Text Segment"]],
    ["Activity Type", D.meta.activity_type],
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

  // ---------- Review summary panel ----------
  const rsBody = document.getElementById("review-summary-body");
  rsBody.innerHTML = md(D.versions.v3_review.review_summary_md || "_No review summary available._");

  // ---------- Question comparison ----------
  const v2 = D.versions.v2_original.questions || [];
  const v3 = D.versions.v3_review.questions || [];
  const v4 = D.versions.v4_current.questions || [];
  const moduleDQs = parseModuleDQs(mp.driving_questions_combined || (mp.driving_questions_verbatim + "\n\n" + mp.driving_questions_outline));

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

  const cmpContainer = document.getElementById("comparison-container");

  function renderSideBySide(rows, hideEmpty) {
    let html = `
      <div class="col-headers">
        <div></div>
        <div class="col-header col-v1">${escapeHTML(D.version_labels.v1)}<span class="sub">${escapeHTML(D.version_subtitles.v1)}</span></div>
        <div class="col-header col-v2">${escapeHTML(D.version_labels.v2)}<span class="sub">${escapeHTML(D.version_subtitles.v2)}</span></div>
        <div class="col-header col-v3">${escapeHTML(D.version_labels.v3)}<span class="sub">${escapeHTML(D.version_subtitles.v3)}</span></div>
        <div class="col-header col-v4">${escapeHTML(D.version_labels.v4)}<span class="sub">${escapeHTML(D.version_subtitles.v4)}</span></div>
      </div>`;
    rows.forEach((r) => {
      if (hideEmpty && !r.v1 && !r.v2 && !r.v3 && !r.v4) return;
      html += `<div class="qrow">
        <div class="row-label">Q${r.idx + 1}</div>
        ${cellHtml(r.v1, "v1")}
        ${cellHtml(r.v2, "v2")}
        ${cellHtml(r.v3, "v3")}
        ${cellHtml(r.v4, "v4")}
      </div>`;
    });
    return html;
  }

  function cellHtml(q, vKey) {
    if (!q) {
      return `<div class="qcell empty col-${vKey}">—</div>`;
    }
    if (vKey === "v1") {
      // Module-plan question: simpler shape
      return `<div class="qcell col-${vKey}">
        <div class="qtitle">${escapeHTML(q.title || "")}</div>
        ${q.type ? `<div class="qtype-badge">${escapeHTML(q.type)}</div>` : ""}
        <div class="qstem">${escapeHTML(q.question || "")}</div>
        ${q.criteria ? `<span class="qcrit-label">Criteria</span><div class="qcrit">${escapeHTML(q.criteria)}</div>` : ""}
      </div>`;
    }
    return `<div class="qcell col-${vKey}">
      <div class="qtitle">${escapeHTML(q.title || "")}</div>
      ${q.type ? `<div class="qtype-badge">${escapeHTML(q.type)}</div>` : ""}
      <div class="qstem">${escapeHTML(q.question || "")}</div>
      ${q.criteria ? `<span class="qcrit-label">Criteria</span><div class="qcrit">${escapeHTML(q.criteria)}</div>` : ""}
      ${q.explanation ? `<span class="qcrit-label">Explanation</span><div class="qcrit">${escapeHTML(q.explanation)}</div>` : ""}
      ${q.options_correct ? `<span class="qcrit-label">Correct answer</span><div class="qcrit">${escapeHTML(q.options_correct)}</div>` : ""}
    </div>`;
  }

  function renderStacked(rows, hideEmpty) {
    let html = "";
    rows.forEach((r) => {
      if (hideEmpty && !r.v1 && !r.v2 && !r.v3 && !r.v4) return;
      html += `<div class="stacked-question">
        <h3>Q${r.idx + 1}</h3>
        <div class="stacked-versions">
          ${stackedRow("v1", r.v1)}
          ${stackedRow("v2", r.v2)}
          ${stackedRow("v3", r.v3)}
          ${stackedRow("v4", r.v4)}
        </div>
      </div>`;
    });
    return html;
  }

  function stackedRow(vKey, q) {
    const label = D.version_labels[vKey];
    const subtitle = D.version_subtitles[vKey];
    if (!q) {
      return `<div class="stacked-version ${vKey}">
        <div class="v-label">${escapeHTML(label)}<div class="vsub">${escapeHTML(subtitle)}</div></div>
        <div class="v-content"><span class="empty">— no question at this position —</span></div>
      </div>`;
    }
    let content = "";
    if (q.title) content += `<div class="qtitle">${escapeHTML(q.title)}</div>`;
    if (q.type) content += `<div class="qtype-badge">${escapeHTML(q.type)}</div>`;
    if (q.question) content += `<div class="qstem">${escapeHTML(q.question)}</div>`;
    if (q.criteria) content += `<span class="qcrit-label">Criteria</span><div class="qcrit">${escapeHTML(q.criteria)}</div>`;
    if (q.explanation) content += `<span class="qcrit-label">Explanation</span><div class="qcrit">${escapeHTML(q.explanation)}</div>`;
    if (q.options_correct) content += `<span class="qcrit-label">Correct answer</span><div class="qcrit">${escapeHTML(q.options_correct)}</div>`;
    return `<div class="stacked-version ${vKey}">
      <div class="v-label">${escapeHTML(label)}<div class="vsub">${escapeHTML(subtitle)}</div></div>
      <div class="v-content">${content}</div>
    </div>`;
  }

  function rerender() {
    const mode = document.getElementById("comparison-mode").value;
    const hideEmpty = document.getElementById("hide-empty").checked;
    if (mode === "stacked") {
      cmpContainer.innerHTML = renderStacked(rows, hideEmpty);
    } else {
      cmpContainer.innerHTML = renderSideBySide(rows, hideEmpty);
    }
  }

  document.getElementById("comparison-mode").addEventListener("change", rerender);
  document.getElementById("hide-empty").addEventListener("change", rerender);
  rerender();

  // ---------- Module-plan DQ parser ----------
  // The module plan's "Driving Questions (Verbatim)" or "(Outline)" cell is a
  // semicolon-or-numbered string. Split by enumeration markers.
  function parseModuleDQs(s) {
    if (!s) return [];
    s = s.trim();
    // First try numbered list: "1. ... 2. ... 3. ..."
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
    // Fallback: split by newlines
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

  // ---------- Run artifacts (View 1) ----------
  const artContainer = document.getElementById("artifacts-container");
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
    const content = D.artifacts[fname];
    const isMissing = !content;
    const block = document.createElement("details");
    block.className = "artifact-block" + (isMissing ? " missing" : "");
    const summary = document.createElement("summary");
    summary.innerHTML = `<strong>${escapeHTML(title)}</strong> <span class="hint">— ${escapeHTML(blurb)}</span>`;
    block.appendChild(summary);
    const body = document.createElement("div");
    body.className = "artifact-body";
    if (isMissing) {
      body.innerHTML = `<em style="color:#8a4d00;">This file was not produced by this run. Phase 0 spec says it should be auto-generated; the regression is logged in the testing execution log.</em>`;
    } else if (fname.endsWith(".json")) {
      let pretty;
      try {
        pretty = JSON.stringify(JSON.parse(content), null, 2);
      } catch (e) {
        pretty = content;
      }
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
})();
