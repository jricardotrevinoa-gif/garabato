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
const MODE_LABEL = { clasico: '✏️ Modo Clásico', regio: '🤠 Modo Regio' };

// ---------- Aviso propio (en lugar del confirm del navegador) ----------
function ask(text, yes = 'Sí') {
  return new Promise((resolve) => {
    $('modalText').textContent = text;
    $('modalYes').textContent = yes;
    $('modal').hidden = false;
    const done = (v) => { $('modal').hidden = true; $('modalYes').onclick = $('modalNo').onclick = $('modal').onclick = null; resolve(v); };
    $('modalYes').onclick = () => done(true);
    $('modalNo').onclick = () => done(false);
    $('modal').onclick = (e) => { if (e.target === $('modal')) done(false); };
  });
}

// ---------- Pantalla siempre encendida mientras juegas ----------
let wakeLock = null;
async function keepAwake() {
  if (!joined || wakeLock || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (e) { wakeLock = null; }
}
document.addEventListener('visibilitychange', keepAwake);
document.addEventListener('pointerdown', keepAwake, { passive: true });

// ---------- Que el teclado no tape la pista ----------
function setVVH() {
  const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  document.documentElement.style.setProperty('--vvh', Math.round(h) + 'px');
  if (!document.getElementById('v-guess').hidden) window.scrollTo(0, 0);
}
window.visualViewport?.addEventListener('resize', setVVH);
window.addEventListener('resize', setVVH);
setVVH();

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
const PLAYER_COLOR_NAMES = ['Naranja', 'Azul', 'Verde', 'Amarillo', 'Morado', 'Rosa', 'Turquesa', 'Café'];
if (!myColor) myColor = PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
function renderSwatches() {
  $('swatches').innerHTML = PLAYER_COLORS.map((c, i) => `<button type="button" class="swatch" style="background:${c}" data-c="${c}" aria-pressed="${c === myColor}" aria-label="${PLAYER_COLOR_NAMES[i]}"></button>`).join('');
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
  keepAwake();
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
socket.on('board:full', (strokes) => { pad.setStrokes(strokes); renderTools(); });
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
    penSeen = false;
    wordHidden = false;
    renderTools();
  }
  const amDrawer = S.drawerId === S.you.id;

  switch (S.phase) {
    case 'lobby': {
      show('v-wait');
      $('waitAvatar').innerHTML = avatarHtml(S.you, 'xl');
      $('waitName').textContent = S.you.name;
      $('waitMode').textContent = MODE_LABEL[S.settings.mode] || '';
      const n = S.players.filter((p) => p.connected).length;
      $('waitCount').textContent = n < 2 ? 'Esperando a más jugadores…' : `${n} jugadores en la sala`;
      break;
    }
    case 'choosing':
      if (amDrawer) {
        show('v-choose');
        const html = (S.choices || []).map((c, i) => `<button class="btn choice" data-i="${i}"><span>${escapeHtml(c.word)}</span><span class="pill diff-${c.diff}">${DIFF_LABEL[c.diff]} ${DIFF_MULT[c.diff]}</span>${c.meaning ? `<span class="mean">${escapeHtml(c.meaning)}</span>` : ''}</button>`).join('');
        if ($('choices').dataset.html !== html) { $('choices').innerHTML = html; $('choices').dataset.html = html; }
        $('rerollBtn').hidden = !S.canReroll;
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
        renderSecret();
      } else {
        show('v-guess');
        renderGuess();
      }
      break;
    case 'reveal': {
      show('v-reveal');
      $('revealWord').textContent = S.word || '';
      $('revealMean').textContent = S.meaning || '';
      $('revealMean').hidden = !S.meaning;
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
$('rerollBtn').onclick = () => { $('rerollBtn').hidden = true; socket.emit('word:reroll'); };

// Palabra secreta: se puede ocultar para que no la vean de reojo en la tablet
let wordHidden = false;
function renderSecret() {
  const w = S.secretWord || '';
  $('secret').textContent = wordHidden ? '•'.repeat(Math.min(10, w.length)) : w;
  $('secret').classList.toggle('hidden-word', wordHidden);
  $('secretMeaning').textContent = wordHidden ? '' : S.secretMeaning || '';
  $('secretMeaning').hidden = !S.secretMeaning || wordHidden;
  $('peek').textContent = wordHidden ? 'Mostrar' : 'Ocultar';
}
$('peek').onclick = () => { wordHidden = !wordHidden; renderSecret(); };

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
const INKS = ['#1b1f3b', '#e63a2e', '#ff8a1f', '#ffd21f', '#23a55a', '#0f6b3a', '#2f6bff', '#7cc8ff', '#8a4dff', '#ff5fa8', '#8a5a3b', '#f3c4a0'];
const INK_NAMES = ['Negro', 'Rojo', 'Naranja', 'Amarillo', 'Verde', 'Verde oscuro', 'Azul', 'Azul cielo', 'Morado', 'Rosa', 'Café', 'Piel'];
let ink = INKS[0];
let size = 12;
let mode = 'pen'; // pen | fill | eraser
let penSeen = false; // si ya usaron lápiz en este turno, el dedo/palma no pinta

function renderTools() {
  $('colors').innerHTML = INKS.map((c, i) => `<button class="color" style="background:${c}" data-c="${c}" aria-pressed="${mode !== 'eraser' && c === ink}" aria-label="${INK_NAMES[i]}"></button>`).join('');
  document.querySelectorAll('[data-size]').forEach((b) => {
    b.setAttribute('aria-pressed', String(mode !== 'fill' && Number(b.dataset.size) === size));
    b.disabled = mode === 'fill';
    b.style.setProperty('--dot', mode === 'eraser' ? '#ffffff' : ink);
  });
  document.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  $('undo').disabled = !pad.strokes.length;
  $('clear').disabled = !pad.strokes.length;
  $('penNote').textContent = penSeen ? '✏️ Lápiz detectado: puedes apoyar la mano, solo pinta el lápiz.' : '';
}
$('colors').addEventListener('click', (e) => {
  const b = e.target.closest('.color');
  if (!b) return;
  ink = b.dataset.c;
  if (mode === 'eraser') mode = 'pen';
  renderTools();
});
document.querySelectorAll('[data-size]').forEach((b) => (b.onclick = () => { size = Number(b.dataset.size); if (mode === 'fill') mode = 'pen'; renderTools(); }));
document.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => { mode = b.dataset.mode; renderTools(); }));
$('undo').onclick = () => { if (!pad.strokes.length) return; pad.undo(); socket.emit('board:undo'); renderTools(); };
$('clear').onclick = async () => {
  if (!pad.strokes.length || !(await ask('¿Borrar todo el dibujo?', 'Sí, borrar'))) return;
  pad.clear();
  socket.emit('board:clear');
  renderTools();
};
renderTools();

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
function toPt(e, withPressure) {
  const r = canvas.getBoundingClientRect();
  const x = Math.round(((e.clientX - r.left) / r.width) * 1000);
  const y = Math.round(((e.clientY - r.top) / r.height) * 1000);
  const pt = [Math.max(0, Math.min(1000, x)), Math.max(0, Math.min(1000, y))];
  if (withPressure) pt.push(Math.round(Math.max(0.05, Math.min(1, e.pressure || 0.5)) * 100));
  return pt;
}
function flush() {
  if (buffer.length && bufferId) socket.emit('stroke:points', { id: bufferId, pts: buffer });
  buffer = [];
}
canvas.addEventListener('pointerdown', (e) => {
  if (!canDraw()) return;
  const isPen = e.pointerType === 'pen';
  // Rechazo de palma: con lápiz, el dedo no pinta. Si la palma empezó un trazo justo antes, se quita.
  if (e.pointerType === 'touch' && penSeen) return;
  if (isPen && !penSeen) { penSeen = true; renderTools(); }
  if (isPen && cur && cur.pointerType === 'touch') {
    buffer = [];
    cur = null;
    pad.undo();
    socket.emit('board:undo');
  }
  if (cur) return;
  e.preventDefault();
  const p = toPt(e, false);
  if (mode === 'fill') {
    const f = { id: rid(), type: 'fill', color: ink, size: 0, points: [p] };
    pad.addStroke(f);
    socket.emit('board:fill', { id: f.id, color: f.color, x: p[0], y: p[1] });
    navigator.vibrate?.(12);
    renderTools();
    return;
  }
  canvas.setPointerCapture(e.pointerId);
  flush();
  const p0 = toPt(e, isPen);
  const eraser = mode === 'eraser';
  cur = { id: rid(), color: eraser ? '#ffffff' : ink, size: eraser ? Math.max(24, size * 2) : size, points: [p0], pointerId: e.pointerId, pointerType: e.pointerType };
  bufferId = cur.id;
  last = p0;
  pad.addStroke(cur);
  socket.emit('stroke:start', { id: cur.id, color: cur.color, size: cur.size, x: p0[0], y: p0[1], p: p0[2] });
  renderTools();
});
canvas.addEventListener('pointermove', (e) => {
  if (!cur || e.pointerId !== cur.pointerId) return;
  e.preventDefault();
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  const pts = [];
  for (const ev of evs.length ? evs : [e]) {
    const p = toPt(ev, cur.pointerType === 'pen');
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
