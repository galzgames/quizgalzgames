// ══════════════════════════════════════════════════
//  Galz Games Quiz — app.js
//  Backend: Firebase Realtime Database
//  Funciona entre qualquer dispositivo/navegador
// ══════════════════════════════════════════════════

const TIMER_SEC  = 20;
const REVEAL_SEC = 5;
const SHAPES     = ['▲','●','■','◆'];
const AVATARS    = ['🦊','🐼','🦁','🐸','🦋','🐧','🦄','🐲','🦖','🐙','🦀','🦩'];
const AV_COLORS  = ['#E21B3C','#1368CE','#26890C','#D89E00','#8B44C9','#D45C00','#1A6B7A','#B83280'];
const QUIZ_KEY   = 'galzgames_quizzes_v3';
const FB_CFG_KEY = 'galzgames_firebase_cfg';

// ── STATE ──────────────────────────────────────────
let db   = null;   // Firebase database reference
let S = {
  quizzes: loadQuizzes(),
  editQs: [], editIdx: -1,
  code: '', name: '', role: '',
  score: 0, answered: false,
  timerLeft: TIMER_SEC,
  timerIv: null, cdIv: null,
  unsub: null,          // Firebase listener unsubscribe
  lastQ: -1,
  currentQuizIdx: 0,
  avatar: '', color: ''
};

// ── FIREBASE ───────────────────────────────────────
function initFirebase(cfg) {
  try {
    if (firebase.apps && firebase.apps.length) {
      firebase.apps.forEach(a => a.delete());
    }
  } catch(e) {}
  try {
    firebase.initializeApp(cfg);
    db = firebase.database();
    return true;
  } catch(e) {
    console.error('Firebase init error:', e);
    return false;
  }
}

function tryLoadSavedFirebase() {
  try {
    const saved = JSON.parse(localStorage.getItem(FB_CFG_KEY) || 'null');
    if (saved && saved.apiKey && saved.databaseURL) {
      return initFirebase(saved);
    }
  } catch(e) {}
  return false;
}

function saveFirebaseConfig() {
  const cfg = {
    apiKey:            document.getElementById('fb-apikey').value.trim(),
    authDomain:        document.getElementById('fb-authdomain').value.trim(),
    databaseURL:       document.getElementById('fb-dburl').value.trim(),
    projectId:         document.getElementById('fb-projectid').value.trim(),
  };
  if (!cfg.apiKey || !cfg.databaseURL) {
    notify('Preencha pelo menos apiKey e databaseURL', 'err'); return;
  }
  if (initFirebase(cfg)) {
    localStorage.setItem(FB_CFG_KEY, JSON.stringify(cfg));
    notify('Firebase conectado! ✓');
    setTimeout(() => go('dashboard'), 800);
  } else {
    notify('Erro ao conectar. Verifique as configurações.', 'err');
  }
}

// DB helpers
function dbRef(path)        { return db.ref(path); }
function dbSet(path, val)   { return db.ref(path).set(val); }
function dbUpdate(path, val){ return db.ref(path).update(val); }
function dbGet(path)        { return db.ref(path).once('value').then(s => s.val()); }
function dbOff(ref)         { if (ref) ref.off(); }

function listen(path, cb) {
  const ref = db.ref(path);
  ref.on('value', snap => cb(snap.val()));
  return ref;
}

// ── UTIL ───────────────────────────────────────────
function notify(msg, type='ok') {
  const n = document.getElementById('notif');
  n.textContent = msg; n.className = type; n.style.display = 'block';
  clearTimeout(n._t); n._t = setTimeout(() => n.style.display = 'none', 2800);
}

function go(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0,0);
  if (id === 'dashboard') renderDash();
}

function stopTimer()  { clearInterval(S.timerIv); S.timerIv = null; }
function stopCd()     { clearInterval(S.cdIv); S.cdIv = null; }
function stopListen() { if (S.unsub) { dbOff(S.unsub); S.unsub = null; } }
function genCode()    { return Math.random().toString(36).substr(2,6).toUpperCase(); }
function esc(s)       { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function rand(a)      { return a[Math.floor(Math.random()*a.length)]; }

function requireDB() {
  if (!db) {
    notify('Configure o Firebase primeiro!', 'err');
    setTimeout(() => go('firebase-setup'), 600);
    return false;
  }
  return true;
}

// ── QUIZ STORAGE (local — admin only) ──────────────
function loadQuizzes() {
  try {
    const d = JSON.parse(localStorage.getItem(QUIZ_KEY) || 'null');
    if (d && d.length) return d;
  } catch(e) {}
  return [{
    title: 'Quiz de Exemplo',
    questions: [
      {text:'Qual é a capital do Brasil?',           options:['São Paulo','Rio de Janeiro','Brasília','Belo Horizonte'], correct:2},
      {text:'Quantos estados tem o Brasil?',          options:['25','26','27','28'],                                      correct:1},
      {text:'Qual é a maior floresta tropical?',      options:['Congo','Daintree','Amazônia','Borneo'],                   correct:2},
      {text:'Qual planeta é o "Planeta Vermelho"?',   options:['Vênus','Júpiter','Saturno','Marte'],                      correct:3}
    ]
  }];
}
function persistQuizzes() {
  try { localStorage.setItem(QUIZ_KEY, JSON.stringify(S.quizzes)); } catch(e) {}
}

// ── ADMIN ──────────────────────────────────────────
function adminLogin() {
  const u = document.getElementById('au').value;
  const p = document.getElementById('ap').value;
  if (u === 'admin' && p === '1234') {
    S.role = 'admin';
    if (!db && !tryLoadSavedFirebase()) {
      notify('⚠️ Firebase não configurado — configure para jogar na internet', 'info');
    }
    go('dashboard');
    notify('Bem-vindo, admin!');
  } else {
    notify('Credenciais inválidas', 'err');
  }
}

// ── DASHBOARD ──────────────────────────────────────
function renderDash() {
  const el = document.getElementById('qlist');
  if (!S.quizzes.length) {
    el.innerHTML = '<div class="qc-empty"><div class="qc-empty-ico">📝</div><p>Nenhum quiz ainda. Crie um!</p></div>';
    return;
  }
  el.innerHTML = S.quizzes.map((q,i) => `
    <div class="quiz-card">
      <div class="qc-info">
        <div class="qc-title">${esc(q.title)||'Sem título'}</div>
        <div class="qc-meta">${q.questions.length} pergunta(s)</div>
      </div>
      <div class="qc-acts">
        <button class="btn btn-ghost sm" onclick="editQuiz(${i})">✏️ Editar</button>
        <button class="btn btn-green sm" onclick="openLobby(${i})">▶ Iniciar</button>
        <button class="btn sm" style="background:rgba(220,50,50,.2);color:#FF8870;border:none;box-shadow:none" onclick="delQuiz(${i})">🗑</button>
      </div>
    </div>`).join('');
}

// ── EDITOR ─────────────────────────────────────────
function newQuiz()    { S.editIdx=-1; document.getElementById('qt').value=''; S.editQs=[]; renderQEditor(); go('editor'); }
function editQuiz(i)  { S.editIdx=i; document.getElementById('qt').value=S.quizzes[i].title; S.editQs=JSON.parse(JSON.stringify(S.quizzes[i].questions)); renderQEditor(); go('editor'); }
function delQuiz(i)   { if(!confirm(`Deletar "${S.quizzes[i].title}"?`))return; S.quizzes.splice(i,1); persistQuizzes(); renderDash(); notify('Removido','err'); }
function addQ()       { S.editQs.push({text:'',options:['','','',''],correct:0}); renderQEditor(); }
function remQ(i)      { S.editQs.splice(i,1); renderQEditor(); }
function setCorr(qi,li){ S.editQs[qi].correct=li; renderQEditor(); }

function renderQEditor() {
  const el = document.getElementById('ql');
  if (!S.editQs.length) { el.innerHTML='<div style="text-align:center;padding:1.5rem;color:rgba(255,255,255,.4);font-weight:700">Adicione perguntas abaixo</div>'; return; }
  el.innerHTML = S.editQs.map((q,qi) => `
    <div class="q-ec">
      <div class="q-ect">
        <div class="q-nb">${qi+1}</div>
        <input class="einput" value="${esc(q.text)}" placeholder="Escreva a pergunta..." oninput="S.editQs[${qi}].text=this.value" style="flex:1">
        <button class="q-del" onclick="remQ(${qi})">✕</button>
      </div>
      ${q.options.map((o,oi)=>`
        <div class="orow">
          <div class="obadge ob${oi}">${SHAPES[oi]}</div>
          <input class="einput" value="${esc(o)}" placeholder="Opção ${'ABCD'[oi]}..." oninput="S.editQs[${qi}].options[${oi}]=this.value">
        </div>`).join('')}
      <div class="clbl">Resposta correta:</div>
      <div class="cbtns">
        ${'ABCD'.split('').map((l,li)=>`<button class="cbtn ${q.correct===li?'on':''}" onclick="setCorr(${qi},${li})">${l}</button>`).join('')}
      </div>
    </div>`).join('');
}

function saveQuiz() {
  const title = document.getElementById('qt').value.trim();
  if (!title) return notify('Dê um título','err');
  if (!S.editQs.length) return notify('Adicione perguntas','err');
  for (const q of S.editQs) {
    if (!q.text.trim()) return notify('Preencha todas as perguntas','err');
    if (q.options.some(o=>!o.trim())) return notify('Preencha todas as opções','err');
  }
  const quiz = {title, questions: JSON.parse(JSON.stringify(S.editQs))};
  if (S.editIdx >= 0) S.quizzes[S.editIdx] = quiz; else S.quizzes.push(quiz);
  persistQuizzes(); notify('Salvo! ✓'); go('dashboard');
}

// ── LOBBY ──────────────────────────────────────────
async function openLobby(i) {
  if (!requireDB()) return;
  if (!S.quizzes[i].questions.length) return notify('Adicione perguntas primeiro','err');
  const code = genCode();
  S.code = code; S.currentQuizIdx = i;
  const roomData = {
    quiz: S.quizzes[i],
    players: {},
    started: false,
    qIdx: 0,
    answers: {},
    phase: 'lobby',
    revealCorrect: -1,
    done: false,
    showFinal: false,
    ts: Date.now()
  };
  try {
    await dbSet(`rooms/${code}`, roomData);
  } catch(e) {
    notify('Erro ao criar sala. Verifique as regras do Firebase.', 'err');
    console.error(e); return;
  }
  document.getElementById('lcode').textContent = code;
  document.getElementById('lcount').textContent = '0';
  document.getElementById('lplayers').innerHTML = '';
  // Show site URL hint
  const urlEl = document.getElementById('lsite-url');
  if (urlEl) urlEl.textContent = window.location.href.split('?')[0];
  go('lobby');
  // Listen for players joining
  stopListen();
  S.unsub = listen(`rooms/${code}/players`, players => {
    if (!players) return;
    const names = Object.keys(players);
    document.getElementById('lcount').textContent = names.length;
    document.getElementById('lplayers').innerHTML = names.map(n => {
      const p = players[n];
      return `<div class="la-chip" style="background:${p.color||'#5C21A6'}">${p.avatar||'🎮'} ${esc(n)}</div>`;
    }).join('');
  });
}

function cancelRoom() {
  stopListen();
  if (db && S.code) db.ref(`rooms/${S.code}`).remove().catch(()=>{});
  go('dashboard');
}

async function startGame() {
  if (!requireDB()) return;
  const snap = await dbGet(`rooms/${S.code}`);
  if (!snap) return notify('Sala não encontrada','err');
  if (!snap.players || !Object.keys(snap.players).length) return notify('Aguarde pelo menos 1 jogador!','err');
  stopListen();
  await dbUpdate(`rooms/${S.code}`, {
    started: true, qIdx: 0, phase: 'question', answers: {}, revealCorrect: -1
  });
  go('game-host');
  renderHostQ();
}

// ── HOST: QUESTION ─────────────────────────────────
async function renderHostQ() {
  stopTimer(); stopCd(); stopListen();
  const room = await dbGet(`rooms/${S.code}`);
  if (!room) return;
  const tot = room.quiz.questions.length;
  const q   = room.quiz.questions[room.qIdx];
  // Reset answers for this question
  await dbUpdate(`rooms/${S.code}`, { answers: {}, phase: 'question', revealCorrect: -1 });
  // UI
  document.getElementById('ghn').textContent = `${room.qIdx+1}/${tot}`;
  document.getElementById('ghans').textContent = '0 resp.';
  document.getElementById('ghq').textContent = q.text;
  document.getElementById('ghprog').style.width = ((room.qIdx/tot)*100)+'%';
  document.getElementById('ghreveal').style.display = 'none';
  document.getElementById('ghopts').innerHTML = q.options.map((o,i) =>
    `<button class="abt a${i}"><span class="ash">${SHAPES[i]}</span><span>${esc(o)}</span></button>`
  ).join('');
  startTimer('ghring','ghtimer', () => doReveal(room.qIdx));
  // Listen for answers
  const playerCount = Object.keys(room.players||{}).length;
  stopListen();
  S.unsub = listen(`rooms/${S.code}/answers`, answers => {
    const count = answers ? Object.keys(answers).length : 0;
    document.getElementById('ghans').textContent = `${count}/${playerCount} resp.`;
    if (playerCount > 0 && count >= playerCount) {
      stopTimer(); stopListen(); doReveal(room.qIdx);
    }
  });
}

// ── REVEAL ─────────────────────────────────────────
async function doReveal(qIdx) {
  stopTimer(); stopListen(); stopCd();
  const room = await dbGet(`rooms/${S.code}`);
  if (!room || room.phase === 'reveal' || room.phase === 'countdown') return;
  const q       = room.quiz.questions[qIdx];
  const correct = q.correct;
  const answers = room.answers || {};
  // Calculate scores
  const players = room.players || {};
  const updates  = {};
  Object.keys(players).forEach(name => {
    const prev = players[name].score || 0;
    const a    = answers[name];
    const pts  = (a !== undefined && a.choice === correct)
      ? 500 + Math.floor((a.time / TIMER_SEC) * 500) : 0;
    updates[`rooms/${S.code}/players/${name}/score`] = prev + pts;
  });
  updates[`rooms/${S.code}/phase`]         = 'reveal';
  updates[`rooms/${S.code}/revealCorrect`] = correct;
  await db.ref('/').update(updates);
  // Fetch updated room for rank display
  const updated = await dbGet(`rooms/${S.code}`);
  // Highlight answer buttons
  const btns = document.getElementById('ghopts').children;
  for (let i = 0; i < btns.length; i++) btns[i].classList.add(i===correct?'correct':'wrong');
  // Live rank
  renderLiveRank(updated.players || {});
  document.getElementById('ghreveal').style.display = 'block';
  const isLast = qIdx >= room.quiz.questions.length - 1;
  const nm   = document.getElementById('gh-next-msg');
  const nBtn = document.getElementById('ghnext');
  if (isLast) {
    if (nm)  nm.style.display  = 'none';
    if (nBtn){ nBtn.style.display = 'flex'; nBtn.textContent = '🏆 Ver Resultados Finais'; }
  } else {
    if (nBtn) nBtn.style.display = 'none';
    startCountdown(REVEAL_SEC, () => nextQ());
  }
}

function renderLiveRank(players) {
  const sorted = Object.entries(players).sort((a,b)=>b[1].score-a[1].score).slice(0,5);
  document.getElementById('ghrank').innerHTML = sorted.map(([n,d],i) => `
    <div class="rank-row">
      <div class="rmed ${['rm1','rm2','rm3'][i]||'rmn'}">${i+1}</div>
      <span class="rname">${d.avatar||'🎮'} ${esc(n)}</span>
      <span class="rpts">${d.score||0}</span>
    </div>`).join('');
}

// ── COUNTDOWN ──────────────────────────────────────
function startCountdown(secs, cb) {
  stopCd();
  let left = secs;
  const msg  = document.getElementById('gh-next-msg');
  const cdEl = document.getElementById('gh-countdown');
  if (msg)  msg.style.display  = 'block';
  if (cdEl) cdEl.textContent   = left;
  dbUpdate(`rooms/${S.code}`, {phase:'countdown'}).catch(()=>{});
  S.cdIv = setInterval(() => {
    left--;
    if (cdEl) cdEl.textContent = left;
    if (left <= 0) { stopCd(); cb(); }
  }, 1000);
}

// ── NEXT Q ─────────────────────────────────────────
async function nextQ() {
  stopCd();
  const room = await dbGet(`rooms/${S.code}`);
  if (!room) return;
  const nextIdx = (room.qIdx || 0) + 1;
  if (nextIdx >= room.quiz.questions.length) {
    // Quiz over — wait for admin to show final
    await dbUpdate(`rooms/${S.code}`, { phase: 'waiting_final', qIdx: nextIdx - 1 });
    showHostFinalWait(room);
    return;
  }
  await dbUpdate(`rooms/${S.code}`, { qIdx: nextIdx, phase: 'question', answers: {}, revealCorrect: -1 });
  renderHostQ();
}

// ── HOST WAITING FINAL ─────────────────────────────
async function showHostFinalWait(room) {
  stopTimer(); stopCd(); stopListen();
  document.getElementById('ghopts').innerHTML = '';
  document.getElementById('ghq').textContent  = 'Quiz finalizado!';
  document.getElementById('ghprog').style.width = '100%';
  document.getElementById('ghn').textContent  = 'Fim!';
  document.getElementById('ghans').textContent = '';
  renderLiveRank(room.players || {});
  document.getElementById('ghreveal').style.display = 'block';
  const nm   = document.getElementById('gh-next-msg');
  const nBtn = document.getElementById('ghnext');
  if (nm)  nm.style.display  = 'none';
  if (nBtn){ nBtn.style.display='flex'; nBtn.textContent='🏆 Ver Resultados Finais'; nBtn.onclick=hostClickFinal; }
}

async function hostClickFinal() {
  if (!requireDB()) return;
  const room = await dbGet(`rooms/${S.code}`);
  if (!room) return;
  await dbUpdate(`rooms/${S.code}`, { done: true, phase: 'done' });
  renderHostFinal(room);
}

function renderHostFinal(room) {
  const players = room.players || {};
  const sorted  = Object.entries(players).sort((a,b)=>b[1].score-a[1].score);
  buildPodium(sorted, 'finpod');
  document.getElementById('finrank').innerHTML = sorted.map(([n,d],i) => `
    <div class="rank-row">
      <div class="rmed ${['rm1','rm2','rm3'][i]||'rmn'}">${i+1}</div>
      <span class="rname">${d.avatar||'🎮'} ${esc(n)}</span>
      <span class="rpts">${d.score||0} pts</span>
    </div>`).join('');
  if (sorted.length) {
    document.getElementById('finwinner').style.display = 'block';
    document.getElementById('finwname').textContent = sorted[0][0];
  }
  go('final');
}

function replayRoom() { openLobby(S.currentQuizIdx); }

// ── PLAYER JOIN ────────────────────────────────────
async function goToName() {
  if (!db && !tryLoadSavedFirebase()) {
    notify('Site sem Firebase configurado. Peça ao admin para configurar.','err'); return;
  }
  const code = document.getElementById('pcode').value.trim().toUpperCase();
  if (code.length < 4) return notify('Código muito curto','err');
  try {
    const room = await dbGet(`rooms/${code}`);
    if (!room)         return notify(`Sala "${code}" não encontrada!`,'err');
    if (room.started)  return notify('Quiz já iniciou! Aguarde a próxima rodada.','err');
    document.getElementById('pcode').dataset.code = code;
    go('join-name');
    setTimeout(()=>document.getElementById('pname').focus(),100);
  } catch(e) {
    notify('Erro ao buscar sala. Verifique sua conexão.','err');
  }
}

async function joinRoom() {
  if (!db && !tryLoadSavedFirebase()) { notify('Firebase não configurado','err'); return; }
  const name = document.getElementById('pname').value.trim();
  const code = document.getElementById('pcode').dataset.code || document.getElementById('pcode').value.trim().toUpperCase();
  if (!name) return notify('Digite seu apelido','err');
  if (name.length > 20) return notify('Apelido muito longo','err');
  try {
    const room = await dbGet(`rooms/${code}`);
    if (!room)         return notify('Sala não encontrada','err');
    if (room.started)  return notify('Quiz já iniciou!','err');
    if (room.players && room.players[name]) return notify('Apelido em uso. Escolha outro!','err');
    const avatar = rand(AVATARS), color = rand(AV_COLORS);
    await dbSet(`rooms/${code}/players/${name}`, {score:0, avatar, color});
    S.name = name; S.code = code; S.score = 0;
    S.answered = false; S.lastQ = -1;
    S.avatar = avatar; S.color = color;
    document.getElementById('wcode').textContent = code;
    document.getElementById('wname').textContent = name;
    const av = document.getElementById('wavatar');
    av.textContent = avatar; av.style.background = color;
    go('waiting');
    listenForStart();
  } catch(e) {
    notify('Erro ao entrar. Verifique sua conexão.','err');
    console.error(e);
  }
}

// ── PLAYER LISTENERS ───────────────────────────────
function listenForStart() {
  stopListen();
  S.unsub = listen(`rooms/${S.code}/phase`, phase => {
    if (phase === 'question') {
      dbGet(`rooms/${S.code}`).then(room => {
        if (room && room.qIdx !== S.lastQ) {
          stopListen();
          renderPlayerQ(room);
        }
      });
    }
  });
}

function renderPlayerQ(room) {
  const qIdx = room.qIdx;
  S.lastQ    = qIdx;
  S.answered = false;
  const q   = room.quiz.questions[qIdx];
  const tot = room.quiz.questions.length;
  document.getElementById('plqn').textContent   = `${qIdx+1}/${tot}`;
  document.getElementById('plq').textContent    = q.text;
  document.getElementById('plprog').style.width = ((qIdx/tot)*100)+'%';
  document.getElementById('plpts').textContent  = S.score+' pts';
  document.getElementById('plfb').style.display = 'none';
  document.getElementById('plopts').innerHTML   = q.options.map((o,i) =>
    `<button class="abt a${i}" onclick="playerAns(${i},${qIdx})">
      <span class="ash">${SHAPES[i]}</span><span>${esc(o)}</span>
    </button>`).join('');
  go('playing');
  startTimer('plring','pltimer', () => playerTimeout(qIdx));
  listenForReveal(qIdx);
}

async function playerAns(choice, qIdx) {
  if (S.answered) return;
  S.answered = true; stopTimer();
  const btns = document.getElementById('plopts').children;
  for (let i=0;i<btns.length;i++){ btns[i].disabled=true; if(i===choice) btns[i].classList.add('chosen'); }
  try {
    await dbSet(`rooms/${S.code}/answers/${S.name}`, {choice, time: S.timerLeft});
  } catch(e) { console.error(e); }
}

async function playerTimeout(qIdx) {
  if (S.answered) return;
  S.answered = true;
  try {
    await dbSet(`rooms/${S.code}/answers/${S.name}`, {choice:-1, time:0});
  } catch(e) {}
}

function listenForReveal(qIdx) {
  stopListen();
  S.unsub = listen(`rooms/${S.code}`, room => {
    if (!room) return;
    // Show final when admin triggers
    if (room.done && room.phase === 'done') {
      stopListen(); showPlayerFinal(room); return;
    }
    // Feedback on reveal
    if ((room.phase==='reveal'||room.phase==='countdown'||room.phase==='waiting_final') && room.qIdx===qIdx) {
      stopListen(); showFeedback(room, qIdx);
    }
  });
}

function showFeedback(room, qIdx) {
  stopTimer();
  const q       = room.quiz.questions[qIdx];
  const correct = room.revealCorrect;
  const answers = room.answers || {};
  const a       = answers[S.name];
  const ok      = a !== undefined && a.choice === correct;
  const pts     = ok ? 500 + Math.floor((a.time/TIMER_SEC)*500) : 0;
  S.score      += pts;
  // Highlight buttons
  const btns = document.getElementById('plopts').children;
  for (let i=0;i<btns.length;i++){
    btns[i].disabled=true;
    if(i===correct) btns[i].classList.add('correct');
    else if(a&&a.choice===i) btns[i].classList.add('wrong');
  }
  // Overlay
  const fbc = document.getElementById('plfbcard');
  fbc.className = 'fb-card '+(ok?'ok':'fail');
  document.getElementById('plicon').textContent   = ok?'✅':'❌';
  document.getElementById('pltxt').textContent    = ok?'Correto!':'Errado!';
  document.getElementById('plptsadd').textContent = ok?`+${pts} pontos`:'Sem pontos';
  document.getElementById('plpts').textContent    = S.score+' pts';
  document.getElementById('plfb').style.display   = 'flex';
  listenForNext(qIdx);
}

function listenForNext(qIdx) {
  stopListen();
  S.unsub = listen(`rooms/${S.code}`, room => {
    if (!room) return;
    if (room.done && room.phase==='done')               { stopListen(); showPlayerFinal(room); return; }
    if (room.phase==='question' && room.qIdx > qIdx)    { stopListen(); document.getElementById('plfb').style.display='none'; renderPlayerQ(room); }
  });
}

function showPlayerFinal(room) {
  stopTimer(); stopListen();
  const players = room.players || {};
  const sorted  = Object.entries(players).sort((a,b)=>b[1].score-a[1].score);
  const pos     = sorted.findIndex(([n])=>n===S.name)+1;
  const icns    = ['🥇','🥈','🥉','🎉','🙂','😊'];
  const ttls    = ['Você ganhou!','Incrível!','Ótimo jogo!','Bom jogo!','Bom jogo!','Bom jogo!'];
  document.getElementById('pfico').textContent  = icns[Math.min(pos-1,5)];
  document.getElementById('pftitle').textContent= ttls[Math.min(pos-1,5)];
  document.getElementById('pfsub').textContent  = pos===1?'Você foi o melhor! 🏆':`Você ficou em ${pos}º lugar`;
  document.getElementById('pfscore').textContent= S.score+' pts';
  document.getElementById('pfpos').textContent  = `${pos}º de ${sorted.length} jogadores`;
  buildPodium(sorted.slice(0,3),'pfpod');
  go('pfinal');
}

// ── PODIUM ─────────────────────────────────────────
function buildPodium(sorted, elId) {
  const el  = document.getElementById(elId); if(!el) return;
  const top = sorted.slice(0,3);
  if (!top.length) { el.innerHTML=''; return; }
  const order = top.length>=3?[top[1],top[0],top[2]]:top.length===2?[top[1],top[0]]:[top[0]];
  const cls   = ['pb2','pb1','pb3'], ico=['🥈','👑','🥉'];
  el.innerHTML = order.map(([n,d],pi) => `
    <div class="pod-pl">
      <div class="pod-name">${d.avatar||'🎮'} ${esc(n)}</div>
      <div class="pod-pts">${d.score||0} pts</div>
      <div class="pod-bar ${cls[pi]}">${ico[pi]}</div>
    </div>`).join('');
}

// ── TIMER ──────────────────────────────────────────
function startTimer(ringId, numId, onEnd) {
  stopTimer();
  S.timerLeft = TIMER_SEC;
  const ring = document.getElementById(ringId);
  const num  = document.getElementById(numId);
  const DASH = 151;
  const upd  = () => {
    const pct  = S.timerLeft/TIMER_SEC;
    ring.style.strokeDashoffset = DASH*(1-pct);
    const warn = S.timerLeft<=5;
    ring.style.stroke = warn?'#E84C39':'#F5C200';
    num.textContent   = Math.ceil(S.timerLeft);
    num.style.color   = warn?'#E84C39':'#fff';
  };
  upd();
  S.timerIv = setInterval(() => {
    S.timerLeft-=.2; upd();
    if (S.timerLeft<=0) { stopTimer(); S.timerLeft=0; upd(); onEnd(); }
  }, 200);
}

// ── INIT ───────────────────────────────────────────
tryLoadSavedFirebase();
