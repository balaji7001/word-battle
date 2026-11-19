/* ═══════════════════════════════════════════
   WORD BATTLE — main.js
   ═══════════════════════════════════════════ */

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const socket = io({ reconnection: true });

let S = JSON.parse(sessionStorage.getItem('wb') || 'null');
let st = null, sel = null, pick = null, muted = false, offset = 0, prev = null;
const save = () => sessionStorage.setItem('wb', JSON.stringify(S));
const nm   = () => $('#name').value.trim() || 'Guest';
const esc  = s => s.replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

/* ───────── SHOW SCREEN ───────── */
function show(id) {
  $$('.screen').forEach(e => {
    const on = e.id === id;
    if (on && !e.classList.contains('on')) {
      e.classList.add('on');
    } else if (!on) {
      e.classList.remove('on');
    }
  });
  spawnStars();
}

/* ───────── BACKGROUND STARS ───────── */
function spawnStars() {
  if (reduce) return;
  const c = $('#stars');
  c.innerHTML = '';
  for (let i = 0; i < 80; i++) {
    const s = document.createElement('div');
    const size = 1 + Math.random() * 3;
    s.style.cssText = `
      position:absolute;
      width:${size}px; height:${size}px;
      border-radius:50%;
      background:#fff;
      left:${Math.random() * 100}%;
      top:${Math.random() * 100}%;
      opacity:${.2 + Math.random() * .8};
      animation: starTwinkle ${1.5 + Math.random() * 3}s ease-in-out ${Math.random() * 3}s infinite alternate;
    `;
    c.append(s);
  }
}
// inject keyframe
const starStyle = document.createElement('style');
starStyle.textContent = `@keyframes starTwinkle { from{opacity:.1} to{opacity:1} }`;
document.head.append(starStyle);
spawnStars();

/* ───────── FLOATING BG LETTERS ───────── */
const BG_LETTERS = 'ABCDEFGHIJKLMNOPRSTW';
for (let i = 0; i < 18; i++) {
  const s = document.createElement('span');
  s.className = 'bg-letter';
  s.textContent = BG_LETTERS[Math.floor(Math.random() * BG_LETTERS.length)];
  const size = 28 + Math.random() * 60;
  s.style.cssText = `
    left: ${Math.random() * 100}%;
    font-size: ${size}px;
    animation-duration: ${14 + Math.random() * 18}s;
    animation-delay: -${Math.random() * 20}s;
  `;
  $('#bg').append(s);
}

/* ───────── LOGO SPARKLES ───────── */
function addLogoSparkles() {
  if (reduce) return;
  const wrap = $('#logoSpark');
  if (!wrap) return;
  const positions = [
    { top: '10%', left: '5%' }, { top: '15%', right: '5%' },
    { top: '50%', left: '-2%' }, { top: '55%', right: '-2%' },
    { bottom: '5%', left: '20%' }, { bottom: '5%', right: '20%' },
  ];
  const emojis = ['✨', '⭐', '💫', '🌟', '✦', '★'];
  positions.forEach((pos, i) => {
    const sp = document.createElement('span');
    sp.textContent = emojis[i % emojis.length];
    sp.style.cssText = Object.entries(pos).map(([k, v]) => `${k}:${v}`).join(';');
    sp.style.animationDelay = `${i * .4}s`;
    wrap.append(sp);
  });
}
addLogoSparkles();

/* ───────── BUTTON RIPPLE ───────── */
document.addEventListener('pointerdown', e => {
  const btn = e.target.closest('.btn');
  if (!btn || reduce) return;
  const r = btn.getBoundingClientRect();
  const rip = document.createElement('span');
  rip.className = 'btn-ripple';
  const size = Math.max(r.width, r.height) * 2;
  rip.style.cssText = `
    width:${size}px; height:${size}px;
    left:${e.clientX - r.left - size / 2}px;
    top:${e.clientY - r.top - size / 2}px;
  `;
  btn.append(rip);
  setTimeout(() => rip.remove(), 500);

  // global ripple on body
  const gr = document.createElement('div');
  gr.className = 'ripple';
  const gs = Math.min(window.innerWidth, window.innerHeight) * .8;
  gr.style.cssText = `
    width:${gs}px; height:${gs}px;
    left:${e.clientX - gs / 2}px;
    top:${e.clientY - gs / 2}px;
  `;
  $('#ripple-layer').append(gr);
  setTimeout(() => gr.remove(), 700);
});

/* ───────── TOAST ───────── */
function toast(msg, ok) {
  const t = document.createElement('div');
  t.className = 'toast' + (ok ? ' ok' : '');
  t.textContent = msg;
  $('#toasts').append(t);
  setTimeout(() => {
    t.style.animation = 'toastIn .3s cubic-bezier(.4,1.4,.4,1) reverse';
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

/* ───────── SOUND (Web Audio) ───────── */
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function beep(freq, dur = .12, type = 'sine', vol = .08) {
  if (muted) return;
  try {
    const ctx = getAudioCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  } catch (_) {}
}
function playSuccess() {
  beep(523, .1, 'sine', .07);
  setTimeout(() => beep(659, .1, 'sine', .07), 100);
  setTimeout(() => beep(784, .15, 'sine', .07), 200);
}
function playLock() {
  beep(740, .15, 'triangle', .08);
  setTimeout(() => beep(880, .2, 'triangle', .08), 120);
}
function playError() {
  beep(160, .2, 'sawtooth', .06);
}
function playWin() {
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, .2, 'sine', .1), i * 120));
}

function playReact() {
  beep(880, .06, 'sine', .06);
  setTimeout(() => beep(1047, .08, 'sine', .05), 60);
}
function playChatSend() {
  beep(660, .05, 'sine', .05);
  setTimeout(() => beep(880, .07, 'sine', .04), 50);
}
function playChatReceive() {
  beep(523, .07, 'triangle', .05);
  setTimeout(() => beep(659, .09, 'triangle', .04), 70);
}

/* Map A-Z to piano-style pitches across two octaves so every key has
   its own distinct note rather than a generic click. */
const KEY_NOTES = {
  A:261, B:277, C:294, D:311, E:330, F:349, G:370,
  H:392, I:415, J:440, K:466, L:494, M:523,
  N:554, O:587, P:622, Q:659, R:698, S:740,
  T:784, U:831, V:880, W:932, X:988, Y:1047, Z:1109
};
function playKey(letter) {
  if (muted) return;
  const freq = KEY_NOTES[letter] || 440;
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;

    /* Short, punchy tone: triangle wave (soft, toy-like) */
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.98, now + 0.08);

    /* Tiny click transient on top for crispness */
    const click = ctx.createOscillator();
    click.type = 'square';
    click.frequency.setValueAtTime(freq * 2, now);

    const gOsc = ctx.createGain();
    gOsc.gain.setValueAtTime(0.09, now);
    gOsc.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    const gClick = ctx.createGain();
    gClick.gain.setValueAtTime(0.04, now);
    gClick.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(gOsc);   gOsc.connect(ctx.destination);
    click.connect(gClick); gClick.connect(ctx.destination);

    osc.start(now);   osc.stop(now + 0.13);
    click.start(now); click.stop(now + 0.03);
  } catch (_) {}
}

/* ───────── NAV ───────── */
$$('[data-go]').forEach(b => b.onclick = () => show(b.dataset.go));

/* ───────── HOME ───────── */
$('#lbBtn').onclick = async () => {
  const r = await (await fetch('/api/leaderboard')).json();
  $('#lb').innerHTML = r.length
    ? r.map(x => `<li>${esc(x.name)} — ${x.rating} ELO · ${x.wins} wins</li>`).join('')
    : '<li>No matches yet.</li>';
  const s = await (await fetch('/api/stats?name=' + encodeURIComponent(nm()))).json();
  $('#mystats').innerHTML = `${esc(nm())}: ${s.matches} matches, ${s.wins} wins, ${s.losses} losses, ELO ${s.rating} (${s.win_pct}%), avg moves ${s.avg_moves ?? '-'}, fastest ${s.fastest ? s.fastest.toFixed(1) + 's' : '-'}`;
  show('board');
};

/* ───────── QUICK MATCH ───────── */
let queued = false;
$('#quick').onclick = () => {
  queued = !queued;
  $('#quick').textContent = queued ? '🔍 Searching… tap to cancel' : '⚡ Play Online (quick match)';
  socket.emit(queued ? 'quick_match' : 'cancel_match', { name: nm() });
};

/* ───────── SINGLE joined HANDLER ───────── */
socket.on('joined', d => {
  // reset quick-match button
  queued = false;
  $('#quick').textContent = '⚡ Play Online (quick match)';
  // reset create button
  $('#create').disabled = false;
  $('#create').innerHTML = '🚀 Create Private Room';
  // reset join button
  $('#join').disabled = false;
  $('#join').innerHTML = 'Join!';
  // save session
  if (d && d.code) {
    S = { code: d.code, token: d.token, idx: d.idx };
    save();
  }
});

/* ───────── SETUP ───────── */
$('#rnd').onclick = () => socket.emit('random_challenge', { length: +$('#diff').value });
$('#diff').onchange = () => $('#rnd').click();
socket.on('challenge', c => { $('#start').value = c.start; $('#target').value = c.target; });

$('#create').onclick = () => {
  const start = $('#start').value.trim();
  const target = $('#target').value.trim();
  if (!start || !target) { toast('Please enter both start and target words!'); return; }
  if (start.length !== target.length) { toast('Start and target must be the same length!'); return; }
  $('#create').disabled = true;
  $('#create').innerHTML = '<span class="spin">◐</span> Creating…';
  socket.emit('create_room', { name: nm(), start, target, timer: +$('#timer').value });
};

$('#join').onclick = () => {
  const code = $('#joincode').value.trim().toUpperCase();
  if (!code) { toast('Please enter a room code!'); return; }
  $('#join').disabled = true;
  $('#join').innerHTML = '<span class="spin">◐</span>';
  socket.emit('join_room', { name: nm(), code, token: S && S.code === code ? S.token : null });
};

/* ───────── LOBBY ───────── */
$('#ready').onclick = () => socket.emit('ready', S);
$('#copy').onclick  = () => navigator.clipboard.writeText(S.code).then(() => toast('Room code copied!', true));

/* ───────── SOUND TOGGLE ───────── */
$('#mute').onclick = () => {
  muted = !muted;
  $('#mute').textContent = muted ? '🔇 Sound' : '🔊 Sound';
};

/* ───────── REMATCH / HOME ───────── */
$('#again').onclick = () => {
  if (S && st && st.players.length === 2) {
    socket.emit('rematch', S);
    $('#again').textContent = '⏳ Waiting for opponent…';
  }
};
$('#homeBtn').onclick = () => {
  sessionStorage.removeItem('wb');
  S = st = prev = null;
  $('#win').classList.remove('on');
  show('home');
};

/* ───────── REACTIONS ───────── */
const REACTIONS = [
  { e: '👏', label: 'Clap' },
  { e: '😮', label: 'Wow' },
  { e: '😂', label: 'Haha' },
  { e: '🔥', label: 'Fire' },
  { e: '😈', label: 'Evil' },
  { e: '🤯', label: 'Mind' },
  { e: '💪', label: 'Strong' },
  { e: '😤', label: 'Grr' },
  { e: '🎉', label: 'Party' },
  { e: '👀', label: 'Eyes' },
];

REACTIONS.forEach(({ e, label }) => {
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
  f.style.left  = (isMe ? 65 : 15) + '%';
  f.style.bottom = '25%';
  $('#float-layer').append(f);
  setTimeout(() => f.remove(), 2200);
  if (!isMe) {
    beep(600, .08, 'sine', .05);
  }
});

/* ───────── CHAT ───────── */
const CHAT_EMOJIS = ['😄','😂','🔥','❤️','👍','🎉','😮','😡','💪','🤔','😴','🏆','✨','👏','🙈'];
let chatOpen = true;
let chatUnread = 0;

// build emoji quick-bar
CHAT_EMOJIS.forEach(em => {
  const b = document.createElement('button');
  b.className = 'chat-emoji-btn';
  b.textContent = em;
  b.title = em;
  b.onclick = () => {
    const inp = $('#chatInput');
    inp.value += em;
    inp.focus();
  };
  $('#chatEmojiBar').append(b);
});

// collapse / expand
$('#chatHeader').onclick = (ev) => {
  if (ev.target.id === 'chatSend') return;
  chatOpen = !chatOpen;
  $('#chatWrap').classList.toggle('collapsed', !chatOpen);
  $('#chatToggle').textContent = chatOpen ? '▼' : '▲';
  if (chatOpen) { chatUnread = 0; $('#chatUnread').classList.remove('show'); scrollChat(); }
};

function scrollChat() {
  const b = $('#chatBody');
  b.scrollTop = b.scrollHeight;
}

function isEmojiOnly(str) {
  // strip emoji characters; if nothing remains it's emoji-only
  return str.trim().replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').trim().length === 0;
}

function addChatMsg(idx, name, msg, sys = false) {
  const isMe = !sys && idx === S?.idx;
  const wrap = document.createElement('div');
  wrap.className = 'chat-msg ' + (sys ? 'sys' : isMe ? 'me' : 'them');

  if (!sys && !isMe) {
    const nm = document.createElement('div');
    nm.className = 'chat-name';
    nm.textContent = name;
    wrap.append(nm);
  }

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble' + (isEmojiOnly(msg) ? ' emoji-only' : '');
  bubble.textContent = msg;
  wrap.append(bubble);

  $('#chatBody').append(wrap);

  if (chatOpen) {
    scrollChat();
  } else {
    chatUnread++;
    $('#chatUnread').textContent = chatUnread > 9 ? '9+' : chatUnread;
    $('#chatUnread').classList.add('show');
  }
}

function sendChat() {
  const inp = $('#chatInput');
  const msg = inp.value.trim();
  if (!msg || !S) return;
  socket.emit('chat', { ...S, msg });
  inp.value = '';
  inp.focus();
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

/* ───────── RECONNECT ───────── */
socket.on('connect', () => {
  if (S && st && st.status !== 'finished') socket.emit('join_room', { code: S.code, token: S.token });
});

/* ───────── ERRORS ───────── */
socket.on('err', e => {
  toast(e.msg);
  playError();
  // reset create/join buttons if they were mid-request
  $('#create').disabled = false;
  $('#create').innerHTML = '🚀 Create Private Room';
  $('#join').disabled = false;
  $('#join').innerHTML = 'Join!';
  const t = $('.tile.sel');
  if (t && !reduce) { t.classList.remove('shake'); void t.offsetWidth; t.classList.add('shake'); t.classList.add('wrong'); setTimeout(() => t.classList.remove('wrong'), 400); }
  setChecking(false);
});
socket.on('toast', e => toast(e.msg));

/* ───────── SUBMIT / PREVIEW ───────── */
function setChecking(on) {
  $('#submit').disabled = on || !pick;
  $('#submit').innerHTML = on ? '<span class="spin">◐</span> Checking…' : '🚀 Submit Move';
}
function preview() {
  return sel === null ? '' : st.current.slice(0, sel) + (pick || st.current[sel]) + st.current.slice(sel + 1);
}
$('#submit').onclick = () => { setChecking(true); socket.emit('move', { ...S, word: preview() }); };

/* ───────── KEYBOARD ───────── */
document.addEventListener('keydown', e => {
  if (!st || st.status !== 'active' || sel === null) return;
  if (/^[a-z]$/i.test(e.key)) { pick = e.key.toUpperCase(); playKey(pick); drawPicker(); drawPreview(); }
  else if (e.key === 'Enter' && pick) $('#submit').click();
});

/* ───────── HELPERS ───────── */
function mine() { return st.status === 'active' && st.turn === S.idx; }

function drawPicker() {
  const p = $('#picker');
  p.classList.toggle('hide', sel === null);
  p.innerHTML = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map(c =>
    `<button class="${c === pick ? 'on' : ''}" ${sel !== null && c === st.current[sel] ? 'disabled' : ''}>${c}</button>`
  ).join('');
  $$('#picker button').forEach(b => b.onclick = () => { pick = b.textContent; playKey(pick); drawPicker(); drawPreview(); });
}

function drawPreview() {
  const p = preview();
  $('#preview').textContent = p || '—';
  setChecking(false);
  $('#submit').disabled = !(pick && mine());
}

function tileHTML(c, i, lk) {
  const locked = lk.includes(i);
  return `<div class="tile ${locked ? 'locked' : ''} ${i === sel ? 'sel' : ''}"
    tabindex="0" data-i="${i}" role="button"
    aria-label="Letter ${c}${locked ? ', locked' : ''}">${c}</div>`;
}

/* ───────── PARTICLES ───────── */
function sparks(el, color = '#4ade80') {
  if (reduce) return;
  const r = el.getBoundingClientRect();
  for (let i = 0; i < 14; i++) {
    const s = document.createElement('i');
    s.className = 'spark';
    s.style.background = color;
    s.style.left = r.left + r.width / 2 + 'px';
    s.style.top  = r.top  + r.height / 2 + 'px';
    document.body.append(s);
    const a = Math.random() * 6.28;
    const d = 40 + Math.random() * 60;
    s.animate([
      { transform: 'none', opacity: 1 },
      { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px) scale(.2)`, opacity: 0 }
    ], { duration: 600 + Math.random() * 300, easing: 'cubic-bezier(.2,1,.2,1)' }).onfinish = () => s.remove();
  }
}

function burstStars(el) {
  if (reduce) return;
  const r = el.getBoundingClientRect();
  const emojis = ['⭐', '✨', '💫', '🌟'];
  for (let i = 0; i < 6; i++) {
    const s = document.createElement('span');
    s.style.cssText = `position:fixed;font-size:1.4rem;pointer-events:none;z-index:60;
      left:${r.left + r.width/2}px; top:${r.top + r.height/2}px;`;
    s.textContent = emojis[i % emojis.length];
    document.body.append(s);
    const a = (i / 6) * 6.28;
    const d = 50 + Math.random() * 50;
    s.animate([
      { transform: 'translate(-50%,-50%) scale(0)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(a)*d}px), calc(-50% + ${Math.sin(a)*d}px)) scale(1.2)`, opacity: 0 }
    ], 800).onfinish = () => s.remove();
  }
}

/* ───────── TIMER ───────── */
setInterval(() => {
  if (!st || !st.deadline || st.status !== 'active') {
    $('#barfill').style.transform = 'scaleX(1)';
    return;
  }
  const left = st.deadline - (Date.now() / 1000 + offset);
  const ratio = Math.max(0, Math.min(1, left / st.timer));
  $('#barfill').style.transform = `scaleX(${ratio})`;
  const urgent = ratio < .25;
  $('.bar').classList.toggle('urgent', urgent);
  $('.timer-wrap').classList.toggle('urgent', urgent);
}, 250);

/* ───────── STATE ───────── */
socket.on('state', s => {
  st = s;
  offset = s.now - Date.now() / 1000;

  /* LOBBY */
  if (s.status === 'lobby') {
    show('lobby');
    $('#code').textContent = s.code;
    $('#lobbyPlayers').innerHTML = s.players.map(p =>
      `<div class="pcard ${p.ready ? 'active' : ''}">${esc(p.name)}<br><small>${p.ready ? '✅ Ready' : '⏳ Not ready'}</small></div>`
    ).join('');
    $('#lobbyMsg').textContent = s.players.length < 2
      ? '⏳ Waiting for opponent…'
      : '🎮 Both connected! Press Ready.';
    return;
  }

  /* GAME */
  show('game');
  if (s.status !== 'finished') { $('#win').classList.remove('on'); $('#again').textContent = '🔄 Rematch!'; }
  if (sel !== null && (!mine() || s.locked.includes(sel))) sel = null;
  if (!prev || prev.current !== s.current) pick = null;

  /* Word display */
  $('#from').textContent = s.start;
  $('#to').textContent   = s.target;

  /* Players */
  s.players.forEach((p, i) => {
    const e = $('#p' + i);
    const isMe = i === S.idx;
    e.innerHTML = `${isMe ? '🌟 ' : ''}${esc(p.name)}${isMe ? ' (you)' : ''}`;
    e.classList.toggle('active', s.status === 'active' && s.turn === i);
    e.classList.toggle('off',   !p.connected);
  });

  /* Opponent connection */
  const opp = s.players[1 - S.idx];
  $('#conn').textContent = opp && !opp.connected
    ? '📡 Opponent disconnected. Waiting…'
    : '';

  /* Turn text */
  const turnEl = $('#turnTxt');
  if (s.status === 'active') {
    if (mine()) {
      turnEl.textContent = '🎯 Your turn!';
      turnEl.className = 'center turn-txt my-turn';
    } else {
      turnEl.textContent = `⏳ ${esc(s.players[1 - S.idx]?.name || 'Opponent')}'s turn…`;
      turnEl.className = 'center turn-txt opp-turn';
    }
  } else {
    turnEl.textContent = '';
    turnEl.className = 'center turn-txt';
  }

  /* Tiles */
  const T = $('#tiles');
  const old = prev && prev.current;
  T.innerHTML = [...s.current].map((c, i) => tileHTML(c, i, s.locked)).join('');

  if (old && old !== s.current) {
    beep(520, .1);
    $$('#tiles .tile').forEach((t, i) => {
      if (old[i] !== s.current[i]) {
        if (!reduce) { t.classList.add('flip', 'correct'); setTimeout(() => t.classList.remove('correct'), 500); }
      }
    });
    s.locked.filter(i => !prev.locked.includes(i)).forEach(i => {
      const t = $$('#tiles .tile')[i];
      if (t) {
        t.classList.add('lockpop');
        sparks(t, '#4ade80');
        burstStars(t);
        playLock();
      }
    });
  }

  /* Tile click handler */
  $$('#tiles .tile').forEach(t => t.onclick = () => {
    const i = +t.dataset.i;
    if (st.locked.includes(i)) { toast('🔒 That letter is locked!'); playError(); return; }
    if (!mine()) { toast("⏳ It's not your turn yet!"); return; }
    sel = i; pick = null;
    $$('#tiles .tile').forEach(x => x.classList.toggle('sel', x === t));
    drawPicker(); drawPreview();
    if (!reduce) {
      t.classList.remove('tileSelected'); void t.offsetWidth; t.classList.add('tileSelected');
    }
    beep(440, .07, 'sine', .05);
  });

  /* History */
  $('#hist').textContent = s.moves.length
    ? '📜 ' + s.moves.map(m => m.word).join(' → ')
    : '';

  drawPicker(); drawPreview();
  prev = s;
  if (s.status === 'finished') win(s);
});

/* ───────── WIN ───────── */
function win(s) {
  const w = s.players[s.winner];
  const isMe = s.winner === S.idx;

  $('#winTitle').textContent = isMe
    ? '🎉 You Win! 🎉'
    : `😮 ${w.name} Wins!`;

  $('#trophyAnim').textContent = isMe ? '🏆' : '🥈';

  $('#winTiles').innerHTML = [...s.target].map((c, i) => tileHTML(c, i, s.locked)).join('');
  $('#winInfo').textContent = `${s.moves.length} moves · ${s.duration.toFixed(1)}s`
    + (s.players[1 - S.idx].rematch ? ' · Opponent wants a rematch!' : '');

  // win stars burst
  const ws = $('#winStars');
  ws.innerHTML = '';
  if (!reduce && isMe) {
    const positions = ['10%,10%','80%,10%','10%,80%','80%,80%','45%,5%','5%,45%','90%,45%'];
    positions.forEach((pos, i) => {
      const [l, t] = pos.split(',');
      const star = document.createElement('span');
      star.className = 'win-star';
      star.textContent = ['⭐','✨','💫','🌟','⭐','✨','💫'][i];
      star.style.cssText = `left:${l};top:${t};animation-delay:${i * .15}s`;
      ws.append(star);
    });
  }

  $('#win').classList.add('on');
  if (isMe) { playWin(); confetti(); }
  else beep(300, .4, 'triangle', .06);
}

/* ───────── CONFETTI ───────── */
function confetti() {
  if (reduce) return;
  const c = $('#confetti');
  const x = c.getContext('2d');
  c.width  = innerWidth;
  c.height = innerHeight;

  const colors = ['#60c8ff','#c084fc','#4ade80','#fde047','#f472b6','#fb923c'];
  const P = Array.from({ length: 150 }, () => ({
    x: Math.random() * c.width,
    y: -Math.random() * c.height * .5,
    vx: (Math.random() - .5) * 2,
    vy: 1.5 + Math.random() * 4,
    r: 4 + Math.random() * 7,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * 360,
    rotV: (Math.random() - .5) * 6,
    shape: Math.random() > .5 ? 'rect' : 'circle',
  }));

  let frame = 0;
  function draw() {
    x.clearRect(0, 0, c.width, c.height);
    P.forEach(p => {
      p.y  += p.vy;
      p.x  += p.vx;
      p.vy += .05;
      p.rot += p.rotV;
      x.save();
      x.translate(p.x, p.y);
      x.rotate(p.rot * Math.PI / 180);
      x.fillStyle = p.color;
      x.globalAlpha = Math.max(0, 1 - frame / 280);
      if (p.shape === 'rect') x.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.5);
      else { x.beginPath(); x.arc(0, 0, p.r / 2, 0, 6.28); x.fill(); }
      x.restore();
    });
    if (++frame < 300) requestAnimationFrame(draw);
    else x.clearRect(0, 0, c.width, c.height);
  }
  draw();
}
