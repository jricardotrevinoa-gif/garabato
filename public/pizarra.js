// Dibuja trazos en un canvas cuadrado. Coordenadas 0..1000, tamaño en las mismas unidades.
// Un trazo puede traer presión por punto ([x, y, 0..100]) y existe el tipo 'fill' (cubeta).
class Pizarra {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { willReadFrequently: false });
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
    if (s.type === 'fill') return this.fill(p[0][0] * k, p[0][1] * k, s.color);
    if (p[0].length > 2) return this.paintPressure(s, from);
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
  // Con lápiz: cada tramo con su propio grosor según la presión.
  paintPressure(s, from) {
    const { ctx } = this;
    const k = this.k;
    const p = s.points;
    const w = (pr) => s.size * k * Math.min(1.6, Math.max(0.3, 0.3 + (pr / 100) * 1.4));
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (from === 0 && p.length === 1) {
      ctx.beginPath();
      ctx.arc(p[0][0] * k, p[0][1] * k, w(p[0][2]) / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    for (let i = Math.max(1, from); i < p.length; i++) {
      ctx.lineWidth = w((p[i - 1][2] + p[i][2]) / 2);
      ctx.beginPath();
      ctx.moveTo(p[i - 1][0] * k, p[i - 1][1] * k);
      ctx.lineTo(p[i][0] * k, p[i][1] * k);
      ctx.stroke();
    }
  }
  // Cubeta: relleno por inundación con tolerancia, y 1 px extra para tapar el borde suavizado.
  fill(x, y, color) {
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height;
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const img = ctx.getImageData(0, 0, W, H);
    const d = img.data;
    const i0 = (y * W + x) * 4;
    const tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2];
    const n = parseInt(color.slice(1), 16);
    const fr = (n >> 16) & 255, fg = (n >> 8) & 255, fb = n & 255;
    if (Math.abs(tr - fr) + Math.abs(tg - fg) + Math.abs(tb - fb) < 6) return;
    const TOL = 90;
    const near = (j) => Math.abs(d[j] - tr) + Math.abs(d[j + 1] - tg) + Math.abs(d[j + 2] - tb) <= TOL;
    const mask = new Uint8Array(W * H);
    const stack = [x, y];
    while (stack.length) {
      const py = stack.pop(), px0 = stack.pop();
      let px = px0;
      let idx = py * W + px;
      while (px >= 0 && !mask[idx] && near(idx * 4)) { px--; idx--; }
      px++; idx++;
      let up = false, down = false;
      while (px < W && !mask[idx] && near(idx * 4)) {
        mask[idx] = 1;
        if (py > 0) {
          const u = idx - W;
          if (!mask[u] && near(u * 4)) { if (!up) { stack.push(px, py - 1); up = true; } } else up = false;
        }
        if (py < H - 1) {
          const dn = idx + W;
          if (!mask[dn] && near(dn * 4)) { if (!down) { stack.push(px, py + 1); down = true; } } else down = false;
        }
        px++; idx++;
      }
    }
    for (let yy = 0; yy < H; yy++) {
      for (let xx = 0; xx < W; xx++) {
        const m = yy * W + xx;
        if (!(mask[m] || (xx > 0 && mask[m - 1]) || (xx < W - 1 && mask[m + 1]) || (yy > 0 && mask[m - W]) || (yy < H - 1 && mask[m + W]))) continue;
        const j = m * 4;
        d[j] = fr; d[j + 1] = fg; d[j + 2] = fb; d[j + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
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
