/* =========================================================
   GRE Prep PWA
   Hash-based routing, no framework, localStorage persistence
   ========================================================= */

const state = {
  index: null,           // content/index.json
  currentSet: null,      // loaded set JSON
  session: null,         // { answers, marked, i, submitted, awaText }
};

const view = document.getElementById('view');
const topbarActions = document.getElementById('topbar-actions');

/* ---------- Routing ---------- */
window.addEventListener('hashchange', route);
window.addEventListener('load', init);

async function init() {
  try {
    state.index = await fetchJson('index.json');
  } catch (e) {
    view.innerHTML = `<p class="muted">Failed to load content index. Check index.json exists.</p>`;
    return;
  }
  route();
}

function route() {
  const hash = (location.hash || '#/').slice(1);
  const parts = hash.split('/').filter(Boolean);
  const [section, id, extra] = parts;
  topbarActions.innerHTML = '';
  closeCalculator();
  closeNavGrid();

  if (!section) return renderHome();
  if (section === 'set' && id) return renderSetDetail(id);
  if (section === 'test' && id) return renderTest(id);
  if (section === 'review' && id) return renderReview(id);
  if (section === 'awa' && id) return renderAwa(id);
  renderHome();
}

function go(path) { location.hash = path; }

/* ---------- Data ---------- */
async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(url);
  return res.json();
}

async function loadSet(setId) {
  const entry = findSetEntry(setId);
  if (!entry) throw new Error('Set not found');
  return fetchJson(entry.path);
}

function findSetEntry(setId) {
  return [...state.index.verbal, ...state.index.quant, ...state.index.awa]
    .find(s => s.id === setId);
}

/* ---------- Progress ---------- */
function getProgress(setId) {
  try {
    return JSON.parse(localStorage.getItem(`gre.progress.${setId}`)) ||
      { attempts: 0, bestScore: null, lastScore: null, lastDate: null, total: null };
  } catch { return { attempts: 0, bestScore: null, lastScore: null, lastDate: null, total: null }; }
}
function saveProgress(setId, score, total) {
  const p = getProgress(setId);
  p.attempts += 1;
  p.lastScore = score;
  p.total = total;
  p.lastDate = new Date().toISOString();
  if (p.bestScore == null || score > p.bestScore) p.bestScore = score;
  localStorage.setItem(`gre.progress.${setId}`, JSON.stringify(p));
}
function saveAwaText(setId, text) {
  localStorage.setItem(`gre.awa.${setId}`, text);
}
function getAwaText(setId) {
  return localStorage.getItem(`gre.awa.${setId}`) || '';
}

/* ---------- HOME ---------- */
function renderHome() {
  const verbal = state.index.verbal;
  const quant = state.index.quant;
  const awa = state.index.awa;

  const html = `
    <h1>GRE Prep</h1>
    <p class="subtitle">Personal practice. ${verbal.length} verbal · ${quant.length} quant · ${awa.length} AWA.</p>

    <div class="section-heading">Verbal Reasoning</div>
    <div class="set-list">${verbal.map(setCardHtml).join('')}</div>

    <div class="section-heading">Quantitative Reasoning</div>
    <div class="set-list">${quant.map(setCardHtml).join('')}</div>

    <div class="section-heading">Analytical Writing</div>
    <div class="set-list">${awa.map(awaCardHtml).join('')}</div>
  `;
  view.innerHTML = html;
}

function setCardHtml(s) {
  const p = getProgress(s.id);
  const scoreText = p.lastScore != null
    ? `${p.lastScore}/${p.total} · best ${p.bestScore}/${p.total}`
    : '—';
  return `
    <a class="set-card" href="#/set/${s.id}">
      <div>
        <div class="set-card-title">
          ${escapeHtml(s.title)}
          <span class="badge badge-${s.difficulty}">${s.difficulty}</span>
        </div>
        <div class="set-card-meta">${s.questionCount} questions</div>
      </div>
      <div class="set-card-score">${scoreText}</div>
    </a>
  `;
}

function awaCardHtml(s) {
  const text = getAwaText(s.id);
  const hasText = text && text.length > 0;
  return `
    <a class="set-card" href="#/awa/${s.id}">
      <div>
        <div class="set-card-title">${escapeHtml(s.title)}</div>
        <div class="set-card-meta">${hasText ? `${text.trim().split(/\s+/).length} words drafted` : 'Not started'}</div>
      </div>
      <div class="set-card-score">${hasText ? 'Draft saved' : '—'}</div>
    </a>
  `;
}

/* ---------- SET DETAIL ---------- */
async function renderSetDetail(setId) {
  const entry = findSetEntry(setId);
  if (!entry) { view.innerHTML = notFound(); return; }
  const p = getProgress(setId);

  view.innerHTML = `
    <a href="#/" class="btn btn-ghost btn-sm" style="margin-bottom: 20px;">← Back</a>
    <h1 class="set-detail-title">${escapeHtml(entry.title)}</h1>
    <p class="set-detail-meta">
      ${entry.questionCount} questions ·
      <span class="badge badge-${entry.difficulty}">${entry.difficulty}</span>
    </p>

    <div class="stat-row">
      <div class="stat-cell">
        <div class="stat-label">Attempts</div>
        <div class="stat-value">${p.attempts}</div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">Last</div>
        <div class="stat-value">${p.lastScore != null ? p.lastScore : '—'}</div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">Best</div>
        <div class="stat-value">${p.bestScore != null ? p.bestScore : '—'}</div>
      </div>
    </div>

    <div class="spacer-24"></div>

    <div class="set-detail-actions">
      <a class="btn btn-primary btn-lg" href="#/test/${setId}">Start Test Mode</a>
      <a class="btn btn-lg" href="#/review/${setId}">Browse in Review Mode</a>
    </div>

    <p class="muted" style="font-size: 13px;">
      <strong>Test mode:</strong> answers hidden, submit at the end, score saved.<br>
      <strong>Review mode:</strong> answers and explanations visible, no scoring.
    </p>
  `;
}

/* ---------- TEST MODE ---------- */
async function renderTest(setId) {
  try {
    state.currentSet = await loadSet(setId);
  } catch { view.innerHTML = notFound(); return; }

  state.session = {
    answers: {},     // qId -> answer
    marked: new Set(),
    i: 0,
    submitted: false,
  };
  renderTestQuestion();
}

function renderTestQuestion() {
  const s = state.currentSet;
  const sess = state.session;
  const q = s.questions[sess.i];
  const total = s.questions.length;

  topbarActions.innerHTML = `
    <button class="btn btn-sm btn-ghost" onclick="openNavGrid()">Q${sess.i + 1} / ${total}</button>
    ${s.subject === 'quant' ? `<button class="btn btn-sm" onclick="openCalculator()">Calc</button>` : ''}
  `;

  const isMarked = sess.marked.has(q.id);

  view.innerHTML = `
    <div class="test-header">
      <div class="test-progress">Question ${sess.i + 1} of ${total}</div>
      <label class="mark-toggle ${isMarked ? 'active' : ''}">
        <input type="checkbox" ${isMarked ? 'checked' : ''} onchange="toggleMark('${q.id}')">
        <span>Mark for review</span>
      </label>
    </div>

    <div class="question">
      <div class="question-type-label">${typeLabel(q.type)}</div>
      ${renderQuestionBody(q, sess.answers[q.id], 'test')}
    </div>

    <div class="test-nav">
      <button class="btn" onclick="prevQuestion()" ${sess.i === 0 ? 'disabled' : ''}>← Previous</button>
      ${sess.i === total - 1
        ? `<button class="btn btn-primary" onclick="submitTest()">Submit Test</button>`
        : `<button class="btn btn-primary" onclick="nextQuestion()">Next →</button>`
      }
    </div>
  `;
}

function toggleMark(qId) {
  if (state.session.marked.has(qId)) state.session.marked.delete(qId);
  else state.session.marked.add(qId);
}

function nextQuestion() {
  const sess = state.session;
  if (sess.i < state.currentSet.questions.length - 1) {
    sess.i++;
    renderTestQuestion();
    window.scrollTo(0, 0);
  }
}
function prevQuestion() {
  const sess = state.session;
  if (sess.i > 0) {
    sess.i--;
    renderTestQuestion();
    window.scrollTo(0, 0);
  }
}
function jumpTo(i) {
  state.session.i = i;
  closeNavGrid();
  renderTestQuestion();
  window.scrollTo(0, 0);
}

/* ---------- Answer handling ---------- */
function setAnswer(qId, value) {
  state.session.answers[qId] = value;
  // Re-render to show the selection state (only current view)
  renderTestQuestion();
}

function setTcAnswer(qId, blankIndex, value) {
  const existing = state.session.answers[qId] || [];
  const arr = [...existing];
  arr[blankIndex] = value;
  state.session.answers[qId] = arr;
  renderTestQuestion();
}

function toggleMultiAnswer(qId, value) {
  const existing = state.session.answers[qId] || [];
  const set = new Set(existing);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  state.session.answers[qId] = [...set];
  renderTestQuestion();
}

function setNumericAnswer(qId, value) {
  state.session.answers[qId] = value;
  // Don't re-render on every keystroke — just store
}

/* ---------- Submit test ---------- */
function submitTest() {
  const s = state.currentSet;
  const sess = state.session;
  let correct = 0;
  const breakdown = {};

  s.questions.forEach(q => {
    const ans = sess.answers[q.id];
    const isCorrect = checkAnswer(q, ans);
    breakdown[q.type] = breakdown[q.type] || { correct: 0, total: 0 };
    breakdown[q.type].total++;
    if (isCorrect) { correct++; breakdown[q.type].correct++; }
  });

  saveProgress(s.id, correct, s.questions.length);
  renderResults(correct, s.questions.length, breakdown);
}

function checkAnswer(q, ans) {
  if (ans == null) return false;
  const expected = q.answer;

  if (Array.isArray(expected)) {
    if (!Array.isArray(ans)) return false;
    if (ans.length !== expected.length) return false;
    // Compare as sets for multi-answer; as ordered for TC
    if (q.type === 'text_completion') {
      return expected.every((v, i) => ans[i] === v);
    }
    // sentence_equivalence and multiple_answer — order-independent
    const sortedA = [...ans].sort();
    const sortedE = [...expected].sort();
    return sortedA.every((v, i) => v === sortedE[i]);
  }

  if (q.type === 'numeric_entry') {
    const a = parseFloat(String(ans).trim());
    const e = parseFloat(expected);
    if (isNaN(a) || isNaN(e)) return false;
    return Math.abs(a - e) < 1e-9;
  }

  return ans === expected;
}

function renderResults(score, total, breakdown) {
  const pct = Math.round((score / total) * 100);
  const s = state.currentSet;

  const breakdownHtml = Object.entries(breakdown).map(([type, b]) => `
    <div class="breakdown-row">
      <span class="breakdown-label">${typeLabel(type)}</span>
      <span class="breakdown-value">${b.correct}/${b.total}</span>
    </div>
  `).join('');

  topbarActions.innerHTML = '';
  view.innerHTML = `
    <a href="#/" class="btn btn-ghost btn-sm" style="margin-bottom: 20px;">← Home</a>
    <h1>Results</h1>
    <p class="subtitle">${escapeHtml(s.title)}</p>

    <div class="result-score">
      <div class="result-score-value">${score}<span style="font-size:28px;color:var(--ink-faint)">/${total}</span></div>
      <div class="result-score-label">${pct}% correct</div>
    </div>

    <h2>By question type</h2>
    <div class="result-breakdown">${breakdownHtml}</div>

    <div class="btn-row">
      <a class="btn btn-primary" href="#/review/${s.id}">Review Answers</a>
      <a class="btn" href="#/test/${s.id}">Retake</a>
      <a class="btn btn-ghost" href="#/">Done</a>
    </div>
  `;
}

/* ---------- REVIEW MODE ---------- */
async function renderReview(setId) {
  try {
    state.currentSet = await loadSet(setId);
  } catch { view.innerHTML = notFound(); return; }

  state.session = { i: 0, mode: 'review' };
  renderReviewQuestion();
}

function renderReviewQuestion() {
  const s = state.currentSet;
  const sess = state.session;
  const q = s.questions[sess.i];
  const total = s.questions.length;

  topbarActions.innerHTML = `
    <span class="muted" style="font-size:13px;">Review mode</span>
  `;

  view.innerHTML = `
    <div class="test-header">
      <a href="#/set/${s.id}" class="btn btn-ghost btn-sm">← Back</a>
      <div class="test-progress">Question ${sess.i + 1} of ${total}</div>
    </div>

    <div class="question">
      <div class="question-type-label">${typeLabel(q.type)}</div>
      ${renderQuestionBody(q, null, 'review')}
    </div>

    <div class="answer-reveal">
      <div class="answer-label">Answer</div>
      <div class="answer-value">${formatAnswer(q)}</div>
      <div class="explanation">${escapeHtml(q.explanation || '—')}</div>
    </div>

    <div class="test-nav">
      <button class="btn" onclick="prevReview()" ${sess.i === 0 ? 'disabled' : ''}>← Previous</button>
      <button class="btn btn-primary" onclick="nextReview()" ${sess.i === total - 1 ? 'disabled' : ''}>Next →</button>
    </div>
  `;
}
function nextReview() {
  if (state.session.i < state.currentSet.questions.length - 1) {
    state.session.i++;
    renderReviewQuestion();
    window.scrollTo(0, 0);
  }
}
function prevReview() {
  if (state.session.i > 0) {
    state.session.i--;
    renderReviewQuestion();
    window.scrollTo(0, 0);
  }
}

/* ---------- Question body renderer (dispatch by type) ---------- */
function renderQuestionBody(q, userAns, mode) {
  const isReview = mode === 'review';

  switch (q.type) {
    case 'text_completion': return renderTextCompletion(q, userAns, isReview);
    case 'sentence_equivalence': return renderSentenceEquivalence(q, userAns, isReview);
    case 'reading_comprehension': return renderReadingComp(q, userAns, isReview);
    case 'problem_solving': return renderProblemSolving(q, userAns, isReview);
    case 'quantitative_comparison': return renderQuantComp(q, userAns, isReview);
    case 'numeric_entry': return renderNumericEntry(q, userAns, isReview);
    case 'multiple_answer': return renderMultipleAnswer(q, userAns, isReview);
    default: return `<p class="muted">Unsupported question type: ${q.type}</p>`;
  }
}

/* ---- Text Completion ---- */
function renderTextCompletion(q, userAns, isReview) {
  userAns = userAns || [];
  // Replace [[1]], [[2]], [[3]] in passage with blank slots
  const promptHtml = q.prompt.replace(/\[\[(\d+)\]\]/g, (_, n) => {
    const idx = parseInt(n) - 1;
    const filled = userAns[idx];
    if (isReview) {
      return `<span class="blank-slot filled">${escapeHtml(q.answer[idx])}</span>`;
    }
    return `<span class="blank-slot ${filled ? 'filled' : ''}">${filled ? escapeHtml(filled) : `blank ${n}`}</span>`;
  });

  const romanLabels = ['i', 'ii', 'iii'];
  const columns = q.options.map((opts, blankIdx) => {
    const label = q.blanks > 1 ? `Blank (${romanLabels[blankIdx] || (blankIdx + 1)})` : 'Select one';
    return `
      <div class="blank-options-group">
        <div class="blank-options-label">${label}</div>
        <div class="options">
          ${opts.map(opt => {
            const selected = userAns[blankIdx] === opt;
            const correct = isReview && opt === q.answer[blankIdx];
            const incorrect = isReview && selected && opt !== q.answer[blankIdx];
            const classes = ['option'];
            if (selected && !isReview) classes.push('selected');
            if (correct) classes.push('correct');
            if (incorrect) classes.push('incorrect');
            return `
              <div class="${classes.join(' ')}" ${!isReview ? `onclick="setTcAnswer('${q.id}', ${blankIdx}, ${JSON.stringify(opt).replace(/"/g, '&quot;')})"` : ''}>
                <div class="option-marker">${selected || correct ? '✓' : ''}</div>
                <div class="option-text">${escapeHtml(opt)}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="prompt prompt-tc">${promptHtml}</div>
    ${columns}
  `;
}

/* ---- Sentence Equivalence ---- */
function renderSentenceEquivalence(q, userAns, isReview) {
  userAns = userAns || [];
  const promptHtml = q.prompt.replace(/\[\[1\]\]/g, () => {
    if (isReview) return `<span class="blank-slot filled">${escapeHtml(q.answer.join(' / '))}</span>`;
    const label = userAns.length === 2 ? userAns.join(' / ') : (userAns.length === 1 ? `${userAns[0]} / ?` : 'blank');
    return `<span class="blank-slot ${userAns.length ? 'filled' : ''}">${escapeHtml(label)}</span>`;
  });

  const opts = q.options.map(opt => {
    const selected = userAns.includes(opt);
    const correct = isReview && q.answer.includes(opt);
    const incorrect = isReview && selected && !q.answer.includes(opt);
    const classes = ['option'];
    if (selected && !isReview) classes.push('selected');
    if (correct) classes.push('correct');
    if (incorrect) classes.push('incorrect');
    return `
      <div class="${classes.join(' ')}" ${!isReview ? `onclick="toggleMultiAnswer('${q.id}', ${JSON.stringify(opt).replace(/"/g, '&quot;')})"` : ''}>
        <div class="option-marker option-checkbox">${selected || correct ? '✓' : ''}</div>
        <div class="option-text">${escapeHtml(opt)}</div>
      </div>
    `;
  }).join('');

  return `
    <div class="prompt prompt-tc">${promptHtml}</div>
    <p class="muted" style="font-size:13px; margin-bottom:10px;">Select exactly two words that produce sentences with equivalent meaning.</p>
    <div class="options">${opts}</div>
  `;
}

/* ---- Reading Comprehension ---- */
function renderReadingComp(q, userAns, isReview) {
  const passageHtml = q.passage
    .split(/\n\s*\n/)
    .map(p => `<p>${escapeHtml(p)}</p>`)
    .join('');

  const opts = renderRadioOptions(q, userAns, isReview);
  return `
    <div class="passage">${passageHtml}</div>
    <div class="prompt">${escapeHtml(q.prompt)}</div>
    <div class="options">${opts}</div>
  `;
}

/* ---- Problem Solving (single-answer multiple choice) ---- */
function renderProblemSolving(q, userAns, isReview) {
  const opts = renderRadioOptions(q, userAns, isReview);
  return `
    <div class="prompt">${escapeHtml(q.prompt)}</div>
    <div class="options">${opts}</div>
  `;
}

/* ---- Quantitative Comparison ---- */
function renderQuantComp(q, userAns, isReview) {
  // Fixed options
  const options = [
    'Quantity A is greater.',
    'Quantity B is greater.',
    'The two quantities are equal.',
    'The relationship cannot be determined from the information given.',
  ];
  const qWithOpts = { ...q, options };
  const opts = renderRadioOptions(qWithOpts, userAns, isReview);
  return `
    <div class="prompt">${escapeHtml(q.prompt || '')}</div>
    <div class="passage" style="border-left-color: var(--ink); font-family: var(--font-ui); font-variation-settings: normal;">
      <div><strong>Quantity A:</strong> ${escapeHtml(q.quantityA)}</div>
      <div style="margin-top: 6px;"><strong>Quantity B:</strong> ${escapeHtml(q.quantityB)}</div>
    </div>
    <div class="options">${opts}</div>
  `;
}

/* ---- Numeric Entry ---- */
function renderNumericEntry(q, userAns, isReview) {
  if (isReview) {
    return `
      <div class="prompt">${escapeHtml(q.prompt)}</div>
      <div class="numeric-entry">
        <input type="text" value="${escapeHtml(String(q.answer))}" disabled />
        <span class="muted">${q.unit || ''}</span>
      </div>
    `;
  }
  return `
    <div class="prompt">${escapeHtml(q.prompt)}</div>
    <div class="numeric-entry">
      <input
        type="text"
        inputmode="decimal"
        value="${userAns != null ? escapeHtml(String(userAns)) : ''}"
        placeholder="Enter number"
        oninput="setNumericAnswer('${q.id}', this.value)"
      />
      <span class="muted">${q.unit || ''}</span>
    </div>
  `;
}

/* ---- Multiple Answer ---- */
function renderMultipleAnswer(q, userAns, isReview) {
  userAns = userAns || [];
  const opts = q.options.map(opt => {
    const selected = userAns.includes(opt);
    const correct = isReview && q.answer.includes(opt);
    const incorrect = isReview && selected && !q.answer.includes(opt);
    const classes = ['option'];
    if (selected && !isReview) classes.push('selected');
    if (correct) classes.push('correct');
    if (incorrect) classes.push('incorrect');
    return `
      <div class="${classes.join(' ')}" ${!isReview ? `onclick="toggleMultiAnswer('${q.id}', ${JSON.stringify(opt).replace(/"/g, '&quot;')})"` : ''}>
        <div class="option-marker option-checkbox">${selected || correct ? '✓' : ''}</div>
        <div class="option-text">${escapeHtml(opt)}</div>
      </div>
    `;
  }).join('');

  return `
    <div class="prompt">${escapeHtml(q.prompt)}</div>
    <p class="muted" style="font-size:13px; margin-bottom:10px;">Select all that apply.</p>
    <div class="options">${opts}</div>
  `;
}

/* ---- Shared: single-select radio options ---- */
function renderRadioOptions(q, userAns, isReview) {
  return q.options.map((opt, i) => {
    const selected = userAns === opt;
    const correct = isReview && opt === q.answer;
    const incorrect = isReview && selected && opt !== q.answer;
    const classes = ['option'];
    if (selected && !isReview) classes.push('selected');
    if (correct) classes.push('correct');
    if (incorrect) classes.push('incorrect');
    const letter = String.fromCharCode(65 + i);
    return `
      <div class="${classes.join(' ')}" ${!isReview ? `onclick="setAnswer('${q.id}', ${JSON.stringify(opt).replace(/"/g, '&quot;')})"` : ''}>
        <div class="option-marker">${letter}</div>
        <div class="option-text">${escapeHtml(opt)}</div>
      </div>
    `;
  }).join('');
}

/* ---------- AWA ---------- */
async function renderAwa(setId) {
  const entry = findSetEntry(setId);
  if (!entry) { view.innerHTML = notFound(); return; }
  const awa = await fetchJson(entry.path);
  const saved = getAwaText(setId);

  topbarActions.innerHTML = '';
  view.innerHTML = `
    <a href="#/" class="btn btn-ghost btn-sm" style="margin-bottom: 20px;">← Back</a>
    <h1>${escapeHtml(awa.title)}</h1>
    <p class="subtitle">Analyze an Issue</p>

    <div class="awa-prompt">${escapeHtml(awa.prompt)}</div>

    <div class="awa-instructions">${escapeHtml(awa.instructions || 'Write a response discussing the extent to which you agree or disagree with the statement. Support your position with reasons and examples.')}</div>

    <textarea
      class="awa-textarea"
      id="awa-text"
      placeholder="Start writing your response here..."
      oninput="onAwaInput('${setId}')"
    >${escapeHtml(saved)}</textarea>
    <div class="awa-wordcount" id="awa-wc">${wordCount(saved)} words</div>

    <div class="btn-row" style="margin-top: 18px;">
      <button class="btn" onclick="toggleModelEssay(this)">Show Model Essay</button>
      <button class="btn btn-ghost" onclick="clearAwa('${setId}')">Clear Draft</button>
    </div>

    <div id="awa-model" class="awa-model hidden">
      <h3>Model Essay</h3>
      ${(awa.modelEssay || 'No model essay provided.').split(/\n\s*\n/).map(p => `<p>${escapeHtml(p)}</p>`).join('')}
      ${awa.rubricNotes ? `<h3 style="margin-top:16px;">What a 6/6 response does</h3><p>${escapeHtml(awa.rubricNotes)}</p>` : ''}
    </div>
  `;
}

function onAwaInput(setId) {
  const ta = document.getElementById('awa-text');
  saveAwaText(setId, ta.value);
  document.getElementById('awa-wc').textContent = `${wordCount(ta.value)} words`;
}
function clearAwa(setId) {
  if (!confirm('Clear this draft?')) return;
  localStorage.removeItem(`gre.awa.${setId}`);
  document.getElementById('awa-text').value = '';
  document.getElementById('awa-wc').textContent = '0 words';
}
function toggleModelEssay(btn) {
  const el = document.getElementById('awa-model');
  el.classList.toggle('hidden');
  btn.textContent = el.classList.contains('hidden') ? 'Show Model Essay' : 'Hide Model Essay';
}
function wordCount(t) {
  return t.trim() === '' ? 0 : t.trim().split(/\s+/).length;
}

/* ---------- Nav grid overlay ---------- */
function openNavGrid() {
  const el = document.getElementById('nav-grid');
  const s = state.currentSet;
  const sess = state.session;
  el.innerHTML = `
    <div class="nav-grid-panel">
      <div class="nav-grid-title">Jump to question</div>
      <div class="nav-grid-buttons">
        ${s.questions.map((q, i) => {
          const answered = sess.answers[q.id] != null &&
            !(Array.isArray(sess.answers[q.id]) && sess.answers[q.id].length === 0);
          const marked = sess.marked.has(q.id);
          const current = i === sess.i;
          const classes = ['nav-num'];
          if (answered) classes.push('answered');
          if (marked) classes.push('marked');
          if (current) classes.push('current');
          return `<button class="${classes.join(' ')}" onclick="jumpTo(${i})">${i + 1}</button>`;
        }).join('')}
      </div>
      <div class="nav-legend">
        <span class="legend-item"><span class="legend-swatch answered"></span> Answered</span>
        <span class="legend-item"><span class="legend-swatch marked"></span> Marked</span>
      </div>
      <div style="margin-top: 16px; display: flex; justify-content: flex-end;">
        <button class="btn btn-sm" onclick="closeNavGrid()">Close</button>
      </div>
    </div>
  `;
  el.classList.remove('hidden');
  el.onclick = (e) => { if (e.target === el) closeNavGrid(); };
}
function closeNavGrid() {
  document.getElementById('nav-grid').classList.add('hidden');
}

/* ---------- Calculator ---------- */
const calc = {
  display: '0',
  prev: null,
  op: null,
  justEvaluated: false,
  memory: 0,
};

function openCalculator() {
  const el = document.getElementById('calculator');
  el.innerHTML = `
    <div class="calc-header">
      <span>Calculator</span>
      <button class="btn-ghost btn-sm" style="padding:2px 6px;" onclick="closeCalculator()">✕</button>
    </div>
    <div class="calc-display" id="calc-display">${calc.display}</div>
    <div class="calc-grid">
      <button class="calc-btn mem" onclick="calcMem('MC')">MC</button>
      <button class="calc-btn mem" onclick="calcMem('MR')">MR</button>
      <button class="calc-btn mem" onclick="calcMem('MS')">MS</button>
      <button class="calc-btn mem" onclick="calcMem('M+')">M+</button>

      <button class="calc-btn op" onclick="calcInput('C')">C</button>
      <button class="calc-btn op" onclick="calcInput('CE')">CE</button>
      <button class="calc-btn op" onclick="calcInput('±')">±</button>
      <button class="calc-btn op" onclick="calcInput('√')">√</button>

      <button class="calc-btn" onclick="calcInput('7')">7</button>
      <button class="calc-btn" onclick="calcInput('8')">8</button>
      <button class="calc-btn" onclick="calcInput('9')">9</button>
      <button class="calc-btn op" onclick="calcInput('÷')">÷</button>

      <button class="calc-btn" onclick="calcInput('4')">4</button>
      <button class="calc-btn" onclick="calcInput('5')">5</button>
      <button class="calc-btn" onclick="calcInput('6')">6</button>
      <button class="calc-btn op" onclick="calcInput('×')">×</button>

      <button class="calc-btn" onclick="calcInput('1')">1</button>
      <button class="calc-btn" onclick="calcInput('2')">2</button>
      <button class="calc-btn" onclick="calcInput('3')">3</button>
      <button class="calc-btn op" onclick="calcInput('−')">−</button>

      <button class="calc-btn" onclick="calcInput('0')">0</button>
      <button class="calc-btn" onclick="calcInput('.')">.</button>
      <button class="calc-btn eq" onclick="calcInput('=')">=</button>
      <button class="calc-btn op" onclick="calcInput('+')">+</button>
    </div>
  `;
  el.classList.remove('hidden');
}
function closeCalculator() {
  document.getElementById('calculator').classList.add('hidden');
}

function calcInput(key) {
  const isDigit = /^[0-9]$/.test(key);
  if (isDigit) {
    if (calc.display === '0' || calc.justEvaluated) calc.display = key;
    else if (calc.display.length < 14) calc.display += key;
    calc.justEvaluated = false;
  } else if (key === '.') {
    if (calc.justEvaluated) { calc.display = '0.'; calc.justEvaluated = false; }
    else if (!calc.display.includes('.')) calc.display += '.';
  } else if (['+', '−', '×', '÷'].includes(key)) {
    if (calc.op && !calc.justEvaluated) calcEvaluate();
    calc.prev = parseFloat(calc.display);
    calc.op = key;
    calc.justEvaluated = true;
  } else if (key === '=') {
    calcEvaluate();
    calc.op = null;
  } else if (key === 'C') {
    calc.display = '0'; calc.prev = null; calc.op = null; calc.justEvaluated = false;
  } else if (key === 'CE') {
    calc.display = '0'; calc.justEvaluated = false;
  } else if (key === '±') {
    if (calc.display !== '0') {
      calc.display = calc.display.startsWith('-') ? calc.display.slice(1) : '-' + calc.display;
    }
  } else if (key === '√') {
    const v = parseFloat(calc.display);
    if (v >= 0) {
      calc.display = formatCalcNum(Math.sqrt(v));
      calc.justEvaluated = true;
    } else calc.display = 'Error';
  }
  document.getElementById('calc-display').textContent = calc.display;
}

function calcEvaluate() {
  if (calc.op == null || calc.prev == null) return;
  const cur = parseFloat(calc.display);
  let result;
  switch (calc.op) {
    case '+': result = calc.prev + cur; break;
    case '−': result = calc.prev - cur; break;
    case '×': result = calc.prev * cur; break;
    case '÷': result = cur === 0 ? NaN : calc.prev / cur; break;
  }
  calc.display = isNaN(result) ? 'Error' : formatCalcNum(result);
  calc.prev = null;
  calc.justEvaluated = true;
  document.getElementById('calc-display').textContent = calc.display;
}

function calcMem(op) {
  const v = parseFloat(calc.display) || 0;
  if (op === 'MC') calc.memory = 0;
  else if (op === 'MR') { calc.display = formatCalcNum(calc.memory); calc.justEvaluated = true; }
  else if (op === 'MS') calc.memory = v;
  else if (op === 'M+') calc.memory += v;
  document.getElementById('calc-display').textContent = calc.display;
}

function formatCalcNum(n) {
  if (!isFinite(n)) return 'Error';
  const s = String(n);
  if (s.length <= 14) return s;
  return n.toPrecision(10);
}

/* ---------- Helpers ---------- */
function typeLabel(type) {
  return {
    text_completion: 'Text Completion',
    sentence_equivalence: 'Sentence Equivalence',
    reading_comprehension: 'Reading Comprehension',
    problem_solving: 'Problem Solving',
    quantitative_comparison: 'Quantitative Comparison',
    numeric_entry: 'Numeric Entry',
    multiple_answer: 'Multiple Answer',
  }[type] || type;
}

function formatAnswer(q) {
  if (Array.isArray(q.answer)) return q.answer.join(' · ');
  return String(q.answer);
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function notFound() {
  return `<p class="muted">Not found. <a href="#/">Back to home</a></p>`;
}

/* Expose needed functions to inline handlers */
window.setAnswer = setAnswer;
window.setTcAnswer = setTcAnswer;
window.toggleMultiAnswer = toggleMultiAnswer;
window.setNumericAnswer = setNumericAnswer;
window.toggleMark = toggleMark;
window.nextQuestion = nextQuestion;
window.prevQuestion = prevQuestion;
window.jumpTo = jumpTo;
window.submitTest = submitTest;
window.nextReview = nextReview;
window.prevReview = prevReview;
window.openNavGrid = openNavGrid;
window.closeNavGrid = closeNavGrid;
window.openCalculator = openCalculator;
window.closeCalculator = closeCalculator;
window.calcInput = calcInput;
window.calcMem = calcMem;
window.onAwaInput = onAwaInput;
window.clearAwa = clearAwa;
window.toggleModelEssay = toggleModelEssay;
