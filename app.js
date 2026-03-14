// ══════════════════════════════════════════
//  QuizArena — app.js
//  Comunicação via localStorage (funciona
//  entre abas do mesmo navegador/domínio)
// ══════════════════════════════════════════

const TIMER_SEC = 20;
const SHAPES = ['▲', '●', '■', '◆'];
const STOR_KEY = 'quizarena_rooms_v2';

// ── ESTADO LOCAL ──
let S = {
  quizzes: loadQuizzes(),
  editQs: [], editIdx: -1,
  code: '', name: '', role: '',
  score: 0, answered: false,
  timerLeft: TIMER_SEC, timerIv: null,
  lastQ: -1, pollIv: null,
  currentQuizIdx: 0
};

// ── PERSISTÊNCIA DE QUIZZES ──
function loadQuizzes() {
  try {
    const saved = JSON.parse(localStorage.getItem('quizarena_quizzes') || 'null');
    if (saved && saved.length) return saved;
  } catch(e) {}
  return [{
    title: 'Quiz de Exemplo',
    questions: [
      { text: 'Qual é a capital do Brasil?', options: ['São Paulo', 'Rio de Janeiro', 'Brasília', 'Belo Horizonte'], correct: 2 },
      { text: 'Quantos estados tem o Brasil?', options: ['25', '26', '27', '28'], correct: 1 },
      { text: 'Qual é a maior floresta tropical do mundo?', options: ['Congo', 'Daintree', 'Amazônia', 'Borneo'], correct: 2 }
    ]
  }];
}

function saveQuizzes() {
  try { localStorage.setItem('quizarena_quizzes', JSON.stringify(S.quizzes)); } catch(e) {}
}

// ── STORAGE DE SALAS (compartilhado entre abas) ──
function getRooms() {
  try { return JSON.parse(localStorage.getItem(STOR_KEY) || '{}'); } catch(e) { return {}; }
}
function setRooms(rooms) {
  try { localStorage.setItem(STOR_KEY, JSON.stringify(rooms)); } catch(e) {}
}
function getRoom(code) { return getRooms()[code] || null; }
function setRoom(code, data) {
  const rooms = getRooms();
  rooms[code] = { ...data, _ts: Date.now() };
  setRooms(rooms);
}
function delRoom(code) {
  const rooms = getRooms();
  delete rooms[code];
  setRooms(rooms);
}

// ── UTIL ──
function notify(msg, type = 'ok') {
  const n = document.getElementById('notif');
  n.textContent = msg;
  n.className = type;
  n.style.display = 'block';
  clearTimeout(n._t);
  n._t = setTimeout(() => n.style.display = 'none', 2800);
}

function go(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (id === 'dashboard') renderDash();
}

function stopPoll() { clearInterval(S.pollIv); S.pollIv = null; }
function stopTimer() { clearInterval(S.timerIv); S.timerIv = null; }
function genCode() { return Math.random().toString(36).substr(2, 6).toUpperCase(); }

// ── ADMIN LOGIN ──
function adminLogin() {
  const u = document.getElementById('au').value;
  const p = document.getElementById('ap').value;
  if (u === 'admin' && p === '1234') {
    S.role = 'admin';
    go('dashboard');
    notify('Bem-vindo, admin!');
  } else {
    notify('Credenciais inválidas', 'err');
  }
}

// ── DASHBOARD ──
function renderDash() {
  const el = document.getElementById('qlist');
  if (!S.quizzes.length) {
    el.innerHTML = `<div style="text-align:center;padding:2.5rem;color:var(--muted)">
      <div style="font-size:2.5rem;margin-bottom:.6rem">📝</div>
      <p>Nenhum quiz ainda. Clique em "+ Novo Quiz"!</p>
    </div>`;
    return;
  }
  el.innerHTML = S.quizzes.map((q, i) => `
    <div class="card" style="margin-bottom:.65rem;display:flex;align-items:center;gap:.7rem;flex-wrap:wrap">
      <div style="flex:1;min-width:110px">
        <p class="bold" style="margin-bottom:.1rem">${esc(q.title) || 'Sem título'}</p>
        <p class="muted small">${q.questions.length} pergunta(s)</p>
      </div>
      <div class="row gap" style="flex-wrap:wrap">
        <button class="btn btn-s" style="padding:.42rem .75rem;font-size:.8rem" onclick="editQuiz(${i})">✏️ Editar</button>
        <button class="btn btn-g" style="padding:.42rem .75rem;font-size:.8rem" onclick="openLobby(${i})">▶ Sala</button>
        <button class="btn btn-d" style="padding:.42rem .75rem;font-size:.8rem" onclick="delQuiz(${i})">🗑</button>
      </div>
    </div>`).join('');
}

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── EDITOR ──
function newQuiz() {
  S.editIdx = -1;
  document.getElementById('qt').value = '';
  S.editQs = [];
  renderQEditor();
  go('editor');
}

function editQuiz(i) {
  S.editIdx = i;
  document.getElementById('qt').value = S.quizzes[i].title;
  S.editQs = JSON.parse(JSON.stringify(S.quizzes[i].questions));
  renderQEditor();
  go('editor');
}

function delQuiz(i) {
  if (!confirm(`Deletar "${S.quizzes[i].title}"?`)) return;
  S.quizzes.splice(i, 1);
  saveQuizzes();
  renderDash();
  notify('Quiz removido', 'err');
}

function addQ() {
  S.editQs.push({ text: '', options: ['', '', '', ''], correct: 0 });
  renderQEditor();
}

function remQ(i) {
  S.editQs.splice(i, 1);
  renderQEditor();
}

function setCorr(qi, li) {
  S.editQs[qi].correct = li;
  renderQEditor();
}

function renderQEditor() {
  const el = document.getElementById('ql');
  if (!S.editQs.length) {
    el.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--muted)">Adicione perguntas abaixo</div>';
    return;
  }
  const L = ['A', 'B', 'C', 'D'];
  const CL = ['oa', 'ob', 'oc', 'od'];
  el.innerHTML = S.editQs.map((q, qi) => `
    <div class="qi">
      <div class="row gap" style="margin-bottom:.55rem">
        <div class="q-num">${qi + 1}</div>
        <input value="${esc(q.text)}" placeholder="Pergunta..." oninput="S.editQs[${qi}].text=this.value" style="flex:1">
        <button class="del-btn" onclick="remQ(${qi})">✕</button>
      </div>
      ${q.options.map((o, oi) => `
        <div class="oil">
          <div class="ol ${CL[oi]}">${L[oi]}</div>
          <input value="${esc(o)}" placeholder="Opção ${L[oi]}..." oninput="S.editQs[${qi}].options[${oi}]=this.value" style="flex:1">
        </div>`).join('')}
      <div style="margin-top:.55rem">
        <p class="muted small" style="margin-bottom:.32rem">Resposta correta:</p>
        <div class="row gap">
          ${L.map((l, li) => `<button class="cb ${q.correct === li ? 'active' : ''}" onclick="setCorr(${qi},${li})">${l}</button>`).join('')}
        </div>
      </div>
    </div>`).join('');
}

function saveQuiz() {
  const title = document.getElementById('qt').value.trim();
  if (!title) return notify('Dê um título ao quiz', 'err');
  if (!S.editQs.length) return notify('Adicione pelo menos uma pergunta', 'err');
  for (const q of S.editQs) {
    if (!q.text.trim()) return notify('Preencha todas as perguntas', 'err');
    if (q.options.some(o => !o.trim())) return notify('Preencha todas as opções', 'err');
  }
  const quiz = { title, questions: JSON.parse(JSON.stringify(S.editQs)) };
  if (S.editIdx >= 0) S.quizzes[S.editIdx] = quiz;
  else S.quizzes.push(quiz);
  saveQuizzes();
  notify('Quiz salvo com sucesso!');
  go('dashboard');
}

// ── LOBBY HOST ──
function openLobby(i) {
  if (!S.quizzes[i].questions.length) return notify('Adicione perguntas primeiro', 'err');
  const code = genCode();
  S.code = code;
  S.currentQuizIdx = i;
  const room = {
    quiz: S.quizzes[i],
    players: {},
    started: false,
    qIdx: 0,
    answers: {},
    phase: 'lobby',
    revealCorrect: -1,
    done: false
  };
  setRoom(code, room);
  document.getElementById('lcode').textContent = code;
  document.getElementById('lcount').textContent = '0';
  document.getElementById('lplayers').innerHTML = '';
  go('lobby');
  startLobbyPoll();
}

function startLobbyPoll() {
  stopPoll();
  S.pollIv = setInterval(() => {
    const r = getRoom(S.code);
    if (!r) return;
    const names = Object.keys(r.players);
    document.getElementById('lcount').textContent = names.length;
    document.getElementById('lplayers').innerHTML = names.map(n => `<span class="chip">${esc(n)}</span>`).join('');
  }, 800);
}

function cancelRoom() {
  stopPoll();
  delRoom(S.code);
  go('dashboard');
}

function startGame() {
  const r = getRoom(S.code);
  if (!r) return notify('Sala não encontrada', 'err');
  if (!Object.keys(r.players).length) return notify('Aguarde pelo menos 1 jogador', 'err');
  stopPoll();
  r.started = true;
  r.qIdx = 0;
  r.phase = 'question';
  r.answers = {};
  r.revealCorrect = -1;
  setRoom(S.code, r);
  go('game-host');
  renderHostQ();
}

// ── HOST: PERGUNTA ──
function renderHostQ() {
  stopTimer();
  const r = getRoom(S.code);
  if (!r) return;
  const q = r.quiz.questions[r.qIdx];
  const tot = r.quiz.questions.length;
  r.answers = {};
  r.phase = 'question';
  r.revealCorrect = -1;
  setRoom(S.code, r);
  document.getElementById('ghn').textContent = `${r.qIdx + 1}/${tot}`;
  document.getElementById('ghans').textContent = '0 respostas';
  document.getElementById('ghq').textContent = q.text;
  document.getElementById('ghprog').style.width = ((r.qIdx / tot) * 100) + '%';
  document.getElementById('ghreveal').style.display = 'none';
  document.getElementById('ghopts').innerHTML = q.options.map((o, i) =>
    `<button class="abt a${i}" disabled><span>${SHAPES[i]}</span><span>${esc(o)}</span></button>`
  ).join('');
  startTimer('ghring', 'ghtimer', () => doReveal());
  startAnswerPoll();
}

function startAnswerPoll() {
  stopPoll();
  S.pollIv = setInterval(() => {
    const r = getRoom(S.code);
    if (!r) return;
    const ansCount = Object.keys(r.answers).length;
    const playerCount = Object.keys(r.players).length;
    document.getElementById('ghans').textContent = `${ansCount}/${playerCount} respostas`;
    if (playerCount > 0 && ansCount >= playerCount) {
      stopTimer();
      stopPoll();
      doReveal();
    }
  }, 600);
}

function doReveal() {
  stopTimer();
  stopPoll();
  const r = getRoom(S.code);
  if (!r || r.phase === 'reveal') return;
  const q = r.quiz.questions[r.qIdx];
  const correct = q.correct;
  // Calcular pontuações
  Object.keys(r.players).forEach(name => {
    if (!r.players[name].score) r.players[name].score = 0;
    const a = r.answers[name];
    if (a !== undefined && a.choice === correct) {
      r.players[name].score += 500 + Math.floor((a.time / TIMER_SEC) * 500);
    }
  });
  r.phase = 'reveal';
  r.revealCorrect = correct;
  setRoom(S.code, r);
  // UI
  const btns = document.getElementById('ghopts').children;
  for (let i = 0; i < btns.length; i++) {
    btns[i].classList.add(i === correct ? 'correct' : 'wrong');
  }
  const sorted = Object.entries(r.players).sort((a, b) => b[1].score - a[1].score).slice(0, 5);
  document.getElementById('ghrank').innerHTML = sorted.map(([n, d], i) =>
    `<div class="rr">
      <div class="med ${['m1','m2','m3'][i] || 'mn'}">${i + 1}</div>
      <span style="flex:1;font-weight:600">${esc(n)}</span>
      <span style="color:var(--c3);font-weight:700">${d.score}</span>
    </div>`
  ).join('');
  document.getElementById('ghreveal').style.display = 'block';
  const isLast = r.qIdx >= r.quiz.questions.length - 1;
  document.getElementById('ghnext').textContent = isLast ? '🏆 Ver Resultados' : 'Próxima →';
}

function nextQ() {
  const r = getRoom(S.code);
  if (!r) return;
  r.qIdx++;
  if (r.qIdx >= r.quiz.questions.length) {
    r.phase = 'done';
    r.done = true;
    setRoom(S.code, r);
    renderFinal();
    return;
  }
  r.phase = 'question';
  r.answers = {};
  r.revealCorrect = -1;
  setRoom(S.code, r);
  renderHostQ();
}

function renderFinal() {
  const r = getRoom(S.code);
  if (!r) return;
  const sorted = Object.entries(r.players).sort((a, b) => b[1].score - a[1].score);
  buildPodium(sorted, 'finpod');
  document.getElementById('finrank').innerHTML = sorted.map(([n, d], i) =>
    `<div class="rr">
      <div class="med ${['m1','m2','m3'][i] || 'mn'}">${i + 1}</div>
      <span style="flex:1;font-weight:600">${esc(n)}</span>
      <span style="color:var(--c3);font-weight:700">${d.score} pts</span>
    </div>`
  ).join('');
  if (sorted.length) {
    document.getElementById('finwinner').style.display = 'block';
    document.getElementById('finwname').textContent = '🥇 ' + sorted[0][0];
  }
  go('final');
}

function replayRoom() { openLobby(S.currentQuizIdx); }

// ── PLAYER: ENTRAR ──
function joinRoom() {
  const name = document.getElementById('pname').value.trim();
  const code = document.getElementById('pcode').value.trim().toUpperCase();
  if (!name) return notify('Digite seu nome', 'err');
  if (code.length < 4) return notify('Código muito curto', 'err');
  const r = getRoom(code);
  if (!r) {
    notify(`Sala "${code}" não encontrada. Verifique o código.`, 'err');
    return;
  }
  if (r.started) return notify('Quiz já iniciado. Aguarde a próxima rodada.', 'err');
  if (r.players[name]) return notify('Nome já em uso. Escolha outro.', 'err');
  r.players[name] = { score: 0 };
  setRoom(code, r);
  S.name = name;
  S.code = code;
  S.score = 0;
  S.answered = false;
  S.lastQ = -1;
  document.getElementById('wname').textContent = name;
  document.getElementById('wcode').textContent = code;
  go('waiting');
  startWaitPoll();
}

function startWaitPoll() {
  stopPoll();
  S.pollIv = setInterval(() => {
    const r = getRoom(S.code);
    if (!r) return;
    if (r.started && r.phase === 'question' && r.qIdx !== S.lastQ) {
      stopPoll();
      renderPlayerQ(r);
    }
  }, 600);
}

// ── PLAYER: PERGUNTA ──
function renderPlayerQ(r) {
  const qIdx = r.qIdx;
  S.lastQ = qIdx;
  S.answered = false;
  const q = r.quiz.questions[qIdx];
  const tot = r.quiz.questions.length;
  document.getElementById('plqn').textContent = `${qIdx + 1}/${tot}`;
  document.getElementById('plqnum').textContent = `Pergunta ${qIdx + 1} de ${tot}`;
  document.getElementById('plq').textContent = q.text;
  document.getElementById('plprog').style.width = ((qIdx / tot) * 100) + '%';
  document.getElementById('plpts').textContent = S.score + ' pts';
  document.getElementById('plfb').style.display = 'none';
  document.getElementById('plopts').innerHTML = q.options.map((o, i) =>
    `<button class="abt a${i}" onclick="playerAns(${i},${qIdx})"><span>${SHAPES[i]}</span><span>${esc(o)}</span></button>`
  ).join('');
  go('playing');
  startTimer('plring', 'pltimer', () => playerTimeout(qIdx));
  startRevealPoll(qIdx);
}

function playerAns(choice, qIdx) {
  if (S.answered) return;
  S.answered = true;
  stopTimer();
  const r = getRoom(S.code);
  if (!r) return;
  if (!r.answers) r.answers = {};
  r.answers[S.name] = { choice, time: S.timerLeft };
  setRoom(S.code, r);
  // Marcar botão escolhido
  const btns = document.getElementById('plopts').children;
  if (btns[choice]) btns[choice].classList.add('chosen');
  for (let i = 0; i < btns.length; i++) btns[i].disabled = true;
  startRevealPoll(qIdx);
}

function playerTimeout(qIdx) {
  if (S.answered) return;
  S.answered = true;
  const r = getRoom(S.code);
  if (r) {
    if (!r.answers) r.answers = {};
    r.answers[S.name] = { choice: -1, time: 0 };
    setRoom(S.code, r);
  }
  startRevealPoll(qIdx);
}

function startRevealPoll(qIdx) {
  stopPoll();
  S.pollIv = setInterval(() => {
    const r = getRoom(S.code);
    if (!r) return;
    if (r.done) { stopPoll(); showPlayerFinal(r); return; }
    if (r.phase === 'reveal' && r.qIdx === qIdx) { stopPoll(); showFeedback(r, qIdx); }
  }, 600);
}

function showFeedback(r, qIdx) {
  stopTimer();
  const q = r.quiz.questions[qIdx];
  const correct = q.correct;
  const a = r.answers ? r.answers[S.name] : undefined;
  const ok = a !== undefined && a.choice === correct;
  const pts = ok ? 500 + Math.floor((a.time / TIMER_SEC) * 500) : 0;
  S.score += pts;
  const btns = document.getElementById('plopts').children;
  for (let i = 0; i < btns.length; i++) {
    btns[i].disabled = true;
    if (i === correct) btns[i].classList.add('correct');
    else if (a && a.choice === i) btns[i].classList.add('wrong');
  }
  document.getElementById('plfb').style.display = 'block';
  document.getElementById('plicon').textContent = ok ? '✅' : '❌';
  document.getElementById('pltxt').textContent = ok ? 'Correto!' : 'Errado!';
  document.getElementById('plptsadd').textContent = ok ? `+${pts} pontos` : 'Sem pontos desta vez';
  document.getElementById('plpts').textContent = S.score + ' pts';
  startNextPoll(qIdx);
}

function startNextPoll(qIdx) {
  stopPoll();
  S.pollIv = setInterval(() => {
    const r = getRoom(S.code);
    if (!r) return;
    if (r.done) { stopPoll(); showPlayerFinal(r); return; }
    if (r.phase === 'question' && r.qIdx > qIdx) { stopPoll(); renderPlayerQ(r); }
  }, 600);
}

function showPlayerFinal(r) {
  const sorted = Object.entries(r.players).sort((a, b) => b[1].score - a[1].score);
  const pos = sorted.findIndex(([n]) => n === S.name) + 1;
  const icns = ['🥇', '🥈', '🥉', '🎉', '🙂'];
  const ttls = ['Você ganhou!', 'Parabéns!', 'Ótimo jogo!', 'Bom jogo!', 'Bom jogo!'];
  document.getElementById('pfico').textContent = icns[Math.min(pos - 1, 4)];
  document.getElementById('pftitle').textContent = ttls[Math.min(pos - 1, 4)];
  document.getElementById('pfsub').textContent = pos === 1 ? 'Você foi o melhor!' : `Você ficou em ${pos}º lugar`;
  document.getElementById('pfscore').textContent = S.score + ' pts';
  document.getElementById('pfpos').textContent = `${pos}º de ${sorted.length} jogadores`;
  document.getElementById('pfpod').innerHTML = sorted.slice(0, 3).map(([n, d], i) =>
    `<div class="rr">
      <div class="med ${['m1','m2','m3'][i] || 'mn'}">${i + 1}</div>
      <span style="flex:1;font-weight:600${n === S.name ? ';color:var(--c3)' : ''}">${esc(n)}${n === S.name ? ' (você)' : ''}</span>
      <span style="color:var(--c3);font-weight:700">${d.score} pts</span>
    </div>`
  ).join('');
  go('pfinal');
}

// ── PÓDIO ──
function buildPodium(sorted, elId) {
  const el = document.getElementById(elId);
  const top = sorted.slice(0, 3);
  if (!top.length) { el.innerHTML = ''; return; }
  const order = top.length >= 3 ? [top[1], top[0], top[2]] : top.length === 2 ? [top[1], top[0]] : [top[0]];
  const cls = ['pb2', 'pb1', 'pb3'];
  const ico = ['🥈', '👑', '🥉'];
  el.innerHTML = order.map(([n, d], pi) =>
    `<div class="pp">
      <div class="pn">${esc(n)}</div>
      <div class="ps">${d.score}pts</div>
      <div class="pb ${cls[pi]}">${ico[pi]}</div>
    </div>`
  ).join('');
}

// ── TIMER ──
function startTimer(ringId, numId, onEnd) {
  stopTimer();
  S.timerLeft = TIMER_SEC;
  const ring = document.getElementById(ringId);
  const num = document.getElementById(numId);
  const DASH = 176;
  const upd = () => {
    const pct = S.timerLeft / TIMER_SEC;
    ring.style.strokeDashoffset = DASH * (1 - pct);
    const warn = S.timerLeft <= 5;
    ring.style.stroke = warn ? '#EF4444' : '#F59E0B';
    num.textContent = Math.ceil(S.timerLeft);
    num.style.color = warn ? '#EF4444' : '#F59E0B';
  };
  upd();
  S.timerIv = setInterval(() => {
    S.timerLeft -= 0.2;
    upd();
    if (S.timerLeft <= 0) { stopTimer(); S.timerLeft = 0; upd(); onEnd(); }
  }, 200);
}

// ── LIMPEZA DE SALAS ANTIGAS ──
function cleanOldRooms() {
  try {
    const rooms = getRooms();
    const now = Date.now();
    let changed = false;
    Object.entries(rooms).forEach(([code, room]) => {
      if (room._ts && now - room._ts > 4 * 60 * 60 * 1000) {
        delete rooms[code];
        changed = true;
      }
    });
    if (changed) setRooms(rooms);
  } catch(e) {}
}

cleanOldRooms();
