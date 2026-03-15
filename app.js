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

let db = null, storage = null;
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
    storage = firebase.storage();
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

async function uploadFile(file, path) {
  const ref = storage.ref(path);
  const snap = await ref.put(file);
  return await snap.ref.getDownloadURL();
}

// ── UTIL ────────────────────────────────────────────
function notify(msg, type='ok') {
  const n = document.getElementById('notif');
  n.textContent=msg; n.className=type; n.style.display='block';
  clearTimeout(n._t); n._t=setTimeout(()=>n.style.display='none',2800);
}
function go(id) {
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
  if(type==='music') { q.text='Que música é essa?'; q.audioUrl=''; q.options=['','','','']; q.correct=0; }
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
        <div class="orow" style="align-items:flex-start;flex-direction:column;gap:.35rem">
          <div style="display:flex;align-items:center;gap:.5rem;width:100%">
            <div class="obadge ob${oi}">${SHAPES[oi]}</div>
            <label class="upload-area" style="flex:1">
              ${url ? `<img src="${url}" class="upload-preview" alt="">` : '<span class="upload-placeholder">📸 Clique para enviar foto</span>'}
              <input type="file" accept="image/*" onchange="handlePhotoUpload(event,${qi},${oi})">
            </label>
          </div>
          <input class="einput" value="${esc((q.labels||[])[oi]||'')}" placeholder="Legenda da foto (opcional)..." oninput="S.editQs[${qi}].labels[${oi}]=this.value" style="margin-left:40px">
        </div>`).join('')}
      <div class="clbl">Foto correta:</div>
      <div class="cbtns">${'ABCD'.split('').map((l,li)=>`<button class="cbtn ${q.correct===li?'on':''}" onclick="setCorr(${qi},${li})">${l}</button>`).join('')}</div>
    </div>`;

    if(type==='music') return `<div class="q-ec q-type-music">${header}
      <div class="music-upload-row">
        <label class="upload-area" style="max-width:100%">
          ${q.audioUrl
            ? `<div class="music-preview">🎵 Áudio carregado — <a href="${q.audioUrl}" target="_blank" style="color:#C084FC">ouvir</a></div>`
            : '<span class="upload-placeholder">🎵 Clique para enviar áudio (MP3/OGG)</span>'}
          <input type="file" accept="audio/*" onchange="handleAudioUpload(event,${qi})">
        </label>
      </div>
      ${q.options.map((o,oi)=>`
        <div class="orow">
          <div class="obadge ob${oi}">${SHAPES[oi]}</div>
          <input class="einput" value="${esc(o)}" placeholder="Opção ${'ABCD'[oi]}..." oninput="S.editQs[${qi}].options[${oi}]=this.value">
        </div>`).join('')}
      <div class="clbl">Resposta correta:</div>
      <div class="cbtns">${'ABCD'.split('').map((l,li)=>`<button class="cbtn ${q.correct===li?'on':''}" onclick="setCorr(${qi},${li})">${l}</button>`).join('')}</div>
    </div>`;

    return '';
  }).join('');
}

// ── FILE UPLOADS ────────────────────────────────────
async function handlePhotoUpload(event, qi, oi) {
  if(!requireDB()) return;
  const file = event.target.files[0];
  if(!file) return;
  if(file.size > 5*1024*1024) { notify('Foto muito grande (máx 5MB)','err'); return; }
  notify('Enviando foto...','info');
  try {
    const url = await uploadFile(file, `quizzes/photos/${Date.now()}_${file.name}`);
    if(!S.editQs[qi].photos) S.editQs[qi].photos=['','','',''];
    S.editQs[qi].photos[oi] = url;
    notify('Foto enviada! ✓');
    renderQEditor();
  } catch(e) { notify('Erro ao enviar foto: '+e.message,'err'); console.error(e); }
}

async function handleAudioUpload(event, qi) {
  if(!requireDB()) return;
  const file = event.target.files[0];
  if(!file) return;
  if(file.size > 10*1024*1024) { notify('Áudio muito grande (máx 10MB)','err'); return; }
  notify('Enviando áudio...','info');
  try {
    const url = await uploadFile(file, `quizzes/audio/${Date.now()}_${file.name}`);
    S.editQs[qi].audioUrl = url;
    notify('Áudio enviado! ✓');
    renderQEditor();
  } catch(e) { notify('Erro ao enviar áudio: '+e.message,'err'); console.error(e); }
}

function saveQuiz() {
  const title=document.getElementById('qt').value.trim();
  if(!title) return notify('Dê um título','err');
  if(!S.editQs.length) return notify('Adicione perguntas','err');
  for(const q of S.editQs) {
    if(!q.text.trim()) return notify('Preencha o texto de todas as perguntas','err');
    if(q.type==='text'&&q.options.some(o=>!o.trim())) return notify('Preencha todas as opções de texto','err');
    if(q.type==='photo'&&(!q.photos||q.photos.some(p=>!p))) return notify('Envie todas as 4 fotos','err');
    if(q.type==='music'&&!q.audioUrl) return notify('Envie o áudio da pergunta musical','err');
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
  // Music
  const ghm=document.getElementById('gh-music');
  if(type==='music') {
    ghm.style.display='flex';
    const a=document.getElementById('gh-audio'); a.src=q.audioUrl; a.load();
    document.getElementById('gh-play-btn').textContent='▶ Tocar';
    document.getElementById('gh-play-btn').className='mp-play-btn';
    document.getElementById('gh-mp-fill').style.width='0%';
  } else ghm.style.display='none';

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

  // Music player
  const plm=document.getElementById('pl-music');
  if(type==='music') {
    plm.style.display='flex';
    const a=document.getElementById('pl-audio'); a.src=q.audioUrl; a.load();
    document.getElementById('pl-play-btn').textContent='▶ Ouvir';
    document.getElementById('pl-play-btn').className='mp-play-btn';
    document.getElementById('pl-mp-fill').style.width='0%';
  } else plm.style.display='none';

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
  // Disable all interactive options
  document.querySelectorAll('#plopts .abt, #pl-photos .photo-opt').forEach((b,i)=>{ b.disabled=true; if(i===choice) b.classList.add('chosen'); });
  try { await dbSet(`rooms/${S.code}/answers/${S.name}`,{choice,time:S.timerLeft}); } catch(e){}
}

async function playerTimeout(qIdx) {
  if(S.answered) return; S.answered=true;
  try { await dbSet(`rooms/${S.code}/answers/${S.name}`,{choice:-1,time:0}); } catch(e){}
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
  // Stop any audio
  ['pl-audio','gh-audio'].forEach(id=>{ try { const a=document.getElementById(id); if(a){ a.pause(); a.currentTime=0; } } catch(e){} });
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
  };
  upd();
  S.timerIv=setInterval(()=>{ S.timerLeft-=.2; upd(); if(S.timerLeft<=0){ stopTimer(); S.timerLeft=0; upd(); onEnd(); } },200);
}

// ── STORAGE: enable CORS in Firebase → Storage rules ─
// ── CLEANUP ──────────────────────────────────────────
tryLoadSavedFirebase();
