const $ = (id) => document.getElementById(id);
const socket = io();
const pizarra = new Pizarra($('board'));
$('timer').innerHTML = timerSvg();

let S = null;
let lastPhaseKey = '';
let lastTickSec = null;

// ---------- Sonidos ----------
const Sfx = {
  ctx: null,
  unlock() {
    if (!this.ctx) try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  tone(freq, dur = 0.12, when = 0, type = 'triangle', vol = 0.18) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  },
  correct() { this.tone(660, 0.12); this.tone(990, 0.2, 0.1); },
  tick() { this.tone(1200, 0.04, 0, 'square', 0.06); },
  start() { this.tone(523, 0.12); this.tone(659, 0.12, 0.1); this.tone(784, 0.22, 0.2); },
  end() { this.tone(523, 0.16); this.tone(392, 0.26, 0.14); },
  fanfare() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, i * 0.14)); },
};
document.addEventListener('pointerdown', () => Sfx.unlock());
document.addEventListener('keydown', () => Sfx.unlock());

// ---------- Conexión ----------
socket.on('connect', () => socket.emit('screen:join'));
socket.on('state', (st) => {
  Reloj.sync(st.serverNow);
  S = st;
  render();
});
socket.on('board:full', (strokes) => pizarra.setStrokes(strokes));
socket.on('board:clear', () => pizarra.clear());
socket.on('stroke:start', (s) => pizarra.addStroke(s));
socket.on('stroke:points', (d) => pizarra.addPoints(d.id, d.pts));
socket.on('sfx', (name) => Sfx[name] && Sfx[name]());

// ---------- Controles ----------
document.querySelectorAll('.seg').forEach((seg) => {
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const key = seg.dataset.key;
    const v = key === 'difficulty' ? b.dataset.v : Number(b.dataset.v);
    socket.emit('host:settings', { [key]: v });
  });
});
$('modes').addEventListener('click', (e) => {
  const b = e.target.closest('.mode');
  if (b) socket.emit('host:settings', { mode: b.dataset.mode });
});
const MODE_TAG = { clasico: '✏️ Clásico', regio: '🤠 Regio' };
$('startBtn').onclick = () => { Sfx.unlock(); socket.emit('host:start'); };
$('againBtn').onclick = () => socket.emit('host:start');
$('lobbyBtn').onclick = () => socket.emit('host:lobby');
$('skipBtn').onclick = () => socket.emit('host:skip');
$('endBtn').onclick = () => { if (confirm('¿Terminar la partida y volver a la sala?')) socket.emit('host:lobby'); };
$('lobbyPlayers').addEventListener('click', (e) => {
  const k = e.target.closest('.kick');
  if (k && confirm(`¿Sacar a ${k.dataset.name} de la sala?`)) socket.emit('host:kick', k.dataset.id);
});
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'f' || e.key === 'F') {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  }
});

// ---------- Tamaño de la pizarra ----------
function fitBoard() {
  const c = $('center');
  const size = Math.floor(Math.min(c.clientWidth, c.clientHeight)) - 8;
  if (size > 0) {
    $('boardWrap').style.width = size + 'px';
    $('boardWrap').style.height = size + 'px';
  }
}
new ResizeObserver(fitBoard).observe($('center'));

// ---------- Render ----------
function render() {
  const inGame = ['choosing', 'drawing', 'reveal'].includes(S.phase);
  $('lobby').hidden = S.phase !== 'lobby';
  $('play').hidden = !inGame;
  $('podium').hidden = S.phase !== 'podium';

  const key = S.phase + ':' + S.drawerId + ':' + S.round;
  if (key !== lastPhaseKey) {
    if (S.phase === 'drawing') Sfx.start();
    if (S.phase === 'reveal') Sfx.end();
    if (S.phase === 'podium') Sfx.fanfare();
    lastPhaseKey = key;
  }

  if (S.phase === 'lobby') renderLobby();
  if (inGame) { fitBoard(); renderGame(); }
  if (S.phase === 'podium') renderPodium();
}

function renderLobby() {
  $('joinUrl').textContent = S.joinUrl.replace(/^http:\/\//, '');
  const ps = S.players;
  $('pcount').textContent = ps.length;
  $('lobbyPlayers').innerHTML = ps.length
    ? ps.map((p) => `<span class="chip ${p.connected ? '' : 'off'}">${avatarHtml(p)}${escapeHtml(p.name)}<button class="kick" title="Sacar" data-id="${p.id}" data-name="${escapeHtml(p.name)}">×</button></span>`).join('')
    : '<div class="empty">Todavía no hay nadie. ¡Escaneen el código!</div>';
  document.querySelectorAll('.mode').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === S.settings.mode)));
  document.querySelectorAll('.seg').forEach((seg) => {
    const cur = String(S.settings[seg.dataset.key]);
    seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === cur)));
  });
  const ready = ps.filter((p) => p.connected).length;
  $('startBtn').disabled = ready < 2;
  $('startNote').textContent = ready < 2 ? 'Se necesitan al menos 2 jugadores.' : `Cada quien dibuja ${S.settings.rounds} ${S.settings.rounds === 1 ? 'vez' : 'veces'}.`;
}

function renderGame() {
  $('roundLbl').innerHTML = `Ronda ${Math.min(S.round, S.rounds)} de ${S.rounds}<span class="mode-tag">${MODE_TAG[S.settings.mode] || ''}</span>`;
  const drawer = S.players.find((p) => p.id === S.drawerId);
  const dname = escapeHtml(S.drawerName || 'Alguien');

  // Arriba al centro
  let top = '';
  if (S.phase === 'choosing') top = `<div class="who">Turno de ${dname}</div><div class="big-word">Eligiendo palabra…</div>`;
  else if (S.phase === 'drawing') top = `<div class="who">${dname} dibuja · ${countLetters(S.hint)} letras <span class="pill diff-${S.wordDiff}">${DIFF_LABEL[S.wordDiff] || ''}</span></div><div class="hint">${hintHtml(S.hint)}</div>`;
  else if (S.phase === 'reveal') top = `<div class="who">Fin del turno de ${dname}</div><div class="big-word">${REASONS[S.endReason] || ''}</div>`;
  $('topCenter').innerHTML = top;

  // Marcador
  const sorted = [...S.players].sort((a, b) => b.score - a.score);
  $('scores').innerHTML = sorted
    .map((p, i) => {
      const cls = [p.isDrawer ? 'drawer' : '', p.guessed ? 'guessed' : '', p.connected ? '' : 'off'].join(' ');
      const sub = p.isDrawer ? '✏️ dibujando' : p.guessed ? `✓ +${p.turnPoints}` : p.connected ? '' : 'sin conexión';
      return `<li class="score-row ${cls}"><span class="pos">${i + 1}</span>${avatarHtml(p)}<span class="nm">${escapeHtml(p.name)}${sub ? `<small>${sub}</small>` : ''}</span><span class="sc">${p.score}</span></li>`;
    })
    .join('');

  // Intentos
  $('feed').innerHTML = [...S.feed]
    .reverse()
    .map((f) => {
      if (f.type === 'correct') return `<li class="correct">✓ <span><b>${escapeHtml(f.name)}</b> adivinó · +${f.points}</span></li>`;
      if (f.type === 'close') return `<li class="close"><span class="dot" style="background:${f.color}"></span><span><b>${escapeHtml(f.name)}</b> está cerca 🔥</span></li>`;
      if (f.type === 'system') return `<li class="system">${escapeHtml(f.text)}</li>`;
      return `<li><span class="dot" style="background:${f.color}"></span><span><span class="who">${escapeHtml(f.name)}:</span> <span class="txt">${escapeHtml(f.text)}</span></span></li>`;
    })
    .join('');

  // Capa sobre la pizarra
  const ov = $('overlay');
  if (S.phase === 'choosing') {
    ov.hidden = false;
    ov.innerHTML = `<div>${drawer ? avatarHtml(drawer, 'hero') : ''}<div class="ov-word" style="font-size:2.4em">Turno de ${dname}</div><div class="lbl">Está eligiendo qué dibujar en su celular…</div></div>`;
  } else if (S.phase === 'reveal') {
    ov.hidden = false;
    const gains = [...S.players].filter((p) => p.connected || p.turnPoints).sort((a, b) => b.turnPoints - a.turnPoints);
    ov.innerHTML = `<div style="width:100%">
      <div class="lbl">La palabra era</div>
      <div class="ov-word">${escapeHtml(S.word)}</div>
      ${S.meaning ? `<div class="meaning">${escapeHtml(S.meaning)}</div>` : ''}
      <ul class="gains">${gains.map((p, i) => `<li style="animation-delay:${0.1 + i * 0.06}s">${avatarHtml(p)}<span>${escapeHtml(p.name)}${p.isDrawer ? ' ✏️' : ''}</span><span class="pts ${p.turnPoints ? '' : 'zero'}">${p.turnPoints ? '+' + p.turnPoints : '—'}</span></li>`).join('')}</ul>
      <div class="nextbar"><i id="nextbar"></i></div>
    </div>`;
  } else {
    ov.hidden = true;
  }
}

const REASONS = { time: '⏰ Se acabó el tiempo', all: '🎉 ¡Todos adivinaron!', skipped: 'Turno saltado', 'drawer-left': 'Se desconectó quien dibujaba' };

function countLetters(hint) {
  return (hint || []).filter((c) => c !== ' ' && c !== '-').length;
}

function renderPodium() {
  const sorted = [...S.players].sort((a, b) => b.score - a.score);
  const order = [1, 0, 2];
  $('steps3').innerHTML = order
    .filter((i) => sorted[i])
    .map((i) => `<div class="step p${i + 1}">${avatarHtml(sorted[i])}<div class="name">${escapeHtml(sorted[i].name)}</div><div class="block">${i + 1}º · ${sorted[i].score}</div></div>`)
    .join('');
  $('rest').innerHTML = sorted
    .slice(3)
    .map((p, i) => `<span class="chip">${i + 4}º ${avatarHtml(p)}${escapeHtml(p.name)} · ${p.score}</span>`)
    .join('');
}

// ---------- Reloj en pantalla ----------
function loop() {
  if (S && ['choosing', 'drawing', 'reveal'].includes(S.phase)) {
    const secs = updateTimer($('timer'), S.startedAt, S.endsAt);
    if (S.phase === 'drawing' && secs <= 5 && secs > 0 && secs !== lastTickSec) Sfx.tick();
    lastTickSec = secs;
    const nb = document.getElementById('nextbar');
    if (nb) nb.style.width = Math.min(100, (100 * (Reloj.now() - S.startedAt)) / (S.endsAt - S.startedAt)) + '%';
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
