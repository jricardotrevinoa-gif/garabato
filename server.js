// Garabato — juego de dibujar y adivinar para jugar en casa.
// La laptop corre este servidor y muestra la pantalla; los celulares entran por Wi-Fi.
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const PALABRAS = require('./palabras');

const START_PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const CHOOSE_SECONDS = 20;
const REVEAL_SECONDS = 7;
const DRAWER_GRACE_SECONDS = 15;
const LOBBY_DROP_SECONDS = 25;
const DIFF_MULT = { facil: 1, medio: 1.25, dificil: 1.5 };
const MODES = ['clasico', 'regio'];

// 'yuki|raspado :: hielo raspado' → { word: 'yuki', answers: ['yuki', 'raspado'], meaning: 'hielo raspado' }
function parseEntry(raw) {
  const [main, meaning = ''] = String(raw).split('::');
  const answers = main.split('|').map((a) => a.trim()).filter(Boolean);
  return { word: answers[0], answers, meaning: meaning.trim() };
}
const BANCO = {};
for (const mode of MODES) {
  BANCO[mode] = {};
  for (const diff of ['facil', 'medio', 'dificil']) BANCO[mode][diff] = (PALABRAS[mode]?.[diff] || []).map(parseEntry);
}

// ---------- Red local ----------
function lanAddress() {
  const candidates = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family === 'IPv4' && !a.internal) candidates.push(a.address);
    }
  }
  const score = (ip) =>
    ip.startsWith('192.168.') ? 3 : ip.startsWith('10.') ? 2 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 1 : 0;
  candidates.sort((a, b) => score(b) - score(a));
  return { best: candidates[0] || 'localhost', all: candidates };
}

let PORT = START_PORT;
let JOIN_URL = '';

// ---------- Archivos ----------
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};
const ROUTES = { '/': 'pantalla.html', '/pantalla': 'pantalla.html', '/jugar': 'jugar.html', '/j': 'jugar.html' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let pathname = decodeURIComponent(url.pathname);

  if (pathname === '/qr.svg') {
    try {
      const svg = await QRCode.toString(JOIN_URL, { type: 'svg', margin: 1, color: { dark: '#1b1f3b', light: '#ffffff' } });
      res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' });
      return res.end(svg);
    } catch (e) {
      res.writeHead(500);
      return res.end('QR error');
    }
  }

  if (ROUTES[pathname]) pathname = '/' + ROUTES[pathname];
  const file = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end();
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('No encontrado');
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

const io = new Server(server, { pingInterval: 5000, pingTimeout: 8000 });

// ---------- Estado del juego ----------
const COLORS = ['#ff5a36', '#2f6bff', '#18a874', '#f2a900', '#a64dff', '#ff4fa3', '#00a3c4', '#6b4f3a'];

const game = {
  phase: 'lobby', // lobby | choosing | drawing | reveal | podium
  settings: { mode: 'clasico', rounds: 3, drawTime: 80, difficulty: 'mixto' },
  players: new Map(),
  order: [],
  round: 1,
  turnIndex: -1,
  turnNumber: 0,
  drawerId: null,
  word: null,
  answers: [],
  meaning: '',
  wordDiff: null,
  choices: [],
  rerolled: false,
  revealed: new Set(),
  strokes: [],
  startedAt: 0,
  endsAt: 0,
  feed: [],
  turnResults: null,
  endReason: '',
  usedWords: new Set(),
};
const timers = { phase: null, tick: null, drawerGrace: null };
const lobbyDrops = new Map();

function clearTimers() {
  clearTimeout(timers.phase);
  clearInterval(timers.tick);
  clearTimeout(timers.drawerGrace);
  timers.phase = timers.tick = timers.drawerGrace = null;
}

// ---------- Utilidades de texto ----------
function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(el|la|los|las|un|una|unos|unas) /, '');
}
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}
function judgeOne(g, word) {
  const w = normalize(word);
  const gs = g.replace(/ /g, ''), ws = w.replace(/ /g, '');
  if (!ws) return 'wrong';
  if (gs === ws || gs === ws + 's' || gs === ws + 'es' || ws === gs + 's' || ws === gs + 'es') return 'correct';
  const d = levenshtein(gs, ws);
  if ((ws.length >= 4 && d <= 1) || (ws.length >= 8 && d <= 2)) return 'close';
  return 'wrong';
}
// Acepta la palabra principal o cualquiera de sus alternas (sinónimos, modismos).
function judge(guess, answers) {
  const g = normalize(guess);
  if (!g) return 'empty';
  const list = Array.isArray(answers) ? answers : [answers];
  const verdicts = list.map((a) => judgeOne(g, a));
  return verdicts.includes('correct') ? 'correct' : verdicts.includes('close') ? 'close' : 'wrong';
}
const isLetter = (ch) => /\p{L}|\d/u.test(ch);

function hintFor(word) {
  if (!word) return null;
  return [...word].map((ch, i) => (isLetter(ch) && !game.revealed.has(i) ? '_' : ch));
}

function pickWords(avoid = []) {
  const bank = BANCO[game.settings.mode] || BANCO.clasico;
  const pick = (diff) => {
    const all = bank[diff];
    const fresh = (e) => !game.usedWords.has(e.word) && !avoid.includes(e.word) && !game.choices.some((c) => c.word === e.word);
    const pool = all.filter(fresh);
    const list = pool.length ? pool : all.filter((e) => !game.choices.some((c) => c.word === e.word));
    const e = list[Math.floor(Math.random() * list.length)] || all[0];
    return { ...e, diff };
  };
  const plan = {
    facil: ['facil', 'facil', 'medio'],
    mixto: ['facil', 'medio', 'dificil'],
    dificil: ['medio', 'dificil', 'dificil'],
  }[game.settings.difficulty] || ['facil', 'medio', 'dificil'];
  game.choices = [];
  for (const d of plan) game.choices.push(pick(d));
  return game.choices;
}

function pushFeed(item) {
  game.feed.push({ ...item, t: Date.now() });
  if (game.feed.length > 40) game.feed.shift();
}

// ---------- Vistas del estado ----------
function publicPlayers() {
  return game.order
    .concat([...game.players.keys()].filter((id) => !game.order.includes(id)))
    .map((id) => game.players.get(id))
    .filter(Boolean)
    .map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      score: p.score,
      connected: p.connected,
      guessed: p.guessed,
      turnPoints: p.turnPoints,
      isDrawer: p.id === game.drawerId,
    }));
}

function publicState() {
  const drawer = game.players.get(game.drawerId);
  return {
    phase: game.phase,
    settings: game.settings,
    round: game.round,
    rounds: game.settings.rounds,
    players: publicPlayers(),
    drawerId: game.drawerId,
    drawerName: drawer ? drawer.name : '',
    hint: game.phase === 'drawing' ? hintFor(game.word) : null,
    word: game.phase === 'reveal' || game.phase === 'podium' ? game.word : null,
    meaning: game.phase === 'reveal' ? game.meaning : '',
    wordDiff: game.phase === 'drawing' || game.phase === 'reveal' ? game.wordDiff : null,
    startedAt: game.startedAt,
    endsAt: game.endsAt,
    serverNow: Date.now(),
    feed: game.feed.slice(-25),
    endReason: game.endReason,
    joinUrl: JOIN_URL,
    colors: COLORS,
  };
}

function playerState(p) {
  const base = publicState();
  base.you = { id: p.id, name: p.name, color: p.color, score: p.score, guessed: p.guessed, turnPoints: p.turnPoints };
  if (p.id === game.drawerId) {
    if (game.phase === 'choosing') {
      base.choices = game.choices.map((c) => ({ word: c.word, diff: c.diff, meaning: c.meaning }));
      base.canReroll = !game.rerolled;
    }
    if (game.phase === 'drawing') {
      base.secretWord = game.word;
      base.secretMeaning = game.meaning;
    }
  }
  return base;
}

function broadcast() {
  io.to('screens').emit('state', publicState());
  for (const p of game.players.values()) {
    if (p.socketId) io.to(p.socketId).emit('state', playerState(p));
  }
}

// ---------- Flujo de la partida ----------
function startGame() {
  clearTimers();
  const connected = [...game.players.values()].filter((p) => p.connected);
  if (connected.length < 2) return;
  for (const p of game.players.values()) {
    p.score = 0;
    p.guessed = false;
    p.turnPoints = 0;
  }
  game.order = connected.map((p) => p.id).sort(() => Math.random() - 0.5);
  game.round = 1;
  game.turnIndex = -1;
  game.turnNumber = 0;
  game.feed = [];
  game.usedWords.clear();
  nextTurn();
}

function nextTurn() {
  clearTimers();
  for (let guard = 0; guard < 500; guard++) {
    game.turnIndex++;
    if (game.turnIndex >= game.order.length) {
      game.turnIndex = 0;
      game.round++;
    }
    if (game.round > game.settings.rounds || game.order.length === 0) return toPodium();
    const p = game.players.get(game.order[game.turnIndex]);
    if (p && p.connected) return beginChoosing(p);
  }
  toPodium();
}

function beginChoosing(drawer) {
  game.phase = 'choosing';
  game.drawerId = drawer.id;
  game.word = null;
  game.answers = [];
  game.meaning = '';
  game.wordDiff = null;
  game.rerolled = false;
  game.choices = [];
  game.strokes = [];
  game.revealed = new Set();
  game.turnNumber++;
  for (const p of game.players.values()) {
    p.guessed = false;
    p.turnPoints = 0;
  }
  pickWords();
  game.startedAt = Date.now();
  game.endsAt = game.startedAt + CHOOSE_SECONDS * 1000;
  timers.phase = setTimeout(() => chooseWord(Math.floor(Math.random() * game.choices.length)), CHOOSE_SECONDS * 1000);
  io.to('screens').emit('board:clear');
  broadcast();
}

function chooseWord(i) {
  if (game.phase !== 'choosing') return;
  const c = game.choices[i];
  if (!c) return;
  clearTimers();
  game.word = c.word;
  game.answers = c.answers;
  game.meaning = c.meaning;
  game.wordDiff = c.diff;
  game.usedWords.add(c.word);
  game.phase = 'drawing';
  game.startedAt = Date.now();
  game.endsAt = game.startedAt + game.settings.drawTime * 1000;
  pushFeed({ type: 'system', text: `${game.players.get(game.drawerId)?.name || 'Alguien'} está dibujando` });
  timers.tick = setInterval(tick, 500);
  broadcast();
}

// Una vez por turno, quien dibuja puede pedir otras tres palabras.
function rerollWords() {
  if (game.phase !== 'choosing' || game.rerolled) return;
  game.rerolled = true;
  const avoid = game.choices.map((c) => c.word);
  game.choices = [];
  pickWords(avoid);
  clearTimeout(timers.phase);
  game.endsAt = Math.max(game.endsAt, Date.now() + 10 * 1000);
  timers.phase = setTimeout(() => chooseWord(Math.floor(Math.random() * game.choices.length)), game.endsAt - Date.now());
  broadcast();
}

function tick() {
  if (game.phase !== 'drawing') return;
  const now = Date.now();
  const total = game.endsAt - game.startedAt;
  const frac = (now - game.startedAt) / total;
  const letters = [...game.word].map((ch, i) => (isLetter(ch) ? i : -1)).filter((i) => i >= 0);
  // Pistas de letras: las fáciles no dan pistas; las medias, una al 65 %; las difíciles, una al 50 % y otra al 75 %.
  let want = 0;
  if (letters.length >= 4 && game.wordDiff === 'medio') want = frac >= 0.65 ? 1 : 0;
  if (letters.length >= 4 && game.wordDiff === 'dificil') want = frac >= 0.75 && letters.length >= 6 ? 2 : frac >= 0.5 ? 1 : 0;
  if (game.revealed.size < want) {
    const hidden = letters.filter((i) => !game.revealed.has(i));
    if (hidden.length > 2) {
      game.revealed.add(hidden[Math.floor(Math.random() * hidden.length)]);
      broadcast();
    }
  }
  if (now >= game.endsAt) endTurn('time');
}

function endTurn(reason) {
  if (game.phase !== 'drawing' && game.phase !== 'choosing') return;
  clearTimers();
  if (!game.word && game.choices[0]) {
    game.word = game.choices[0].word;
    game.answers = game.choices[0].answers;
    game.meaning = game.choices[0].meaning;
    game.wordDiff = game.choices[0].diff;
  }
  game.endReason = reason;
  game.phase = 'reveal';
  game.startedAt = Date.now();
  game.endsAt = game.startedAt + REVEAL_SECONDS * 1000;
  timers.phase = setTimeout(nextTurn, REVEAL_SECONDS * 1000);
  broadcast();
}

function toPodium() {
  clearTimers();
  game.phase = 'podium';
  game.drawerId = null;
  game.endsAt = 0;
  broadcast();
}

function toLobby() {
  clearTimers();
  game.phase = 'lobby';
  game.drawerId = null;
  game.word = null;
  game.strokes = [];
  game.feed = [];
  for (const p of [...game.players.values()]) {
    p.guessed = false;
    p.turnPoints = 0;
    if (!p.connected) game.players.delete(p.id);
  }
  game.order = [];
  io.to('screens').emit('board:clear');
  broadcast();
}

function guessersLeft() {
  return [...game.players.values()].filter((p) => p.connected && p.id !== game.drawerId && !p.guessed && game.order.includes(p.id)).length;
}

function handleGuess(p, text) {
  if (game.phase !== 'drawing' || p.id === game.drawerId || p.guessed || !game.order.includes(p.id)) return;
  text = String(text || '').slice(0, 40).trim();
  if (!text) return;
  const verdict = judge(text, game.answers.length ? game.answers : [game.word]);
  const socket = io.to(p.socketId);
  if (verdict === 'correct') {
    const remaining = Math.max(0, game.endsAt - Date.now()) / (game.endsAt - game.startedAt);
    const mult = DIFF_MULT[game.wordDiff] || 1;
    const pts = Math.round(((100 + 200 * remaining) * mult) / 5) * 5;
    p.guessed = true;
    p.turnPoints = pts;
    p.score += pts;
    const drawer = game.players.get(game.drawerId);
    if (drawer) {
      const dp = Math.round((50 * mult) / 5) * 5;
      drawer.turnPoints += dp;
      drawer.score += dp;
    }
    pushFeed({ type: 'correct', playerId: p.id, name: p.name, color: p.color, points: pts });
    socket.emit('guess:result', { verdict, text, points: pts });
    io.to('screens').emit('sfx', 'correct');
    if (guessersLeft() === 0) return endTurn('all');
    broadcast();
  } else if (verdict === 'close') {
    pushFeed({ type: 'close', playerId: p.id, name: p.name, color: p.color });
    socket.emit('guess:result', { verdict, text });
    broadcast();
  } else {
    pushFeed({ type: 'guess', playerId: p.id, name: p.name, color: p.color, text });
    socket.emit('guess:result', { verdict, text });
    broadcast();
  }
}

function removePlayer(id) {
  const idx = game.order.indexOf(id);
  if (idx !== -1) {
    game.order.splice(idx, 1);
    if (idx < game.turnIndex) game.turnIndex--;
    else if (idx === game.turnIndex) game.turnIndex--;
  }
  const p = game.players.get(id);
  game.players.delete(id);
  if (p && p.socketId) io.to(p.socketId).emit('kicked');
  if (id === game.drawerId && (game.phase === 'drawing' || game.phase === 'choosing')) {
    game.drawerId = null;
    endTurn('drawer-left');
  } else if (game.phase === 'drawing' && guessersLeft() === 0) {
    endTurn('all');
  } else broadcast();
}

// ---------- Conexiones ----------
const clampNum = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(v) || 0)));

io.on('connection', (socket) => {
  let player = null;
  let isScreen = false;

  socket.on('screen:join', () => {
    isScreen = true;
    socket.join('screens');
    socket.emit('state', publicState());
    socket.emit('board:full', game.strokes);
  });

  socket.on('player:join', (data = {}) => {
    const id = String(data.id || '').slice(0, 40);
    if (!id) return;
    const name = String(data.name || '').trim().slice(0, 16) || 'Jugador';
    const color = COLORS.includes(data.color) ? data.color : COLORS[game.players.size % COLORS.length];
    player = game.players.get(id);
    if (player) {
      if (player.socketId && player.socketId !== socket.id) io.to(player.socketId).emit('replaced');
      Object.assign(player, { name, color, socketId: socket.id, connected: true });
    } else {
      player = { id, name, color, socketId: socket.id, connected: true, score: 0, guessed: false, turnPoints: 0 };
      game.players.set(id, player);
      if (game.phase !== 'lobby' && game.phase !== 'podium') game.order.push(id);
    }
    clearTimeout(lobbyDrops.get(id));
    lobbyDrops.delete(id);
    if (id === game.drawerId) {
      clearTimeout(timers.drawerGrace);
      timers.drawerGrace = null;
      socket.emit('board:full', game.strokes);
    }
    broadcast();
  });

  socket.on('player:leave', () => {
    if (player) removePlayer(player.id);
    player = null;
  });

  // Controles de la pantalla
  socket.on('host:settings', (s = {}) => {
    if (!isScreen || game.phase !== 'lobby') return;
    game.settings = {
      mode: MODES.includes(s.mode) ? s.mode : game.settings.mode,
      rounds: clampNum(s.rounds ?? game.settings.rounds, 1, 6),
      drawTime: clampNum(s.drawTime ?? game.settings.drawTime, 30, 180),
      difficulty: ['facil', 'mixto', 'dificil'].includes(s.difficulty) ? s.difficulty : game.settings.difficulty,
    };
    broadcast();
  });
  socket.on('host:start', () => isScreen && (game.phase === 'lobby' || game.phase === 'podium') && startGame());
  socket.on('host:skip', () => isScreen && endTurn('skipped'));
  socket.on('host:lobby', () => isScreen && toLobby());
  socket.on('host:kick', (id) => isScreen && game.players.has(id) && removePlayer(id));

  // Elegir palabra
  socket.on('word:choose', (i) => {
    if (player && player.id === game.drawerId) chooseWord(Number(i));
  });
  socket.on('word:reroll', () => {
    if (player && player.id === game.drawerId) rerollWords();
  });

  // Dibujo (coordenadas 0..1000 relativas a la pizarra cuadrada)
  // Cada punto es [x, y] o, con lápiz, [x, y, presión 0..100].
  const cleanPt = (p) => (p.length > 2 && p[2] != null ? [clampNum(p[0], 0, 1000), clampNum(p[1], 0, 1000), clampNum(p[2], 0, 100)] : [clampNum(p[0], 0, 1000), clampNum(p[1], 0, 1000)]);
  const okColor = (c) => (/^#[0-9a-f]{6}$/i.test(c) ? c : '#1b1f3b');
  const canDraw = () => player && player.id === game.drawerId && game.phase === 'drawing';
  socket.on('stroke:start', (s = {}) => {
    if (!canDraw() || game.strokes.length > 3000) return;
    const stroke = {
      id: String(s.id).slice(0, 20),
      color: okColor(s.color),
      size: clampNum(s.size, 2, 120),
      points: [cleanPt([s.x, s.y, s.p])],
    };
    game.strokes.push(stroke);
    io.to('screens').emit('stroke:start', stroke);
  });
  socket.on('stroke:points', (d = {}) => {
    if (!canDraw() || !Array.isArray(d.pts)) return;
    const stroke = game.strokes.find((s) => s.id === d.id);
    if (!stroke || stroke.points.length > 6000) return;
    const pts = d.pts.slice(0, 200).filter(Array.isArray).map(cleanPt);
    stroke.points.push(...pts);
    io.to('screens').emit('stroke:points', { id: stroke.id, pts });
  });
  // Cubeta: rellena el área cerrada que toca el punto.
  socket.on('board:fill', (f = {}) => {
    if (!canDraw() || game.strokes.length > 3000) return;
    const fill = { id: String(f.id).slice(0, 20), type: 'fill', color: okColor(f.color), size: 0, points: [[clampNum(f.x, 0, 1000), clampNum(f.y, 0, 1000)]] };
    game.strokes.push(fill);
    io.to('screens').emit('stroke:start', fill);
  });
  socket.on('board:undo', () => {
    if (!canDraw()) return;
    game.strokes.pop();
    io.to('screens').emit('board:full', game.strokes);
  });
  socket.on('board:clear', () => {
    if (!canDraw()) return;
    game.strokes = [];
    io.to('screens').emit('board:clear');
  });

  socket.on('guess', (text) => player && handleGuess(player, text));

  socket.on('disconnect', () => {
    if (!player || player.socketId !== socket.id) return;
    const p = player;
    p.connected = false;
    p.socketId = null;
    if (game.phase === 'lobby') {
      lobbyDrops.set(p.id, setTimeout(() => {
        if (!p.connected && game.phase === 'lobby') {
          game.players.delete(p.id);
          broadcast();
        }
      }, LOBBY_DROP_SECONDS * 1000));
    }
    if (p.id === game.drawerId && (game.phase === 'drawing' || game.phase === 'choosing')) {
      timers.drawerGrace = setTimeout(() => {
        if (!p.connected) endTurn('drawer-left');
      }, DRAWER_GRACE_SECONDS * 1000);
    } else if (game.phase === 'drawing' && guessersLeft() === 0) {
      endTurn('all');
      return;
    }
    broadcast();
  });
});

// ---------- Arranque ----------
function openBrowser(url) {
  if (process.env.NO_OPEN) return;
  const cmd = process.platform === 'darwin' ? `open "${url}"` : process.platform === 'win32' ? `start "" "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

function listen(port) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && port < START_PORT + 20) return listen(port + 1);
    console.error(err);
    process.exit(1);
  });
  server.listen(port, '0.0.0.0', () => {
    PORT = port;
    const { best, all } = lanAddress();
    // En internet (Render u otro servicio) usa la dirección pública; en casa, la IP de la red local.
    const publicUrl = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
    JOIN_URL = publicUrl ? `${publicUrl}/jugar` : `http://${best}:${PORT}/jugar`;
    if (publicUrl) {
      console.log(`Garabato en línea: pantalla ${publicUrl}  ·  celulares ${JOIN_URL}`);
      return;
    }
    console.log('\n  ✏️  Garabato está listo\n');
    console.log(`  Pantalla (abre en la laptop):  http://localhost:${PORT}`);
    console.log(`  Celulares (misma red Wi-Fi):   ${JOIN_URL}`);
    if (all.length > 1) console.log(`  Otras direcciones posibles:    ${all.slice(1).map((ip) => `http://${ip}:${PORT}/jugar`).join('  ')}`);
    console.log('\n  Para cerrar el juego: Ctrl + C\n');
    openBrowser(`http://localhost:${PORT}`);
  });
}

if (require.main === module) listen(START_PORT);
module.exports = { judge, normalize, parseEntry, BANCO, server, listen, game };
