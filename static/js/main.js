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
$('#drawAgain').onclick = () => {
  if (S && st && st.players.length === 2) {
    socket.emit('rematch', S);
    $('#drawAgain').textContent = '⏳ Waiting…';
  }
};
$('#drawHome').onclick = () => {
  sessionStorage.removeItem('wb');
  S = st = prev = null;
  $('#draw').classList.remove('on');
  show('home');
};

/* ══════════════════════════════════════
   PAUSE / RESUME
   ══════════════════════════════════════ */
$('#pauseBtn').onclick = () => S && socket.emit('pause', S);
$('#resumeBtn').onclick = () => S && socket.emit('resume', S);
$('#resumeOverlayBtn').onclick = () => S && socket.emit('resume', S);

/* ══════════════════════════════════════
   RESET (vote — both must agree)
   ══════════════════════════════════════ */
let resetVoted = false;
$('#resetBtn').onclick = () => {
  if (!S) return;
  if (resetVoted) {
    socket.emit('cancel_reset', S);
    resetVoted = false;
    $('#resetBtn').classList.remove('voted');
    $('#resetBtn').textContent = '🔄 Reset';
  } else {
    socket.emit('vote_reset', S);
    resetVoted = true;
    $('#resetBtn').classList.add('voted');
    $('#resetBtn').textContent = '✕ Cancel Reset';
  }
};

/* ══════════════════════════════════════
   FORFEIT
   ══════════════════════════════════════ */
$('#forfeitBtn').onclick = () => {
  if (!S) return;
  if (!confirm('Surrender this match? You will lose.')) return;
  socket.emit('forfeit', S);
};

/* ══════════════════════════════════════
   HINTS
   ══════════════════════════════════════ */
$('#hintBtn').onclick = () => {
  if (!S) return;
  if (!mine()) { toast("⏳ It's not your turn!"); return; }
  socket.emit('hint', S);
};
$('#hintClose').onclick = () => {
  $('#hintPanel').style.display = 'none';
};

socket.on('hint', d => {
  const panel = $('#hintPanel');
  const words = $('#hintWords');
  words.innerHTML = '';
  d.hints.forEach(w => {
    const el = document.createElement('div');
    el.className = 'hint-word';
    el.textContent = w;
    words.append(el);
  });
  panel.style.display = 'flex';
  updateHintCounter(d.hints_left);
  beep(880, .08, 'sine', .06);
  setTimeout(() => beep(1047, .1, 'sine', .05), 80);
});

function updateHintCounter(left) {
  const c = $('#hintCounter');
  if (c) {
    c.textContent = left;
    c.classList.toggle('zero', left === 0);
  }
  const btn = $('#hintBtn');
  if (btn) btn.disabled = left === 0 || !mine();
}

/* ══════════════════════════════════════
   WORD DEFINITIONS
   ══════════════════════════════════════ */
// Built-in definition map (most common game words)
const DEFS = {"cat":"a small furry pet that meows","dog":"a loyal pet that barks","hat":"a covering worn on the head","bed":"furniture for sleeping","pig":"a pink farm animal","fox":"a clever wild animal with a bushy tail","sun":"the star that lights our day","bus":"a large vehicle for many people","bat":"a flying mammal active at night","run":"to move quickly on foot","hot":"having a high temperature","big":"large in size","low":"near the ground","map":"a drawing showing an area","pen":"a tool for writing","cup":"a small container for drinking","red":"the colour of fire and blood","tan":"a light brown colour","boy":"a male child","gum":"soft tissue around teeth","ant":"a tiny hard-working insect","eel":"a long snake-like fish","sit":"to rest on a surface","top":"the highest point","bag":"a container for carrying things","wet":"covered with water","dry":"without water","fire":"burning flames","cold":"having a low temperature","love":"a deep feeling of affection","hate":"a strong feeling of dislike","warm":"slightly hot, comfortable","cool":"slightly cold, pleasantly fresh","head":"the top part of your body","tail":"the end part of an animal","dark":"without light","life":"the state of being alive","wind":"moving air","rain":"water falling from clouds","good":"of high quality or right","evil":"very bad or wicked","sand":"tiny grains of rock on beaches","milk":"a white drink from cows","book":"pages with words bound together","look":"to use your eyes to see","lamp":"a device that gives light","pine":"an evergreen tree with needles","card":"a small flat piece of stiff paper","word":"a unit of language with meaning","coin":"a small metal piece of money","gold":"a precious yellow metal","fish":"a cold-blooded creature in water","bird":"a feathered animal that flies","rice":"a grain eaten worldwide","meat":"the flesh of animals as food","time":"the continuous progress of events","long":"great in length","fast":"moving at high speed","slow":"moving at low speed","hard":"firm and not soft; difficult","soft":"gentle to touch","dawn":"the moment the sun rises","dusk":"the moment the sun sets","ship":"a large vessel on water","boat":"a small vessel on water","water":"a clear liquid essential to life","earth":"the planet we live on","light":"energy that lets us see","night":"the dark period after sunset","stone":"a small hard piece of rock","plant":"a living organism that grows from soil","bread":"a baked food from flour","heart":"the organ that pumps blood","brain":"the organ inside your skull that thinks","smile":"a happy expression on your face","frown":"a sad or angry expression","clean":"free from dirt","dirty":"covered in dirt","happy":"feeling joy and contentment","angry":"feeling strong displeasure","money":"coins and notes to buy things","honey":"a sweet sticky food made by bees","train":"a vehicle that runs on rails","plane":"an aircraft that flies","grass":"green plants on lawns","field":"an open area of land","sweet":"having a sugary taste","beach":"a sandy shore next to the sea","ocean":"a vast body of salt water","storm":"violent weather with rain and wind","cloud":"a mass of water vapour in the sky","tiger":"a large striped wild cat","lemon":"a sour yellow citrus fruit","horse":"a large animal for riding","house":"a building where people live","paint":"a coloured liquid for surfaces","brush":"a tool with bristles","bear":"a large powerful wild animal","bold":"brave and confident","bond":"a connection between things","burn":"to be on fire","bush":"a low woody plant","cage":"an enclosure made of bars","cake":"a sweet baked dessert","calm":"peaceful without worry","cave":"a hollow space underground","chef":"a professional cook","chip":"a small piece broken off","club":"a group with shared interests","clue":"a hint to solve a mystery","coal":"a black rock burned as fuel","code":"a system of signs or symbols","cope":"to manage a difficult situation","corn":"a yellow cereal grain","cure":"a remedy that heals","cute":"attractive and endearing","deal":"an agreement","dear":"beloved; expensive","deck":"a floor of a ship","deep":"extending far down","deny":"to say something is not true","dice":"small cubes used in games","diet":"the food you usually eat","dine":"to eat a meal","dome":"a rounded roof","done":"completed or finished","door":"a panel for an entrance","dove":"a white bird symbolising peace","drag":"to pull something heavy","draw":"to make a picture","drip":"a small drop of liquid","drop":"a small amount of liquid","drum":"a musical instrument you beat","duck":"a water bird","dump":"to throw away carelessly","dust":"fine dry powder of dirt","ease":"freedom from difficulty","edge":"the border of something","epic":"impressively great","even":"flat and level","exam":"a formal test of knowledge","face":"the front of the head","fact":"something known to be true","fail":"to not succeed","fall":"to drop downward","fame":"being widely known","farm":"land for growing crops","fear":"an unpleasant feeling of danger","feel":"to sense by touch","fill":"to put into a container until full","film":"a movie","find":"to discover something","flag":"a cloth representing a country","flat":"a level surface; an apartment","flow":"to move smoothly like water","foam":"a mass of small bubbles","fold":"to bend something over itself","folk":"people in general","fond":"having a liking for something","fool":"someone who acts unwisely","fork":"a utensil with prongs","form":"the shape of something","fort":"a strong military building","free":"not under control or cost","fuel":"material burned for energy","full":"containing as much as possible","fury":"extreme anger","game":"an activity played for fun","gang":"a group of people","gate":"a hinged barrier in a fence","gaze":"to look steadily at something","gear":"equipment; a machine mechanism","germ":"a microorganism causing disease","give":"to hand something to someone","glad":"feeling pleasure","glee":"great delight or joy","glue":"a sticky substance for joining","goal":"an aim or score in sport","goat":"a horned farm animal","golf":"a sport played with clubs","gown":"a long elegant dress","grab":"to take hold of quickly","grip":"a firm hold on something","grin":"a wide smile showing teeth","grow":"to get bigger over time","gulp":"to swallow quickly","gust":"a sudden strong burst of wind","hack":"to cut roughly","hail":"frozen rain; to greet someone","hair":"thin strands on the head","half":"one of two equal parts","hall":"a large room or corridor","halt":"to stop moving","hand":"the body part at arm's end","hang":"to fasten from above","harm":"damage or injury","haze":"a thin mist reducing visibility","heap":"a large untidy pile","hear":"to perceive sounds","heel":"the back part of the foot","herd":"a group of animals","hero":"a person admired for bravery","hide":"to put out of sight","high":"at great distance above ground","hill":"raised land smaller than a mountain","hint":"a small piece of helpful information","hire":"to employ someone","hold":"to keep in your hand","hole":"an opening or hollow space","hook":"a curved device for hanging things","hope":"to want something to happen","horn":"a hard growth on an animal","hose":"a flexible tube for water","huge":"extremely large","hunt":"to chase wild animals","hurt":"to cause pain","idle":"not working or busy","inch":"a unit of length","iron":"a hard grey metal","item":"a single thing in a collection","jade":"a green precious stone","jest":"a joke or playful remark","join":"to connect things together","joke":"something said to cause laughter","jump":"to push off the ground","just":"fair and right; only","keen":"having a strong interest","keep":"to hold onto something","kind":"gentle and generous","king":"a male ruler","kiss":"to touch with the lips in affection","kite":"a flying toy on a string","knee":"the joint in the middle of your leg","know":"to have information in your mind","lace":"a delicate patterned fabric","lame":"unable to walk properly","land":"solid ground","lane":"a narrow road","last":"after everything else","late":"after the expected time","lead":"to guide others","lean":"thin; to tilt to one side","leap":"to jump high or far","lend":"to give something temporarily","lick":"to pass the tongue over a surface","lily":"a beautiful flowering plant","line":"a long thin mark","link":"a connection","lion":"a large powerful wild cat","list":"a series of items","load":"a heavy amount to carry","loan":"money borrowed with a promise to repay","lock":"a device to fasten something","lore":"a body of knowledge","lose":"to no longer have something","loss":"the act of losing","lure":"to attract by offering something","lust":"a strong desire","made":"past tense of make","mail":"letters delivered by post","main":"the most important","male":"of the masculine sex","mare":"a female horse","mark":"a spot or trace","mast":"a tall pole on a ship","mate":"a friend or partner","maze":"a complicated network of paths","meal":"an occasion when food is eaten","mean":"unkind; to intend","meet":"to come face to face with someone","melt":"to change from solid to liquid","mild":"gentle and not severe","mill":"a building for grinding grain","mine":"belonging to me","mint":"a herb with a fresh smell","miss":"to fail to hit; to feel sad about absence","mist":"thin fog of water droplets","mode":"a way of operating","mole":"a small burrowing animal","monk":"a man in a religious community","moon":"the natural satellite of Earth","more":"a greater amount","moss":"a soft green plant on damp surfaces","move":"to change position","much":"a large amount","must":"to be required to do something","nail":"a thin metal spike","name":"a word to identify someone","neat":"tidy and in order","need":"to require something essential","nest":"a structure where birds lay eggs","nice":"pleasant and agreeable","node":"a point where lines connect","nook":"a small quiet corner","norm":"a standard or expected pattern","nose":"the organ used for smelling","note":"a short written message","obey":"to follow instructions","once":"one single time","only":"no more than; exclusively","open":"not closed","oval":"egg-shaped","oven":"an enclosed compartment for cooking","pace":"the speed of movement","page":"one side of a leaf in a book","paid":"past tense of pay","pain":"an unpleasant feeling","pair":"two matching things","pale":"light in colour","palm":"the flat inner surface of the hand","pave":"to cover with stone or asphalt","peak":"the highest point","peer":"to look closely; a person of equal status","play":"to take part in a game","plot":"the main story; a plan","plum":"a sweet purple fruit","poem":"a piece of writing with rhythm","poll":"a survey of opinions","pond":"a small area of still water","pool":"a small area of water","poor":"having very little money","pore":"a tiny opening in the skin","post":"a pole; to send by mail","pour":"to cause liquid to flow","pray":"to speak to a god","prey":"an animal hunted for food","pull":"to draw towards yourself","pump":"a device for moving liquid","pure":"not mixed with anything else","push":"to apply force to move something","race":"a competition of speed","rage":"extreme anger","raid":"a sudden attack","rake":"a garden tool for gathering leaves","ramp":"a slope connecting two levels","rank":"a position in a hierarchy","rare":"not common; slightly cooked","rash":"a skin irritation; acting without thinking","rate":"the speed; a price","read":"to understand written words","real":"actually existing; not fake","reef":"a ridge of rock or coral","rely":"to trust or depend on","rent":"payment for using property","rest":"to relax; what remains","ring":"a circular band; to make a bell sound","riot":"a violent public disturbance","rise":"to move upward","risk":"the possibility of harm","road":"a hard surface for vehicles","roam":"to travel without a destination","roar":"a loud deep sound","robe":"a long loose garment","rock":"a hard natural mineral; to move back and forth","roll":"to move by turning over","roof":"the top covering of a building","rope":"a thick twisted cord","rose":"a beautiful flowering plant with thorns","rude":"showing no respect","ruin":"a building in decay; to damage","rule":"a statement of what is allowed","rust":"reddish-brown coating on iron","safe":"protected from danger","sage":"a wise person; an aromatic herb","sail":"to travel on water using wind","sale":"the exchange of goods for money","sane":"having a healthy mind","save":"to rescue; to keep money","seed":"a plant embryo","seep":"to flow slowly through gaps","send":"to cause something to go somewhere","shad":"a type of fish","shed":"a small outbuilding","shin":"the front of the lower leg","shop":"a place where goods are sold","shot":"a fired projectile; an attempt","show":"to let someone see; a performance","shut":"to close","silk":"a smooth shiny fabric","sing":"to make musical sounds with your voice","sink":"to go down into water or liquid","size":"the measurement of how big something is","skip":"to jump lightly; to miss a step","slab":"a thick flat piece of stone","slap":"to hit with an open hand","slim":"thin and lean","slip":"to lose your footing","slot":"a narrow opening","slow":"moving at low speed","snap":"to break suddenly","snug":"warm and comfortable","soak":"to leave in liquid until wet","soar":"to fly high; to increase rapidly","sock":"a covering worn on the foot","soil":"the top layer of earth","sole":"the only one; bottom of a shoe","some":"an unspecified amount","song":"a piece of music with words","soon":"in a short time from now","sore":"painful to touch","sort":"to arrange into categories","soul":"the spiritual part of a person","span":"the length from one end to another","spin":"to rotate quickly","spot":"a small area; to notice something","stem":"the main stalk of a plant","step":"to put your foot down; a stair","stir":"to mix; to cause excitement","stop":"to cease moving","stub":"a short remaining piece","such":"of the type mentioned","suit":"a set of matching clothes","sulk":"to be silent and sullen","sure":"confident and certain","swam":"past tense of swim","sync":"to coordinate timing","tame":"domesticated; not wild","tang":"a strong sharp taste","task":"a piece of work to be done","team":"a group working together","tear":"to rip; a drop of water from the eye","test":"a procedure to check quality","than":"used in comparisons","then":"at that time; next in order","thud":"a dull heavy sound","tick":"a mark showing something is correct","tier":"a row or layer","till":"until; to cultivate soil","tilt":"to lean to one side","tiny":"extremely small","toil":"to work very hard","toll":"a charge for using a road","tomb":"a burial place","tone":"quality of sound","took":"past tense of take","tore":"past tense of tear","torn":"ripped apart","toss":"to throw lightly","tour":"a journey visiting several places","town":"a settlement larger than a village","trap":"a device to catch animals","tree":"a tall plant with a trunk","trek":"a long difficult journey","trim":"to cut to neaten; neat and tidy","trio":"a group of three","trip":"a journey; to stumble","true":"accurate and correct","tube":"a hollow cylinder","tuck":"to push something into a folded position","tune":"a melody; to adjust an instrument","turf":"grass and the soil beneath","twin":"one of two born at the same time","type":"a category; to write on a keyboard","ugly":"unpleasant to look at","undo":"to reverse an action","unit":"a single thing as part of a group","upon":"on top of; immediately after","used":"previously owned; accustomed to","vale":"a valley","vane":"a device showing wind direction","veil":"a thin covering; to hide","vend":"to sell goods","vent":"an opening for air; to express feelings","vest":"a sleeveless garment","veto":"to reject a proposal officially","vice":"a bad habit; a gripping tool","view":"what you can see; an opinion","vile":"extremely unpleasant","vine":"a climbing plant that produces grapes","visa":"permission to enter a country","void":"empty space; to make invalid","volt":"a unit of electric potential","wade":"to walk through water","wake":"to stop sleeping; a trail left by a boat","walk":"to move on foot at normal pace","wall":"a vertical structure dividing spaces","wand":"a thin stick used by magicians","wane":"to decrease gradually","wary":"cautious and careful about danger","wave":"a ridge of moving water; to greet","wean":"to stop feeding a baby on milk","weed":"an unwanted wild plant","week":"a period of seven days","well":"in good health; a hole for water","went":"past tense of go","west":"the direction where the sun sets","whim":"a sudden desire or impulse","wide":"having a large distance from side to side","wife":"a married woman","will":"to be going to do; determination","wilt":"to droop from lack of water","wily":"clever at getting what you want","wine":"an alcoholic drink from grapes","wink":"to close and open one eye quickly","wolf":"a wild animal related to the dog","womb":"the organ where babies develop","wool":"the soft fibre from sheep","worm":"a small creature that burrows in soil","wrap":"to cover something completely","wren":"a very small brown songbird","yard":"an enclosed outdoor area","yarn":"a long story; thread for knitting","yawn":"to open the mouth from tiredness","year":"a period of 365 days","yell":"to shout loudly","zone":"an area set apart for a purpose","zoom":"to move very quickly"};

let lastWord = null;
async function showWordDef(word, playerName) {
  const w = word.toLowerCase();
  const box = $('#wordDef');
  if (!box) return;

  // Try built-in first
  let def = DEFS[w];

  // If not found and we have the API available, try fetching
  if (!def) {
    try {
      const r = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${w}`, {signal: AbortSignal.timeout(3000)});
      if (r.ok) {
        const data = await r.json();
        def = data?.[0]?.meanings?.[0]?.definitions?.[0]?.definition || null;
        if (def && def.length > 120) def = def.slice(0, 117) + '…';
      }
    } catch(_) { /* offline or timeout — no problem */ }
  }

  if (!def) {
    box.classList.remove('show');
    return;
  }

  box.innerHTML = `<div class="word-def-inner">
    <span class="word-def-word">${esc(word.toUpperCase())}</span>
    <span class="word-def-sep">—</span>
    <div>
      <div class="word-def-text">${esc(def)}</div>
      <div class="word-def-player">played by ${esc(playerName)}</div>
    </div>
  </div>`;
  box.classList.add('show');
  lastWord = word;
}

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
  if (s.status !== 'finished') { $('#draw').classList.remove('on'); $('#drawAgain').textContent = '🔄 Rematch!'; }
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

  /* pause overlay */
  const paused = s.status === 'paused';
  $('#pauseOverlay').style.display = paused ? 'grid' : 'none';
  $('#pauseBtn').style.display  = (!paused && s.status === 'active') ? '' : 'none';
  $('#resumeBtn').style.display = paused ? '' : 'none';

  /* sync reset vote state */
  const myVoted = (s.reset_votes || []).includes(S.idx);
  if (!myVoted && resetVoted) { resetVoted = false; }
  $('#resetBtn').classList.toggle('voted', myVoted);
  $('#resetBtn').textContent = myVoted ? '✕ Cancel Reset' : '🔄 Reset';
  resetVoted = myVoted;

  /* hint counter */
  const hintsLeft = (s.hints_max || 3) - ((s.hints_used || [0,0])[S.idx] || 0);
  updateHintCounter(hintsLeft);

  const tEl = $('#turnTxt');
  if (s.status === 'active') {
    if (mine()) { tEl.textContent = '🎯 Your turn!'; tEl.className = 'turn-txt my-turn'; }
    else { tEl.textContent = `⏳ ${esc(s.players[1-S.idx]?.name||'Opponent')}'s turn…`; tEl.className = 'turn-txt opp-turn'; }
  } else if (paused) {
    tEl.textContent = '⏸ Paused'; tEl.className = 'turn-txt opp-turn';
  } else {
    tEl.textContent = ''; tEl.className = 'turn-txt';
  }

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
    // Show definition for the new word
    const mover = s.moves.length ? s.players[s.moves[s.moves.length-1].player] : null;
    if (mover) showWordDef(s.current, mover.name);
  }

  $$('#tiles .tile').forEach(t => t.onclick = () => {
    if (paused) { toast('⏸ Game is paused!'); return; }
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
  if (s.status === 'finished') {
    if (s.reason === 'draw') {
      drawScreen(s);
    } else {
      winScreen(s);
    }
  }
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
   DRAW SCREEN
   ══════════════════════════════════════ */
function drawScreen(s) {
  $('#drawInfo').textContent = `${s.moves.length} moves · ${s.duration.toFixed(1)}s · No more valid moves available`;
  $('#draw').classList.add('on');
  // gentle shimmer sound
  beep(440,.2,'sine',.06);
  setTimeout(()=>beep(554,.2,'sine',.05),200);
  setTimeout(()=>beep(440,.3,'sine',.04),400);
  // small confetti in blue/purple
  if (!reduce) {
    const c = $('#drawCanvas'), x = c.getContext('2d');
    c.width = innerWidth; c.height = innerHeight;
    const cols = ['#60c8ff','#c084fc','#ffffff','#a78bca'];
    const P = Array.from({length:80}, () => ({
      x:Math.random()*c.width, y:-Math.random()*c.height*.3,
      vx:(Math.random()-.5)*2, vy:1+Math.random()*3,
      r:3+Math.random()*5, color:cols[Math.floor(Math.random()*cols.length)],
      rot:Math.random()*360, rotV:(Math.random()-.5)*5,
    }));
    let frame=0;
    (function draw(){
      x.clearRect(0,0,c.width,c.height);
      P.forEach(p=>{p.y+=p.vy;p.x+=p.vx;p.vy+=.04;p.rot+=p.rotV;
        x.save();x.translate(p.x,p.y);x.rotate(p.rot*Math.PI/180);
        x.fillStyle=p.color;x.globalAlpha=Math.max(0,1-frame/180);
        x.fillRect(-p.r/2,-p.r/2,p.r,p.r*1.4);x.restore();});
      if(++frame<200) requestAnimationFrame(draw);
      else x.clearRect(0,0,c.width,c.height);
    })();
  }
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
