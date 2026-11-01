/* ui-core.js — app shell, drawing primitives, line editor, home screen, menus, forms, errors */
(function () {
'use strict';
const E = window.Engine, N = window.Numeric;
const W = 320, H = 240, SB = 30;
const cells = s => (String(s).match(/[\s\S][\u0300-\u036f]*/gu) || []);
const MONO = 'Consolas, "DejaVu Sans Mono", "Lucida Console", "Courier New", monospace';
const GRIDS = {
  // Lucida Console's characters are 0.6em wide, so these sizes fill each 12px / 8px cell the way the CE's font does
  big: { cw: 12, rh: 21, cols: 26, rows: 10, x0: 4, font: '20px "Lucida Console", ' + MONO },
  small: { cw: 8, rh: 14, cols: 39, rows: 15, x0: 4, font: '13.3px "Lucida Console", ' + MONO }
};
/* the CE's named colors (plots, grid, axes) */
const COLORS = [['BLUE', '#1f4fff'], ['RED', '#e0201b'], ['BLACK', '#111111'], ['MAGENTA', '#e020c8'], ['GREEN', '#119e3a'], ['ORANGE', '#ff8a00'], ['BROWN', '#8b3a12'],
  ['NAVY', '#1b2a7a'], ['LTBLUE', '#3aa6ff'], ['YELLOW', '#d6b400'], ['LTGRAY', '#c8c8c8'], ['MEDGRAY', '#a0a0a0'], ['GRAY', '#808080'], ['DARKGRAY', '#505050']];
const LIGHT_COLORS = new Set(['YELLOW', 'LTGRAY', 'MEDGRAY', 'LTBLUE']);
const BORDERS = ['#e4e2e8', '#bfe8cf', '#cfe0f5', '#ffffff']; // FORMAT BorderColor 1–4 (graph surround)
const COL = { text: '#000000', inv: '#000000', invText: '#ffffff', bar: '#4d5157', barText: '#ffffff', dim: '#9a9a9a', accent: '#1f4fff', hint: '#3b5d8a' };

const App = window.App = {
  cells,
  W, H, SB, GRIDS, COL, MONO, COLORS, LIGHT_COLORS, BORDERS,
  shift: null, alphaLock: false, insertMode: true, blinkOn: true, off: false,
  screen: null, keyLog: [], listeners: [],
  scale: 4
};

/* ===================== GRAPHICS ===================== */
const G = App.G = {
  init(canvas) {
    this.cv = canvas; canvas.width = W * App.scale; canvas.height = H * App.scale;
    this.ctx = canvas.getContext('2d'); this.ctx.setTransform(App.scale, 0, 0, App.scale, 0, 0);
    this.ctx.textBaseline = 'middle';
  },
  clear(bg = '#ffffff') { const c = this.ctx; c.fillStyle = bg; c.fillRect(0, SB, W, H - SB); },
  status(line2, line2Color) {
    const c = this.ctx; c.fillStyle = COL.bar; c.fillRect(0, 0, W, SB);
    const M = E.getState().mode;
    const fl = M.float === 'FLOAT' ? 'FLOAT' : 'FIX' + M.float;
    const ans = { AUTO: 'AUTO', DEC: 'DEC', 'FRAC-APPROX': 'FRAC' }[M.answers];
    const cpx = { REAL: 'REAL', 'a+bi': 'a+bi', 're^θi': 're^θi' }[M.complex];
    const txt = [M.notation, fl, ans, cpx, M.angle, M.mathprint === 'MATHPRINT' ? 'MP' : 'CL'].join(' ');
    c.font = 'bold 10.5px ' + MONO; c.textAlign = 'left'; c.fillStyle = COL.barText; c.fillText(txt, 4, 8);
    if (line2) { c.fillStyle = line2Color || '#d7f0ff'; c.font = 'bold 10.5px ' + MONO; c.fillText(line2, 4, 22); }
    // shift indicator
    let ind = null; if (App.shift === '2nd') ind = ['2ND', '#2d8cff']; else if (App.shift === 'alpha') ind = [App.alphaLock ? 'A-LOCK' : 'ALPHA', '#5fd35f'];
    if (ind) { c.font = 'bold 10px ' + MONO; const w = c.measureText(ind[0]).width + 8; c.fillStyle = ind[1]; c.fillRect(W - w - 4, 2, w, 13); c.fillStyle = '#000'; c.textAlign = 'center'; c.fillText(ind[0], W - 4 - w / 2, 9); c.textAlign = 'left'; }
    if (!App.insertMode) { c.font = 'bold 10px ' + MONO; c.fillStyle = '#ffcf5a'; c.textAlign = 'right'; c.fillText('OVR', W - 4, 22); c.textAlign = 'left'; }
  },
  /* draw string on a character grid */
  text(g, col, row, str, o = {}) {
    const c = this.ctx; c.font = g.font; c.textAlign = 'center';
    const chars = cells(str);
    const y = SB + row * g.rh;
    if (o.inv || o.bg) { c.fillStyle = o.bg || (o.color || COL.inv); c.fillRect(g.x0 + col * g.cw, y + 1, chars.length * g.cw, g.rh - 1); }
    c.fillStyle = o.inv ? (o.invText || COL.invText) : (o.color || COL.text);
    chars.forEach((ch, k) => { if (col + k >= g.cols + 1) return; c.fillText(ch, g.x0 + (col + k) * g.cw + g.cw / 2, y + g.rh / 2 + 1); });
  },
  cell(g, col, row, color) { const c = this.ctx; c.fillStyle = color; c.fillRect(g.x0 + col * g.cw, SB + row * g.rh + 1, g.cw, g.rh - 1); },
  /* cursor block with shift glyph */
  cursor(g, col, row, ch) {
    if (!App.blinkOn) return;
    const c = this.ctx; const x = g.x0 + col * g.cw, y = SB + row * g.rh;
    if (!App.insertMode && !App.shift) { c.fillStyle = '#000'; c.fillRect(x, y + 1, g.cw, g.rh - 1); c.fillStyle = '#fff'; c.font = g.font; c.textAlign = 'center'; if (ch) c.fillText(ch, x + g.cw / 2, y + g.rh / 2 + 1); return; }
    c.fillStyle = '#000'; c.fillRect(x, y + 1, g.cw, g.rh - 1);
    c.fillStyle = '#fff'; c.font = 'bold ' + g.font; c.textAlign = 'center';
    const glyph = App.shift === '2nd' ? '↑' : App.shift === 'alpha' ? 'A' : (ch || '');
    if (glyph) c.fillText(glyph, x + g.cw / 2, y + g.rh / 2 + 1);
  },
  raw(x, y, str, font, color, align = 'left') { const c = this.ctx; c.font = font; c.fillStyle = color; c.textAlign = align; c.fillText(str, x, y); }
};

/* ===================== LINE EDITOR ===================== */
const MP_KEYS = { '^': 'pow.b', '√(': 'sqrt.b', 'abs(': 'abs.b', 'e^(': 'exp.b', '10^(': 'tenx.b', 'nDeriv(': 'nder.b', 'fnInt(': 'fint.b', 'Σ(': 'sum.b', 'logBASE(': 'logb.b' };
const ALPHA_FIRST = new Set(['nder.b', 'sum.b']); // the first box is a variable, so ALPHA turns on (like the CE)
class LineEditor {
  constructor(toks = []) { this.toks = toks.slice(); this.cur = this.toks.length; this.fresh = false; }
  set(t, cur) { this.toks = t.slice(); this.cur = cur === undefined ? this.toks.length : cur; }
  get empty() { return this.toks.length === 0; }
  insert(tok) {
    if (this.fresh) { this.toks = []; this.cur = 0; this.fresh = false; }
    // in MathPrint mode these keys open a template on editors that draw them (the home screen)
    if (this.mathprint && MP_KEYS[tok] && E.getState().mode.mathprint === 'MATHPRINT') tok = MP_KEYS[tok];
    // template: all slots empty, cursor in the first slot
    const T = E.TEMPLATES[tok];
    if (T && (T.kind === 'frac' || T.kind === 'mix')) { // a number typed just before moves into the first box, cursor to the next
      let s = this.cur; while (s > 0 && /^[0-9.]$/.test(this.toks[s - 1])) s--;
      const num = this.toks.slice(s, this.cur);
      if (num.length) { this.toks.splice(s, num.length, tok, ...num, ...T.seps, T.end); this.cur = s + num.length + 2; return; }
    }
    if (T) { this.toks.splice(this.cur, 0, tok, ...T.seps, T.end); this.cur++; if (ALPHA_FIRST.has(tok)) App.shift = 'alpha'; return; }
    this.put(tok);
  }
  put(tok) {
    if (App.insertMode || this.cur >= this.toks.length || E.TMPL_TOKS.has(this.toks[this.cur])) this.toks.splice(this.cur, 0, tok); else this.toks[this.cur] = tok;
    this.cur++;
  }
  insertMany(arr) { if (this.fresh) { this.toks = []; this.cur = 0; this.fresh = false; } arr.forEach(t => this.put(t)); }
  /* template parts are deleted only as a whole, and only once every slot is empty */
  delTmpl(i) {
    const t = tmplSpan(this.toks, i); if (!t) return false;
    if (t.e === t.s + t.b.length - 1) { this.toks.splice(t.s, t.b.length); this.cur = t.s; return true; }
    return false;
  }
  /* ▲/▼ between numerator and denominator; false when the cursor is not in a fraction part of a template */
  vert(dir) {
    let s = enclosingTmpl(this.toks, this.cur);
    while (s >= 0) {
      const t = tmplSpan(this.toks, s);
      if (t) {
        const k = t.b.findIndex((b, j) => this.cur > b && this.cur <= t.b[j + 1]); // slot holding the cursor
        if (E.TEMPLATES[this.toks[t.s]].kind === 'pw') { // piecewise: ▲▼ to the same box of the row above/below
          const to = k + 2 * dir; if (k >= 0 && to >= 0 && to < t.b.length - 1) { this.cur = Math.min(t.b[to] + 1 + (this.cur - t.b[k] - 1), t.b[to + 1]); return true; }
          s = enclosingTmpl(this.toks, s); continue;
        }
        const nd = t.b.length - 3; // numerator slot index (the last two slots are numerator and denominator)
        const go = (from, to) => { this.cur = Math.min(t.b[to] + 1 + (this.cur - t.b[from] - 1), t.b[to + 1]); return true; };
        if (dir > 0 && k === nd) return go(nd, nd + 1);
        if (dir < 0 && k === nd + 1) return go(nd + 1, nd);
      }
      s = enclosingTmpl(this.toks, s);
    }
    return false;
  }
  key(k) {
    switch (k) {
      case '#left': this.fresh = false; if (this.cur > 0) this.cur--; return true;
      case '#right': this.fresh = false; if (this.cur < this.toks.length) this.cur++; return true;
      case '#home': this.fresh = false; this.cur = 0; return true;
      case '#end': this.fresh = false; this.cur = this.toks.length; return true;
      case '#del': this.fresh = false;
        if (this.cur < this.toks.length) { if (E.TMPL_TOKS.has(this.toks[this.cur])) this.delTmpl(this.cur); else this.toks.splice(this.cur, 1); }
        return true;
      case '#bksp': this.fresh = false;
        if (this.cur > 0) { if (E.TMPL_TOKS.has(this.toks[this.cur - 1])) { if (!this.delTmpl(this.cur - 1)) this.cur--; } else { this.toks.splice(this.cur - 1, 1); this.cur--; } }
        return true;
      case '#ins': App.insertMode = !App.insertMode; return true;
    }
    return false;
  }
  text() { return E.tokText(this.toks); }
  /* char offset of each token boundary */
  offsets() { const o = [0]; let p = 0; this.toks.forEach(t => { p += cells(E.disp(t)).length; o.push(p); }); return o; }
  lineCount(width) { return Math.max(1, Math.ceil((cells(this.text()).length + 1) / width)); }
  /* render starting at grid (col,row) with given width; returns number of rows used */
  render(g, col, row, width, showCursor = true, maxRows = 99, scrollRow = 0) {
    const chars = cells(this.text()); const off = this.offsets(); const cp = off[this.cur];
    const rows = Math.max(1, Math.ceil((chars.length + 1) / width));
    for (let r = scrollRow; r < Math.min(rows, scrollRow + maxRows); r++) G.text(g, col, row + r - scrollRow, chars.slice(r * width, (r + 1) * width).join(''));
    if (showCursor) { const cr = Math.floor(cp / width); if (cr >= scrollRow && cr < scrollRow + maxRows) G.cursor(g, col + cp % width, row + cr - scrollRow, chars[cp]); }
    return Math.min(rows, maxRows);
  }
  cursorRow(width) { return Math.floor(this.offsets()[this.cur] / width); }
}
App.LineEditor = LineEditor;
/* a one-line entry ("L₁(3)=12") with the blinking cursor where the editor's cursor really is; y is the text's middle.
   Long entries scroll so the cursor stays visible. */
App.entryLine = function (label, ed, x, y, g = GRIDS.big) {
  if (App.mpEntry(label, ed, x, y)) return;
  const c = G.ctx, chars = cells(label + ed.text()), cp = cells(label).length + ed.offsets()[ed.cur];
  const fit = Math.floor((W - x) / g.cw), start = Math.max(0, cp - fit + 1);
  c.font = g.font; c.textAlign = 'center'; c.fillStyle = COL.text;
  chars.slice(start, start + fit).forEach((ch, i) => c.fillText(ch, x + i * g.cw + g.cw / 2, y + 1));
  if (App.blinkOn) {
    const cx = x + (cp - start) * g.cw; c.fillStyle = '#000'; c.fillRect(cx, y - g.rh / 2 + 1, g.cw, g.rh - 2);
    const glyph = App.shift === '2nd' ? '↑' : App.shift === 'alpha' ? 'A' : chars[cp];
    if (glyph) { c.fillStyle = '#fff'; c.fillText(glyph, cx + g.cw / 2, y + 1); }
  }
};

/* an entry holding MathPrint templates (n/d etc.) drawn stacked, like the CE; false when there are none */
App.mpEntry = function (label, ed, x, mid) {
  if (!ed.toks.some(t => E.TEMPLATES[t])) return false;
  const L = MP.layout(ed.toks, { cursor: true, maxW: W - x - cells(label).length * GRIDS.big.cw - 4 }), ln = L.lines[0], top = mid - ln.up - 0.5, c = G.ctx;
  c.fillStyle = '#fff'; c.fillRect(x, top, W - x, L.lines.reduce((a, l) => a + MP.lineH(l), 0));
  c.font = GRIDS.big.font; c.textAlign = 'center'; c.fillStyle = COL.text; cells(label).forEach((ch, i) => c.fillText(ch, x + i * GRIDS.big.cw + GRIDS.big.cw / 2, mid + 1));
  MP.drawLine(L, 0, x + cells(label).length * GRIDS.big.cw, top, { cursor: ed.cur }); return true;
};

/* ===================== MATHPRINT LAYOUT ===================== */
const CLOSE = new Set(Object.values(E.TEMPLATES).map(T => T.end));
const isOpen = t => !!E.TEMPLATES[t], isClose = t => CLOSE.has(t);
/* template that structural token i belongs to: {s: start, e: end, b: [start, ...separators, end]};
   slot k holds the tokens between b[k] and b[k+1] */
function tmplSpan(toks, i) {
  let s = i, depth = 0;
  if (!isOpen(toks[i])) {
    for (s = i - 1; s >= 0; s--) { const t = toks[s]; if (isClose(t)) depth++; else if (isOpen(t)) { if (depth === 0) break; depth--; } }
    if (s < 0) return null;
  }
  const T = E.TEMPLATES[toks[s]], b = [s]; depth = 0;
  for (let j = s + 1; j < toks.length; j++) {
    const t = toks[j];
    if (isOpen(t)) depth++;
    else if (isClose(t)) { if (depth > 0) { depth--; continue; } if (t !== T.end || b.length !== T.seps.length + 1) return null; b.push(j); return { s, e: j, b }; }
    else if (depth === 0 && T.seps.includes(t)) b.push(j);
  }
  return null;
}
/* start index of the innermost template with a slot holding cursor position cur, or -1 */
function enclosingTmpl(toks, cur) {
  let depth = 0;
  for (let j = cur - 1; j >= 0; j--) { const t = toks[j]; if (isClose(t)) depth++; else if (isOpen(t)) { if (depth === 0) return j; depth--; } }
  return -1;
}
const MP = App.MP = { tmplSpan };
const UP = 10, DN = 10, GAP = 2, RAISE = 8, RIGHT = 316, X0 = 4;
/* text sizes: normal, and the smaller one used inside exponents */
const SZ = { big: { cw: GRIDS.big.cw, up: UP, dn: DN, font: GRIDS.big.font }, small: { cw: GRIDS.small.cw, up: 7, dn: 7, font: GRIDS.small.font } };
/* box for tokens [from,to); endIdx is the cursor position at its end; sm = exponent-size text.
   Coordinates are relative to the middle line. */
function mpBox(toks, from, to, endIdx, sm, slot) {
  const F = sm ? SZ.small : SZ.big, cw = F.cw;
  const b = { w: 0, up: F.up, dn: F.dn, items: [], cur: {} };
  const shift = (o, dx, dy) => { o.items.forEach(it => { it.x += dx; it.y += dy; if (it.y1 !== undefined) it.y1 += dy; b.items.push(it); }); Object.keys(o.cur).forEach(k => { const c = o.cur[k]; b.cur[k] = { x: c.x + dx, y: c.y + dy, sm: c.sm }; }); };
  for (let i = from; i < to; i++) {
    b.cur[i] = { x: b.w, y: 0, sm };
    const t = isOpen(toks[i]) ? tmplSpan(toks, i) : null;
    if (t && t.e < to) {
      const T = E.TEMPLATES[toks[i]];
      // exponents and fraction numerators/denominators use the small font (a mixed number's whole part stays full size)
      const small = k => sm || T.kind === 'sup' || T.kind === 'frac' || (T.kind === 'mix' && k > 0) || !!(SMALL_SLOTS[T.kind] && SMALL_SLOTS[T.kind][k]);
      const slots = t.b.slice(0, -1).map((bk, k) => mpBox(toks, bk + 1, t.b[k + 1], t.b[k + 1], small(k), true));
      const s = slots[0], grow = (up, dn) => { b.up = Math.max(b.up, up); b.dn = Math.max(b.dn, dn); };
      if (T.kind === 'sup') { // optional e / 10, then the raised exponent box in smaller text
        cells(T.prefix || '').forEach(ch => { b.items.push({ k: 'txt', x: b.w, y: 0, s: ch, sm }); b.w += cw; });
        const dy = -Math.max(sm ? 6 : RAISE, s.dn + 2); // tall exponents (fractions) sit fully above the middle line
        shift(s, b.w, dy); grow(s.up - dy, s.dn + dy); b.w += s.w; i = t.e; continue;
      }
      if (T.kind === 'sqrt') { // radical sign with a bar over the contents
        shift(s, b.w + 10, 0); b.items.push({ k: 'sqrt', x: b.w, y: -(s.up + 2), y1: s.dn, w: s.w + 12 });
        grow(s.up + 3, s.dn + 1); b.w += s.w + 13; i = t.e; continue;
      }
      if (T.kind === 'abs') { // |contents|
        b.items.push({ k: 'vbar', x: b.w + 2, y: -s.up, y1: s.dn }); shift(s, b.w + 5, 0);
        b.items.push({ k: 'vbar', x: b.w + s.w + 7, y: -s.up, y1: s.dn }); b.w += s.w + 10; i = t.e; continue;
      }
      if (T.kind === 'pw') { // { brace with rows "expr , condition", centered on the middle line
        const rows = []; for (let r = 0; r < slots.length; r += 2) rows.push([slots[r], slots[r + 1]]);
        const rh = rows.map(([e, c]) => ({ up: Math.max(e.up, c.up), dn: Math.max(e.dn, c.dn) })), Ht = rh.reduce((a, r) => a + r.up + r.dn + 3, 0) - 3;
        const bx = b.w + 2, top = -Ht / 2; let y = top, wMax = 0;
        b.items.push({ k: 'vbar', x: bx + 2, y: top + 2, y1: Ht / 2 - 2 }, { k: 'bar', x: bx + 2, y: top + 1, w: 4 }, { k: 'bar', x: bx + 2, y: Ht / 2 - 1, w: 4 }, { k: 'bar', x: bx, y: 0, w: 3 });
        rows.forEach(([e, c], i) => { const mid = y + rh[i].up, x = bx + 9; shift(e, x, mid); b.items.push({ k: 'txt', x: x + e.w, y: mid, s: ',', sm }); shift(c, x + e.w + cw, mid); wMax = Math.max(wMax, e.w + cw + c.w); y += rh[i].up + rh[i].dn + 3; });
        grow(Ht / 2 + 1, Ht / 2 + 1); b.w += 11 + wMax + 2; i = t.e; continue;
      }
      if (CALC_KINDS.has(T.kind)) { b.w = calcTemplate(T.kind, slots, toks, t, b, shift, grow); i = t.e; continue; }
      if (slots.length === 3) { // Un/d: whole part on the middle line, then the stacked fraction
        const u = slots.shift(); shift(u, b.w, 0); b.up = Math.max(b.up, u.up); b.dn = Math.max(b.dn, u.dn); b.w += u.w + 1;
      }
      const [n, d] = slots;
      const w = Math.max(n.w, d.w) + 4, ny = -(n.dn + GAP), dy = d.up + GAP;
      shift(n, b.w + (w - n.w) / 2, ny); shift(d, b.w + (w - d.w) / 2, dy);
      b.items.push({ k: 'bar', x: b.w + 1, y: 0, w: w - 2 });
      b.up = Math.max(b.up, n.up - ny); b.dn = Math.max(b.dn, d.dn + dy);
      b.w += w; i = t.e; continue;
    }
    cells(E.disp(toks[i])).forEach(ch => { b.items.push({ k: 'txt', x: b.w, y: 0, s: ch, sm }); b.w += cw; });
  }
  if (slot && from === to) { b.items.push({ k: 'slot', x: 0, y: 0, sm }); b.w = cw; }
  b.cur[endIdx] = b.cur[endIdx] || { x: slot && from === to ? 0 : b.w, y: 0, sm };
  return b;
}
/* nDeriv, fnInt, Σ and logBASE templates, drawn like the CE: small bounds/variables, full-size expression in ( ) */
const SMALL_SLOTS = { nder: [1, 0, 1], fint: [1, 1, 0, 0], sum: [1, 1, 1, 0], logb: [1, 0] };
const CALC_KINDS = new Set(Object.keys(SMALL_SLOTS));
function calcTemplate(kind, slots, toks, t, b, shift, grow) {
  const cw = SZ.big.cw, scw = SZ.small.cw, sm = SZ.small;
  const put = (s, x, y, small) => { let w = 0; cells(s).forEach(ch => { b.items.push({ k: 'txt', x: x + w, y, s: ch, sm: small }); w += small ? scw : cw; }); return w; };
  const glyph = (s, x, size, w) => b.items.push({ k: 'txt', x, y: 0, s, font: size + 'px ' + MONO, w });
  const paren = (e, x) => { x += put('(', x, 0, false); shift(e, x, 0); x += e.w; x += put(')', x, 0, false); grow(e.up, e.dn); return x; };
  let x = b.w;
  if (kind === 'logb') { const [base, arg] = slots; x += put('log', x, 0, false); shift(base, x, 7); grow(0, 7 + base.dn); x += base.w; return paren(arg, x); }
  if (kind === 'nder') {
    const [v, e, val] = slots, denW = scw + v.w, fw = Math.max(scw, denW) + 2, dy = sm.up + 2;
    put('d', x + (fw - scw) / 2, -(sm.dn + 1), true); b.items.push({ k: 'bar', x, y: 0, w: fw });
    const dx = x + (fw - denW) / 2; put('d', dx, dy, true); shift(v, dx + scw, dy); grow(sm.up + sm.dn + 1, dy + sm.dn);
    x = paren(e, x + fw + 1);
    const lo = Math.max(DN, e.dn), hi = Math.max(UP, e.up), sy = lo - 2;
    b.items.push({ k: 'vbar', x: x + 1, y: -hi, y1: lo + 3 }); x += 3;
    const vt = E.tokText(toks.slice(t.b[0] + 1, t.b[1])) || '□'; x += put(vt + '=', x, sy, true);
    shift(val, x, sy); grow(hi, sy + Math.max(sm.dn, val.dn)); return x + val.w + 1;
  }
  if (kind === 'fint') {
    const [lo, hi, e, v] = slots; glyph('∫', x, 26, 10); const x0 = x + 11;
    shift(hi, x0, -12); shift(lo, x0, 12); grow(12 + hi.up, 12 + lo.dn);
    x = paren(e, x0 + Math.max(lo.w, hi.w) + 2); x += put('d', x, 0, false); shift(v, x, 0); grow(v.up, v.dn); return x + v.w + 1;
  }
  // Σ: upper bound above, var=start below
  const [v, st, en, e] = slots, lowW = v.w + scw + st.w, col = Math.max(14, lowW, en.w);
  glyph('Σ', x + (col - 14) / 2, 22, 14);
  const ty = -(UP + 1 + en.dn); shift(en, x + (col - en.w) / 2, ty);
  const ly = DN + 1 + sm.up, lx = x + (col - lowW) / 2; shift(v, lx, ly); put('=', lx + v.w, ly, true); shift(st, lx + v.w + scw, ly);
  grow(-ty + en.up, ly + Math.max(sm.dn, v.dn, st.dn));
  return paren(e, x + col + 2);
}
/* lay out a token line, wrapping like the home screen: characters wrap one at a time, a template never splits.
   opts: {classic: linear text only, maxW} → {lines:[{units:[{u,x}], w, up, dn}], cur:{idx:{line,x,y}}} */
MP.layout = function (toks, opts = {}) {
  const cw = GRIDS.big.cw, maxW = opts.maxW || GRIDS.big.cols * cw;
  const units = [];
  for (let i = 0; i < toks.length; i++) {
    const t = !opts.classic && isOpen(toks[i]) ? tmplSpan(toks, i) : null;
    if (t) { const b = mpBox(toks, i, t.e + 1, t.e + 1, false); delete b.cur[t.e + 1]; units.push(b); i = t.e; continue; }
    cells(E.disp(toks[i])).forEach((ch, k) => units.push({ w: cw, up: UP, dn: DN, items: [{ k: 'txt', x: 0, y: 0, s: ch }], cur: k === 0 ? { [i]: { x: 0, y: 0 } } : {} }));
  }
  units.push({ w: cw, up: UP, dn: DN, items: [], cur: { [toks.length]: { x: 0, y: 0 } }, endMark: true });
  const lines = []; let ln = null; const cur = {};
  units.forEach(u => {
    if (!ln || (ln.w + u.w > maxW && ln.units.length)) { ln = { units: [], w: 0, up: UP, dn: DN }; lines.push(ln); }
    Object.keys(u.cur).forEach(k => cur[k] = { line: lines.length - 1, x: ln.w + u.cur[k].x, y: u.cur[k].y, sm: u.cur[k].sm });
    ln.units.push({ u, x: ln.w }); ln.w += u.endMark ? 0 : u.w; ln.up = Math.max(ln.up, u.up); ln.dn = Math.max(ln.dn, u.dn);
  });
  if (lines.length > 1 && !lines[lines.length - 1].units.some(x => !x.u.endMark) && !opts.cursor) lines.pop();
  return { lines, cur, toks };
};
MP.lineH = ln => ln.up + ln.dn + 1;
/* a matrix answer drawn like the CE: one tall bracket each side, columns right-aligned; null if too wide */
MP.matrixLayout = function (m, outLine) {
  const rowsTxt = outLine ? (outLine.match(/\[[^\[\]]*\]/g) || []).map(r => r.slice(1, -1).trim().split(/\s+/)) : [];
  const fits = rowsTxt.length === m.length && rowsTxt.every((r, i) => r.length === m[i].length);
  const cw = SZ.big.cw, sw = SZ.small.cw, txt = m.map((r, i) => r.map((v, j) => fits ? rowsTxt[i][j] : E.fmtScalar(v)));
  // a fraction entry ("⁻1/2") is stacked in small digits, like the CE; rows get taller when there is one
  const cell = t => { const f = /^(⁻?)(\d+)\/(\d+)$/.exec(t); return f ? { f, w: (f[1] ? cw : 0) + Math.max(f[2].length, f[3].length) * sw + 2 } : { s: cells(t), w: cells(t).length * cw }; };
  const C = txt.map(r => r.map(cell)), anyF = C.some(r => r.some(c => c.f)), rh = anyF ? 31 : GRIDS.big.rh;
  const colW = C[0].map((_, j) => Math.max(...C.map(r => r[j].w)));
  const up = m.length * rh / 2, dn = up, items = [];
  const bracket = (x, dir) => items.push({ k: 'vbar', x, y: -up + 1, y1: dn - 1 }, { k: 'bar', x: dir > 0 ? x : x - 3, y: -up + 1, w: 4 }, { k: 'bar', x: dir > 0 ? x : x - 3, y: dn - 2, w: 4 });
  bracket(2, 1); let x = 6;
  colW.forEach((w, j) => {
    C.forEach((r, i) => {
      const e = r[j], x0 = x + w - e.w, my = -up + rh * i + rh / 2 - 1;
      if (!e.f) { e.s.forEach((ch, k) => items.push({ k: 'txt', x: x0 + k * cw, y: my, s: ch })); return; }
      let fx = x0; if (e.f[1]) { items.push({ k: 'txt', x: fx, y: my, s: '⁻' }); fx += cw; }
      const fw = e.w - (e.f[1] ? cw : 0), put = (digits, y) => cells(digits).forEach((ch, k) => items.push({ k: 'txt', x: fx + (fw - digits.length * sw) / 2 + k * sw, y, s: ch, font: SZ.small.font, w: sw }));
      put(e.f[2], my - 7); items.push({ k: 'bar', x: fx, y: my, w: fw }); put(e.f[3], my + 8);
    });
    x += w + cw;
  });
  x -= cw - 3; bracket(x + 3, -1);
  const W = x + 5; if (W > RIGHT - X0) return null;
  return { lines: [{ units: [{ u: { items, w: W, up, dn, cur: {} }, x: 0 }], w: W, up, dn }], cur: {}, toks: [] };
};
/* draw one laid-out line with its top-left at (x, top); inv = selected history item */
MP.drawLine = function (L, li, x, top, o = {}) {
  const ln = L.lines[li], c = G.ctx, cw = GRIDS.big.cw, mid = top + ln.up + 0.5;
  if (o.inv) { c.fillStyle = COL.inv; c.fillRect(x, top + 1, Math.max(ln.w, cw), MP.lineH(ln) - 1); }
  if (o.hist) { c.fillStyle = '#8eeeff'; c.fillRect(x, top + 1, Math.max(ln.w, cw), MP.lineH(ln) - 1); } // history selection is light blue on the CE
  const fg = o.inv ? COL.invText : COL.text;
  c.textAlign = 'center';
  ln.units.forEach(({ u, x: ux }) => u.items.forEach(it => {
    const px = x + ux + it.x, py = mid + it.y, F = it.sm ? SZ.small : SZ.big;
    if (it.k === 'txt') { c.fillStyle = fg; c.font = it.font || F.font; c.fillText(it.s, px + (it.w || F.cw) / 2, py + 1); }
    else if (it.k === 'bar') { c.fillStyle = fg; c.fillRect(px, Math.round(py), it.w, 1.2); }
    else if (it.k === 'vbar') { c.fillStyle = fg; c.fillRect(px, py, 1.2, it.y1 - it.y); }
    else if (it.k === 'sqrt') {
      const y1 = mid + it.y1, h = y1 - py; c.strokeStyle = fg; c.lineWidth = 1.2; c.beginPath();
      c.moveTo(px + 1, py + h * 0.62); c.lineTo(px + 3, py + h * 0.55); c.lineTo(px + 5.5, y1); c.lineTo(px + 8.5, py + 0.5); c.lineTo(px + it.w, py + 0.5); c.stroke();
    }
    else if (it.k === 'slot') { c.strokeStyle = o.inv ? COL.invText : '#8a8a8a'; c.lineWidth = 1; c.setLineDash([2, 2]); const ins = it.sm ? 1.5 : 2.5; c.strokeRect(px + ins, py - F.up + 2.5, F.cw - 2 * ins, F.up + F.dn - 4); c.setLineDash([]); }
  }));
  if (o.cursor !== undefined && L.cur[o.cursor] && L.cur[o.cursor].line === li) {
    const p = L.cur[o.cursor], t = L.toks[o.cursor];
    const ch = t !== undefined && !E.TMPL_TOKS.has(t) ? cells(E.disp(t))[0] : '';
    MP.cursor(x + p.x, mid + p.y, ch, p.sm);
  }
};
MP.cursor = function (x, mid, ch, sm) {
  if (!App.blinkOn) return;
  const F = sm ? SZ.small : SZ.big, c = G.ctx;
  c.fillStyle = '#000'; c.fillRect(x, mid - F.up, F.cw, F.up + F.dn);
  const glyph = App.insertMode || App.shift ? (App.shift === '2nd' ? '↑' : App.shift === 'alpha' ? 'A' : (ch || '')) : (ch || '');
  c.fillStyle = '#fff'; c.font = (App.insertMode || App.shift ? 'bold ' : '') + F.font; c.textAlign = 'center';
  if (glyph) c.fillText(glyph, x + F.cw / 2, mid + 1);
};
/* a fraction answer such as "⁻5/6" or "1 1/2" (or a list of them, "{1/2 ⁻1/3}") as template tokens for stacked display, else null */
MP.fracOutToks = function (line) {
  const m = /^(⁻?)(?:(\d+) )?(\d+)\/(\d+)$/.exec(line);
  if (!m) {
    if (line[0] !== '{' || !/\d\/\d/.test(line)) return null;
    const out = []; let last = 0;
    line.replace(/(\d+)\/(\d+)/g, (s, n, d, i) => { out.push(...cells(line.slice(last, i)), 'frac.n', ...n, 'frac.d', ...d, 'frac.e'); last = i + s.length; return s; });
    return out.concat(cells(line.slice(last)));
  }
  if (m[2]) return ['mix.u', ...(m[1] + m[2]), 'mix.n', ...m[3], 'mix.d', ...m[4], 'mix.e'];
  return [...m[1], 'frac.n', ...m[3], 'frac.d', ...m[4], 'frac.e'];
};

/* ===================== SCREEN MGMT ===================== */
App.setScreen = function (s) { if (App.screen && App.screen.leave) App.screen.leave(); App.screen = s; if (s.enter) s.enter(); App.render(); };
App.render = function () {
  if (App.off) { const c = G.ctx; c.fillStyle = '#0d0f12'; c.fillRect(0, 0, W, H); return; }
  try { App.screen.render(); } catch (e) { console.error(e); }
  App.listeners.forEach(f => f());
};
App.isTok = k => typeof k === 'string' && k[0] !== '#';
App.flash = function (msg) { App.flashMsg = msg; clearTimeout(App._ft); App._ft = setTimeout(() => { App.flashMsg = null; App.render(); }, 2200); };

/* ===================== ERROR SCREEN ===================== */
const ERR_HELP = {
  'SYNTAX': 'Something is typed out of order. Check parentheses, commas, and subtract (−) vs negative (⁻).',
  'DOMAIN': 'A value is outside what this function allows (example: log of 0, sin⁻¹ of 2).',
  'DIVIDE BY 0': 'The expression divides by zero.',
  'NONREAL ANSWERS': 'The answer is not a real number. MODE → a+bi shows complex answers.',
  'DIM MISMATCH': 'Lists or matrices used together must be the same size.',
  'INVALID DIM': 'A list or matrix size is not valid here (empty list, bad index, etc.).',
  'DATA TYPE': 'Wrong kind of value here (a list or matrix where a number is expected, etc.).',
  'ARCHIVED': 'That variable is archived (it has a * in MEM). Use MEM ▸ UnArchive first.',
  'UNDEFINED': 'A variable, list, Y= function, or stat value has not been set yet.',
  'ARGUMENT': 'Wrong number of values inside this function\'s parentheses.',
  'NO SIGN CHANGE': 'No solution found. Move the bounds or guess closer to the answer.',
  'WINDOW RANGE': 'Xmin must be less than Xmax, and Ymin less than Ymax.',
  'STAT': 'Not enough data (or invalid data) for this calculation.',
  'SINGULAR MATRIX': 'This matrix has no inverse (determinant is 0).',
  'OVERFLOW': 'The result is too large (≥ 1ᴇ100).',
  'TOL NOT MET': 'Could not reach the required accuracy.',
  'INVALID': 'This command cannot be used here.',
  'MEMORY': 'Too many nested calls (a Y= function may refer to itself).',
  'BAD GUESS': 'The guess is outside the bounds or at an undefined point.',
  'BREAK': 'The program was stopped with the ON key.',
  'LABEL': 'Goto or Menu( names a Lbl that is not in the program.',
  'INCREMENT': 'The step of a For( loop cannot be 0.'
};
App.showError = function (err, opts = {}) {
  const type = err && err.type ? err.type : 'INVALID';
  if (!(err && err.type)) console.error(err);
  const back = App.screen;
  const scr = {
    render() {
      G.clear(); G.status(''); const g = GRIDS.big, title = 'ERROR: ' + type;
      // CE layout: centered highlighted title, 1:Quit / 2:Goto, a line, then the help text
      G.text(g, Math.max(0, Math.floor((g.cols - cells(title).length) / 2)), 0, title, { inv: true });
      G.text(g, 0, 1, '1:Quit'); if (opts.goto) G.text(g, 0, 2, '2:Goto');
      G.text(g, 0, 1 + (this.idx || 0), (this.idx ? '2' : '1') + ':', { inv: true });
      const ly = SB + 3 * g.rh + 4; G.ctx.fillStyle = '#000'; G.ctx.fillRect(0, ly, W, 1.5);
      const help = ERR_HELP[type] || ''; const words = help.split(' '); const lines = []; let ln = '';
      words.forEach(w => { if ((ln + ' ' + w).trim().length > 26) { lines.push(ln.trim()); ln = w; } else ln += ' ' + w; }); if (ln.trim()) lines.push(ln.trim());
      lines.forEach((l, i) => G.text(g, 0, 4 + i, l));
    },
    key(k) {
      if ((k === '#up' || k === '#down') && opts.goto) { this.idx = this.idx ? 0 : 1; return true; }
      if (k === '#enter') k = this.idx ? '2' : '1'; // ENTER picks the highlighted choice
      if (k === '1' || k === '#clear' || k === '#quit') { (opts.quit || (() => App.setScreen(opts.quitTo || App.home)))(); return true; }
      if (k === '2' && opts.goto) { opts.goto(err.pos); return true; }
      return true;
    }
  };
  App.setScreen(scr);
};

/* ===================== RCL (2nd STO→) =====================
   "Rcl " at the bottom; name a variable (letter, list, matrix, Y=, string), ENTER pastes its contents */
App.rclScreen = function (target) {
  const ed = new LineEditor();
  const contents = toks => {
    const st = E.getState(), n = toks.join('');
    if (E.YN.includes(n)) return st.Y[n].toks.slice();
    if (E.STRS.includes(n)) { const s = (st.strs || {})[n]; if (s === undefined) N.fail('UNDEFINED'); return E.tokenize(s); }
    const v = E.ev(E.parseExpr(toks));
    if (E.isMat(v)) return ['['].concat(...v.mat.map(r => ['['].concat(...r.map((x, j) => (j ? [','] : []).concat(E.numToToks(x))), [']'])), [']']);
    if (E.isList(v)) return ['{'].concat(...v.map((x, j) => (j ? [','] : []).concat(typeof x === 'number' ? E.numToToks(x) : E.tokenize(E.format(x)[0]))), ['}']);
    return typeof v === 'number' ? E.numToToks(v) : E.tokenize(E.format(v)[0]);
  };
  return {
    enter() { App.shift = 'alpha'; }, // the CE turns ALPHA on for the name
    render() { if (target.render) target.render(); const g = GRIDS.big, c = G.ctx, y = SB + (g.rows - 1) * g.rh; c.fillStyle = '#fff'; c.fillRect(0, y, W, g.rh + 2); App.entryLine('Rcl ', ed, g.x0, y + g.rh / 2 + 1); },
    key(k) {
      if (k === '#clear' || k === '#quit') { App.setScreen(target); return true; }
      if (k === '#enter') {
        if (ed.empty) { App.setScreen(target); return true; }
        try { const toks = contents(ed.toks); App.setScreen(target); if (target.ed && target.ed.insertMany) { target.ed.insertMany(toks); if (target.sync) target.sync(); if ('dirty' in target) target.dirty = true; } else toks.forEach(t => target.insert(t)); }
        catch (err) { App.showError(err, { quit: () => App.setScreen(target) }); }
        return true;
      }
      if (App.isTok(k)) { ed.insert(k); return true; }
      return ed.key(k) || (k[0] === '#' && !/^#(vars|matrix|list|f4|catalog)$/.test(k));
    },
    canInsert() { return true; }, insert(t) { ed.insert(t); }
  };
};

/* ===================== CATALOG HELP (+ on a menu or catalog item) ===================== */
App.catalogHelp = function (tok, back, paste) {
  const name = E.disp(tok).trim(), syn = window.CatalogHelp && window.CatalogHelp.syntax(tok);
  const g = GRIDS.big, wrap = s => { const ch = cells(s), out = []; for (let i = 0; i < ch.length; i += g.cols) out.push(ch.slice(i, i + g.cols).join('')); return out; };
  const lines = syn ? wrap(name + (/[( ]$/.test(tok) || name.endsWith('(') ? '' : ' ') + syn.replace(/^\(no arguments\)$/, '')).concat(syn === '(no arguments)' ? ['(no arguments)'] : []) : [name, 'No help for this item.'];
  App.setScreen({
    render() { G.clear(); G.status(''); G.text(g, 0, 0, 'CATALOG HELP', { inv: true }); lines.forEach((s, i) => G.text(g, 0, i + 2, s)); G.text(g, 0, g.rows - 1, 'ENTER: Paste  CLEAR: Back', { color: COL.hint }); },
    key(k) { if (k === '#enter') { App.setScreen(back); paste(); return true; } if (k === '#clear' || k === '+') { App.setScreen(back); return true; } return App.isTok(k); }
  });
};

/* ===================== HOME SCREEN ===================== */
const AUTO_ANS = new Set(['+', '-', '*', '/', '^', '²', '⁻¹', '³', '!', '→', 'ᵀ', 'nPr', 'nCr', '▶Frac', '▶Dec', '▶DMS', '▶F◀▶D', 'ˣ√', '°', 'ʳ']);
const Home = App.home = {
  ed: Object.assign(new LineEditor(), { mathprint: true }), sel: null, recallIdx: -1,
  get S() { return E.getState(); },
  entries() { return this.S.entries; },
  insert(tok) {
    this.sel = null;
    if (this.ed.empty && AUTO_ANS.has(tok)) this.ed.insert('Ans');
    this.ed.insert(tok);
  },
  insertMany(arr) { this.ed.insertMany(arr); },
  rows() { // build display rows [{L, li, x, item}] — one per laid-out line, MathPrint fractions stacked
    const out = []; const classic = this.S.mode.mathprint !== 'MATHPRINT';
    const add = (L, item, right) => L.lines.forEach((ln, li) => out.push({ L, li, item, x: right && L.lines.length === 1 ? RIGHT - ln.w : X0 }));
    const from = this.sel === null ? (this.hideBefore || 0) : 0; // after a results screen, older entries wait in history
    this.entries().forEach((e, ei) => {
      if (e.clr || ei < from) return;
      add(MP.layout(e.toks, { classic }), ei * 2, false);
      const mL = !classic && !e.left && e.val && Array.isArray(e.val.mat) ? MP.matrixLayout(e.val.mat, (e.out || []).join(' ')) : null;
      if (mL) add(mL, ei * 2 + 1, true);
      else (e.out || []).forEach(line => {
        const ft = !classic && !e.left ? MP.fracOutToks(line) : null;
        add(MP.layout(ft || cells(line), { classic: !ft }), ei * 2 + 1, !e.left);
      });
      out.push({ sep: true, item: ei * 2 + 1 }); // dotted line after each entry, like the CE
    });
    return out;
  },
  render() {
    G.clear(); G.status(this.sel !== null ? 'HISTORY' : (App.flashMsg || ''));
    const rows = this.rows();
    const edL = MP.layout(this.ed.toks, { classic: this.S.mode.mathprint !== 'MATHPRINT', cursor: true });
    edL.lines.forEach((ln, li) => rows.push({ L: edL, li, item: null, x: X0 }));
    const h = r => r.sep ? 3 : MP.lineH(r.L.lines[r.li]);
    let start = rows.length, used = 0;
    const top = App.paneTop || SB; // lower half in HORIZONTAL split screen
    while (start > 0 && used + h(rows[start - 1]) <= H - top) { start--; used += h(rows[start]); }
    if (this.sel !== null) { const first = rows.findIndex(r => r.item === this.sel); if (first >= 0 && first < start) start = first; }
    let y = top;
    for (let i = start; i < rows.length && y + h(rows[i]) <= H; i++) {
      const r = rows[i], c = G.ctx;
      if (r.sep) { c.fillStyle = COL.text; for (let x = X0; x < RIGHT; x += 3) c.fillRect(x, y + 1, 1, 1); }
      else MP.drawLine(r.L, r.li, r.x, y, { hist: this.sel !== null && r.item === this.sel, cursor: r.L === edL && this.sel === null && App.screen === this ? this.ed.cur : undefined });
      y += h(r);
    }
  },
  selectable() { const s = []; this.entries().forEach((e, i) => { if (e.clr) return; s.push(i * 2); if (e.out && e.out.length && !e.left && e.val !== undefined) s.push(i * 2 + 1); }); return s; },
  key(k) {
    const S = this.S;
    if (this.sel !== null) {
      const s = this.selectable(); let ix = s.indexOf(this.sel);
      if (k === '#up') { if (ix > 0) this.sel = s[ix - 1]; return true; }
      if (k === '#down') { if (ix < s.length - 1) this.sel = s[ix + 1]; else this.sel = null; return true; }
      if (k === '#enter') { const e = this.entries()[Math.floor(this.sel / 2)]; const toks = this.sel % 2 === 0 ? e.toks : (typeof e.val === 'number' ? E.numToToks(e.val) : e.toks); this.sel = null; this.insertMany(toks); return true; }
      if (k === '#clear') { this.sel = null; return true; }
      this.sel = null; // fall through
    }
    switch (k) {
      case '#enter': return this.exec();
      case '#up': { if (this.ed.vert(-1)) return true; const s = this.selectable(); if (s.length) this.sel = s[s.length - 1]; return true; }
      case '#down': this.ed.vert(1); return true;
      case '#entry': {
        const list = this.entries().filter(e => !e.clr && e.toks.length);
        if (!list.length) return true;
        this.recallIdx = (this.recallIdx + 1) % list.length; this.ed.set(list[list.length - 1 - this.recallIdx].toks); return true;
      }
      case '#clear':
        if (!this.ed.empty) this.ed.set([]); else { S.entries.forEach(e => e.clr = true); }
        return true;
    }
    if (App.isTok(k)) { this.insert(k); return true; }
    return this.ed.key(k);
  },
  exec() {
    const S = this.S; let toks = this.ed.toks.slice();
    if (!toks.length) { const last = S.entries.filter(e => e.toks.length).pop(); if (!last) return true; toks = last.toks.slice(); }
    this.recallIdx = -1; App.lastRunToks = toks;
    if (toks[0] === 'prgm') { // prgmNAME runs a program
      try { App.runProgram(toks.slice(1).join(''), toks); this.ed.set([]); }
      catch (err) { App.showError(err); }
      return true;
    }
    try {
      const r = E.run(toks); const ent = { toks };
      if (!r) ent.out = [];
      else if (r.lines && r.title) { ent.out = ['Done']; this.push(ent); this.ed.set([]); App.save(); App.setScreen(new ResultScreen(r.lines)); return true; }
      else if (r.lines) { ent.out = r.lines; ent.left = true; }
      else if (r.done) ent.out = ['Done'];
      else if (r.action === 'clrhome') { S.entries.forEach(e => e.clr = true); this.ed.set([]); App.save(); return true; }
      else if (r.action === 'graph') { ent.out = ['Done']; S.entries.push(ent); this.ed.set([]); App.save(); App.setScreen(App.graph); return true; }
      else if (r.screen) { ent.out = ['Done']; S.entries.push(ent); this.ed.set([]); App.save(); App.setScreen(r.screen); return true; }
      else { ent.out = E.format(r.value, r.conv); ent.val = r.value; }
      this.push(ent);
      this.ed.set([]); App.save();
    } catch (err) {
      if (err && err.type) { this.push({ toks, out: ['Error'] }); App.save(); } // the CE keeps failed entries in history
      App.showError(err, { goto: (pos) => { this.ed.set(toks, Math.min(pos === undefined ? toks.length : pos, toks.length)); App.setScreen(Home); } });
    }
    return true;
  },
  push(ent) {
    const S = this.S; S.entries.push(ent);
    if (S.entries.length > 40) { const n = S.entries.length - 40; S.entries.splice(0, n); this.hideBefore = Math.max(0, (this.hideBefore || 0) - n); }
  },
  /* run tokens as if typed at home (used by wizards) */
  runToks(toks) { this.ed.set(toks); App.setScreen(Home); this.exec(); App.render(); }
};

/* ===================== MENU SCREEN ===================== */
const LABELS = '1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZθ'.split('');
class Menu {
  /* tabs: [{name, items:[{label, tok?, run?, sub?}]}] ; target: editable screen to paste into */
  constructor(tabs, target, opts = {}) { this.tabs = tabs; this.target = target; this.tab = opts.tab || 0; this.idx = 0; this.top = 0; this.opts = opts; this.back = opts.back || null; }
  get items() { const t = this.tabs[this.tab]; return typeof t.items === 'function' ? t.items() : t.items; }
  render() {
    G.clear(); G.status(this.opts.status || ''); const g = GRIDS.big; let col = 0;
    if (this.opts.title) G.text(g, 0, 0, this.opts.title, { inv: true });
    else this.tabs.forEach((t, i) => { G.text(g, col, 0, t.name, { inv: i === this.tab }); col += cells(t.name).length + 1; });
    const items = this.items; const vis = g.rows - 1;
    if (this.idx < this.top) this.top = this.idx; if (this.idx >= this.top + vis) this.top = this.idx - vis + 1;
    for (let r = 0; r < vis && this.top + r < items.length; r++) {
      const i = this.top + r; const it = items[i]; const lab = LABELS[i] || '?';
      const more = (r === vis - 1 && i < items.length - 1) ? '↓' : (r === 0 && this.top > 0 ? '↑' : ':');
      G.text(g, 0, r + 1, lab + more, { inv: i === this.idx }); // the CE highlights the number and its colon
      G.text(g, 2, r + 1, typeof it.label === 'function' ? it.label() : it.label, { color: it.disabled ? COL.dim : undefined });
    }
  }
  choose(i) {
    const it = this.items[i]; if (!it || it.disabled) return;
    if (it.sub) { App.setScreen(new Menu(typeof it.sub === 'function' ? it.sub() : it.sub, this.target, { back: this, title: it.subTitle })); return; }
    if (it.run) { it.run(this.target, this); return; }
    const toks = it.toks || [it.tok !== undefined ? it.tok : it.label];
    const tgt = this.target && this.target.insert ? this.target : Home;
    if (it.raw && tgt.ed && tgt.ed.insertMany) { tgt.ed.insertMany(toks); if (tgt.sync) tgt.sync(); if ('dirty' in tgt) tgt.dirty = true; } // already-built template tokens
    else toks.forEach(t => tgt.insert(t));
    App.setScreen(tgt);
  }
  key(k) {
    const items = this.items;
    if (k === '+') { const it = items[this.idx]; if (it && !it.disabled && !it.sub) App.catalogHelp(it.tok !== undefined ? it.tok : (it.toks ? it.toks.join('') : it.label), this, () => this.choose(this.idx)); return true; } // CATALOG HELP
    if (!items.length && (k === '#up' || k === '#down' || k === '#enter')) return true;
    switch (k) {
      case '#up': this.idx = (this.idx - 1 + items.length) % items.length; return true;
      case '#down': this.idx = (this.idx + 1) % items.length; return true;
      case '#pgdn': this.idx = Math.min(items.length - 1, this.idx + 9); return true;
      case '#pgup': this.idx = Math.max(0, this.idx - 9); return true;
      case '#left': if (this.tabs.length > 1) { this.tab = (this.tab - 1 + this.tabs.length) % this.tabs.length; this.idx = 0; this.top = 0; } return true;
      case '#right': if (this.tabs.length > 1) { this.tab = (this.tab + 1) % this.tabs.length; this.idx = 0; this.top = 0; } return true;
      case '#enter': this.choose(this.idx); return true;
      case '#clear': App.setScreen(this.back || this.target || Home); return true;
      case '#del': case '#mode': if (k === '#mode') return false; return true;
    }
    const li = LABELS.indexOf(k);
    if (li >= 0 && li < items.length) { this.idx = li; this.choose(li); return true; }
    if (App.isTok(k)) return true; // swallow other tokens
    return false;
  }
}
App.Menu = Menu;

/* ===================== FORM SCREEN =====================
   fields: {label, kind:'num'|'expr'|'choice'|'action'|'info', get(), set(v), opts:[...], run(), hidden() } */
class Form {
  constructor(o) { Object.assign(this, { grid: 'big', title: null, fields: [], idx: 0, top: 0, ed: null }, o); this.fixIdx(); }
  vis() { return this.fields.filter(f => !(f.hidden && f.hidden())); }
  fixIdx() { const v = this.vis(); const sel = v.filter(f => f.kind !== 'info'); if (!sel.includes(this.cur)) this.cur = sel[0]; this.startEdit(); }
  startEdit() {
    const f = this.cur; this.ed = null; if (!f) return;
    this.opt = f.kind === 'choice' ? Math.max(0, f.opts.indexOf(f.get())) : 0;
    if (f.kind === 'num' || f.kind === 'expr') { const v = f.get(); this.ed = new LineEditor(Array.isArray(v) ? v : (v === null || v === undefined ? [] : E.numToToks(v))); this.ed.cur = 0; this.ed.fresh = true; this.dirty = false; }
  }
  commit() {
    const f = this.cur; if (!f || !this.ed || !this.dirty) return true;
    if (f.kind === 'expr') { f.set(this.ed.toks.slice()); this.dirty = false; return true; }
    try { const v = E.evalNumber(this.ed.toks); f.set(v); this.dirty = false; this.ed = new LineEditor(E.numToToks(f.get())); this.ed.cur = 0; this.ed.fresh = true; return true; }
    catch (err) { const self = this; App.showError(err, { quit: () => { self.startEdit(); App.setScreen(self); }, goto: (pos) => { App.setScreen(self); self.ed.cur = Math.min(pos || 0, self.ed.toks.length); self.ed.fresh = false; } }); return false; }
  }
  move(d) {
    if (!this.commit()) return; const v = this.vis().filter(f => f.kind !== 'info'); let i = v.indexOf(this.cur) + d;
    if (i < 0) i = this.wrap ? v.length - 1 : 0; if (i >= v.length) i = this.wrap ? 0 : v.length - 1;
    this.cur = v[i]; this.startEdit();
  }
  layout() { // returns [{f, row, rows}]
    const g = GRIDS[this.grid]; const out = []; let row = this.title ? (Array.isArray(this.title) ? this.title.length : 1) : 0;
    this.vis().forEach(f => {
      let rows = 1;
      if ((f.kind === 'num' || f.kind === 'expr') && f === this.cur && this.ed) { const lw = cells(f.label || '').length; rows = Math.max(1, Math.ceil((lw + cells(this.ed.text()).length + 1) / g.cols)); }
      out.push({ f, row, rows }); row += rows;
    });
    return out;
  }
  render() {
    G.clear(); G.status(this.status ? this.status() : (App.flashMsg || '')); const g = GRIDS[this.grid];
    const titles = this.title ? (Array.isArray(this.title) ? this.title : [this.title]) : [];
    titles.forEach((t, i) => { const s = typeof t === 'function' ? t() : t; G.text(g, this.titleCenter && i === 0 ? Math.max(0, Math.floor((g.cols - cells(s).length) / 2)) : 0, i, s, { inv: i === 0 && this.titleInv !== false }); });
    const L = this.layout(); const cur = L.find(x => x.f === this.cur);
    const avail = g.rows - titles.length;
    if (cur) { if (cur.row - titles.length < this.top) this.top = cur.row - titles.length; if (cur.row + cur.rows - titles.length > this.top + avail) this.top = cur.row + cur.rows - titles.length - avail; }
    L.forEach(({ f, row }) => {
      const r = row - this.top; if (r < titles.length || r >= g.rows) return;
      let label = typeof f.label === 'function' ? f.label() : (f.label || ''); const lw = cells(label).length;
      if (f.mark && f.mark()) G.text(g, 0, r, '▪');
      const lc = f.mark || this.indent ? 1 : 0; // wizards indent their rows one column, like the CE
      if (f.kind === 'info') { G.text(g, lc, r, label, { color: f.color }); return; }
      if (f.kind === 'action') { G.text(g, lc, r, label, { inv: f === this.cur }); return; }
      if (f.labelColor) { G.text(g, lc, r, label, { color: f.labelColor }); label = ''; }
      if (f.kind === 'cycle') { // a value bar changed with ◀ ▶ (colors on FORMAT)
        G.text(g, lc, r, label); const v = f.get(), x = g.x0 + (lc + lw) * g.cw + 2, w = f.width || 100, y = SB + r * g.rh, c = G.ctx;
        const bg = f.swatch ? f.swatch(v) : null; c.fillStyle = bg || '#fff'; c.fillRect(x, y + 2, w, g.rh - 3);
        if (!bg) { c.strokeStyle = '#000'; c.lineWidth = 1; c.strokeRect(x + .5, y + 2.5, w - 1, g.rh - 4); }
        G.raw(x + w / 2, y + g.rh / 2 + 1, String(v), g.font, bg && !(f.light && f.light(v)) ? COL.invText : COL.text, 'center');
        if (f === this.cur && App.blinkOn) { c.strokeStyle = '#000'; c.lineWidth = 1.5; c.strokeRect(x - 1.5, y + .5, w + 3, g.rh); }
        return;
      }
      G.text(g, lc, r, label);
      if (f.kind === 'choice') {
        let col = lc + lw; const sel = f.get();
        f.opts.forEach((o, i) => {
          const name = (f.names ? f.names[i] : String(o)); const isCur = f === this.cur && this.opt === i; const dis = f.disabled && f.disabled.includes(o);
          G.text(g, col, r, name, { inv: o === sel, color: dis ? COL.dim : undefined });
          if (isCur && App.blinkOn) { const c = G.ctx; c.strokeStyle = o === sel ? '#ffcf5a' : '#000'; c.lineWidth = 1.5; c.strokeRect(g.x0 + col * g.cw + .5, SB + r * g.rh + 1.5, cells(name).length * g.cw - 1, g.rh - 2); }
          col += cells(name).length + 1;
        });
        return;
      }
      if (f === this.cur && this.ed && App.mpEntry('', this.ed, g.x0 + (lc + lw) * g.cw, SB + r * g.rh + g.rh / 2)) return;
      if (f === this.cur && this.ed) {
        const chars = cells(this.ed.text()); const width = g.cols; const start = lc + lw;
        const all = cells(label).map(() => ' ').concat(chars);
        const off = this.ed.offsets(); const cp = start + off[this.ed.cur];
        for (let k = start; k < Math.max(all.length + lc, start + 1); k++) { const ch = chars[k - start]; if (ch === undefined) continue; const rr = r + Math.floor(k / width); if (rr < g.rows) G.text(g, k % width, rr, ch); }
        const rr = r + Math.floor(cp / width); if (rr < g.rows) G.cursor(g, cp % width, rr, chars[cp - start]);
        return;
      }
      const v = f.get(); const s = f.show ? f.show(v) : (Array.isArray(v) ? E.tokText(v) : (v === null || v === undefined ? '' : E.fmtReal(v)));
      G.text(g, lc + lw, r, s.slice(0, g.cols - lc - lw));
    });
    if (this.footer) this.footer();
  }
  key(k) {
    const f = this.cur;
    if (this.onKey && this.onKey(k)) return true;
    if ((k === '#up' || k === '#down') && this.ed && this.ed.vert(k === '#down' ? 1 : -1)) return true; // ▲▼ inside an n/d first
    switch (k) {
      case '#up': this.move(-1); return true;
      case '#down': this.move(1); return true;
      case '#enter':
        if (!f) return true;
        if (f.kind === 'choice') { const o = f.opts[this.opt]; if (!(f.disabled && f.disabled.includes(o))) f.set(o); this.fixIdx(); if (this.onChange) this.onChange(); return true; }
        if (f.kind === 'action') { f.run(); return true; }
        if (this.commit()) { if (this.onEnter && this.onEnter(f)) return true; this.move(1); } return true;
      case '#solve': if (this.onSolve && f) { if (this.ed && this.dirty && !this.commit()) return true; this.onSolve(f); this.startEdit(); } return true;
      case '#quit': if (this.commit() !== false) { if (this.onExit) this.onExit(); return false; } return true;
    }
    if (f && f.kind === 'cycle') {
      if (k === '#left' || k === '#right') { const o = f.opts, i = o.indexOf(f.get()); f.set(o[(Math.max(0, i) + (k === '#right' ? 1 : -1) + o.length) % o.length]); return true; }
      return App.isTok(k) || k === '#enter' || k === '#clear';
    }
    if (f && f.kind === 'choice') {
      if (k === '#left') { this.opt = (this.opt - 1 + f.opts.length) % f.opts.length; return true; }
      if (k === '#right') { this.opt = (this.opt + 1) % f.opts.length; return true; }
      if (k === '#clear') { if (this.onClear) { this.onClear(); return true; } return false; }
      return App.isTok(k);
    }
    if (f && this.ed) {
      if (k === '#clear') { if (this.ed.empty && this.onClear) { this.onClear(); return true; } this.ed.set([]); this.dirty = true; return true; }
      if (App.isTok(k)) { this.ed.insert(k); this.dirty = true; return true; }
      if (k === '#del' || k === '#bksp') { this.ed.key(k); this.dirty = true; return true; }
      if (this.ed.key(k)) return true;
    }
    if (k === '#clear' && this.onClear) { this.onClear(); return true; }
    return App.isTok(k);
  }
  insert(tok) { if (this.ed) { this.ed.insert(tok); this.dirty = true; } }
}
App.Form = Form;

/* ===================== TEXT / RESULTS SCREEN ===================== */
class TextScreen {
  constructor(lines, o = {}) { this.lines = lines; this.top = 0; this.o = o; }
  render() {
    G.clear(); G.status(this.o.status || ''); const g = GRIDS[this.o.grid || 'big'];
    for (let r = 0; r < g.rows && this.top + r < this.lines.length; r++) {
      const L = this.lines[this.top + r]; const s = typeof L === 'string' ? L : L.text;
      G.text(g, 0, r, s, { inv: (r + this.top === 0 && this.o.titleInv) || (L && L.inv), color: L && L.color });
    }
    if (this.top + g.rows < this.lines.length) G.text(g, g.cols - 1, g.rows - 1, '↓');
    if (this.top > 0) G.text(g, g.cols - 1, 0, '↑');
  }
  key(k) {
    const g = GRIDS[this.o.grid || 'big'];
    if (k === '#down') { if (this.top + g.rows < this.lines.length) this.top++; return true; }
    if (k === '#up') { if (this.top > 0) this.top--; return true; }
    if (k === '#clear' || k === '#enter') { App.setScreen(this.o.back || Home); return true; }
    if (this.o.keys && this.o.keys(k)) return true;
    return false;
  }
}
App.TextScreen = TextScreen;

/* statistics results (1-Var Stats, LinReg, tests…) shown like the CE: centered highlighted title, ↑/↓ at the
   left edge when there is more, cursor under the last line; typing anything starts a fresh home screen */
class ResultScreen {
  constructor(lines) { this.title = lines[0]; this.lines = lines.slice(1); this.top = 0; }
  get rows() { return GRIDS.big.rows - 1; }
  get total() { return this.lines.length + 1; } // + the cursor line
  render() {
    G.clear(); G.status(App.flashMsg || ''); const g = GRIDS.big;
    const t = cells(this.title); G.text(g, Math.max(0, Math.floor((g.cols - t.length) / 2)), 0, this.title, { inv: true });
    const max = Math.max(0, this.total - this.rows); if (this.top > max) this.top = max;
    for (let r = 0; r < this.rows; r++) {
      const i = this.top + r;
      if (i === this.lines.length) { G.cursor(g, 0, r + 1, ''); break; }
      if (i > this.lines.length) break;
      let s = cells(this.lines[i]);
      if (r === 0 && this.top > 0) s = ['↑'].concat(s.slice(1));
      else if (r === this.rows - 1 && i < this.total - 1) s = ['↓'].concat(s.slice(1));
      G.text(g, 0, r + 1, s.join(''));
    }
  }
  key(k) {
    const max = Math.max(0, this.total - this.rows);
    if (k === '#down') { if (this.top < max) this.top++; return true; }
    if (k === '#up') { if (this.top > 0) this.top--; else { App.setScreen(Home); Home.key('#up'); } return true; }
    // anything else goes to a fresh home screen (earlier entries stay in history)
    Home.hideBefore = Home.S.entries.length; App.setScreen(Home);
    if (k === '#clear' || k === '#quit') return true;
    if (k === '#enter') return true;
    return Home.key(k) || App.global(k);
  }
}
App.ResultScreen = ResultScreen;

/* ===================== MODE / FORMAT ===================== */
App.modeScreen = function () {
  const S = E.getState(); const M = S.mode; const ch = (opts, key, extra = {}) => Object.assign({ kind: 'choice', label: '', opts, get: () => M[key], set: v => { M[key] = v; App.save(); } }, extra);
  return new Form({
    grid: 'small', wrap: true,
    fields: [
      ch(['MATHPRINT', 'CLASSIC'], 'mathprint'),
      ch(['NORMAL', 'SCI', 'ENG'], 'notation'),
      { kind: 'choice', label: '', opts: ['FLOAT', 0, 1, 2, 3, 4, 5, 6, 7, 8, 9], get: () => M.float, set: v => { M.float = v; App.save(); } },
      ch(['RADIAN', 'DEGREE'], 'angle'),
      ch(['FUNCTION', 'PARAMETRIC', 'POLAR', 'SEQ'], 'graph'),
      ch(['THICK', 'DOT-THICK', 'THIN', 'DOT-THIN'], 'lineStyle'),
      { kind: 'choice', label: '', opts: ['SEQUENTIAL', 'SIMUL'], get: () => M.simul ? 'SIMUL' : 'SEQUENTIAL', set: v => { M.simul = v === 'SIMUL'; App.save(); } },
      ch(['REAL', 'a+bi', 're^θi'], 'complex', { names: ['REAL', 'a+bi', 're^(θi)'] }),
      { kind: 'choice', label: '', opts: ['FULL', 'HORIZONTAL', 'GRAPH-TABLE'], get: () => M.split || 'FULL', set: v => { M.split = v; App.save(); } },
      ch(['n/d', 'Un/d'], 'fracType', { label: 'FRACTION TYPE: ', labelColor: COL.accent }),
      ch(['AUTO', 'DEC'], 'answers', { label: 'ANSWERS: ', labelColor: COL.accent }),
      { kind: 'choice', label: 'STAT DIAGNOSTICS: ', labelColor: COL.accent, opts: ['OFF', 'ON'], get: () => M.statDiag ? 'ON' : 'OFF', set: v => { M.statDiag = v === 'ON'; App.save(); } },
      { kind: 'choice', label: 'STAT WIZARDS: ', labelColor: COL.accent, opts: ['ON', 'OFF'], get: () => M.statWiz ? 'ON' : 'OFF', set: v => { M.statWiz = v === 'ON'; App.save(); } },
      { kind: 'info', label: 'SET CLOCK  ' + new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }) + ' ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }).replace(' ', '') },
      { kind: 'info', label: 'LANGUAGE:   ENGLISH' }
    ]
  });
};
App.formatScreen = function () {
  const F = E.getState().fmt; const ch = (opts, get, set, extra = {}) => Object.assign({ kind: 'choice', label: '', opts, get, set: v => { set(v); App.save(); } }, extra);
  const hex = n => (COLORS.find(c => c[0] === n) || [])[1];
  const cyc = (label, opts, get, set, extra = {}) => Object.assign({ kind: 'cycle', label, opts, get, set: v => { set(v); App.save(); }, swatch: hex, light: n => LIGHT_COLORS.has(n) }, extra);
  const names = COLORS.map(c => c[0]);
  return new Form({
    wrap: true, status() { return this.cur && this.cur.kind === 'cycle' ? 'PRESS [◀] OR [▶] TO SELECT AN OPTION' : ''; },
    fields: [
      ...(E.getState().mode.graph === 'SEQ' ? [ch(['Time', 'Web', 'uv', 'vw', 'uw'], () => F.seqFmt || 'Time', v => F.seqFmt = v)] : []),
      ch(['RectGC', 'PolarGC'], () => F.polarGC ? 'PolarGC' : 'RectGC', v => F.polarGC = v === 'PolarGC'),
      ch(['CoordOn', 'CoordOff'], () => F.coord ? 'CoordOn' : 'CoordOff', v => F.coord = v === 'CoordOn'),
      ch(['GridOff', 'GridDot', 'GridLine'], () => ({ OFF: 'GridOff', DOT: 'GridDot', LINE: 'GridLine' })[F.grid], v => F.grid = { GridOff: 'OFF', GridDot: 'DOT', GridLine: 'LINE' }[v]),
      cyc('GridColor:', names, () => F.gridColor || 'MEDGRAY', v => F.gridColor = v),
      cyc('Axes:', names.concat('Off'), () => F.axes ? (F.axesColor || 'BLACK') : 'Off', v => { F.axes = v !== 'Off'; if (v !== 'Off') F.axesColor = v; }, { swatch: v => v === 'Off' ? null : hex(v) }),
      ch(['LabelOff', 'LabelOn'], () => F.label ? 'LabelOn' : 'LabelOff', v => F.label = v === 'LabelOn'),
      ch(['ExprOn', 'ExprOff'], () => F.expr ? 'ExprOn' : 'ExprOff', v => F.expr = v === 'ExprOn'),
      cyc('BorderColor:', [1, 2, 3, 4], () => F.border || 1, v => F.border = v, { swatch: v => App.BORDERS[v - 1], light: () => true }),
      cyc('Background:', ['Off'].concat(names, [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].filter(d => (E.getState().images || {})[d]).map(d => 'Image' + d)),
        () => F.bgImage !== null && F.bgImage !== undefined ? 'Image' + F.bgImage : F.bg || 'Off',
        v => { const im = /^Image(\d)$/.exec(v); F.bgImage = im ? +im[1] : null; F.bg = im || v === 'Off' ? null : v; }, { swatch: v => v === 'Off' || /^Image/.test(v) ? null : hex(v) }),
      ch(['On', 'Off'], () => F.detectAsym ? 'On' : 'Off', v => F.detectAsym = v === 'On', { label: 'Detect Asymptotes: ' })
    ]
  });
};

/* ===================== PERSISTENCE ===================== */
App.save = function () {
  clearTimeout(App._sv); App._sv = setTimeout(() => {
    try { const S = E.getState(); localStorage.setItem('cgc-state-v1', JSON.stringify(S, (k, v) => (v instanceof E.Cx ? { __cx: [v.re, v.im] } : v))); } catch (e) { }
  }, 300);
};
App.load = function () {
  try {
    const s = localStorage.getItem('cgc-state-v1'); if (!s) return;
    const st = JSON.parse(s, (k, v) => (v && v.__cx ? new E.Cx(v.__cx[0], v.__cx[1]) : v));
    const d = E.defaultState();
    const merged = Object.assign(d, st); merged.mode = Object.assign(E.defaultState().mode, st.mode); merged.fmt = Object.assign(E.defaultState().fmt, st.fmt); merged.win = Object.assign(E.defaultState().win, st.win);
    merged.draw = (merged.draw || []).filter(d => d.t !== 'shade' && d.t !== 'shadeDist');
    E.setState(merged);
  } catch (e) { }
};

/* ===================== KEY DISPATCH ===================== */
App.press = function (id, fromLog) {
  if (!fromLog) App.logKey(id);
  App.blinkOn = true;
  if (App.off) { if (id === 'on') { App.off = false; App.render(); } return; }
  if (id === '2nd') { App.shift = App.shift === '2nd' ? null : '2nd'; App.render(); return; }
  if (id === 'alpha') {
    if (App.shift === '2nd') { App.alphaLock = true; App.shift = 'alpha'; }
    else if (App.shift === 'alpha') { App.shift = null; App.alphaLock = false; }
    else App.shift = 'alpha';
    App.render(); return;
  }
  const def = App.KEYS[id]; if (!def) return;
  let k;
  if (App.shift === '2nd') k = def.s; else if (App.shift === 'alpha') k = def.a !== undefined ? def.a : def.m; else k = def.m;
  if (App.shift === '2nd' || (App.shift === 'alpha' && !App.alphaLock)) App.shift = null;
  if (k === undefined || k === null) { App.render(); return; }
  if (id === 'xt' && k === 'X') k = ({ PARAMETRIC: 'T', POLAR: 'θ', SEQ: 'seq.n' })[E.getState().mode.graph] || 'X';
  App.dispatch(k);
};
App.dispatch = function (k) {
  if (App.graphBusy && App.graphBusy(k)) { App.render(); return; } // a graph is being drawn: ENTER pauses, ON stops
  const sc = App.screen;
  let handled = false;
  try { handled = sc.key ? sc.key(k) : false; } catch (e) { App.showError(e); return; }
  if (!handled) {
    if (App.global(k)) { }
    else if (App.isTok(k)) { if (sc.insert && sc !== Home) sc.insert(k); else { if (App.screen !== Home) App.setScreen(Home); Home.insert(k); } }
  }
  App.render();
};
App.logKey = function (id) {
  const pre = App.shift; App.keyLog.push({ id, shift: pre === '2nd' ? '2nd' : (pre === 'alpha' ? 'alpha' : null) });
  if (App.keyLog.length > 400) App.keyLog.shift();
  if (App.onKeyLog) App.onKeyLog();
};

/* blink */
setInterval(() => { App.blinkOn = !App.blinkOn; if (App.screen && !App.off && App.screen.blinks !== false) App.render(); }, 520);
})();
