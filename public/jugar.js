const $ = (id) => document.getElementById(id);
const socket = io();

// ---------- Memoria local ----------
const store = {
  get(k) { try { return localStorage.getItem('garabato:' + k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem('garabato:' + k, v); } catch (e) {} },
};
const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
// Modo prueba (/jugar?prueba): cada pestaña es un jugador distinto, para probar en una sola compu.
const PRUEBA = new URLSearchParams(location.search).has('prueba');
if (PRUEBA) {
  const mem = new Map();
  store.get = (k) => mem.get(k) ?? null;
  store.set = (k, v) => mem.set(k, v);
}
let myId = store.get('id');
if (!myId) { myId = rid(); store.set('id', myId); }
let myName = store.get('name') || '';
let myColor = store.get('color') || '';
let joined = store.get('joined') === '1' && !!myName;

let S = null;
let turnKey = '';
let mine = [];
let toastTimer = null;

// ---------- Vistas ----------
const VIEWS = ['v-join', 'v-wait', 'v-choose', 'v-other', 'v-draw', 'v-guess', 'v-reveal', 'v-podium'];
let current = '';
function show(id) {
  if (current === id) return;
  VIEWS.forEach((v) => ($(v).hidden = v !== id));
  current = id;
  if (id === 'v-guess' && !(S && S.you && S.you.guessed)) setTimeout(() => $('guessInput').focus(), 50);
}

// ---------- Unirse ----------
const PLAYER_COLORS = ['#ff5a36', '#2f6bff', '#18a874', '#f2a900', '#a64dff', '#ff4fa3', '#00a3c4', '#6b4f3a'];
if (!myColor) myColor = PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
function renderSwatches() {
  $('swatches').innerHTML = PLAYER_COLORS.map((c) => `<button type="button" class="swatch" style="background:${c}" data-c="${c}" aria-pressed="${c === myColor}" aria-label="Color"></button>`).join('');
}
renderSwatches();
$('swatches').addEventListener('click', (e) => {
  const b = e.target.closest('.swatch');
  if (!b) return;
  myColor = b.dataset.c;
  renderSwatches();
});
$('name').value = myName;
$('joinForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const n = $('name').value.trim();
  if (!n) { $('joinNote').textContent = 'Escribe tu nombre.'; return; }
  myName = n;
  store.set('name', myName);
  store.set('color', myColor);
  store.set('joined', '1');
  joined = true;
  $('joinNote').textContent = '';
  join();
  $('name').blur();
});
function join() {
  if (joined && socket.connected) socket.emit('player:join', { id: myId, name: myName, color: myColor });
}
$('changeBtn').onclick = () => {
  socket.emit('player:leave');
  joined = false;
  store.set('joined', '0');
  render();
};

// ---------- Conexión ----------
socket.on('connect', () => { $('banner').hidden = true; join(); });
socket.on('disconnect', () => { $('banner').textContent = 'Reconectando…'; $('banner').hidden = false; });
socket.on('state', (st) => {
  Reloj.sync(st.serverNow);
  S = st;
  render();
});
socket.on('kicked', () => {
  joined = false;
  store.set('joined', '0');
  $('joinNote').textContent = 'Te sacaron de la sala. Puedes volver a entrar.';
  render();
});
socket.on('replaced', () => {
  $('banner').textContent = 'Abriste el juego en otra pestaña. Usa esa.';
  $('banner').hidden = false;
  socket.disconnect();
});
socket.on('board:full', (strokes) => pad.setStrokes(strokes));
socket.on('guess:result', (r) => {
  if (r.verdict === 'correct') {
    navigator.vibrate?.([60, 40, 120]);
  } else {
    mine.push({ text: r.text, verdict: r.verdict });
    if (r.verdict === 'close') showToast('¡Casi! 🔥');
    else { $('guessForm').classList.remove('shake'); void $('guessForm').offsetWidth; $('guessForm').classList.add('shake'); }
  }
  renderGuess();
});

function showToast(text) {
  clearTimeout(toastTimer);
  const el = document.getElementById('toast') || Object.assign(document.createElement('div'), { id: 'toast', className: 'toast' });
  el.textContent = text;
  $('guessStatus').prepend(el);
  toastTimer = setTimeout(() => el.remove(), 1600);
}

// ---------- Render ----------
function render() {
  if (!joined) return show('v-join');
  if (!S || !S.you) return show('v-wait');

  const key = S.round + ':' + S.drawerId + ':' + (S.phase === 'lobby' || S.phase === 'podium' ? S.phase : 'turn');
  if (key !== turnKey) {
    if (turnKey) pad.clear(); // al reconectar conserva el dibujo que mandó el servidor
    turnKey = key;
    mine = [];
    $('guessInput').value = '';
  }
  const amDrawer = S.drawerId === S.you.id;

  switch (S.phase) {
    case 'lobby': {
      show('v-wait');
      $('waitAvatar').innerHTML = avatarHtml(S.you, 'xl');
      $('waitName').textContent = S.you.name;
      const n = S.players.filter((p) => p.connected).length;
      $('waitCount').textContent = n < 2 ? 'Esperando a más jugadores…' : `${n} jugadores en la sala`;
      break;
    }
    case 'choosing':
      if (amDrawer) {
        show('v-choose');
        const html = (S.choices || []).map((c, i) => `<button class="btn choice" data-i="${i}">${escapeHtml(c.word)} <span class="pill diff-${c.diff}">${DIFF_LABEL[c.diff]} ${DIFF_MULT[c.diff]}</span></button>`).join('');
        if ($('choices').dataset.html !== html) { $('choices').innerHTML = html; $('choices').dataset.html = html; }
      } else {
        show('v-other');
        const d = S.players.find((p) => p.id === S.drawerId);
        $('otherAvatar').innerHTML = d ? avatarHtml(d, 'xl') : '';
        $('otherTitle').textContent = `${S.drawerName || 'Alguien'} está eligiendo palabra…`;
      }
      break;
    case 'drawing':
      if (amDrawer) {
        show('v-draw');
        $('secret').textContent = S.secretWord || '';
      } else {
        show('v-guess');
        renderGuess();
      }
      break;
    case 'reveal': {
      show('v-reveal');
      $('revealWord').textContent = S.word || '';
      const me = S.players.find((p) => p.id === S.you.id) || S.you;
      $('revealMine').textContent = amDrawer
        ? me.turnPoints ? `Tu dibujo te dio +${me.turnPoints}` : 'Nadie lo adivinó esta vez'
        : me.turnPoints ? `¡Adivinaste! +${me.turnPoints}` : 'Esta no salió';
      $('revealScore').textContent = me.score;
      break;
    }
    case 'podium': {
      show('v-podium');
      const sorted = [...S.players].sort((a, b) => b.score - a.score);
      const pos = sorted.findIndex((p) => p.id === S.you.id) + 1;
      $('podiumTitle').textContent = pos === 1 ? '¡Ganaste! 🏆' : pos ? `Quedaste en ${pos}º lugar` : 'Fin de la partida';
      $('podiumScore').textContent = (sorted[pos - 1] || S.you).score + ' pts';
      break;
    }
  }
}

$('choices').addEventListener('click', (e) => {
  const b = e.target.closest('.choice');
  if (b) socket.emit('word:choose', Number(b.dataset.i));
});

// ---------- Adivinar ----------
function renderGuess() {
  if (!S || S.phase !== 'drawing') return;
  $('guessWho').textContent = `Dibuja ${S.drawerName}`;
  $('guessHint').innerHTML = hintHtml(S.hint);
  const guessed = S.you.guessed;
  $('guessForm').hidden = guessed;
  const list = mine.map((g) => `<li class="${g.verdict}"><span>${escapeHtml(g.text)}</span><span class="tag">${g.verdict === 'close' ? 'casi 🔥' : '✗'}</span></li>`).join('');
  const toast = document.getElementById('toast');
  if (guessed) {
    $('guessStatus').innerHTML = `<div class="got"><div class="big">¡Adivinaste!</div><div class="score-big">+${S.you.turnPoints}</div><div class="muted">Espera a que los demás lo saquen.</div></div>`;
  } else {
    $('guessStatus').innerHTML = mine.length ? `<ul class="mine">${list}</ul>` : '<div class="tip">Mira la pantalla y escribe lo que crees que es.<br>Puedes intentar las veces que quieras.</div>';
    if (toast) $('guessStatus').prepend(toast);
  }
}
$('guessForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('guessInput').value.trim();
  if (!v) return;
  socket.emit('guess', v);
  $('guessInput').value = '';
  $('guessInput').focus();
});

// ---------- Dibujar ----------
const pad = new Pizarra($('padCanvas'));
const INKS = ['#1b1f3b', '#e63a2e', '#ff8a1f', '#ffd21f', '#23a55a', '#2f6bff', '#8a4dff', '#ff5fa8', '#8a5a3b', '#9aa0b5'];
let ink = INKS[0];
let size = 14;
let erasing = false;

function renderTools() {
  $('colors').innerHTML = INKS.map((c) => `<button class="color" style="background:${c}" data-c="${c}" aria-pressed="${!erasing && c === ink}" aria-label="Color"></button>`).join('');
  document.querySelectorAll('[data-size]').forEach((b) => b.setAttribute('aria-pressed', String(!erasing && Number(b.dataset.size) === size)));
  $('eraser').setAttribute('aria-pressed', String(erasing));
}
renderTools();
$('colors').addEventListener('click', (e) => {
  const b = e.target.closest('.color');
  if (!b) return;
  ink = b.dataset.c;
  erasing = false;
  renderTools();
});
document.querySelectorAll('[data-size]').forEach((b) => (b.onclick = () => { size = Number(b.dataset.size); erasing = false; renderTools(); }));
$('eraser').onclick = () => { erasing = !erasing; renderTools(); };
$('undo').onclick = () => { pad.undo(); socket.emit('board:undo'); };
$('clear').onclick = () => {
  if (!pad.strokes.length || !confirm('¿Borrar todo el dibujo?')) return;
  pad.clear();
  socket.emit('board:clear');
};

// La pizarra del celular siempre cuadrada y del mayor tamaño posible
function fitPad() {
  const box = $('pad');
  const s = Math.floor(Math.min(box.clientWidth, box.clientHeight));
  if (s > 0) { $('padWrap').style.width = s + 'px'; $('padWrap').style.height = s + 'px'; }
}
new ResizeObserver(fitPad).observe($('pad'));

const canvas = $('padCanvas');
let cur = null;
let buffer = [];
let bufferId = null;
let last = null;
const canDraw = () => S && S.phase === 'drawing' && S.drawerId === S.you?.id;
function toPt(e) {
  const r = canvas.getBoundingClientRect();
  const x = Math.round(((e.clientX - r.left) / r.width) * 1000);
  const y = Math.round(((e.clientY - r.top) / r.height) * 1000);
  return [Math.max(0, Math.min(1000, x)), Math.max(0, Math.min(1000, y))];
}
function flush() {
  if (buffer.length && bufferId) socket.emit('stroke:points', { id: bufferId, pts: buffer });
  buffer = [];
}
canvas.addEventListener('pointerdown', (e) => {
  if (!canDraw() || cur) return;
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  flush();
  const p = toPt(e);
  cur = { id: rid(), color: erasing ? '#ffffff' : ink, size: erasing ? 44 : size, points: [p], pointerId: e.pointerId };
  bufferId = cur.id;
  last = p;
  pad.addStroke(cur);
  socket.emit('stroke:start', { id: cur.id, color: cur.color, size: cur.size, x: p[0], y: p[1] });
});
canvas.addEventListener('pointermove', (e) => {
  if (!cur || e.pointerId !== cur.pointerId) return;
  e.preventDefault();
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  const pts = [];
  for (const ev of evs.length ? evs : [e]) {
    const p = toPt(ev);
    if (Math.abs(p[0] - last[0]) + Math.abs(p[1] - last[1]) < 3) continue;
    pts.push(p);
    last = p;
  }
  if (!pts.length) return;
  pad.addPoints(cur.id, pts);
  buffer.push(...pts);
});
const endStroke = (e) => {
  if (!cur || e.pointerId !== cur.pointerId) return;
  flush();
  cur = null;
};
canvas.addEventListener('pointerup', endStroke);
canvas.addEventListener('pointercancel', endStroke);
setInterval(flush, 40);

// ---------- Relojes ----------
function loop() {
  if (S) {
    if (current === 'v-draw') updateTimer($('timerDraw'), S.startedAt, S.endsAt);
    if (current === 'v-guess') updateTimer($('timerGuess'), S.startedAt, S.endsAt);
    if (current === 'v-choose') $('chooseCount').textContent = Math.max(0, Math.ceil((S.endsAt - Reloj.now()) / 1000)) + ' s';
  }
  requestAnimationFrame(loop);
}
$('timerDraw').innerHTML = timerSvg();
$('timerGuess').innerHTML = timerSvg();
requestAnimationFrame(loop);
render();
