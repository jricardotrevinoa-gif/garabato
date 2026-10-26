// Dibuja trazos en un canvas cuadrado. Coordenadas 0..1000, tamaño en las mismas unidades.
class Pizarra {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.strokes = [];
    this.byId = new Map();
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(this.canvas.clientWidth * dpr);
    if (!w || w === this.canvas.width) return;
    this.canvas.width = w;
    this.canvas.height = w;
    this.redraw();
  }
  get k() { return this.canvas.width / 1000; }
  setStrokes(list) {
    this.strokes = (list || []).map((s) => ({ ...s, points: s.points.slice() }));
    this.byId = new Map(this.strokes.map((s) => [s.id, s]));
    this.redraw();
  }
  clear() { this.setStrokes([]); }
  addStroke(s) {
    const st = { ...s, points: s.points.slice() };
    this.strokes.push(st);
    this.byId.set(st.id, st);
    this.paint(st, 0);
  }
  addPoints(id, pts) {
    const st = this.byId.get(id);
    if (!st) return;
    const from = st.points.length;
    st.points.push(...pts);
    this.paint(st, from);
  }
  undo() {
    const st = this.strokes.pop();
    if (st) this.byId.delete(st.id);
    this.redraw();
  }
  redraw() {
    const { ctx, canvas } = this;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const s of this.strokes) this.paint(s, 0);
  }
  paint(s, from) {
    const { ctx } = this;
    const k = this.k;
    const p = s.points;
    if (!p.length) return;
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = s.size * k;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (from === 0 && p.length === 1) {
      ctx.beginPath();
      ctx.arc(p[0][0] * k, p[0][1] * k, (s.size * k) / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const start = Math.max(0, from - 1);
    ctx.beginPath();
    ctx.moveTo(p[start][0] * k, p[start][1] * k);
    for (let i = start + 1; i < p.length; i++) ctx.lineTo(p[i][0] * k, p[i][1] * k);
    ctx.stroke();
  }
}

// Utilidades compartidas
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function avatarHtml(p, cls = '') {
  return `<span class="avatar ${cls}" style="--c:${p.color}">${escapeHtml((p.name || '?').trim().charAt(0) || '?')}</span>`;
}
function hintHtml(hint) {
  if (!hint) return '';
  return hint
    .map((ch) => (ch === ' ' ? '<span class="ch sp"> </span>' : ch === '_' ? '<span class="ch">&nbsp;</span>' : `<span class="ch open">${escapeHtml(ch)}</span>`))
    .join('');
}
const DIFF_LABEL = { facil: 'Fácil', medio: 'Medio', dificil: 'Difícil' };
const DIFF_MULT = { facil: '×1', medio: '×1.25', dificil: '×1.5' };

// Reloj sincronizado con el servidor
const Reloj = {
  offset: 0,
  sync(serverNow) { this.offset = serverNow - Date.now(); },
  now() { return Date.now() + this.offset; },
};

function timerSvg() {
  return '<svg viewBox="0 0 44 44"><circle class="track" cx="22" cy="22" r="19" fill="none" stroke-width="4"/><circle class="bar" cx="22" cy="22" r="19" fill="none" stroke-width="4" stroke-linecap="round" stroke-dasharray="119.4" stroke-dashoffset="0"/></svg><span class="num">0</span>';
}
function updateTimer(el, startedAt, endsAt) {
  if (!el) return 0;
  const total = Math.max(1, endsAt - startedAt);
  const left = Math.max(0, endsAt - Reloj.now());
  const secs = Math.ceil(left / 1000);
  el.querySelector('.num').textContent = secs;
  el.querySelector('.bar').style.strokeDashoffset = String(119.4 * (1 - left / total));
  el.classList.toggle('low', secs <= 10);
  return secs;
}
