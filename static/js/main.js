/* ═══════════════════════════════════════
   WORD BATTLE — Premium Edition main.js
   ═══════════════════════════════════════ */

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const socket = io({ transports: ['polling'], upgrade: false, reconnection: true });

let S    = JSON.parse(sessionStorage.getItem('wb') || 'null');
let st   = null, sel = null, pick = null;
let muted = false, offset = 0, prev = null;
const save = () => sessionStorage.setItem('wb', JSON.stringify(S));
const nm   = () => $('#name').value.trim() || 'Guest';
const esc  = s => s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ══════════════════════════════════════
   NAVIGATION — single source of truth
   ══════════════════════════════════════ */
function show(id) {
  $$('.screen').forEach(el => {
    el.classList.remove('on');
  });
  const target = $('#' + id);
  if (target) target.classList.add('on');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  spawnStars();
}

// data-go buttons (How to Play, Setup from home)
$$('[data-go]').forEach(b => b.onclick = () => show(b.dataset.go));

// All back buttons go home
$('#backHow').onclick   = () => show('home');
$('#backBoard').onclick = () => show('home');
$('#backSetup').onclick = () => show('home');
$('#backLobby').onclick = () => { show('home'); };

/* ══════════════════════════════════════
   BACKGROUND
   ══════════════════════════════════════ */
function spawnStars() {
  if (reduce) return;
  const c = $('#stars');
  c.innerHTML = '';
  for (let i = 0; i < 90; i++) {
    const s = document.createElement('div');
    const sz = 1 + Math.random() * 2.5;
    s.style.cssText = `position:absolute;width:${sz}px;height:${sz}px;border-radius:50%;background:#fff;
      left:${Math.random()*100}%;top:${Math.random()*100}%;
      opacity:${.15+Math.random()*.85};
      animation:starTwinkle ${1.4+Math.random()*3}s ease-in-out ${Math.random()*3}s infinite alternate`;
    c.append(s);
  }
}
const ss = document.createElement('style');
ss.textContent = '@keyframes starTwinkle{from{opacity:.08}to{opacity:1}}';
document.head.append(ss);
spawnStars();

// Floating bg letters
const BGL = 'ABCDEFGHIJKLMNOPRSTW';
const bgLetWrap = $('#bgLetters');
for (let i = 0; i < 20; i++) {
  const s = document.createElement('span');
  s.className = 'bg-letter';
  s.textContent = BGL[Math.floor(Math.random() * BGL.length)];
  const sz = 26 + Math.random() * 56;
  s.style.cssText = `left:${Math.random()*100}%;font-size:${sz}px;
    animation-duration:${13+Math.random()*18}s;animation-delay:-${Math.random()*20}s`;
  bgLetWrap.append(s);
}

// Logo sparkles
function addLogoSparkles() {
  if (reduce) return;
  const wrap = $('#logoSpark');
  if (!wrap) return;
  [
    {top:'8%',left:'4%'},{top:'12%',right:'4%'},
    {top:'48%',left:'-3%'},{top:'52%',right:'-3%'},
    {bottom:'4%',left:'18%'},{bottom:'4%',right:'18%'},
  ].forEach((pos, i) => {
    const sp = document.createElement('span');
    sp.textContent = ['✨','⭐','💫','🌟','✦','★'][i];
    sp.style.cssText = Object.entries(pos).map(([k,v]) => `${k}:${v}`).join(';');
    sp.style.animationDelay = `${i*.38}s`;
    wrap.append(sp);
  });
}
addLogoSparkles();

/* ══════════════════════════════════════
   RIPPLE
   ══════════════════════════════════════ */
document.addEventListener('pointerdown', e => {
  const btn = e.target.closest('.btn, .back-btn, .react-btn, .chat-send');
  if (!btn || reduce) return;
  const r = btn.getBoundingClientRect();
  const rip = document.createElement('span');
  rip.className = 'btn-ripple';
  const size = Math.max(r.width, r.height) * 2;
  rip.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX-r.left-size/2}px;top:${e.clientY-r.top-size/2}px`;
  btn.append(rip);
  setTimeout(() => rip.remove(), 500);

  const gr = document.createElement('div');
  gr.className = 'ripple';
  const gs = Math.min(innerWidth, innerHeight) * .75;
  gr.style.cssText = `width:${gs}px;height:${gs}px;left:${e.clientX-gs/2}px;top:${e.clientY-gs/2}px`;
  $('#ripple-layer').append(gr);
  setTimeout(() => gr.remove(), 700);
});

/* ══════════════════════════════════════
   TOAST
   ══════════════════════════════════════ */
function toast(msg, ok = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (ok ? ' ok' : '');
  t.textContent = msg;
  $('#toasts').append(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'scale(.9)'; setTimeout(() => t.remove(), 300); }, 2800);
}

/* ══════════════════════════════════════
   SOUND
   ══════════════════════════════════════ */
let audioCtx = null;
function getACtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function beep(freq, dur = .12, type = 'sine', vol = .08) {
  if (muted) return;
  try {
    const ctx = getACtx(), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur);
  } catch(_) {}
}
function playLock()  { beep(740,.14,'triangle',.08); setTimeout(()=>beep(880,.18,'triangle',.08),110); }
function playError() { beep(160,.2,'sawtooth',.06); }
function playWin()   { [523,659,784,1047].forEach((f,i)=>setTimeout(()=>beep(f,.2,'sine',.1),i*120)); }
function playReact() { beep(880,.06,'sine',.06); setTimeout(()=>beep(1047,.08,'sine',.05),55); }
function playChatSend()    { beep(660,.05,'sine',.05); setTimeout(()=>beep(880,.07,'sine',.04),48); }
function playChatReceive() { beep(523,.07,'triangle',.05); setTimeout(()=>beep(659,.09,'triangle',.04),68); }

const KEY_NOTES = {
  A:261,B:277,C:294,D:311,E:330,F:349,G:370,H:392,I:415,J:440,K:466,L:494,M:523,
  N:554,O:587,P:622,Q:659,R:698,S:740,T:784,U:831,V:880,W:932,X:988,Y:1047,Z:1109
};
function playKey(letter) {
  if (muted) return;
  const freq = KEY_NOTES[letter] || 440;
  try {
    const ctx = getACtx(), now = ctx.currentTime;
    const osc = ctx.createOscillator(), gO = ctx.createGain();
    const clk = ctx.createOscillator(), gC = ctx.createGain();
    osc.type = 'triangle'; osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq*.98, now+.08);
    clk.type = 'square'; clk.frequency.setValueAtTime(freq*2, now);
    gO.gain.setValueAtTime(.09,now); gO.gain.exponentialRampToValueAtTime(.001,now+.13);
    gC.gain.setValueAtTime(.04,now); gC.gain.exponentialRampToValueAtTime(.001,now+.03);
    osc.connect(gO); gO.connect(ctx.destination);
    clk.connect(gC); gC.connect(ctx.destination);
    osc.start(now); osc.stop(now+.13);
    clk.start(now); clk.stop(now+.03);
  } catch(_) {}
}

/* ══════════════════════════════════════
   HOME
   ══════════════════════════════════════ */
$('#lbBtn').onclick = async () => {
  const r = await (await fetch('/api/leaderboard')).json();
  $('#lb').innerHTML = r.length
    ? r.map(x => `<li>${esc(x.name)} — ${x.rating} ELO · ${x.wins} wins</li>`).join('')
    : '<li style="color:var(--mut)">No matches yet.</li>';
  const s = await (await fetch('/api/stats?name=' + encodeURIComponent(nm()))).json();
  $('#mystats').innerHTML = `<strong>${esc(nm())}</strong><br>
    ${s.matches} matches · ${s.wins} wins · ${s.losses} losses<br>
    ELO <strong>${s.rating}</strong> (${s.win_pct}%) · avg ${s.avg_moves ?? '-'} moves · fastest ${s.fastest ? s.fastest.toFixed(1)+'s' : '-'}`;
  show('board');
};

/* ══════════════════════════════════════
   QUICK MATCH
   ══════════════════════════════════════ */
let queued = false;
$('#quick').onclick = () => {
  queued = !queued;
  $('#quick').textContent = queued ? '🔍 Searching… tap to cancel' : '⚡ Quick Match';
  socket.emit(queued ? 'quick_match' : 'cancel_match', { name: nm() });
};

/* ══════════════════════════════════════
   JOINED (single handler)
   ══════════════════════════════════════ */
socket.on('joined', d => {
  queued = false;
  $('#quick').textContent = '⚡ Quick Match';
  $('#create').disabled = false;
  $('#create').innerHTML = '🚀 Create Private Room';
  $('#join').disabled = false;
  $('#join').innerHTML = 'Join!';
  if (d && d.code) { S = { code: d.code, token: d.token, idx: d.idx }; save(); }
});

/* ══════════════════════════════════════
   SETUP
   ══════════════════════════════════════ */
$('#rnd').onclick = () => socket.emit('random_challenge', { length: +$('#diff').value });
$('#diff').onchange = () => $('#rnd').click();
socket.on('challenge', c => { $('#start').value = c.start; $('#target').value = c.target; });

$('#create').onclick = () => {
  const start = $('#start').value.trim(), target = $('#target').value.trim();
  if (!start || !target) { toast('Enter both start and target words!'); return; }
  if (start.length !== target.length) { toast('Words must be the same length!'); return; }
  $('#create').disabled = true;
  $('#create').innerHTML = '<span class="spin">◐</span> Creating…';
  socket.emit('create_room', { name: nm(), start, target, timer: +$('#timer').value });
};
$('#join').onclick = () => {
  const code = $('#joincode').value.trim().toUpperCase();
  if (!code) { toast('Enter a room code!'); return; }
  $('#join').disabled = true;
  $('#join').innerHTML = '<span class="spin">◐</span>';
  socket.emit('join_room', { name: nm(), code, token: S && S.code === code ? S.token : null });
};

/* ══════════════════════════════════════
   LOBBY
   ══════════════════════════════════════ */
$('#ready').onclick = () => socket.emit('ready', S);
$('#copy').onclick  = () => navigator.clipboard.writeText(S.code).then(() => toast('Code copied! 📋', true));

/* ══════════════════════════════════════
   SOUND TOGGLE
   ══════════════════════════════════════ */
$('#mute').onclick = () => {
  muted = !muted;
  $('#mute').textContent = muted ? '🔇' : '🔊';
};

/* ══════════════════════════════════════
   REMATCH / HOME
   ══════════════════════════════════════ */
$('#again').onclick = () => {
  if (S && st && st.players.length === 2) {
    socket.emit('rematch', S);
    $('#again').textContent = '⏳ Waiting…';
  }
};
$('#homeBtn').onclick = () => {
  sessionStorage.removeItem('wb');
  S = st = prev = null;
  $('#win').classList.remove('on');
  show('home');
};

/* ══════════════════════════════════════
   REACTIONS
   ══════════════════════════════════════ */
const REACTIONS = [
  {e:'👏',label:'Clap'},{e:'😮',label:'Wow'},{e:'😂',label:'Lol'},
  {e:'🔥',label:'Fire'},{e:'😈',label:'Evil'},{e:'🤯',label:'Mind'},
  {e:'💪',label:'Power'},{e:'😤',label:'Grr'},{e:'🎉',label:'Party'},{e:'👀',label:'Eyes'},
];
REACTIONS.forEach(({e, label}) => {
  const b = document.createElement('button');
  b.className = 'react-btn';
  b.innerHTML = `<span>${e}</span><span class="react-label-txt">${label}</span>`;
  b.setAttribute('aria-label', 'React ' + label);
  b.onclick = () => {
    if (!S) return;
    socket.emit('react', { ...S, e });
    b.classList.remove('sent'); void b.offsetWidth; b.classList.add('sent');
    playReact();
  };
  $('#reacts').append(b);
});
socket.on('react', r => {
  const isMe = r.idx === S?.idx;
  const f = document.createElement('span');
  f.className = 'react-floater';
  f.textContent = r.e;
  f.style.left   = (isMe ? 65 : 12) + '%';
  f.style.bottom = '22%';
  $('#float-layer').append(f);
  setTimeout(() => f.remove(), 2300);
  if (!isMe) beep(600, .08, 'sine', .05);
});

/* ══════════════════════════════════════
   CHAT
   ══════════════════════════════════════ */
const CHAT_EMOJIS = ['😄','😂','🔥','❤️','👍','🎉','😮','😡','💪','🤔','😴','🏆','✨','👏','🙈'];
let chatOpen = true, chatUnreadCount = 0;

CHAT_EMOJIS.forEach(em => {
  const b = document.createElement('button');
  b.className = 'chat-emoji-btn'; b.textContent = em; b.title = em;
  b.onclick = () => { $('#chatInput').value += em; $('#chatInput').focus(); };
  $('#chatEmojiBar').append(b);
});

$('#chatHeader').onclick = ev => {
  if (['chatSend','mute'].includes(ev.target.id)) return;
  chatOpen = !chatOpen;
  $('#chatWrap').classList.toggle('collapsed', !chatOpen);
  $('#chatToggle').textContent = chatOpen ? '▼' : '▲';
  if (chatOpen) { chatUnreadCount = 0; $('#chatUnread').classList.remove('show'); scrollChat(); }
};

function scrollChat() {
  const b = $('#chatBody'); b.scrollTop = b.scrollHeight;
}
function isEmojiOnly(str) {
  return str.trim().replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D]/gu,'').trim().length === 0;
}
function addChatMsg(idx, name, msg, sys = false) {
  const isMe = !sys && idx === S?.idx;
  const wrap = document.createElement('div');
  wrap.className = 'chat-msg ' + (sys ? 'sys' : isMe ? 'me' : 'them');
  if (!sys && !isMe) {
    const nd = document.createElement('div');
    nd.className = 'chat-name'; nd.textContent = name; wrap.append(nd);
  }
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble' + (isEmojiOnly(msg) ? ' emoji-only' : '');
  bubble.textContent = msg;
  wrap.append(bubble);
  $('#chatBody').append(wrap);
  if (chatOpen) { scrollChat(); }
  else {
    chatUnreadCount++;
    $('#chatUnread').textContent = chatUnreadCount > 9 ? '9+' : chatUnreadCount;
    $('#chatUnread').classList.add('show');
  }
}
function sendChat() {
  const inp = $('#chatInput');
  const msg = inp.value.trim();
  if (!msg || !S) return;
  socket.emit('chat', { ...S, msg });
  inp.value = ''; inp.focus();
  playChatSend();
}
$('#chatSend').onclick = sendChat;
$('#chatInput').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
});
socket.on('chat', d => {
  addChatMsg(d.idx, d.name, d.msg);
  if (d.idx !== S?.idx) playChatReceive();
});

/* ══════════════════════════════════════
   RECONNECT
   ══════════════════════════════════════ */
socket.on('connect', () => {
  if (S && st && st.status !== 'finished') socket.emit('join_room', { code: S.code, token: S.token });
});

/* ══════════════════════════════════════
   ERRORS
   ══════════════════════════════════════ */
socket.on('err', e => {
  toast(e.msg);
  playError();
  $('#create').disabled = false; $('#create').innerHTML = '🚀 Create Private Room';
  $('#join').disabled = false;   $('#join').innerHTML = 'Join!';
  const t = $('.tile.sel');
  if (t && !reduce) { t.classList.remove('shake','wrong'); void t.offsetWidth; t.classList.add('shake','wrong'); setTimeout(()=>t.classList.remove('wrong'),400); }
  setChecking(false);
});
socket.on('toast', e => toast(e.msg));

/* ══════════════════════════════════════
   GAME LOGIC
   ══════════════════════════════════════ */
function setChecking(on) {
  $('#submit').disabled = on || !pick;
  $('#submit').innerHTML = on ? '<span class="spin">◐</span>' : '🚀 Submit';
}
function preview() {
  return sel === null ? '' : st.current.slice(0,sel) + (pick||st.current[sel]) + st.current.slice(sel+1);
}
$('#submit').onclick = () => { setChecking(true); socket.emit('move', { ...S, word: preview() }); };

document.addEventListener('keydown', e => {
  if (!st || st.status !== 'active' || sel === null) return;
  if (/^[a-z]$/i.test(e.key)) { pick = e.key.toUpperCase(); playKey(pick); drawPicker(); drawPreview(); }
  else if (e.key === 'Enter' && pick) $('#submit').click();
});

function mine() { return st.status === 'active' && st.turn === S.idx; }

function drawPicker() {
  const p = $('#picker');
  p.classList.toggle('hide', sel === null);
  p.innerHTML = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map(c =>
    `<button class="${c===pick?'on':''}" ${sel!==null&&c===st.current[sel]?'disabled':''}>${c}</button>`
  ).join('');
  $$('#picker button').forEach(b => b.onclick = () => { pick = b.textContent; playKey(pick); drawPicker(); drawPreview(); });
}
function drawPreview() {
  $('#preview').textContent = preview() || '—';
  setChecking(false);
  $('#submit').disabled = !(pick && mine());
}
function tileHTML(c, i, lk) {
  const locked = lk.includes(i);
  return `<div class="tile ${locked?'locked':''} ${i===sel?'sel':''}"
    tabindex="0" data-i="${i}" role="button"
    aria-label="Letter ${c}${locked?', locked':''}">${c}</div>`;
}

/* ══════════════════════════════════════
   PARTICLES
   ══════════════════════════════════════ */
function sparks(el, color='#4ade80') {
  if (reduce) return;
  const r = el.getBoundingClientRect();
  for (let i = 0; i < 14; i++) {
    const s = document.createElement('i');
    s.className = 'spark'; s.style.background = color;
    s.style.left = r.left + r.width/2 + 'px';
    s.style.top  = r.top  + r.height/2 + 'px';
    document.body.append(s);
    const a = Math.random()*6.28, d = 40+Math.random()*60;
    s.animate([
      {transform:'none',opacity:1},
      {transform:`translate(${Math.cos(a)*d}px,${Math.sin(a)*d}px) scale(.2)`,opacity:0}
    ],{duration:600+Math.random()*300,easing:'cubic-bezier(.2,1,.2,1)'}).onfinish = ()=>s.remove();
  }
}
function burstStars(el) {
  if (reduce) return;
  const r = el.getBoundingClientRect();
  ['⭐','✨','💫','🌟','⭐','✨'].forEach((em, i) => {
    const s = document.createElement('span');
    s.style.cssText = `position:fixed;font-size:1.3rem;pointer-events:none;z-index:60;left:${r.left+r.width/2}px;top:${r.top+r.height/2}px`;
    s.textContent = em; document.body.append(s);
    const a = (i/6)*6.28, d = 48+Math.random()*48;
    s.animate([
      {transform:'translate(-50%,-50%) scale(0)',opacity:1},
      {transform:`translate(calc(-50% + ${Math.cos(a)*d}px),calc(-50% + ${Math.sin(a)*d}px)) scale(1.2)`,opacity:0}
    ],800).onfinish = ()=>s.remove();
  });
}

/* ══════════════════════════════════════
   TIMER BAR
   ══════════════════════════════════════ */
setInterval(() => {
  if (!st || !st.deadline || st.status !== 'active') {
    $('#barfill').style.transform = 'scaleX(1)';
    if ($('.timer-wrap')) { $('.timer-wrap').classList.remove('urgent'); $('.bar').classList.remove('urgent'); }
    return;
  }
  const left = st.deadline - (Date.now()/1000 + offset);
  const ratio = Math.max(0, Math.min(1, left/st.timer));
  $('#barfill').style.transform = `scaleX(${ratio})`;
  const secs = Math.ceil(left);
  $('#timerLabel').textContent = secs > 0 ? `${secs}s` : '';
  const urgent = ratio < .28;
  $('.bar').classList.toggle('urgent', urgent);
  $('.timer-wrap').classList.toggle('urgent', urgent);
}, 250);

/* ══════════════════════════════════════
   STATE
   ══════════════════════════════════════ */
socket.on('state', s => {
  st = s; offset = s.now - Date.now()/1000;

  /* LOBBY */
  if (s.status === 'lobby') {
    show('lobby');
    $('#code').textContent = s.code;
    $('#lobbyPlayers').innerHTML = s.players.map(p =>
      `<div class="pcard ${p.ready?'active':''}">${esc(p.name)}<br><small>${p.ready?'✅ Ready':'⏳ Waiting'}</small></div>`
    ).join('');
    $('#lobbyMsg').textContent = s.players.length < 2
      ? '⏳ Waiting for opponent…'
      : '🎮 Both here! Press Ready.';
    return;
  }

  /* GAME */
  show('game');
  if (s.status !== 'finished') { $('#win').classList.remove('on'); $('#again').textContent = '🔄 Rematch!'; }
  if (sel !== null && (!mine() || s.locked.includes(sel))) sel = null;
  if (!prev || prev.current !== s.current) pick = null;

  $('#from').textContent = s.start;
  $('#to').textContent   = s.target;

  s.players.forEach((p, i) => {
    const el = $('#p' + i);
    const isMe = i === S.idx;
    el.innerHTML = `${isMe?'🌟 ':''}${esc(p.name)}${isMe?' (you)':''}`;
    el.classList.toggle('active', s.status === 'active' && s.turn === i);
    el.classList.toggle('off', !p.connected);
  });

  const opp = s.players[1 - S.idx];
  $('#conn').textContent = opp && !opp.connected ? '📡 Opponent disconnected…' : '';

  const tEl = $('#turnTxt');
  if (s.status === 'active') {
    if (mine()) { tEl.textContent = '🎯 Your turn!'; tEl.className = 'turn-txt my-turn'; }
    else { tEl.textContent = `⏳ ${esc(s.players[1-S.idx]?.name||'Opponent')}'s turn…`; tEl.className = 'turn-txt opp-turn'; }
  } else { tEl.textContent = ''; tEl.className = 'turn-txt'; }

  const T = $('#tiles'), old = prev && prev.current;
  T.innerHTML = [...s.current].map((c, i) => tileHTML(c, i, s.locked)).join('');

  if (old && old !== s.current) {
    beep(520, .1);
    $$('#tiles .tile').forEach((t, i) => {
      if (old[i] !== s.current[i] && !reduce) { t.classList.add('flip','correct'); setTimeout(()=>t.classList.remove('correct'),500); }
    });
    s.locked.filter(i => !prev.locked.includes(i)).forEach(i => {
      const t = $$('#tiles .tile')[i];
      if (t) { t.classList.add('lockpop'); sparks(t,'#4ade80'); burstStars(t); playLock(); }
    });
  }

  $$('#tiles .tile').forEach(t => t.onclick = () => {
    const i = +t.dataset.i;
    if (st.locked.includes(i)) { toast('🔒 That letter is locked!'); playError(); return; }
    if (!mine()) { toast("⏳ Not your turn!"); return; }
    sel = i; pick = null;
    $$('#tiles .tile').forEach(x => x.classList.toggle('sel', x===t));
    drawPicker(); drawPreview();
    beep(440,.07,'sine',.05);
  });

  $('#hist').textContent = s.moves.length ? '📜 ' + s.moves.map(m=>m.word).join(' → ') : '';
  drawPicker(); drawPreview();
  prev = s;
  if (s.status === 'finished') winScreen(s);
});

/* ══════════════════════════════════════
   WIN
   ══════════════════════════════════════ */
function winScreen(s) {
  const w = s.players[s.winner], isMe = s.winner === S.idx;
  $('#winTitle').textContent   = isMe ? '🎉 You Win! 🎉' : `😮 ${w.name} Wins!`;
  $('#trophyAnim').textContent = isMe ? '🏆' : '🥈';
  $('#winTiles').innerHTML = [...s.target].map((c,i) => tileHTML(c,i,s.locked)).join('');
  $('#winInfo').textContent = `${s.moves.length} moves · ${s.duration.toFixed(1)}s`
    + (s.players[1-S.idx].rematch ? ' · Opponent wants rematch!' : '');

  const ws = $('#winStars'); ws.innerHTML = '';
  if (!reduce && isMe) {
    ['10%,10%','80%,10%','10%,80%','80%,80%','45%,5%','5%,45%','90%,45%'].forEach((pos,i) => {
      const [l,t] = pos.split(',');
      const star = document.createElement('span');
      star.className = 'win-star';
      star.textContent = ['⭐','✨','💫','🌟','⭐','✨','💫'][i];
      star.style.cssText = `left:${l};top:${t};animation-delay:${i*.14}s`;
      ws.append(star);
    });
  }
  $('#win').classList.add('on');
  if (isMe) { playWin(); confetti(); }
  else beep(300,.4,'triangle',.06);
}

/* ══════════════════════════════════════
   CONFETTI
   ══════════════════════════════════════ */
function confetti() {
  if (reduce) return;
  const c = $('#confetti'), x = c.getContext('2d');
  c.width = innerWidth; c.height = innerHeight;
  const cols = ['#60c8ff','#c084fc','#4ade80','#fde047','#f472b6','#fb923c'];
  const P = Array.from({length:160}, () => ({
    x: Math.random()*c.width, y: -Math.random()*c.height*.5,
    vx:(Math.random()-.5)*2, vy:1.5+Math.random()*4,
    r:4+Math.random()*7, color:cols[Math.floor(Math.random()*cols.length)],
    rot:Math.random()*360, rotV:(Math.random()-.5)*6,
    shape:Math.random()>.5?'rect':'circle',
  }));
  let frame = 0;
  (function draw() {
    x.clearRect(0,0,c.width,c.height);
    P.forEach(p => {
      p.y+=p.vy; p.x+=p.vx; p.vy+=.05; p.rot+=p.rotV;
      x.save(); x.translate(p.x,p.y); x.rotate(p.rot*Math.PI/180);
      x.fillStyle=p.color; x.globalAlpha=Math.max(0,1-frame/285);
      if(p.shape==='rect') x.fillRect(-p.r/2,-p.r/2,p.r,p.r*1.5);
      else{x.beginPath();x.arc(0,0,p.r/2,0,6.28);x.fill()}
      x.restore();
    });
    if(++frame<310) requestAnimationFrame(draw);
    else x.clearRect(0,0,c.width,c.height);
  })();
}
