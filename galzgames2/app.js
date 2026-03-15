// ══════════════════════════════════════════════════
//  Galz Games Quiz — app.js
//  • Perguntas avançam automaticamente após reveal
//  • Admin vê contagem regressiva entre perguntas
//  • Resultados finais só aparecem quando admin clica
//  • Sincronização via localStorage (mesma aba/navegador)
// ══════════════════════════════════════════════════

const TIMER_SEC    = 20;   // segundos por pergunta
const REVEAL_SEC   = 5;    // segundos mostrando placar antes da próxima
const STOR_KEY     = 'galzgames_rooms_v2';
const QUIZ_KEY     = 'galzgames_quizzes_v2';
const SHAPES       = ['▲','●','■','◆'];
const AVATARS      = ['🦊','🐼','🦁','🐸','🦋','🐧','🦄','🐲','🦖','🐙','🦀','🦩'];
const AV_COLORS    = ['#E21B3C','#1368CE','#26890C','#D89E00','#8B44C9','#D45C00','#1A6B7A','#B83280'];

let S = {
  quizzes: loadQuizzes(),
  editQs: [], editIdx: -1,
  code: '', name: '', role: '',
  score: 0, answered: false,
  timerLeft: TIMER_SEC,
  timerIv: null, pollIv: null, cdIv: null,
  lastQ: -1, lastPhase: '',
  currentQuizIdx: 0,
  avatar: '', color: ''
};

// ── QUIZ PERSISTENCE ──────────────────────────────
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

// ── ROOM STORAGE ──────────────────────────────────
function getRooms()       { try { return JSON.parse(localStorage.getItem(STOR_KEY)||'{}'); } catch(e){ return {}; } }
function setRooms(r)      { try { localStorage.setItem(STOR_KEY, JSON.stringify(r)); } catch(e){} }
function getRoom(c)       { return getRooms()[c] || null; }
function setRoom(c, data) { const r=getRooms(); r[c]={...data,_ts:Date.now()}; setRooms(r); }
function delRoom(c)       { const r=getRooms(); delete r[c]; setRooms(r); }

// ── UTILS ─────────────────────────────────────────
function notify(msg, type='ok') {
  const n=document.getElementById('notif');
  n.textContent=msg; n.className=type; n.style.display='block';
  clearTimeout(n._t); n._t=setTimeout(()=>n.style.display='none',2800);
}
function go(id) {
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0,0);
  if(id==='dashboard') renderDash();
}
function stopPoll()  { clearInterval(S.pollIv);  S.pollIv=null;  }
function stopTimer() { clearInterval(S.timerIv); S.timerIv=null; }
function stopCd()    { clearInterval(S.cdIv);    S.cdIv=null;    }
function genCode()   { return Math.random().toString(36).substr(2,6).toUpperCase(); }
function esc(s)      { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function rand(arr)   { return arr[Math.floor(Math.random()*arr.length)]; }

// ── ADMIN ─────────────────────────────────────────
function adminLogin() {
  const u=document.getElementById('au').value, p=document.getElementById('ap').value;
  if(u==='admin'&&p==='1234'){ S.role='admin'; go('dashboard'); notify('Bem-vindo, admin!'); }
  else notify('Credenciais inválidas','err');
}

// ── DASHBOARD ─────────────────────────────────────
function renderDash() {
  const el=document.getElementById('qlist');
  if(!S.quizzes.length){
    el.innerHTML='<div class="qc-empty"><div class="qc-empty-ico">📝</div><p>Nenhum quiz ainda. Crie um!</p></div>';
    return;
  }
  el.innerHTML=S.quizzes.map((q,i)=>`
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

// ── EDITOR ────────────────────────────────────────
function newQuiz()    { S.editIdx=-1; document.getElementById('qt').value=''; S.editQs=[]; renderQEditor(); go('editor'); }
function editQuiz(i)  { S.editIdx=i; document.getElementById('qt').value=S.quizzes[i].title; S.editQs=JSON.parse(JSON.stringify(S.quizzes[i].questions)); renderQEditor(); go('editor'); }
function delQuiz(i)   { if(!confirm(`Deletar "${S.quizzes[i].title}"?`))return; S.quizzes.splice(i,1); persistQuizzes(); renderDash(); notify('Removido','err'); }
function addQ()       { S.editQs.push({text:'',options:['','','',''],correct:0}); renderQEditor(); }
function remQ(i)      { S.editQs.splice(i,1); renderQEditor(); }
function setCorr(qi,li){ S.editQs[qi].correct=li; renderQEditor(); }

function renderQEditor() {
  const el=document.getElementById('ql');
  if(!S.editQs.length){ el.innerHTML='<div style="text-align:center;padding:1.5rem;color:rgba(255,255,255,.4);font-weight:700">Adicione perguntas abaixo</div>'; return; }
  el.innerHTML=S.editQs.map((q,qi)=>`
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
  const title=document.getElementById('qt').value.trim();
  if(!title) return notify('Dê um título','err');
  if(!S.editQs.length) return notify('Adicione perguntas','err');
  for(const q of S.editQs){
    if(!q.text.trim()) return notify('Preencha todas as perguntas','err');
    if(q.options.some(o=>!o.trim())) return notify('Preencha todas as opções','err');
  }
  const quiz={title,questions:JSON.parse(JSON.stringify(S.editQs))};
  if(S.editIdx>=0) S.quizzes[S.editIdx]=quiz; else S.quizzes.push(quiz);
  persistQuizzes(); notify('Salvo! ✓'); go('dashboard');
}

// ── LOBBY ─────────────────────────────────────────
function openLobby(i) {
  if(!S.quizzes[i].questions.length) return notify('Adicione perguntas primeiro','err');
  const code=genCode();
  S.code=code; S.currentQuizIdx=i;
  setRoom(code,{
    quiz:S.quizzes[i], players:{}, started:false,
    qIdx:0, answers:{}, phase:'lobby', revealCorrect:-1, done:false, showFinal:false
  });
  document.getElementById('lcode').textContent=code;
  document.getElementById('lcount').textContent='0';
  document.getElementById('lplayers').innerHTML='';
  go('lobby');
  startLobbyPoll();
}

function startLobbyPoll() {
  stopPoll();
  S.pollIv=setInterval(()=>{
    const r=getRoom(S.code); if(!r) return;
    const names=Object.keys(r.players);
    document.getElementById('lcount').textContent=names.length;
    document.getElementById('lplayers').innerHTML=names.map(n=>{
      const p=r.players[n];
      return `<div class="la-chip" style="background:${p.color||'#5C21A6'}">${p.avatar||'🎮'} ${esc(n)}</div>`;
    }).join('');
  },800);
}

function cancelRoom() { stopPoll(); delRoom(S.code); go('dashboard'); }

function startGame() {
  const r=getRoom(S.code);
  if(!r) return notify('Sala não encontrada','err');
  if(!Object.keys(r.players).length) return notify('Aguarde pelo menos 1 jogador!','err');
  stopPoll();
  r.started=true; r.qIdx=0; r.phase='question'; r.answers={}; r.revealCorrect=-1;
  setRoom(S.code,r);
  go('game-host');
  renderHostQ();
}

// ── HOST: QUESTION ────────────────────────────────
function renderHostQ() {
  stopTimer(); stopCd();
  const r=getRoom(S.code); if(!r) return;
  const tot=r.quiz.questions.length;
  const q=r.quiz.questions[r.qIdx];
  // reset room state for this question
  r.answers={}; r.phase='question'; r.revealCorrect=-1;
  setRoom(S.code,r);
  // UI
  document.getElementById('ghn').textContent=`${r.qIdx+1}/${tot}`;
  document.getElementById('ghans').textContent='0 resp.';
  document.getElementById('ghq').textContent=q.text;
  document.getElementById('ghprog').style.width=((r.qIdx/tot)*100)+'%';
  document.getElementById('ghreveal').style.display='none';
  document.getElementById('ghopts').innerHTML=q.options.map((o,i)=>
    `<button class="abt a${i}"><span class="ash">${SHAPES[i]}</span><span>${esc(o)}</span></button>`
  ).join('');
  startTimer('ghring','ghtimer',()=>doReveal());
  startAnswerPoll();
}

function startAnswerPoll() {
  stopPoll();
  S.pollIv=setInterval(()=>{
    const r=getRoom(S.code); if(!r) return;
    const ac=Object.keys(r.answers).length;
    const pc=Object.keys(r.players).length;
    document.getElementById('ghans').textContent=`${ac}/${pc} resp.`;
    if(pc>0&&ac>=pc){ stopTimer(); stopPoll(); doReveal(); }
  },600);
}

// ── REVEAL ────────────────────────────────────────
function doReveal() {
  stopTimer(); stopPoll();
  const r=getRoom(S.code);
  if(!r||r.phase==='reveal'||r.phase==='countdown') return;
  const q=r.quiz.questions[r.qIdx];
  const correct=q.correct;
  // score
  Object.keys(r.players).forEach(name=>{
    if(!r.players[name].score) r.players[name].score=0;
    const a=r.answers[name];
    if(a!==undefined&&a.choice===correct)
      r.players[name].score+=500+Math.floor((a.time/TIMER_SEC)*500);
  });
  r.phase='reveal'; r.revealCorrect=correct;
  setRoom(S.code,r);
  // highlight correct answer
  const btns=document.getElementById('ghopts').children;
  for(let i=0;i<btns.length;i++) btns[i].classList.add(i===correct?'correct':'wrong');
  // live rank
  renderLiveRank(r);
  document.getElementById('ghreveal').style.display='block';
  const isLast=r.qIdx>=r.quiz.questions.length-1;
  if(isLast) {
    // Last question: hide countdown, show final button
    document.getElementById('reveal-next-msg') && (document.getElementById('reveal-next-msg').style.display='none');
    const nm=document.getElementById('gh-next-msg');
    if(nm) nm.style.display='none';
    document.getElementById('ghnext').style.display='flex';
    document.getElementById('ghnext').textContent='🏆 Ver Resultados Finais';
  } else {
    // Auto-advance with countdown
    document.getElementById('ghnext').style.display='none';
    startCountdown(REVEAL_SEC, ()=>{ nextQ(); });
  }
}

function renderLiveRank(r) {
  const sorted=Object.entries(r.players).sort((a,b)=>b[1].score-a[1].score).slice(0,5);
  document.getElementById('ghrank').innerHTML=sorted.map(([n,d],i)=>`
    <div class="rank-row">
      <div class="rmed ${['rm1','rm2','rm3'][i]||'rmn'}">${i+1}</div>
      <span class="rname">${d.avatar||'🎮'} ${esc(n)}</span>
      <span class="rpts">${d.score}</span>
    </div>`).join('');
}

// ── COUNTDOWN (entre perguntas — host) ────────────
function startCountdown(secs, cb) {
  stopCd();
  let left=secs;
  const msg=document.getElementById('gh-next-msg');
  const cdEl=document.getElementById('gh-countdown');
  if(msg){ msg.style.display='block'; }
  if(cdEl) cdEl.textContent=left;
  // Update room so players can start polling for next question
  const r=getRoom(S.code);
  if(r){ r.phase='countdown'; setRoom(S.code,r); }
  S.cdIv=setInterval(()=>{
    left--;
    if(cdEl) cdEl.textContent=left;
    if(left<=0){ stopCd(); cb(); }
  },1000);
}

// ── NEXT Q ────────────────────────────────────────
function nextQ() {
  stopCd();
  const r=getRoom(S.code); if(!r) return;
  r.qIdx++;
  if(r.qIdx>=r.quiz.questions.length){
    // End: wait for admin to click "ver resultados"
    r.phase='waiting_final'; r.done=false; // done=false until admin clicks
    setRoom(S.code,r);
    showHostFinalWait();
    return;
  }
  r.phase='question'; r.answers={}; r.revealCorrect=-1;
  setRoom(S.code,r);
  renderHostQ();
}

// ── HOST: WAITING FOR FINAL CLICK ─────────────────
function showHostFinalWait() {
  // Reuse game-host screen, show final rank + button
  const r=getRoom(S.code); if(!r) return;
  stopTimer(); stopPoll(); stopCd();
  // Hide question UI, show reveal with final button
  document.getElementById('ghopts').innerHTML='';
  document.getElementById('ghq').textContent='Quiz finalizado!';
  document.getElementById('ghprog').style.width='100%';
  document.getElementById('ghn').textContent='Fim!';
  document.getElementById('ghans').textContent='';
  renderLiveRank(r);
  document.getElementById('ghreveal').style.display='block';
  const nm=document.getElementById('gh-next-msg');
  if(nm) nm.style.display='none';
  document.getElementById('ghnext').style.display='flex';
  document.getElementById('ghnext').textContent='🏆 Ver Resultados Finais';
  document.getElementById('ghnext').onclick=showHostFinal;
}

// ── HOST FINAL RESULTS ────────────────────────────
function showHostFinal() {
  const r=getRoom(S.code); if(!r) return;
  r.done=true; r.phase='done';
  setRoom(S.code,r);
  const sorted=Object.entries(r.players).sort((a,b)=>b[1].score-a[1].score);
  buildPodium(sorted,'finpod');
  document.getElementById('finrank').innerHTML=sorted.map(([n,d],i)=>`
    <div class="rank-row">
      <div class="rmed ${['rm1','rm2','rm3'][i]||'rmn'}">${i+1}</div>
      <span class="rname">${d.avatar||'🎮'} ${esc(n)}</span>
      <span class="rpts">${d.score} pts</span>
    </div>`).join('');
  if(sorted.length){
    document.getElementById('finwinner').style.display='block';
    document.getElementById('finwname').textContent=sorted[0][0];
  }
  go('final');
}

function replayRoom() { openLobby(S.currentQuizIdx); }

// ── PLAYER JOIN ───────────────────────────────────
function goToName() {
  const code=document.getElementById('pcode').value.trim().toUpperCase();
  if(code.length<4) return notify('Código muito curto','err');
  const r=getRoom(code);
  if(!r){ notify(`Sala "${code}" não encontrada!`,'err'); return; }
  if(r.started){ notify('Quiz já iniciou! Aguarde a próxima rodada.','err'); return; }
  document.getElementById('pcode').dataset.code=code;
  go('join-name');
  setTimeout(()=>document.getElementById('pname').focus(),100);
}

function joinRoom() {
  const name=document.getElementById('pname').value.trim();
  const code=document.getElementById('pcode').dataset.code||document.getElementById('pcode').value.trim().toUpperCase();
  if(!name) return notify('Digite seu apelido','err');
  if(name.length>20) return notify('Apelido muito longo','err');
  const r=getRoom(code);
  if(!r){ notify('Sala não encontrada','err'); return; }
  if(r.started){ notify('Quiz já iniciou!','err'); return; }
  if(r.players[name]){ notify('Apelido em uso. Escolha outro!','err'); return; }
  const avatar=rand(AVATARS), color=rand(AV_COLORS);
  r.players[name]={score:0,avatar,color};
  setRoom(code,r);
  S.name=name; S.code=code; S.score=0; S.answered=false; S.lastQ=-1; S.lastPhase='';
  S.avatar=avatar; S.color=color;
  document.getElementById('wcode').textContent=code;
  document.getElementById('wname').textContent=name;
  const av=document.getElementById('wavatar');
  av.textContent=avatar; av.style.background=color;
  go('waiting');
  startWaitPoll();
}

// ── PLAYER POLLING ────────────────────────────────
function startWaitPoll() {
  stopPoll();
  S.pollIv=setInterval(()=>{
    const r=getRoom(S.code); if(!r) return;
    if(r.started&&r.phase==='question'&&r.qIdx!==S.lastQ){
      stopPoll(); renderPlayerQ(r);
    }
  },600);
}

// ── PLAYER: QUESTION ─────────────────────────────
function renderPlayerQ(r) {
  const qIdx=r.qIdx;
  S.lastQ=qIdx; S.answered=false;
  const q=r.quiz.questions[qIdx];
  const tot=r.quiz.questions.length;
  document.getElementById('plqn').textContent=`${qIdx+1}/${tot}`;
  document.getElementById('plqnum')&&(document.getElementById('plqnum').textContent=`Pergunta ${qIdx+1} de ${tot}`);
  document.getElementById('plq').textContent=q.text;
  document.getElementById('plprog').style.width=((qIdx/tot)*100)+'%';
  document.getElementById('plpts').textContent=S.score+' pts';
  document.getElementById('plfb').style.display='none';
  document.getElementById('plopts').innerHTML=q.options.map((o,i)=>
    `<button class="abt a${i}" onclick="playerAns(${i},${qIdx})">
      <span class="ash">${SHAPES[i]}</span><span>${esc(o)}</span>
    </button>`).join('');
  go('playing');
  startTimer('plring','pltimer',()=>playerTimeout(qIdx));
  startPlayerRevealPoll(qIdx);
}

function playerAns(choice,qIdx) {
  if(S.answered) return;
  S.answered=true; stopTimer();
  const r=getRoom(S.code); if(!r) return;
  if(!r.answers) r.answers={};
  r.answers[S.name]={choice,time:S.timerLeft};
  setRoom(S.code,r);
  const btns=document.getElementById('plopts').children;
  for(let i=0;i<btns.length;i++){ btns[i].disabled=true; if(i===choice) btns[i].classList.add('chosen'); }
  startPlayerRevealPoll(qIdx);
}

function playerTimeout(qIdx) {
  if(S.answered) return;
  S.answered=true;
  const r=getRoom(S.code);
  if(r){ if(!r.answers) r.answers={}; r.answers[S.name]={choice:-1,time:0}; setRoom(S.code,r); }
  startPlayerRevealPoll(qIdx);
}

function startPlayerRevealPoll(qIdx) {
  stopPoll();
  S.pollIv=setInterval(()=>{
    const r=getRoom(S.code); if(!r) return;
    // Show final when admin triggers it
    if(r.done&&r.phase==='done'){ stopPoll(); showPlayerFinal(r); return; }
    // Show feedback when host reveals
    if((r.phase==='reveal'||r.phase==='countdown'||r.phase==='waiting_final')&&r.qIdx===qIdx){
      stopPoll(); showFeedback(r,qIdx);
    }
  },600);
}

function showFeedback(r,qIdx) {
  stopTimer();
  const q=r.quiz.questions[qIdx];
  const correct=q.correct;
  const a=r.answers?r.answers[S.name]:undefined;
  const ok=a!==undefined&&a.choice===correct;
  const pts=ok?500+Math.floor((a.time/TIMER_SEC)*500):0;
  S.score+=pts;
  // Highlight buttons
  const btns=document.getElementById('plopts').children;
  for(let i=0;i<btns.length;i++){
    btns[i].disabled=true;
    if(i===correct) btns[i].classList.add('correct');
    else if(a&&a.choice===i) btns[i].classList.add('wrong');
  }
  // Show feedback overlay
  const fb=document.getElementById('plfb');
  const fbc=document.getElementById('plfbcard');
  fbc.className='fb-card '+(ok?'ok':'fail');
  document.getElementById('plicon').textContent=ok?'✅':'❌';
  document.getElementById('pltxt').textContent=ok?'Correto!':'Errado!';
  document.getElementById('plptsadd').textContent=ok?`+${pts} pontos`:'Sem pontos';
  document.getElementById('plpts').textContent=S.score+' pts';
  fb.style.display='flex';
  // Poll for next question or final
  startPlayerNextPoll(qIdx);
}

function startPlayerNextPoll(qIdx) {
  stopPoll();
  S.pollIv=setInterval(()=>{
    const r=getRoom(S.code); if(!r) return;
    if(r.done&&r.phase==='done'){ stopPoll(); showPlayerFinal(r); return; }
    // Next question started
    if(r.phase==='question'&&r.qIdx>qIdx){
      stopPoll();
      document.getElementById('plfb').style.display='none';
      renderPlayerQ(r);
    }
  },600);
}

function showPlayerFinal(r) {
  stopTimer(); stopPoll();
  const sorted=Object.entries(r.players).sort((a,b)=>b[1].score-a[1].score);
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

// ── PODIUM ────────────────────────────────────────
function buildPodium(sorted,elId) {
  const el=document.getElementById(elId); if(!el) return;
  const top=sorted.slice(0,3);
  if(!top.length){ el.innerHTML=''; return; }
  const order=top.length>=3?[top[1],top[0],top[2]]:top.length===2?[top[1],top[0]]:[top[0]];
  const cls=['pb2','pb1','pb3'], ico=['🥈','👑','🥉'];
  el.innerHTML=order.map(([n,d],pi)=>`
    <div class="pod-pl">
      <div class="pod-name">${d.avatar||'🎮'} ${esc(n)}</div>
      <div class="pod-pts">${d.score} pts</div>
      <div class="pod-bar ${cls[pi]}">${ico[pi]}</div>
    </div>`).join('');
}

// ── TIMER ─────────────────────────────────────────
function startTimer(ringId,numId,onEnd) {
  stopTimer();
  S.timerLeft=TIMER_SEC;
  const ring=document.getElementById(ringId);
  const num=document.getElementById(numId);
  const DASH=151;
  const upd=()=>{
    const pct=S.timerLeft/TIMER_SEC;
    ring.style.strokeDashoffset=DASH*(1-pct);
    const warn=S.timerLeft<=5;
    ring.style.stroke=warn?'#E84C39':'#F5C200';
    num.textContent=Math.ceil(S.timerLeft);
    num.style.color=warn?'#E84C39':'#fff';
  };
  upd();
  S.timerIv=setInterval(()=>{
    S.timerLeft-=.2; upd();
    if(S.timerLeft<=0){ stopTimer(); S.timerLeft=0; upd(); onEnd(); }
  },200);
}

// ── CLEANUP OLD ROOMS ─────────────────────────────
(function(){
  try{
    const rooms=getRooms(), now=Date.now(); let changed=false;
    Object.entries(rooms).forEach(([c,r])=>{
      if(r._ts&&now-r._ts>4*60*60*1000){ delete rooms[c]; changed=true; }
    });
    if(changed) setRooms(rooms);
  }catch(e){}
})();
