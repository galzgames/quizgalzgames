// ══════════════════════════════════════════════════
//  Galz Games Quiz — app.js
//  Tipos: texto, foto (4 imagens), música (áudio + 4 opções)
//  Backend: Firebase Realtime Database + Storage
// ══════════════════════════════════════════════════

// ▼▼▼ CONFIGURAÇÃO FIREBASE — funciona em qualquer dispositivo ▼▼▼
const FIREBASE_CONFIG = {
  apiKey:        "AIzaSyBIQWna0NgqbmGsNwtt_UITLXPMANKn3CA",
  authDomain:    "quiz-e0e90.firebaseapp.com",
  databaseURL:   "https://quiz-e0e90-default-rtdb.firebaseio.com",
  projectId:     "quiz-e0e90",
  storageBucket: "quiz-e0e90.firebasestorage.app"
};
// ▲▲▲ SE TROCAR DE PROJETO FIREBASE, ATUALIZE OS VALORES ACIMA ▲▲▲

const TIMER_SEC  = 20;
const REVEAL_SEC = 5;
const SHAPES     = ['▲','●','■','◆'];
const AVATARS    = ['🦊','🐼','🦁','🐸','🦋','🐧','🦄','🐲','🦖','🐙','🦀','🦩'];
const AV_COLORS  = ['#E21B3C','#1368CE','#26890C','#D89E00','#8B44C9','#D45C00','#1A6B7A','#B83280'];
const QUIZ_KEY   = 'galzgames_quizzes_v4';
const FB_CFG_KEY = 'galzgames_firebase_cfg';

let db = null;
let S = {
  quizzes: loadQuizzes(),
  editQs: [], editIdx: -1,
  code: '', name: '', role: '',
  score: 0, answered: false,
  timerLeft: TIMER_SEC,
  timerIv: null, cdIv: null, unsub: null,
  lastQ: -1, currentQuizIdx: 0,
  avatar: '', color: ''
};

// ── FIREBASE ────────────────────────────────────────
function initFirebase(cfg) {
  try {
    if (firebase.apps && firebase.apps.length) firebase.apps.forEach(a => { try { a.delete(); } catch(e){} });
    firebase.initializeApp(cfg);
    db = firebase.database();
    return true;
  } catch(e) { console.error(e); return false; }
}

// Inicia sempre com a config fixa — funciona em qualquer dispositivo
function tryLoadSavedFirebase() {
  // 1. Tenta config salva manualmente (sobrescreve a fixa se existir)
  try {
    const s = JSON.parse(localStorage.getItem(FB_CFG_KEY) || 'null');
    if (s && s.apiKey && s.databaseURL) return initFirebase(s);
  } catch(e) {}
  // 2. Usa config fixa no código
  if (FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.databaseURL) {
    return initFirebase(FIREBASE_CONFIG);
  }
  return false;
}

function saveFirebaseConfig() {
  const cfg = {
    apiKey:        document.getElementById('fb-apikey').value.trim(),
    authDomain:    document.getElementById('fb-authdomain').value.trim(),
    databaseURL:   document.getElementById('fb-dburl').value.trim(),
    projectId:     document.getElementById('fb-projectid').value.trim(),
    storageBucket: document.getElementById('fb-projectid').value.trim() + '.firebasestorage.app'
  };
  if (!cfg.apiKey || !cfg.databaseURL) { notify('Preencha apiKey e databaseURL','err'); return; }
  if (initFirebase(cfg)) {
    localStorage.setItem(FB_CFG_KEY, JSON.stringify(cfg));
    notify('Firebase conectado! ✓');
    setTimeout(() => go('dashboard'), 700);
  } else notify('Erro ao conectar','err');
}

// DB / Storage helpers
function dbGet(p)       { return db.ref(p).once('value').then(s => s.val()); }
function dbSet(p,v)     { return db.ref(p).set(v); }
function dbUpdate(p,v)  { return db.ref(p).update(v); }
function dbOff(r)       { if(r) r.off(); }
function listen(p,cb)   { const r=db.ref(p); r.on('value',s=>cb(s.val())); return r; }

// ── UTIL ────────────────────────────────────────────
function notify(msg, type='ok') {
  const n = document.getElementById('notif');
  n.textContent=msg; n.className=type; n.style.display='block';
  clearTimeout(n._t); n._t=setTimeout(()=>n.style.display='none',2800);
}
function go(id) {
  // 'home' agora é a intro
  if(id==='home') id='intro';
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0,0);
  if(id==='dashboard') renderDash();
}
function stopTimer()  { clearInterval(S.timerIv); S.timerIv=null; }
function stopCd()     { clearInterval(S.cdIv); S.cdIv=null; }
function stopListen() { if(S.unsub){ dbOff(S.unsub); S.unsub=null; } }
function genCode()    { return Math.random().toString(36).substr(2,6).toUpperCase(); }
function esc(s)       { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function rand(a)      { return a[Math.floor(Math.random()*a.length)]; }
function requireDB()  { if(!db){ notify('Configure o Firebase primeiro!','err'); setTimeout(()=>go('firebase-setup'),600); return false; } return true; }

// ── QUIZ PERSISTENCE ────────────────────────────────
function loadQuizzes() {
  try { const d=JSON.parse(localStorage.getItem(QUIZ_KEY)||'null'); if(d&&d.length) return d; } catch(e) {}
  return [{
    title:'Quiz de Exemplo',
    questions:[
      {type:'text', text:'Qual é a capital do Brasil?', options:['São Paulo','Rio de Janeiro','Brasília','Belo Horizonte'], correct:2},
      {type:'text', text:'Quantos estados tem o Brasil?', options:['25','26','27','28'], correct:1}
    ]
  }];
}
function persistQuizzes() { try { localStorage.setItem(QUIZ_KEY, JSON.stringify(S.quizzes)); } catch(e) {} }

// ── ADMIN ────────────────────────────────────────────
function adminLogin() {
  const u=document.getElementById('au').value, p=document.getElementById('ap').value;
  if(u==='admin'&&p==='1234'){ S.role='admin'; if(!db) tryLoadSavedFirebase(); go('dashboard'); notify('Bem-vindo!'); }
  else notify('Credenciais inválidas','err');
}

// ── DASHBOARD ───────────────────────────────────────
function renderDash() {
  const el=document.getElementById('qlist');
  if(!S.quizzes.length){ el.innerHTML='<div class="qc-empty"><div class="qc-empty-ico">📝</div><p>Nenhum quiz ainda!</p></div>'; return; }
  el.innerHTML=S.quizzes.map((q,i)=>`
    <div class="quiz-card">
      <div class="qc-info">
        <div class="qc-title">${esc(q.title)||'Sem título'}</div>
        <div class="qc-meta">${q.questions.length} pergunta(s) · ${getQuizTypes(q)}</div>
      </div>
      <div class="qc-acts">
        <button class="btn btn-ghost sm" onclick="editQuiz(${i})">✏️ Editar</button>
        <button class="btn btn-green sm" onclick="openLobby(${i})">▶ Iniciar</button>
        <button class="btn sm" style="background:rgba(220,50,50,.2);color:#FF8870;border:none;box-shadow:none" onclick="delQuiz(${i})">🗑</button>
      </div>
    </div>`).join('');
}

function getQuizTypes(q) {
  const types = [...new Set(q.questions.map(p=>p.type||'text'))];
  return types.map(t=>t==='text'?'📝':t==='photo'?'📸':'🎵').join(' ');
}

// ── EDITOR ──────────────────────────────────────────
function newQuiz()    { S.editIdx=-1; document.getElementById('qt').value=''; S.editQs=[]; renderQEditor(); go('editor'); }
function editQuiz(i)  { S.editIdx=i; document.getElementById('qt').value=S.quizzes[i].title; S.editQs=JSON.parse(JSON.stringify(S.quizzes[i].questions)); renderQEditor(); go('editor'); }
function delQuiz(i)   { if(!confirm(`Deletar "${S.quizzes[i].title}"?`))return; S.quizzes.splice(i,1); persistQuizzes(); renderDash(); notify('Removido','err'); }

function showAddMenu() {
  const m=document.getElementById('add-menu');
  m.style.display = m.style.display==='none' ? 'flex' : 'none';
}

function addQ(type) {
  document.getElementById('add-menu').style.display='none';
  const q = { type };
  if(type==='text')  { q.text=''; q.options=['','','','']; q.correct=0; }
  if(type==='photo') { q.text='Escolha a foto correta:'; q.photos=['','','','']; q.labels=['','','','']; q.correct=0; }
  if(type==='music') { q.text='Que música é essa?'; q.audioUrl=''; q.youtubeId=''; q.youtubeStart=0; q.youtubeEnd=30; q.youtubeUrl=''; q.options=['','','','']; q.correct=0; }
  S.editQs.push(q);
  renderQEditor();
  setTimeout(()=>{ const el=document.getElementById('ql'); if(el) el.scrollTop=el.scrollHeight; },100);
}

function remQ(i) { S.editQs.splice(i,1); renderQEditor(); }
function setCorr(qi,li) { S.editQs[qi].correct=li; renderQEditor(); }

function renderQEditor() {
  const el=document.getElementById('ql');
  if(!S.editQs.length){ el.innerHTML='<div style="text-align:center;padding:1.5rem;color:rgba(255,255,255,.4);font-weight:700">Adicione perguntas abaixo</div>'; return; }
  el.innerHTML=S.editQs.map((q,qi)=>{
    const type = q.type||'text';
    const typeLbl = type==='text'?'📝 Texto':type==='photo'?'📸 Foto':'🎵 Música';
    const header = `
      <div class="q-type-badge">${typeLbl}</div>
      <div class="q-ect">
        <div class="q-nb">${qi+1}</div>
        <input class="einput" value="${esc(q.text)}" placeholder="Pergunta..." oninput="S.editQs[${qi}].text=this.value" style="flex:1">
        <button class="q-del" onclick="remQ(${qi})">✕</button>
      </div>`;

    if(type==='text') return `<div class="q-ec q-type-text">${header}
      ${q.options.map((o,oi)=>`
        <div class="orow">
          <div class="obadge ob${oi}">${SHAPES[oi]}</div>
          <input class="einput" value="${esc(o)}" placeholder="Opção ${'ABCD'[oi]}..." oninput="S.editQs[${qi}].options[${oi}]=this.value">
        </div>`).join('')}
      <div class="clbl">Resposta correta:</div>
      <div class="cbtns">${'ABCD'.split('').map((l,li)=>`<button class="cbtn ${q.correct===li?'on':''}" onclick="setCorr(${qi},${li})">${l}</button>`).join('')}</div>
    </div>`;

    if(type==='photo') return `<div class="q-ec q-type-photo">${header}
      ${(q.photos||['','','','']).map((url,oi)=>`
        <div style="margin-bottom:.75rem">
          <div class="orow" style="margin-bottom:.35rem">
            <div class="obadge ob${oi}">${SHAPES[oi]}</div>
            <span style="font-size:.8rem;color:rgba(255,255,255,.5);font-weight:700">Foto ${'ABCD'[oi]}</span>
            ${url ? `<img src="${url}" style="width:38px;height:38px;border-radius:6px;object-fit:cover;margin-left:auto;border:2px solid rgba(255,255,255,.15)">` : ''}
          </div>
          <input class="einput" value="${esc(url)}" placeholder="Cole o link da imagem (https://...)" oninput="setPhoto(${qi},${oi},this.value)">
          <input class="einput" value="${esc((q.labels||[])[oi]||'')}" placeholder="Legenda (opcional)" oninput="S.editQs[${qi}].labels[${oi}]=this.value" style="margin-top:.3rem;font-size:.8rem;opacity:.7">
        </div>`).join('')}
      <div class="clbl">Foto correta:</div>
      <div class="cbtns">${'ABCD'.split('').map((l,li)=>`<button class="cbtn ${q.correct===li?'on':''}" onclick="setCorr(${qi},${li})">${l}</button>`).join('')}</div>
    </div>`;

    if(type==='music') {
      const ytId    = q.youtubeId    || '';
      const ytStart = q.youtubeStart || 0;
      const ytEnd   = q.youtubeEnd   || 30;
      const mp3Url  = q.audioUrl     || '';
      return `<div class="q-ec q-type-music">${header}

      <div class="yt-search-box" id="ytsb-${qi}">
        <div class="clbl">🔍 Buscar no YouTube</div>
        <div style="display:flex;gap:.5rem;margin-bottom:.5rem">
          <input class="einput" id="ytsearch-${qi}" placeholder="Ex: Mario Bros theme, Tetris OST..." style="flex:1" onkeydown="if(event.key==='Enter')searchYT(${qi})">
          <button onclick="searchYT(${qi})" style="background:var(--a0);color:#fff;border:none;border-radius:8px;padding:.5rem .9rem;font-family:var(--font);font-size:.82rem;font-weight:800;cursor:pointer;white-space:nowrap;flex-shrink:0">🔍 Buscar</button>
        </div>
        <div id="ytresults-${qi}" class="yt-results"></div>
      </div>

      ${ytId ? `
      <div class="yt-selected-box">
        <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.5rem">
          <img src="https://img.youtube.com/vi/${ytId}/mqdefault.jpg" style="width:80px;height:56px;object-fit:cover;border-radius:6px;flex-shrink:0">
          <div style="flex:1">
            <div style="font-size:.8rem;font-weight:700;color:#C084FC;margin-bottom:.2rem">YouTube selecionado ✓</div>
            <div style="font-size:.72rem;color:rgba(255,255,255,.45)">ID: ${ytId}</div>
          </div>
          <button onclick="clearYT(${qi})" style="background:rgba(220,50,50,.2);color:#FF8870;border:1px solid rgba(220,50,50,.3);border-radius:6px;padding:.3rem .6rem;font-size:.75rem;cursor:pointer">✕ Trocar</button>
        </div>
        <div style="display:flex;gap:.6rem;align-items:center;flex-wrap:wrap">
          <div style="font-size:.75rem;color:rgba(255,255,255,.45);flex-shrink:0">Trecho (segundos):</div>
          <div style="display:flex;align-items:center;gap:.4rem">
            <span style="font-size:.72rem;color:rgba(255,255,255,.35)">início</span>
            <input type="number" value="${ytStart}" min="0" style="width:60px;padding:.3rem .4rem;border-radius:6px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.07);color:#fff;font-size:.8rem;text-align:center" onchange="S.editQs[${qi}].youtubeStart=+this.value">
            <span style="font-size:.72rem;color:rgba(255,255,255,.35)">fim</span>
            <input type="number" value="${ytEnd}" min="1" style="width:60px;padding:.3rem .4rem;border-radius:6px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.07);color:#fff;font-size:.8rem;text-align:center" onchange="S.editQs[${qi}].youtubeEnd=+this.value">
          </div>
        </div>
      </div>` : `
      <div style="display:flex;align-items:center;gap:.5rem;margin:.4rem 0">
        <div style="flex:1;height:1px;background:rgba(255,255,255,.1)"></div>
        <span style="font-size:.72rem;color:rgba(255,255,255,.25)">ou cole um link</span>
        <div style="flex:1;height:1px;background:rgba(255,255,255,.1)"></div>
      </div>
      <div class="clbl">▶ Link do YouTube</div>
      <input class="einput" value="${esc(q.youtubeUrl||'')}" placeholder="https://youtube.com/watch?v=..." oninput="setYoutubeUrl(${qi},this.value)" style="margin-bottom:.6rem">
      <div class="clbl">🎵 Link direto de MP3</div>
      <input class="einput" value="${esc(mp3Url)}" placeholder="https://...arquivo.mp3" oninput="setMp3Url(${qi},this.value)" style="margin-bottom:.4rem">
      ${mp3Url ? `<audio src="${mp3Url}" controls style="width:100%;height:32px;margin-bottom:.5rem;border-radius:6px;accent-color:#8B44C9"></audio>` : ''}`}

      ${q.options.map((o,oi)=>`
        <div class="orow" style="margin-top:${oi===0?'.75rem':'0'}">
          <div class="obadge ob${oi}">${SHAPES[oi]}</div>
          <input class="einput" value="${esc(o)}" placeholder="Opção ${'ABCD'[oi]}..." oninput="S.editQs[${qi}].options[${oi}]=this.value">
        </div>`).join('')}
      <div class="clbl">Resposta correta:</div>
      <div class="cbtns">${'ABCD'.split('').map((l,li)=>`<button class="cbtn ${q.correct===li?'on':''}" onclick="setCorr(${qi},${li})">${l}</button>`).join('')}</div>
    </div>`;
    }

    return '';
  }).join('');
}

// ── YOUTUBE SEARCH & HELPERS ─────────────────────────
// Instâncias Invidious públicas — tenta em ordem até uma funcionar
const INV_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.privacydev.net',
  'https://iv.datura.network',
  'https://invidious.fdn.fr',
  'https://invidious.nerdvpn.de'
];

async function searchYT(qi) {
  const query = document.getElementById(`ytsearch-${qi}`).value.trim();
  if(!query) return notify('Digite algo para buscar','err');
  const el = document.getElementById(`ytresults-${qi}`);
  el.innerHTML = '<div class="yt-loading">🔍 Buscando...</div>';

  const fields = 'videoId,title,author,lengthSeconds';
  const encoded = encodeURIComponent(query);

  for(const base of INV_INSTANCES) {
    try {
      const url = `${base}/api/v1/search?q=${encoded}&type=video&fields=${fields}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if(!res.ok) continue;
      const data = await res.json();
      if(!Array.isArray(data) || !data.length) {
        el.innerHTML='<div class="yt-loading">Nenhum resultado encontrado. Tente outra busca.</div>';
        return;
      }
      el.innerHTML = data.slice(0,7).map(v => {
        const safeTitle = v.title.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
        return `<div class="yt-result-item" onclick="selectYT(${qi},'${v.videoId}','${safeTitle}')">
          <img src="https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg" class="yt-thumb" alt="" onerror="this.style.display='none'">
          <div class="yt-result-info">
            <div class="yt-result-title">${esc(v.title)}</div>
            <div class="yt-result-ch">${esc(v.author||'')} ${v.lengthSeconds ? '· '+fmtSec(v.lengthSeconds) : ''}</div>
          </div>
          <div class="yt-pick-btn">Usar ▶</div>
        </div>`;
      }).join('');
      return; // sucesso, para de tentar
    } catch(e) {
      continue; // tenta próxima instância
    }
  }
  // Todas falharam
  el.innerHTML = `<div class="yt-loading" style="color:#FF8870">
    Busca indisponível no momento.<br>
    <span style="font-size:.72rem;opacity:.7">Cole o link do YouTube diretamente no campo abaixo.</span>
  </div>`;
}

function fmtSec(s) {
  if(!s) return '';
  const m = Math.floor(s/60), sec = s%60;
  return `${m}:${String(sec).padStart(2,'0')}`;
}

function selectYT(qi, videoId, title) {
  S.editQs[qi].youtubeId    = videoId;
  S.editQs[qi].youtubeStart = S.editQs[qi].youtubeStart || 0;
  S.editQs[qi].youtubeEnd   = S.editQs[qi].youtubeEnd   || 30;
  S.editQs[qi].youtubeUrl   = '';
  S.editQs[qi].audioUrl     = '';
  if(S.editQs[qi].options.every(o=>!o.trim())) S.editQs[qi].options[0] = title;
  notify('Música selecionada! ✓');
  renderQEditor();
  setTimeout(()=>{ const el=document.getElementById('ql'); if(el) el.scrollTop=el.scrollHeight; },100);
}

function clearYT(qi) {
  S.editQs[qi].youtubeId = '';
  S.editQs[qi].youtubeUrl = '';
  renderQEditor();
}

function setYoutubeUrl(qi, url) {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if(match) {
    S.editQs[qi].youtubeId    = match[1];
    S.editQs[qi].youtubeUrl   = url;
    S.editQs[qi].youtubeStart = S.editQs[qi].youtubeStart || 0;
    S.editQs[qi].youtubeEnd   = S.editQs[qi].youtubeEnd   || 30;
    S.editQs[qi].audioUrl     = '';
    notify('Link do YouTube detectado! ✓');
    renderQEditor();
  } else {
    S.editQs[qi].youtubeUrl = url;
    S.editQs[qi].youtubeId  = '';
  }
}

function setMp3Url(qi, url) {
  S.editQs[qi].audioUrl   = url.trim();
  S.editQs[qi].youtubeId  = '';
  S.editQs[qi].youtubeUrl = '';
}

// ── LINK HELPERS ─────────────────────────────────────
function setPhoto(qi, oi, url) {
  if(!S.editQs[qi].photos) S.editQs[qi].photos=['','','',''];
  S.editQs[qi].photos[oi] = url.trim();
}

function saveQuiz() {
  const title=document.getElementById('qt').value.trim();
  if(!title) return notify('Dê um título','err');
  if(!S.editQs.length) return notify('Adicione perguntas','err');
  for(const q of S.editQs) {
    if(!q.text.trim()) return notify('Preencha o texto de todas as perguntas','err');
    if(q.type==='text'&&q.options.some(o=>!o.trim())) return notify('Preencha todas as opções de texto','err');
    if(q.type==='photo'&&(!q.photos||q.photos.filter(p=>p.trim()).length<4)) return notify('Cole links para todas as 4 fotos','err');
    if(q.type==='music'&&!q.youtubeId&&!q.audioUrl) return notify('Adicione uma música (busque no YouTube ou cole um link)','err');
    if(q.type==='music'&&q.options.some(o=>!o.trim())) return notify('Preencha as opções da pergunta musical','err');
  }
  const quiz={title,questions:JSON.parse(JSON.stringify(S.editQs))};
  if(S.editIdx>=0) S.quizzes[S.editIdx]=quiz; else S.quizzes.push(quiz);
  persistQuizzes(); notify('Salvo! ✓'); go('dashboard');
}

// ── LOBBY ────────────────────────────────────────────
async function openLobby(i) {
  if(!requireDB()) return;
  if(!S.quizzes[i].questions.length) return notify('Adicione perguntas primeiro','err');
  const code=genCode(); S.code=code; S.currentQuizIdx=i;
  await dbSet(`rooms/${code}`,{ quiz:S.quizzes[i], players:{}, started:false, qIdx:0, answers:{}, phase:'lobby', revealCorrect:-1, done:false });
  document.getElementById('lcode').textContent=code;
  document.getElementById('lcount').textContent='0';
  document.getElementById('lplayers').innerHTML='';
  const u=document.getElementById('lsite-url'); if(u) u.textContent=location.href.split('?')[0];
  go('lobby');
  stopListen();
  S.unsub=listen(`rooms/${code}/players`,players=>{
    if(!players) return;
    const names=Object.keys(players);
    document.getElementById('lcount').textContent=names.length;
    document.getElementById('lplayers').innerHTML=names.map(n=>`<div class="la-chip" style="background:${players[n].color||'#5C21A6'}">${players[n].avatar||'🎮'} ${esc(n)}</div>`).join('');
  });
}

function cancelRoom() { stopListen(); if(db&&S.code) db.ref(`rooms/${S.code}`).remove().catch(()=>{}); go('dashboard'); }

async function startGame() {
  if(!requireDB()) return;
  const r=await dbGet(`rooms/${S.code}`);
  if(!r) return notify('Sala não encontrada','err');
  if(!r.players||!Object.keys(r.players).length) return notify('Aguarde pelo menos 1 jogador!','err');
  stopListen();
  await dbUpdate(`rooms/${S.code}`,{started:true,qIdx:0,phase:'question',answers:{},revealCorrect:-1});
  go('game-host'); renderHostQ();
}

// ── HOST QUESTION ───────────────────────────────────
async function renderHostQ() {
  stopTimer(); stopCd(); stopListen();
  const room=await dbGet(`rooms/${S.code}`); if(!room) return;
  const q=room.quiz.questions[room.qIdx];
  const tot=room.quiz.questions.length;
  await dbUpdate(`rooms/${S.code}`,{answers:{},phase:'question',revealCorrect:-1});
  document.getElementById('ghn').textContent=`${room.qIdx+1}/${tot}`;
  document.getElementById('ghans').textContent='0 resp.';
  document.getElementById('ghq').textContent=q.text;
  document.getElementById('ghprog').style.width=((room.qIdx/tot)*100)+'%';
  document.getElementById('ghreveal').style.display='none';

  const type=q.type||'text';
  // Music — YouTube or audio URL
  const ghm=document.getElementById('gh-music');
  if(type==='music') {
    ghm.style.display='flex';
    if(q.youtubeId) {
      // Replace music player with YouTube embed
      const start = q.youtubeStart||0, end = q.youtubeEnd||30;
      ghm.innerHTML=`
        <div style="width:100%;max-width:700px">
          <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.5rem">
            <div class="mp-icon">🎵</div>
            <div class="mp-info"><div class="mp-label">Ouça o trecho e responda!</div></div>
          </div>
          <div style="position:relative;border-radius:10px;overflow:hidden;background:#000;aspect-ratio:16/6">
            <iframe id="gh-yt-frame"
              src="https://www.youtube.com/embed/${q.youtubeId}?start=${start}&end=${end}&autoplay=1&controls=1&rel=0&modestbranding=1"
              style="width:100%;height:100%;border:none"
              allow="autoplay; encrypted-media" allowfullscreen>
            </iframe>
          </div>
          <div style="font-size:.72rem;color:rgba(255,255,255,.35);margin-top:.3rem;text-align:center">Trecho: ${start}s → ${end}s</div>
        </div>`;
    } else {
      ghm.innerHTML=`
        <div class="mp-icon">🎵</div>
        <div class="mp-info"><div class="mp-label">Ouça o trecho e responda!</div><div class="mp-bar"><div class="mp-fill" id="gh-mp-fill"></div></div></div>
        <audio id="gh-audio" src="${q.audioUrl||''}" preload="auto"></audio>
        <button class="mp-play-btn" id="gh-play-btn" onclick="toggleAudio('gh-audio','gh-play-btn','gh-mp-fill')">▶ Tocar</button>`;
      setTimeout(()=>{
        const a=document.getElementById('gh-audio'); if(a){ a.src=q.audioUrl||''; a.load(); }
      },100);
    }
  } else { ghm.style.display='none'; ghm.innerHTML=''; }

  // Photo
  const ghp=document.getElementById('gh-photos');
  if(type==='photo') {
    ghp.style.display='grid'; ghp.className='photo-grid host';
    ghp.innerHTML=(q.photos||[]).map((url,i)=>`
      <div class="photo-opt p${i} disabled">
        <img src="${url}" alt="">
        <div class="photo-shape">${SHAPES[i]}</div>
        ${q.labels&&q.labels[i]?`<div class="photo-label">${esc(q.labels[i])}</div>`:''}
      </div>`).join('');
  } else ghp.style.display='none';

  // Text options
  const gho=document.getElementById('ghopts');
  if(type==='text'||type==='music') {
    gho.style.display='grid';
    gho.innerHTML=q.options.map((o,i)=>`<button class="abt a${i}"><span class="ash">${SHAPES[i]}</span><span>${esc(o)}</span></button>`).join('');
  } else gho.style.display='none';

  startTimer('ghring','ghtimer',()=>doReveal(room.qIdx));
  const pc=Object.keys(room.players||{}).length;
  stopListen();
  S.unsub=listen(`rooms/${S.code}/answers`,answers=>{
    const cnt=answers?Object.keys(answers).length:0;
    document.getElementById('ghans').textContent=`${cnt}/${pc} resp.`;
    if(pc>0&&cnt>=pc){ stopTimer(); stopListen(); doReveal(room.qIdx); }
  });
}

async function doReveal(qIdx) {
  stopTimer(); stopListen(); stopCd();
  const room=await dbGet(`rooms/${S.code}`);
  if(!room||room.phase==='reveal'||room.phase==='countdown') return;
  const q=room.quiz.questions[qIdx];
  const correct=q.correct;
  const answers=room.answers||{};
  const updates={};
  Object.keys(room.players||{}).forEach(name=>{
    const prev=room.players[name].score||0;
    const a=answers[name];
    const pts=(a!==undefined&&a.choice===correct)?500+Math.floor((a.time/TIMER_SEC)*500):0;
    updates[`rooms/${S.code}/players/${name}/score`]=prev+pts;
  });
  updates[`rooms/${S.code}/phase`]='reveal';
  updates[`rooms/${S.code}/revealCorrect`]=correct;
  await db.ref('/').update(updates);
  const updated=await dbGet(`rooms/${S.code}`);

  // Reveal correct answer visually
  const type=q.type||'text';
  if(type==='photo') {
    const photoOpts=document.getElementById('gh-photos').children;
    for(let i=0;i<photoOpts.length;i++) photoOpts[i].classList.add(i===correct?'correct':'wrong');
  } else {
    const btns=document.getElementById('ghopts').children;
    for(let i=0;i<btns.length;i++) btns[i].classList.add(i===correct?'correct':'wrong');
  }

  renderLiveRank(updated.players||{});
  document.getElementById('ghreveal').style.display='block';
  const isLast=qIdx>=room.quiz.questions.length-1;
  const nm=document.getElementById('gh-next-msg');
  const nb=document.getElementById('ghnext');
  if(isLast){ if(nm) nm.style.display='none'; if(nb){ nb.style.display='flex'; nb.textContent='🏆 Ver Resultados Finais'; } }
  else { if(nb) nb.style.display='none'; startCountdown(REVEAL_SEC,()=>nextQ()); }
}

function renderLiveRank(players) {
  const sorted=Object.entries(players).sort((a,b)=>b[1].score-a[1].score).slice(0,5);
  document.getElementById('ghrank').innerHTML=sorted.map(([n,d],i)=>`
    <div class="rank-row">
      <div class="rmed ${['rm1','rm2','rm3'][i]||'rmn'}">${i+1}</div>
      <span class="rname">${d.avatar||'🎮'} ${esc(n)}</span>
      <span class="rpts">${d.score||0}</span>
    </div>`).join('');
}

function startCountdown(secs,cb) {
  stopCd(); let left=secs;
  const nm=document.getElementById('gh-next-msg'), cd=document.getElementById('gh-countdown');
  if(nm) nm.style.display='block'; if(cd) cd.textContent=left;
  dbUpdate(`rooms/${S.code}`,{phase:'countdown'}).catch(()=>{});
  S.cdIv=setInterval(()=>{ left--; if(cd) cd.textContent=left; if(left<=0){ stopCd(); cb(); } },1000);
}

async function nextQ() {
  stopCd();
  const room=await dbGet(`rooms/${S.code}`); if(!room) return;
  const nextIdx=(room.qIdx||0)+1;
  if(nextIdx>=room.quiz.questions.length) {
    await dbUpdate(`rooms/${S.code}`,{phase:'waiting_final',qIdx:nextIdx-1});
    showHostFinalWait(room); return;
  }
  await dbUpdate(`rooms/${S.code}`,{qIdx:nextIdx,phase:'question',answers:{},revealCorrect:-1});
  renderHostQ();
}

async function showHostFinalWait(room) {
  stopTimer(); stopCd(); stopListen();
  document.getElementById('ghopts').style.display='none';
  document.getElementById('gh-music').style.display='none';
  document.getElementById('gh-photos').style.display='none';
  document.getElementById('ghq').textContent='Quiz finalizado!';
  document.getElementById('ghprog').style.width='100%';
  document.getElementById('ghn').textContent='Fim!';
  document.getElementById('ghans').textContent='';
  renderLiveRank(room.players||{});
  document.getElementById('ghreveal').style.display='block';
  const nm=document.getElementById('gh-next-msg'), nb=document.getElementById('ghnext');
  if(nm) nm.style.display='none';
  if(nb){ nb.style.display='flex'; nb.textContent='🏆 Ver Resultados Finais'; nb.onclick=hostClickFinal; }
}

async function hostClickFinal() {
  const room=await dbGet(`rooms/${S.code}`); if(!room) return;
  await dbUpdate(`rooms/${S.code}`,{done:true,phase:'done'});
  renderHostFinal(room);
}

function renderHostFinal(room) {
  const sorted=Object.entries(room.players||{}).sort((a,b)=>b[1].score-a[1].score);
  buildPodium(sorted,'finpod');
  document.getElementById('finrank').innerHTML=sorted.map(([n,d],i)=>`
    <div class="rank-row">
      <div class="rmed ${['rm1','rm2','rm3'][i]||'rmn'}">${i+1}</div>
      <span class="rname">${d.avatar||'🎮'} ${esc(n)}</span>
      <span class="rpts">${d.score||0} pts</span>
    </div>`).join('');
  if(sorted.length){ document.getElementById('finwinner').style.display='block'; document.getElementById('finwname').textContent=sorted[0][0]; }
  go('final');
}
function replayRoom() { openLobby(S.currentQuizIdx); }

// ── PLAYER JOIN ──────────────────────────────────────
async function goToName() {
  if(!db) tryLoadSavedFirebase();
  if(!db) { notify('Erro de conexão. Tente recarregar a página.','err'); return; }
  const code=document.getElementById('pcode').value.trim().toUpperCase();
  if(code.length<4) return notify('Código muito curto','err');
  try {
    const room=await dbGet(`rooms/${code}`);
    if(!room) return notify(`Sala "${code}" não encontrada!`,'err');
    if(room.started) return notify('Quiz já iniciou!','err');
    document.getElementById('pcode').dataset.code=code;
    go('join-name'); setTimeout(()=>document.getElementById('pname').focus(),100);
  } catch(e) { notify('Erro de conexão. Tente recarregar a página.','err'); }
}

async function joinRoom() {
  if(!db) tryLoadSavedFirebase();
  if(!db) { notify('Erro de conexão. Tente recarregar a página.','err'); return; }
  const name=document.getElementById('pname').value.trim();
  const code=document.getElementById('pcode').dataset.code||document.getElementById('pcode').value.trim().toUpperCase();
  if(!name) return notify('Digite seu apelido','err');
  const room=await dbGet(`rooms/${code}`);
  if(!room) return notify('Sala não encontrada','err');
  if(room.started) return notify('Quiz já iniciou!','err');
  if(room.players&&room.players[name]) return notify('Apelido em uso!','err');
  const avatar=rand(AVATARS), color=rand(AV_COLORS);
  await dbSet(`rooms/${code}/players/${name}`,{score:0,avatar,color});
  S.name=name; S.code=code; S.score=0; S.answered=false; S.lastQ=-1;
  S.avatar=avatar; S.color=color;
  document.getElementById('wcode').textContent=code;
  document.getElementById('wname').textContent=name;
  const av=document.getElementById('wavatar'); av.textContent=avatar; av.style.background=color;
  go('waiting'); listenForStart();
}

// ── PLAYER LISTENERS ────────────────────────────────
function listenForStart() {
  stopListen();
  S.unsub=listen(`rooms/${S.code}/phase`,phase=>{
    if(phase==='question') {
      dbGet(`rooms/${S.code}`).then(room=>{ if(room&&room.qIdx!==S.lastQ){ stopListen(); renderPlayerQ(room); } });
    }
  });
}

function renderPlayerQ(room) {
  const qIdx=room.qIdx; S.lastQ=qIdx; S.answered=false;
  const q=room.quiz.questions[qIdx];
  const tot=room.quiz.questions.length;
  const type=q.type||'text';

  document.getElementById('plqn').textContent=`${qIdx+1}/${tot}`;
  document.getElementById('plprog').style.width=((qIdx/tot)*100)+'%';
  document.getElementById('plpts').textContent=S.score+' pts';
  document.getElementById('plfb').style.display='none';

  // Music player — YouTube or audio URL
  const plm=document.getElementById('pl-music');
  if(type==='music') {
    plm.style.display='flex';
    if(q.youtubeId) {
      const start=q.youtubeStart||0, end=q.youtubeEnd||30;
      plm.innerHTML=`
        <div style="width:100%">
          <div style="display:flex;align-items:center;gap:.65rem;margin-bottom:.45rem">
            <div class="mp-icon">🎵</div>
            <div class="mp-info"><div class="mp-label">Ouça e responda!</div></div>
          </div>
          <div style="position:relative;border-radius:10px;overflow:hidden;background:#000;aspect-ratio:16/6">
            <iframe src="https://www.youtube.com/embed/${q.youtubeId}?start=${start}&end=${end}&autoplay=1&controls=1&rel=0&modestbranding=1"
              style="width:100%;height:100%;border:none"
              allow="autoplay; encrypted-media" allowfullscreen>
            </iframe>
          </div>
        </div>`;
    } else {
      plm.innerHTML=`
        <div class="mp-icon">🎵</div>
        <div class="mp-info"><div class="mp-label">Ouça e responda!</div><div class="mp-bar"><div class="mp-fill" id="pl-mp-fill"></div></div></div>
        <audio id="pl-audio" src="${q.audioUrl||''}" preload="auto"></audio>
        <button class="mp-play-btn" id="pl-play-btn" onclick="toggleAudio('pl-audio','pl-play-btn','pl-mp-fill')">▶ Ouvir</button>`;
      setTimeout(()=>{
        const a=document.getElementById('pl-audio'); if(a){ a.src=q.audioUrl||''; a.load(); }
      },100);
    }
  } else { plm.style.display='none'; plm.innerHTML=''; }

  // Photo grid
  const plp=document.getElementById('pl-photos');
  if(type==='photo') {
    plp.style.display='grid';
    plp.innerHTML=(q.photos||[]).map((url,i)=>`
      <div class="photo-opt p${i}" onclick="playerAns(${i},${qIdx})">
        <img src="${url}" alt="">
        <div class="photo-shape">${SHAPES[i]}</div>
        ${q.labels&&q.labels[i]?`<div class="photo-label">${esc(q.labels[i])}</div>`:''}
      </div>`).join('');
  } else plp.style.display='none';

  // Question text
  const qbox=document.getElementById('plqbox');
  qbox.style.display='flex';
  document.getElementById('plq').textContent=q.text;

  // Text options
  const plopts=document.getElementById('plopts');
  if(type==='text'||type==='music') {
    plopts.style.display='grid';
    plopts.innerHTML=q.options.map((o,i)=>`
      <button class="abt a${i}" onclick="playerAns(${i},${qIdx})">
        <span class="ash">${SHAPES[i]}</span><span>${esc(o)}</span>
      </button>`).join('');
  } else plopts.style.display='none';

  go('playing');
  startTimer('plring','pltimer',()=>playerTimeout(qIdx));
  listenForReveal(qIdx);
}

async function playerAns(choice,qIdx) {
  if(S.answered) return;
  S.answered=true; stopTimer();
  stopMediaPlayback(); // para YouTube e áudio ao responder
  document.querySelectorAll('#plopts .abt, #pl-photos .photo-opt').forEach((b,i)=>{ b.disabled=true; if(i===choice) b.classList.add('chosen'); });
  try { await dbSet(`rooms/${S.code}/answers/${S.name}`,{choice,time:S.timerLeft}); } catch(e){}
}

async function playerTimeout(qIdx) {
  if(S.answered) return; S.answered=true;
  stopMediaPlayback(); // para YouTube e áudio ao acabar o tempo
  try { await dbSet(`rooms/${S.code}/answers/${S.name}`,{choice:-1,time:0}); } catch(e){}
}

function stopMediaPlayback() {
  // Para áudio MP3
  try {
    const a = document.getElementById('pl-audio');
    if(a){ a.pause(); a.currentTime=0; }
  } catch(e){}
  // Para YouTube — substitui src do iframe por vazio (única forma confiável)
  try {
    const frame = document.querySelector('#pl-music iframe');
    if(frame){ frame.src=''; }
  } catch(e){}
}

function listenForReveal(qIdx) {
  stopListen();
  S.unsub=listen(`rooms/${S.code}`,room=>{
    if(!room) return;
    if(room.done&&room.phase==='done'){ stopListen(); showPlayerFinal(room); return; }
    if((room.phase==='reveal'||room.phase==='countdown'||room.phase==='waiting_final')&&room.qIdx===qIdx){
      stopListen(); showFeedback(room,qIdx);
    }
  });
}

function showFeedback(room,qIdx) {
  stopTimer();
  const q=room.quiz.questions[qIdx];
  const correct=room.revealCorrect;
  const answers=room.answers||{};
  const a=answers[S.name];
  const ok=a!==undefined&&a.choice===correct;
  const pts=ok?500+Math.floor((a.time/TIMER_SEC)*500):0;
  S.score+=pts;

  // Reveal correct on photos or text options
  const type=q.type||'text';
  if(type==='photo') {
    const opts=document.getElementById('pl-photos').children;
    for(let i=0;i<opts.length;i++){ opts[i].classList.add('disabled'); if(i===correct) opts[i].classList.add('correct'); else if(a&&a.choice===i) opts[i].classList.add('wrong'); }
  } else {
    const btns=document.getElementById('plopts').children;
    for(let i=0;i<btns.length;i++){ btns[i].disabled=true; if(i===correct) btns[i].classList.add('correct'); else if(a&&a.choice===i) btns[i].classList.add('wrong'); }
  }

  const fbc=document.getElementById('plfbcard');
  fbc.className='fb-card '+(ok?'ok':'fail');
  document.getElementById('plicon').textContent=ok?'✅':'❌';
  document.getElementById('pltxt').textContent=ok?'Correto!':'Errado!';
  document.getElementById('plptsadd').textContent=ok?`+${pts} pontos`:'Sem pontos';
  document.getElementById('plpts').textContent=S.score+' pts';
  document.getElementById('plfb').style.display='flex';
  listenForNext(qIdx);
}

function listenForNext(qIdx) {
  stopListen();
  S.unsub=listen(`rooms/${S.code}`,room=>{
    if(!room) return;
    if(room.done&&room.phase==='done'){ stopListen(); showPlayerFinal(room); return; }
    if(room.phase==='question'&&room.qIdx>qIdx){ stopListen(); document.getElementById('plfb').style.display='none'; renderPlayerQ(room); }
  });
}

function showPlayerFinal(room) {
  stopTimer(); stopListen();
  // Stop audio and YouTube iframes
  ['pl-audio','gh-audio'].forEach(id=>{ try { const a=document.getElementById(id); if(a){ a.pause(); a.currentTime=0; } } catch(e){} });
  ['pl-music','gh-music'].forEach(id=>{ try { const el=document.getElementById(id); if(el){ const f=el.querySelector('iframe'); if(f) f.src=''; } } catch(e){} });
  const sorted=Object.entries(room.players||{}).sort((a,b)=>b[1].score-a[1].score);
  const pos=sorted.findIndex(([n])=>n===S.name)+1;
  const icns=['🥇','🥈','🥉','🎉','🙂','😊'];
  const ttls=['Você ganhou!','Incrível!','Ótimo jogo!','Bom jogo!','Bom jogo!','Bom jogo!'];
  document.getElementById('pfico').textContent=icns[Math.min(pos-1,5)];
  document.getElementById('pftitle').textContent=ttls[Math.min(pos-1,5)];
  document.getElementById('pfsub').textContent=pos===1?'Você foi o melhor! 🏆':`Você ficou em ${pos}º lugar`;
  document.getElementById('pfscore').textContent=S.score+' pts';
  document.getElementById('pfpos').textContent=`${pos}º de ${sorted.length} jogadores`;
  buildPodium(sorted.slice(0,3),'pfpod');
  go('pfinal');
}

// ── PODIUM ───────────────────────────────────────────
function buildPodium(sorted,elId) {
  const el=document.getElementById(elId); if(!el) return;
  const top=sorted.slice(0,3); if(!top.length){ el.innerHTML=''; return; }
  const order=top.length>=3?[top[1],top[0],top[2]]:top.length===2?[top[1],top[0]]:[top[0]];
  const cls=['pb2','pb1','pb3'], ico=['🥈','👑','🥉'];
  el.innerHTML=order.map(([n,d],pi)=>`
    <div class="pod-pl">
      <div class="pod-name">${d.avatar||'🎮'} ${esc(n)}</div>
      <div class="pod-pts">${d.score||0} pts</div>
      <div class="pod-bar ${cls[pi]}">${ico[pi]}</div>
    </div>`).join('');
}

// ── AUDIO PLAYER ────────────────────────────────────
function toggleAudio(audioId, btnId, fillId) {
  const audio=document.getElementById(audioId);
  const btn=document.getElementById(btnId);
  const fill=document.getElementById(fillId);
  if(!audio.src||audio.src==='undefined') { notify('Áudio não disponível','err'); return; }
  if(audio.paused) {
    audio.play().catch(()=>notify('Erro ao tocar o áudio','err'));
    btn.textContent='⏸ Pausar'; btn.classList.add('playing');
    audio.ontimeupdate=()=>{ if(audio.duration) fill.style.width=(audio.currentTime/audio.duration*100)+'%'; };
    audio.onended=()=>{ btn.textContent='▶ Ouvir novamente'; btn.classList.remove('playing'); };
  } else {
    audio.pause(); btn.textContent='▶ Ouvir'; btn.classList.remove('playing');
  }
}

// ── TIMER ────────────────────────────────────────────
function startTimer(ringId,numId,onEnd) {
  stopTimer(); S.timerLeft=TIMER_SEC;
  const ring=document.getElementById(ringId), num=document.getElementById(numId);
  const DASH=151;
  const upd=()=>{
    const pct=S.timerLeft/TIMER_SEC;
    ring.style.strokeDashoffset=DASH*(1-pct);
    const warn=S.timerLeft<=5;
    ring.style.stroke=warn?'#E84C39':'#F5C200';
    num.textContent=Math.ceil(S.timerLeft); num.style.color=warn?'#E84C39':'#fff';
    // Warning animation + sound on timer
    if(warn){ num.classList.add('timer-warn-anim'); }
    else { num.classList.remove('timer-warn-anim'); }
    // Beep a cada segundo quando <= 5
    const ceil=Math.ceil(S.timerLeft);
    if(warn && ceil!==S._lastBeep){ S._lastBeep=ceil; sfx(ceil<=3?'beep_fast':'beep'); }
    if(!warn) S._lastBeep=0;
  };
  upd();
  S.timerIv=setInterval(()=>{ S.timerLeft-=.2; upd(); if(S.timerLeft<=0){ stopTimer(); S.timerLeft=0; upd(); onEnd(); } },200);
}

// ══════════════════════════════════════════════════
//  SOUND SYSTEM — Web Audio API (sem arquivos externos)
// ══════════════════════════════════════════════════
let _ac = null;
function getAC() {
  if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)();
  if (_ac.state === 'suspended') _ac.resume();
  return _ac;
}

// Gera sons retrô com osciladores
function sfx(name) {
  try {
    const ac = getAC();
    const sounds = {
      // Coin Mario — dois tons subindo rápido
      coin: () => {
        playTone(ac, 'square', 988,  0,    0.08, 0.1);
        playTone(ac, 'square', 1319, 0.08, 0.08, 0.1);
      },
      // Select — bip curto
      select: () => {
        playTone(ac, 'square', 440, 0, 0.06, 0.08);
        playTone(ac, 'square', 660, 0.06, 0.06, 0.08);
      },
      // Start — fanfara ascendente
      start: () => {
        [523,659,784,1047].forEach((f,i) => playTone(ac,'square',f,i*0.07,0.07,0.15));
      },
      // Back — tom descendente
      back: () => {
        playTone(ac, 'square', 440, 0,    0.06, 0.08);
        playTone(ac, 'square', 330, 0.06, 0.06, 0.08);
      },
      // Correct — fanfara vitória
      correct: () => {
        [523,659,784,1047,1319].forEach((f,i) => playTone(ac,'square',f,i*0.06,0.06,0.18));
      },
      // Wrong — buzzer erro
      wrong: () => {
        playNoise(ac, 0, 0.15, 0.3);
        playTone(ac, 'sawtooth', 150, 0, 0.2, 0.2);
        playTone(ac, 'sawtooth', 100, 0.1, 0.15, 0.2);
      },
      // Beep contagem regressiva normal (5-4)
      beep: () => {
        playTone(ac, 'square', 880, 0, 0.05, 0.04);
      },
      // Beep rápido (3-2-1)
      beep_fast: () => {
        playTone(ac, 'square', 1100, 0, 0.06, 0.04);
      },
      // Time up — fim do tempo
      timeup: () => {
        playTone(ac, 'sawtooth', 440, 0,   0.08, 0.15);
        playTone(ac, 'sawtooth', 330, 0.1, 0.08, 0.15);
        playTone(ac, 'sawtooth', 220, 0.2, 0.1,  0.2);
      },
      // Winner — tema de vitória longo
      winner: () => {
        const melody=[523,523,523,523,415,466,523,0,466,523];
        const times= [0,.18,.36,.54,.72,.9,1.08,1.26,1.35,1.53];
        melody.forEach((f,i)=>{ if(f>0) playTone(ac,'square',f,times[i],0.15,0.2); });
      },
      // Hadouken — swoosh grave
      hadouken: () => {
        playTone(ac,'sawtooth',200,0,  0.05,0.3);
        playTone(ac,'sawtooth',400,0.05,0.1,0.3);
        playTone(ac,'square', 800,0.1, 0.1,0.2);
        playNoise(ac,0.1,0.2,0.4);
      },
      // 1UP — sequência clássica
      oneup: () => {
        [784,1047,1319,1568,2093].forEach((f,i)=>playTone(ac,'square',f,i*0.08,0.08,0.12));
      },
      // Reveal — drum roll estilo
      reveal: () => {
        for(let i=0;i<6;i++) playNoise(ac,i*0.04,0.02,0.15);
        playTone(ac,'square',523,0.25,0.08,0.15);
        playTone(ac,'square',784,0.33,0.08,0.15);
        playTone(ac,'square',1047,0.41,0.12,0.2);
      },
    };
    if (sounds[name]) sounds[name]();
  } catch(e) { console.warn('sfx error:', e); }
}

function playTone(ac, type, freq, delay, duration, vol=0.15) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain); gain.connect(ac.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime + delay);
  gain.gain.setValueAtTime(vol, ac.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + duration);
  osc.start(ac.currentTime + delay);
  osc.stop(ac.currentTime + delay + duration + 0.01);
}

function playNoise(ac, delay, duration, vol=0.1) {
  const buf = ac.createBuffer(1, ac.sampleRate * duration, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i=0; i<data.length; i++) data[i] = Math.random()*2-1;
  const src = ac.createBufferSource();
  const gain = ac.createGain();
  const filter = ac.createBiquadFilter();
  filter.type='bandpass'; filter.frequency.value=800; filter.Q.value=0.5;
  src.buffer=buf; src.connect(filter); filter.connect(gain); gain.connect(ac.destination);
  gain.gain.setValueAtTime(vol, ac.currentTime+delay);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime+delay+duration);
  src.start(ac.currentTime+delay);
  src.stop(ac.currentTime+delay+duration+0.01);
}

// ── HOOK SONS NO JOGO ──────────────────────────────
// Tocar som correto/errado no feedback do jogador
const _origShowFeedback = showFeedback;
showFeedback = function(room, qIdx) {
  const q = room.quiz.questions[qIdx];
  const correct = room.revealCorrect;
  const a = (room.answers||{})[S.name];
  const ok = a !== undefined && a.choice === correct;
  sfx(ok ? 'correct' : 'wrong');
  _origShowFeedback(room, qIdx);
};

// Som no reveal do host
const _origDoReveal = doReveal;
doReveal = async function(qIdx) {
  await _origDoReveal(qIdx);
  sfx('reveal');
};

// Som de vitória na tela final do jogador
const _origShowPlayerFinal = showPlayerFinal;
showPlayerFinal = function(room) {
  const sorted = Object.entries(room.players||{}).sort((a,b)=>b[1].score-a[1].score);
  const pos = sorted.findIndex(([n])=>n===S.name)+1;
  sfx(pos===1 ? 'winner' : pos<=3 ? 'oneup' : 'select');
  _origShowPlayerFinal(room);
};

// Som de fim do tempo
const _origStopTimer = stopTimer;
stopTimer = function() {
  _origStopTimer();
};

// ── INTRO SEQUENCE ────────────────────────────────
function runIntro() {
  // Tocar coin na entrada
  setTimeout(() => sfx('coin'), 800);
  setTimeout(() => sfx('select'), 1400);
  // Intro já fica visível via CSS — não precisa fazer nada
}

// Inicializar som ao primeiro toque (iOS exige interação)
document.addEventListener('touchstart', () => { try { getAC(); } catch(e){} }, { once: true });
document.addEventListener('click',      () => { try { getAC(); } catch(e){} }, { once: true });

// ── CLEANUP ──────────────────────────────────────────
tryLoadSavedFirebase();
runIntro();
