/* ui-graph.js — Y= editor, WINDOW, ZOOM, GRAPH (trace / calc / zoom), TABLE, TBLSET, draw commands */
(function () {
'use strict';
const E = window.Engine, N = window.Numeric, App = window.App, G = App.G;
const { GRIDS, COL, SB, MONO } = App;
const S = () => E.getState();
let GX = 27, GY = 52, GW = 265, GH = 165, GEO = 'FULL';
App.GEOM = { GX, GY, GW, GH };
/* MODE split screen: graph area, and the part of the screen it owns ([x, y, w, h]) */
const GEOMS = { FULL: [27, 52, 265, 165], HORIZONTAL: [27, 34, 265, 97], 'GRAPH-TABLE': [5, 52, 151, 165] };
const PANES = { FULL: [0, SB, 320, 210], HORIZONTAL: [0, SB, 320, 105], 'GRAPH-TABLE': [0, SB, 160, 210] };
const split = () => S().mode.split || 'FULL';

/* ===================== helpers ===================== */
const dX = () => E.deltaX(), dY = () => E.deltaY();
const px = x => GX + (x - S().win.Xmin) / dX();
const py = y => GY + GH - 1 - (y - S().win.Ymin) / dY();
const xOfPx = i => S().win.Xmin + i * dX();
const yOfPx = j => S().win.Ymin + (GH - 1 - j) * dY();
function activeFns() { const st = S(); return E.YN.filter(n => st.Y[n].on && st.Y[n].toks.length); }
const gmode = () => S().mode.graph;
const PVAR = { PARAMETRIC: 'T', POLAR: 'θ', SEQ: 'n' };
const safe = f => { try { const v = f(); return typeof v === 'number' && isFinite(v) ? v : NaN; } catch (e) { return NaN; } };
/* the graphs of PARAMETRIC, POLAR and SEQ mode: each knows its parameter range and how to turn a parameter into (x, y) */
function curves() {
  const st = S(), m = gmode(), w = st.win, out = [];
  if (m === 'PARAMETRIC') st.par.forEach((d, i) => { if (d.on && d.x.length && d.y.length) out.push({ color: d.color, labels: [E.XT[i] + '=' + E.tokText(d.x), E.YT[i] + '=' + E.tokText(d.y)], range: [w.Tmin, w.Tmax, w.Tstep],
    point: t => [safe(() => E.evalPar(i, 'x', t)), safe(() => E.evalPar(i, 'y', t))], cols: [{ name: E.XT[i], val: t => safe(() => E.evalPar(i, 'x', t)) }, { name: E.YT[i], val: t => safe(() => E.evalPar(i, 'y', t)) }] }); });
  if (m === 'POLAR') st.pol.forEach((d, i) => { if (d.on && d.toks.length) out.push({ color: d.color, labels: [E.RN[i] + '=' + E.tokText(d.toks)], range: [w.θmin, w.θmax, w.θstep],
    point: th => { const r = safe(() => E.evalPol(i, th)), a = st.mode.angle === 'DEGREE' ? th * Math.PI / 180 : th; return [r * Math.cos(a), r * Math.sin(a)]; }, cols: [{ name: E.RN[i], val: th => safe(() => E.evalPol(i, th)) }] }); });
  const sf = st.fmt.seqFmt || 'Time';
  if (m === 'SEQ' && sf === 'Web') E.SEQS.forEach(n => { const d = st.seq[n]; if (d.on && d.toks.length) out.push(webCurve(n, d)); });
  if (m === 'SEQ' && sf !== 'Time' && sf !== 'Web') { const [a, b] = sf.split(''); const da = st.seq[a], db = st.seq[b]; if (da.toks.length && db.toks.length) out.push({ color: da.color, dots: true, labels: [a + '(n)=' + E.tokText(da.toks), b + '(n)=' + E.tokText(db.toks)], range: [w.PlotStart, w.nMax, w.PlotStep],
    point: k => [safe(() => E.seqVal(a, k)), safe(() => E.seqVal(b, k))], cols: [{ name: a, val: k => safe(() => E.seqVal(a, k)) }, { name: b, val: k => safe(() => E.seqVal(b, k)) }] }); }
  if (m === 'SEQ' && sf === 'Time') E.SEQS.forEach(n => { const d = st.seq[n]; if (d.on && d.toks.length) out.push({ color: d.color, dots: true, labels: [n + '(n)=' + E.tokText(d.toks)], range: [w.PlotStart, w.nMax, w.PlotStep],
    point: k => [k, safe(() => E.seqVal(n, k))], cols: [{ name: n, val: k => safe(() => E.seqVal(n, k)) }] }); });
  return out;
}
App.curves = curves;
/* SEQ Web format: y=x, y=f(x) with x standing for u(n-1); TRACE walks the web (point s: vertical, then over to y=x) */
function webCurve(n, d) {
  const st = S(), w = st.win, f = x => safe(() => E.seqWebF(n, x)), u = j => safe(() => E.seqVal(n, w.nMin + j));
  return { color: d.color, web: true, labels: [n + '(n)=' + E.tokText(d.toks)], range: [0, 2 * (w.nMax - w.nMin), 1],
    point: s => { const j = Math.floor(s / 2); return s === 0 ? [u(0), 0] : s % 2 ? [u(j), u(j + 1)] : [u(j), u(j)]; },
    cols: [{ name: n, val: k => safe(() => E.seqVal(n, k)) }],
    *draw(c, lw, lx, ly) { yield* fnSteps(c, x => x, '#111', 1, false, lx, ly); yield* fnSteps(c, f, d.color, lw, false, lx, ly); } };
}
const xyText = (x, y) => {
  if (!S().fmt.polarGC || !isFinite(x) || !isFinite(y)) return ['X=' + (isFinite(x) ? niceNum(N.r12(x)) : ''), 'Y=' + (isFinite(y) ? niceNum(N.r12(y)) : '')];
  const th = Math.atan2(y, x) * (S().mode.angle === 'DEGREE' ? 180 / Math.PI : 1); return ['R=' + niceNum(N.r12(Math.hypot(x, y))), 'θ=' + niceNum(N.r12(th))];
};
/* one step per T, θ or n value, so the graph can be drawn gradually */
function* curveSteps(c, cv, lw, dots, lx, ly) {
  if (cv.draw) { yield* cv.draw(c, lw, lx, ly); return; }
  const [a, b, step] = cv.range; if (!(step > 0) || !(b >= a)) return;
  let prev = null;
  for (let k = 0, p = a; p <= b + step * 1e-9 && k < 20000; k++, p = a + k * step) {
    const [x, y] = E.seqBatch(() => cv.point(p)); if (!isFinite(x) || !isFinite(y)) { prev = null; yield; continue; }
    const X = Math.max(-2000, Math.min(2000, lx(x))), Y = Math.max(-2000, Math.min(2000, ly(y)));
    c.strokeStyle = cv.color; c.fillStyle = cv.color; c.lineWidth = lw; c.lineJoin = 'round'; c.lineCap = 'round';
    if (dots || cv.dots) c.fillRect(X - 1, Y - 1, 2.2, 2.2);
    else if (prev) { c.beginPath(); c.moveTo(prev[0], prev[1]); c.lineTo(X, Y); c.stroke(); }
    if (!(dots || cv.dots)) prev = [X, Y];
    yield;
  }
}
const runSteps = it => { for (const _ of it) { } };
App.activeFns = activeFns;
function fval(name, x) { try { const v = E.evalY(name, x); return (typeof v === 'number' && isFinite(v)) ? v : NaN; } catch (e) { return NaN; } }
App.fval = fval;
function validateWindow() { const w = S().win; if (!(w.Xmin < w.Xmax) || !(w.Ymin < w.Ymax)) N.fail('WINDOW RANGE'); }
function saveZPrev() { S().zprev = Object.assign({}, S().win); }
function setWin(o) { saveZPrev(); Object.assign(S().win, o); S().traceStep = null; App.save(); }
App.setWin = setWin;
// graph-screen numbers fit in 9 characters, like the CE (T=0.3926991, X=4.6193977)
const niceNum = v => { for (let sig = 10; sig > 1; sig--) { const t = E.fmtReal(v, { sig }); if (t.replace('⁻', '').length <= 9) return t; } return E.fmtReal(v); };

/* table/short number format (max ~6 chars like a handheld) */
function fmtShort(v, max = 6) {
  if (typeof v !== 'number' || !isFinite(v)) return 'ERROR';
  if (v === 0) return '0';
  const neg = v < 0, a = Math.abs(v); const room = max - (neg ? 1 : 0);
  let s;
  if (Number.isInteger(a) && String(a).length <= room) s = String(a);
  else if (a >= 1e-3 && a < Math.pow(10, room)) {
    const intDigits = Math.max(1, Math.floor(Math.log10(a)) + 1); let dec = room - intDigits - 1;
    if (dec < 0) dec = 0; s = a.toFixed(dec); if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
    if (s.length > room) s = null;
  }
  if (!s) { let e = Math.floor(Math.log10(a)); let m = a / Math.pow(10, e); const md = Math.max(0, room - String(e).length - 3); s = m.toFixed(md); if (Number(s) >= 10) { e++; m /= 10; s = m.toFixed(md); } s = s.replace(/\.?0+$/, '') + 'ᴇ' + (e < 0 ? '⁻' + (-e) : e); }
  return (neg ? '⁻' : '') + s;
}
App.fmtShort = fmtShort;

/* ===================== Y= EDITOR ===================== */
/* the Y= lines for the current graph mode: label, tokens, color square, and the object whose = turns it on/off */
function yRows() {
  const st = S(), m = st.mode.graph, row = (label, get, set, color, obj) => ({ label, get, set, color, obj });
  if (m === 'PARAMETRIC') return [].concat(...st.par.map((d, i) => [row(E.XT[i], () => d.x, t => { d.x = t; }, d.color, d), row(E.YT[i], () => d.y, t => { d.y = t; }, null, d)]));
  if (m === 'POLAR') return st.pol.map((d, i) => row(E.RN[i], () => d.toks, t => { d.toks = t; }, d.color, d));
  if (m === 'SEQ') return [row('nMin', () => E.numToToks(st.win.nMin), t => { try { const v = E.evalNumber(t); if (Number.isInteger(v) && v >= 0) st.win.nMin = v; } catch (e) { } }, null, null)]
    .concat(...E.SEQS.map(n => { const d = st.seq[n], ty = st.seqType || 'n'; return [row(n + '(' + ty + ')', () => d.toks, t => { d.toks = t; }, d.color, d), row(n + '(nMin)', () => d.init, t => { d.init = t; }, null, null)]
      .concat(ty === 'n+2' ? [row(n + '(nMin+1)', () => d.init1 || [], t => { d.init1 = t; }, null, null)] : []); }));
  return E.YN.map(n => row(n, () => st.Y[n].toks, t => { st.Y[n].toks = t; }, st.Y[n].color, st.Y[n]))
    .concat(st.appIneq ? xIneqs().map((d, i) => row('X' + '₁₂₃₄'[i], () => d.toks, t => { d.toks = t; }, d.color, d)) : []);
}
/* Inequalz X= lines (vertical boundaries such as X<3), kept in st.xIneq */
function xIneqs() { const st = S(); if (!st.xIneq) st.xIneq = ['#1f4fff', '#e0201b', '#111111', '#e020c8'].map(color => ({ toks: [], on: true, ineq: '<', color })); return st.xIneq; }
const ineqSnap = () => JSON.stringify([S().xIneq, E.YN.map(n => [S().Y[n].toks, S().Y[n].ineq, S().Y[n].on])]);
App.yRows = yRows;
const YEdit = App.yedit = {
  row: 0, plotIdx: 0, onEq: false, ed: null, top: 0,
  enter() { // keep the cursor when returning from a menu (e.g. inside a fresh n/d template)
    this.snap = ineqSnap(); const rows = yRows(); if (this.row >= rows.length) this.row = 0; const y = this.row >= 0 && rows[this.row];
    if (!(y && this.ed && this.edRow === this.row && this.edMode === S().mode.graph && this.ed.toks.join('\u0001') === y.get().join('\u0001'))) this.bind();
  },
  bind() { this.edRow = this.row; this.edMode = S().mode.graph; if (this.row >= 0) { const y = yRows()[this.row]; this.ed = Object.assign(new App.LineEditor(y.get()), { mathprint: true }); } else this.ed = null; },
  sync() { if (this.row >= 0 && this.ed) { yRows()[this.row].set(this.ed.toks.slice()); App.invalidateGraph(); } App.save(); },
  insert(t) { if (this.row < 0) return; if (this.onEq) { this.onEq = false; this.ed.cur = 0; } this.ed.insert(t); this.sync(); },
  insertMany(arr) { arr.forEach(t => this.insert(t)); },
  render() {
    const st = S(); G.clear(); G.status(App.flashMsg || (st.appIneq && this.onEq && st.mode.graph === 'FUNCTION' ? 'INEQUALZ: [alpha][f1]–[f5]  =  <  ≤  >  ≥' : '')); const g = GRIDS.big;
    // plots line: small font, spaced out
    const sm = GRIDS.small, pw = 5 * sm.cw + 6, pgap = 30, pmid = SB + g.rh / 2 + 0.5;
    st.plots.forEach((p, i) => {
      const x = 28 + i * (pw + pgap), c = G.ctx;
      if (p.on) { c.fillStyle = COL.inv; c.fillRect(x, pmid - 8, pw, 16); }
      G.raw(x + pw / 2, pmid + 1, 'Plot' + (i + 1), sm.font, p.on ? COL.invText : COL.text, 'center');
      if (this.row === -1 && this.plotIdx === i && App.blinkOn) { c.strokeStyle = p.on ? '#ffcf5a' : '#000'; c.lineWidth = 1.5; c.strokeRect(x - 1.5, pmid - 9.5, pw + 3, 19); }
    });
    G.ctx.strokeStyle = '#000'; G.ctx.setLineDash([1, 2]); G.ctx.beginPath(); G.ctx.moveTo(4, SB + g.rh + .5); G.ctx.lineTo(316, SB + g.rh + .5); G.ctx.stroke(); G.ctx.setLineDash([]);
    // equations laid out like the home screen (MathPrint templates stacked), each line as tall as it needs
    const MP = App.MP, classic = st.mode.mathprint !== 'MATHPRINT', EQ_GAP = 3, rows = yRows();
    const labW = r => App.cells(r.label).length, eqX = r => g.x0 + (2 + labW(r)) * g.cw + EQ_GAP; // small space after the highlighted =
    const lays = rows.map((r, i) => MP.layout(i === this.row && this.ed ? this.ed.toks : r.get(), { classic, maxW: (g.cols - 2 - labW(r)) * g.cw - EQ_GAP, cursor: i === this.row }));
    const hOf = i => lays[i].lines.reduce((a, ln) => a + MP.lineH(ln), 0);
    const seqT = st.mode.graph === 'SEQ', top0 = SB + g.rh * (seqT ? 2 : 1), avail = App.H - top0;
    if (seqT) { // TYPE: SEQ(n) SEQ(n+1) SEQ(n+2)
      const c = G.ctx, ty = st.seqType || 'n', my = SB + g.rh * 1.5 + 1; let x = g.x0 + 4; c.font = sm.font; c.textAlign = 'left'; c.fillStyle = COL.text; c.fillText('TYPE:', x, my); x += 6 * sm.cw;
      ['n', 'n+1', 'n+2'].forEach(t => { const s = 'SEQ(' + t + ')', w2 = App.cells(s).length * sm.cw + 4; if (t === ty) { c.fillStyle = COL.inv; c.fillRect(x - 2, my - 8, w2, 16); } c.fillStyle = t === ty ? COL.invText : COL.text; c.fillText(s, x, my); if (this.row === -2 && t === ty && App.blinkOn) { c.strokeStyle = '#000'; c.lineWidth = 1.5; c.strokeRect(x - 3.5, my - 9.5, w2 + 3, 19); } x += w2 + 10; });
    }
    // scroll so current row visible
    const startOf = i => { let h = 0; for (let k = this.top; k < i; k++) h += hOf(k); return h; };
    if (this.row >= 0) { if (this.row < this.top) this.top = this.row; while (startOf(this.row) + hOf(this.row) > avail && this.top < this.row) this.top++; } else this.top = 0;
    let y = top0; const c = G.ctx;
    for (let i = this.top; i < rows.length && y < App.H; i++) {
      const R = rows[i], L = lays[i], mid = y + L.lines[0].up + 0.5, lw = labW(R), on = R.obj ? R.obj.on : false, x0 = eqX(R);
      if (y + MP.lineH(L.lines[0]) > App.H) break; // only whole lines, like the handheld
      if (R.color) { c.fillStyle = R.color; c.fillRect(g.x0 + 1, mid - 6.5, 8, 13); }
      c.font = g.font; c.textAlign = 'center'; c.fillStyle = COL.text;
      App.cells(R.label).forEach((ch, k) => c.fillText(ch, g.x0 + (1 + k) * g.cw + g.cw / 2, mid + 1));
      if (on) { c.fillStyle = COL.inv; c.fillRect(g.x0 + (1 + lw) * g.cw, mid - 10, g.cw, 20); }
      c.fillStyle = on ? COL.invText : COL.text; c.fillText((st.appIneq && st.mode.graph === 'FUNCTION' && R.obj && R.obj.ineq) || '=', g.x0 + (1.5 + lw) * g.cw, mid + 1);
      if (i === this.row && this.onEq) MP.cursor(g.x0 + (1 + lw) * g.cw, mid, '=');
      L.lines.forEach((ln, li) => {
        if (y + MP.lineH(ln) > App.H) { y = App.H; return; }
        MP.drawLine(L, li, x0, y, { cursor: i === this.row && this.ed && !this.onEq ? this.ed.cur : undefined }); y += MP.lineH(ln);
      });
    }
  },
  key(k) {
    const st = S();
    // ▲/▼ first move between numerator and denominator inside a template
    if ((k === '#up' || k === '#down') && this.ed && !this.onEq && this.row >= 0 && this.ed.vert(k === '#down' ? 1 : -1)) return true;
    const seqT = st.mode.graph === 'SEQ';
    if (this.row === -2) {
      if (k === '#up') { this.row = -1; return true; } if (k === '#down') { this.row = 0; this.bind(); return true; }
      if (k === '#left' || k === '#right') { const T = ['n', 'n+1', 'n+2'], i = T.indexOf(st.seqType || 'n'); st.seqType = T[(i + (k === '#left' ? 2 : 1)) % 3]; App.invalidateGraph(); App.save(); return true; }
      return App.isTok(k) || k === '#enter';
    }
    if (seqT && k === '#up' && this.row === 0 && !(this.ed && !this.onEq && this.ed.vert(-1))) { this.sync(); this.row = -2; this.onEq = false; this.bind(); return true; }
    if (seqT && k === '#down' && this.row === -1) { this.row = -2; return true; }
    if (k === '#up') { if (this.row === -1) return true; this.sync(); this.row--; this.onEq = false; this.bind(); if (this.ed) this.ed.cur = this.ed.toks.length; return true; }
    if (k === '#down') { if (this.row === yRows().length - 1) return true; this.sync(); this.row++; this.onEq = false; this.bind(); return true; }
    if (this.row === -1) {
      if (k === '#left') { this.plotIdx = (this.plotIdx + 2) % 3; return true; }
      if (k === '#right') { this.plotIdx = (this.plotIdx + 1) % 3; return true; }
      if (k === '#enter') { st.plots[this.plotIdx].on = !st.plots[this.plotIdx].on; App.save(); return true; }
      return App.isTok(k);
    }
    if (this.onEq && st.appIneq && st.mode.graph === 'FUNCTION' && /^#f[1-5]$/.test(k)) { const o = yRows()[this.row].obj; if (o) { o.ineq = ['=', '<', '≤', '>', '≥'][+k[2] - 1]; App.invalidateGraph(); App.save(); } return true; }
    if (this.onEq) {
      if (k === '#enter') { const o = yRows()[this.row].obj; if (o) { o.on = !o.on; App.invalidateGraph(); App.save(); } return true; }
      if (k === '#right') { this.onEq = false; this.ed.cur = 0; return true; }
      if (k === '#left') return true;
      if (k === '#clear') { this.ed.set([]); this.onEq = false; this.sync(); return true; }
      if (App.isTok(k)) { this.insert(k); return true; }
      if (k === '#del') return true;
    }
    if (k === '#enter') { this.sync(); if (this.row < yRows().length - 1) { this.row++; this.bind(); } return true; }
    if (k === '#clear') { this.ed.set([]); this.sync(); return true; }
    if (k === '#left' && this.ed.cur === 0) { this.onEq = true; return true; }
    if (App.isTok(k)) { this.insert(k); return true; }
    if (this.ed.key(k)) { this.sync(); return true; }
    return false;
  },
  leave() { this.sync(); if (S().ineqShade && ineqSnap() !== this.snap) { S().ineqShade = null; App.save(); } }
};

/* ===================== WINDOW ===================== */
App.windowScreen = function () {
  const w = S().win; const num = (label, key) => ({ kind: 'num', label, get: () => w[key], set: v => { saveZPrev(); w[key] = v; App.save(); } });
  return new App.Form({
    title: 'WINDOW',
    fields: ({ PARAMETRIC: [num('Tmin=', 'Tmin'), num('Tmax=', 'Tmax'), num('Tstep=', 'Tstep')], POLAR: [num('θmin=', 'θmin'), num('θmax=', 'θmax'), num('θstep=', 'θstep')],
      SEQ: [num('nMin=', 'nMin'), num('nMax=', 'nMax'), num('PlotStart=', 'PlotStart'), num('PlotStep=', 'PlotStep')] }[S().mode.graph] || []).concat([num('Xmin=', 'Xmin'), num('Xmax=', 'Xmax'), num('Xscl=', 'Xscl'), num('Ymin=', 'Ymin'), num('Ymax=', 'Ymax'), num('Yscl=', 'Yscl'),
      { kind: 'num', label: 'Xres=', get: () => w.Xres, set: v => { if (!Number.isInteger(v) || v < 1 || v > 8) N.fail('DOMAIN'); w.Xres = v; } },
      { kind: 'num', label: 'ΔX=', get: () => dX(), set: v => { if (v <= 0) N.fail('DOMAIN'); w.Xmax = w.Xmin + (GW - 1) * v; S().traceStep = null; } },
      { kind: 'num', label: 'TraceStep=', get: () => S().traceStep || 2 * dX(), set: v => { if (v <= 0) N.fail('DOMAIN'); S().traceStep = v; } }].filter((f, i, all) => S().mode.graph === 'FUNCTION' || !['Xres=', 'ΔX=', 'TraceStep='].includes(f.label)), S().appTrans && S().mode.graph === 'FUNCTION' ? transSettings() : [])
  });
};
/* Transfrm adds its SETTINGS under WINDOW: >|| (◀▶ step by hand), > (play), >> (play fast), Step, and A–D */
function transSettings() {
  const st = S(), v = k => ({ kind: 'num', label: k + '=', get: () => st.vars[k] || 0, set: x => { st.vars[k] = x; App.save(); } });
  return [{ kind: 'info', label: 'SETTINGS', color: COL.accent },
    { kind: 'choice', label: '', opts: ['>||', '>', '>>'], get: () => st.trnMode || '>||', set: m => { st.trnMode = m; Graph.trPaused = false; App.save(); } },
    v('A'), v('B'), v('C'), v('D'),
    { kind: 'num', label: 'Step=', get: () => st.trnStep || 1, set: x => { if (!(x > 0)) N.fail('DOMAIN'); st.trnStep = x; App.save(); } }];
}
App.tblsetScreen = function () {
  const t = S().tbl;
  return new App.Form({
    title: 'TABLE SETUP',
    fields: [
      { kind: 'num', label: 'TblStart=', get: () => t.start, set: v => { t.start = v; App.save(); } },
      { kind: 'num', label: 'ΔTbl=', get: () => t.step, set: v => { if (v === 0) N.fail('DOMAIN'); t.step = v; App.save(); } },
      { kind: 'choice', label: 'Indpnt: ', opts: ['AUTO', 'ASK'], names: ['Auto', 'Ask'], get: () => t.indpnt, set: v => { t.indpnt = v; App.save(); } },
      { kind: 'choice', label: 'Depend: ', opts: ['AUTO', 'ASK'], names: ['Auto', 'Ask'], get: () => t.depend, set: v => { t.depend = v; App.save(); } }
    ]
  });
};

/* ===================== GRAPH RENDERING ===================== */
const off = document.createElement('canvas'); off.width = GW * App.scale; off.height = GH * App.scale;
const octx = off.getContext('2d'); let lastSig = null;
function applyGeom() {
  const sp = split(); if (sp === GEO) return; GEO = sp;
  [GX, GY, GW, GH] = GEOMS[sp] || GEOMS.FULL; App.GEOM = { GX, GY, GW, GH }; E.graphPx.w = GW - 1; E.graphPx.h = GH - 1;
  off.width = GW * App.scale; off.height = GH * App.scale; lastSig = null; Graph.cx = GW >> 1; Graph.cy = GH >> 1;
}
App.applyGeom = applyGeom;
/* everything that changes the graph except DRAW items (adding a Line( or Text( does not redraw the functions slowly) */
function coreSignature() { const st = S(); return JSON.stringify([st.mode.graph, st.par, st.pol, st.seq, st.win, st.fmt, st.mode.lineStyle, st.mode.angle, E.YN.map(n => [st.Y[n].on, st.Y[n].toks, st.Y[n].color, st.Y[n].ineq]), st.appIneq, st.appIneq && [st.xIneq, st.ineqShade], st.appTrans, st.plots, st.plots.some(p => p.on) ? st.lists : 0, st.vars]); }
let lastCore = null;
/* no gradual drawing while a program runs (DispGraph) or while Transfrm changes A–D */
const instantGraph = () => !!(S().appTrans || (App.Runner && App.Runner.active && !App.Runner.active.done) || App.instantGraph);
App.invalidateGraph = () => { lastSig = null; lastCore = null; };
const BORDERS = App.BORDERS;
const colorHex = (name, dflt) => (App.COLORS.find(c => c[0] === name) || [0, dflt])[1];
/* Image1–Image0 background pictures (data URLs in st.images), decoded once */
const bgImgs = {};
function bgImage(slot) {
  const src = (S().images || {})[slot]; if (!src) return null; let im = bgImgs[slot];
  if (!im || im.src !== src) { im = bgImgs[slot] = new Image(); im.onload = () => { App.invalidateGraph(); App.render(); }; im.src = src; }
  return im.complete && im.naturalWidth ? im : null;
}
function drawBase(instant) {
  stopJob(); const st = S(); const w = st.win, F = st.fmt; const c = octx;
  c.setTransform(App.scale, 0, 0, App.scale, 0, 0); c.fillStyle = F.bg ? colorHex(F.bg, '#fff') : '#fff'; c.fillRect(0, 0, GW, GH);
  if (F.bgImage !== null && F.bgImage !== undefined) { const im = bgImage(F.bgImage); if (im) c.drawImage(im, 0, 0, GW, GH); }
  const lx = x => (x - w.Xmin) / dX(), ly = y => GH - 1 - (y - w.Ymin) / dY();
  // grid
  if (F.grid !== 'OFF' && w.Xscl > 0 && w.Yscl > 0 && (w.Xmax - w.Xmin) / w.Xscl < 200 && (w.Ymax - w.Ymin) / w.Yscl < 200) {
    const gc = colorHex(F.gridColor || 'MEDGRAY', '#a0a0a0'); c.fillStyle = gc; c.strokeStyle = gc; c.globalAlpha = F.grid === 'LINE' ? 0.45 : 1; c.lineWidth = 1;
    const x0 = Math.ceil(w.Xmin / w.Xscl), x1 = Math.floor(w.Xmax / w.Xscl), y0 = Math.ceil(w.Ymin / w.Yscl), y1 = Math.floor(w.Ymax / w.Yscl);
    if (F.grid === 'LINE') { c.beginPath(); for (let i = x0; i <= x1; i++) { const X = Math.round(lx(i * w.Xscl)) + .5; c.moveTo(X, 0); c.lineTo(X, GH); } for (let j = y0; j <= y1; j++) { const Y = Math.round(ly(j * w.Yscl)) + .5; c.moveTo(0, Y); c.lineTo(GW, Y); } c.stroke(); }
    else for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) c.fillRect(Math.round(lx(i * w.Xscl)), Math.round(ly(j * w.Yscl)), 1, 1);
    c.globalAlpha = 1;
  }
  // axes
  if (F.axes) {
    c.strokeStyle = colorHex(F.axesColor || 'BLACK', '#000'); c.lineWidth = 1; c.beginPath();
    const ax = Math.round(ly(0)) + .5, ay = Math.round(lx(0)) + .5;
    if (w.Ymin <= 0 && w.Ymax >= 0) { c.moveTo(0, ax); c.lineTo(GW, ax); }
    if (w.Xmin <= 0 && w.Xmax >= 0) { c.moveTo(ay, 0); c.lineTo(ay, GH); }
    if (w.Xscl > 0 && (w.Xmax - w.Xmin) / w.Xscl < 140 && w.Ymin <= 0 && w.Ymax >= 0) for (let i = Math.ceil(w.Xmin / w.Xscl); i <= Math.floor(w.Xmax / w.Xscl); i++) { const X = Math.round(lx(i * w.Xscl)) + .5; c.moveTo(X, ax - 3); c.lineTo(X, ax + 3); }
    if (w.Yscl > 0 && (w.Ymax - w.Ymin) / w.Yscl < 100 && w.Xmin <= 0 && w.Xmax >= 0) for (let j = Math.ceil(w.Ymin / w.Yscl); j <= Math.floor(w.Ymax / w.Yscl); j++) { const Y = Math.round(ly(j * w.Yscl)) + .5; c.moveTo(ay - 3, Y); c.lineTo(ay + 3, Y); }
    c.stroke();
    if (F.label) { c.fillStyle = '#000'; c.font = 'italic 11px ' + MONO; c.textAlign = 'right'; c.fillText('x', GW - 3, Math.min(GH - 4, Math.max(10, ax - 6))); c.textAlign = 'left'; c.fillText('y', Math.min(GW - 10, Math.max(2, ay + 4)), 10); }
  }
  // draw items: shading first
  st.draw.forEach(d => drawItem(c, d, lx, ly, true));
  // stat plots
  st.plots.forEach((p, i) => { if (p.on) try { drawPlot(c, p, i, lx, ly); } catch (e) { } });
  // functions: each graph is a list of steps (screen columns, or T/θ/n values) so it can be drawn gradually like the CE
  const style = st.mode.lineStyle; const lw = style.includes('THIN') ? 1.2 : 2.2; const dots = style.startsWith('DOT');
  const rel = n => (st.appIneq && gmode() === 'FUNCTION' && st.Y[n].ineq) || '=';
  const ineq = st.appIneq && gmode() === 'FUNCTION', both = ineq && st.ineqShade; // Ineq Intersection / Union shade once for all of them
  if (ineq) ineqShading(c, lx, ly, rel, both);
  const graphs = gmode() === 'FUNCTION'
    ? activeFns().map(n => { const r = rel(n); return { n: Math.ceil(GW / (w.Xres || 1)), it: fnSteps(c, x => fval(n, x), st.Y[n].color, lw, dots, lx, ly, r === '<' || r === '>', r === '=' || both ? null : r) }; })
    : curves().map(cv => ({ n: cv.draw ? 2 * GW : Math.max(1, (cv.range[1] - cv.range[0]) / cv.range[2]), it: curveSteps(c, cv, lw, dots, lx, ly) }));
  const finish = () => st.draw.forEach(d => drawItem(c, d, lx, ly, false));
  if (instant || !graphs.length) { graphs.forEach(g => runSteps(g.it)); finish(); return; }
  job = { graphs, finish, simul: !!st.mode.simul, paused: false };
  job.timer = setTimeout(tick, 0);
}
/* Inequalz: X= lines with their shading, and with Ineq Intersection / Union one shading for every inequality together */
function ineqShading(c, lx, ly, rel, both) {
  const st = S(), w = st.win, xs = xIneqs().map(d => { if (!d.on || !d.toks.length) return null; try { const v = E.evalNumber(d.toks); return isFinite(v) ? { v, r: d.ineq || '=', d } : null; } catch (e) { return null; } }).filter(Boolean);
  const ys = activeFns().map(n => ({ n, r: rel(n) })).filter(o => o.r !== '=');
  const xOk = (o, x) => o.r === '<' ? x < o.v : o.r === '≤' ? x <= o.v : o.r === '>' ? x > o.v : x >= o.v;
  xs.forEach(o => { const X = lx(o.v);
    if (o.r !== '=' && !both) { c.save(); c.globalAlpha = .22; c.fillStyle = o.d.color; if (o.r === '<' || o.r === '≤') c.fillRect(0, 0, Math.max(0, X), GH); else c.fillRect(X, 0, GW - X, GH); c.restore(); }
    c.save(); c.strokeStyle = o.d.color; c.lineWidth = 2; if (o.r === '<' || o.r === '>') c.setLineDash([5, 4]); c.beginPath(); c.moveTo(X, 0); c.lineTo(X, GH); c.stroke(); c.restore(); });
  if (!both) return;
  const xr = xs.filter(o => o.r !== '='); if (!xr.length && !ys.length) return;
  c.save(); c.globalAlpha = .3; c.fillStyle = '#1f4fff';
  for (let i = 0; i < GW; i++) {
    const x = w.Xmin + i * dX(); let lo = -Infinity, hi = Infinity, loU = Infinity, hiU = -Infinity, ok = true, any = false;
    xr.forEach(o => { if (xOk(o, x)) any = true; else ok = false; });
    ys.forEach(o => { const y = fval(o.n, x); if (!isFinite(y)) { ok = false; return; } if (o.r === '>' || o.r === '≥') { lo = Math.max(lo, y); loU = Math.min(loU, y); } else { hi = Math.min(hi, y); hiU = Math.max(hiU, y); } });
    const band = (a, b) => { const Y0 = Math.max(0, Math.min(GH, ly(b))), Y1 = Math.max(0, Math.min(GH, ly(a))); if (Y1 > Y0) c.fillRect(i, Y0, 1, Y1 - Y0); };
    if (st.ineqShade === 'I') { if (ok && lo < hi) band(lo, hi); }
    else if (any) band(-Infinity, Infinity);
    else { if (hiU > -Infinity) band(-Infinity, hiU); if (loU < Infinity) band(loU, Infinity); }
  }
  c.restore();
}
/* gradual drawing: SEQUENTIAL finishes one graph before the next, SIMUL steps them all together.
   A function takes about a second, like the handheld. ENTER pauses, ON stops, any other key finishes at once. */
let job = null, stale = false;
const FRAMES = 60; // the steps of one graph are spread over about this many 16 ms ticks
function advance(g) { const k = Math.max(1, Math.ceil(g.n / FRAMES)); for (let j = 0; j < k; j++) if (g.it.next().done) return true; return false; }
function tick() {
  if (!job || job.paused) return;
  if (job.simul) job.graphs = job.graphs.filter(g => !advance(g));
  else if (advance(job.graphs[0])) job.graphs.shift();
  if (!job.graphs.length) { const j = job; job = null; j.finish(); }
  else job.timer = setTimeout(tick, 16);
  App.render();
}
function stopJob() { if (job) { clearTimeout(job.timer); job = null; } }
function finishJob() { if (!job) return; const j = job; stopJob(); j.graphs.forEach(g => runSteps(g.it)); j.finish(); }
/* keys while a graph is being drawn (called by App.dispatch); true = the key was used up */
App.graphBusy = k => {
  if (!job) return false;
  if (k === '#on') { stopJob(); stale = true; return true; }
  if (k === '#enter' && App.screen === Graph) { job.paused = !job.paused; if (!job.paused) tick(); return true; }
  finishJob(); return false;
};
App.graphDrawing = () => !!job;
App.finishGraph = finishJob;
/* the busy indicator at the right of the status bar: dashes that move while drawing, still dots when paused */
function busyMark() {
  const c = G.ctx, x0 = App.W - 30, y = 22; c.fillStyle = COL.bar; c.fillRect(x0 - 2, y - 4, 30, 8); c.fillStyle = '#ffffff';
  if (job.paused) { for (let i = 0; i < 26; i += 4) c.fillRect(x0 + i, y - 1, 2, 2); return; }
  const o = Math.floor(Date.now() / 60) % 8; for (let i = -8; i < 26; i += 8) { const a = Math.max(0, i + o), b = Math.min(26, i + o + 5); if (b > a) c.fillRect(x0 + a, y - 1, b - a, 2); }
}
/* one step per screen column; shade (Inequalz) fills toward the top or bottom; dash keeps the dashes even across steps */
function* fnSteps(c, f, color, lw, dots, lx, ly, dash, shade) {
  const st = S(), w = st.win; const step = w.Xres || 1;
  let prev = null, len = 0;
  const clampY = Y => Math.max(-2000, Math.min(2000, Y));
  for (let i = 0; i < GW; i += step) {
    const x = w.Xmin + i * dX(); const y = f(x);
    if (!isFinite(y)) { prev = null; yield; continue; }
    const Y = clampY(ly(y));
    if (shade) { c.save(); c.globalAlpha = .22; c.fillStyle = color; const Ys = Math.max(0, Math.min(GH, Y)); if (shade === '>' || shade === '≥') c.fillRect(i, 0, step, Ys); else c.fillRect(i, Ys, step, GH - Ys); c.restore(); }
    c.strokeStyle = color; c.fillStyle = color; c.lineWidth = lw; c.lineJoin = 'round'; c.lineCap = dash ? 'butt' : 'round';
    if (dots) { c.fillRect(i - lw / 2, Y - lw / 2, lw, lw); prev = null; yield; continue; }
    if (prev) {
      let brk = false;
      if (st.fmt.detectAsym && Math.abs(Y - prev.Y) > GH * 0.6) {
        const ym = f(x - dX() * step / 2);
        if (!isFinite(ym) || ym > Math.max(y, prev.y) + Math.abs(y - prev.y) || ym < Math.min(y, prev.y) - Math.abs(y - prev.y) || (Math.sign(y) !== Math.sign(prev.y) && Math.abs(ym) > Math.max(Math.abs(y), Math.abs(prev.y)))) brk = true;
      }
      if (!brk) { c.setLineDash(dash ? [5, 4] : []); c.lineDashOffset = len; c.beginPath(); c.moveTo(prev.X, prev.Y); c.lineTo(i, Y); c.stroke(); len += Math.hypot(i - prev.X, Y - prev.Y); c.setLineDash([]); c.lineDashOffset = 0; }
    }
    prev = { X: i, Y, y };
    yield;
  }
}
const plotFn = (c, f, color, lw, dots, lx, ly) => runSteps(fnSteps(c, f, color, lw, dots, lx, ly));
function mark(c, m, X, Y, color) {
  c.fillStyle = color; c.strokeStyle = color; c.lineWidth = 1;
  if (m === '□') c.strokeRect(Math.round(X) - 2.5, Math.round(Y) - 2.5, 5, 5);
  else if (m === '+') { c.beginPath(); c.moveTo(X - 3, Y); c.lineTo(X + 3, Y); c.moveTo(X, Y - 3); c.lineTo(X, Y + 3); c.stroke(); }
  else if (m === '▪') c.fillRect(X - 1.5, Y - 1.5, 3, 3);
  else c.fillRect(X - 1, Y - 1, 2, 2); // '·' dot
}
App.drawMark = mark;
function plotLists(p) {
  const st = S(); const xs = st.lists[p.x] || []; const ys = p.y ? (st.lists[p.y] || []) : [];
  let fr = null; if (p.freq && p.freq !== '1') { fr = st.lists[p.freq] || null; }
  return { xs, ys, fr };
}
function drawPlot(c, p, idx, lx, ly) {
  const { xs, ys, fr } = plotLists(p); const st = S(); const w = st.win;
  if (p.type === 'scatter' || p.type === 'xyLine') {
    const n = Math.min(xs.length, ys.length); if (!n) return;
    if (p.type === 'xyLine') { c.strokeStyle = p.color; c.lineWidth = 1.5; c.beginPath(); for (let i = 0; i < n; i++) { const X = lx(xs[i]), Y = ly(ys[i]); i ? c.lineTo(X, Y) : c.moveTo(X, Y); } c.stroke(); }
    for (let i = 0; i < n; i++) mark(c, p.mark, lx(xs[i]), ly(ys[i]), p.color);
  } else if (p.type === 'normprob') {
    const xs2 = xs.slice().sort((a, b) => a - b), n = xs2.length;
    xs2.forEach((x, i) => { const z = N.invNorm((i + 0.5) / n); const [X, Y] = (p.axis || 'X') === 'X' ? [x, z] : [z, x]; mark(c, p.mark, lx(X), ly(Y), p.color); });
  } else if (p.type === 'histogram') {
    if (!(w.Xscl > 0)) return; const bins = new Map();
    xs.forEach((x, i) => { const b = Math.floor((x - w.Xmin) / w.Xscl + 1e-9); bins.set(b, (bins.get(b) || 0) + (fr ? fr[i] : 1)); });
    c.strokeStyle = p.color; c.fillStyle = p.color + '33'; c.lineWidth = 1;
    bins.forEach((h, b) => { const x0 = lx(w.Xmin + b * w.Xscl), x1 = lx(w.Xmin + (b + 1) * w.Xscl), y0 = ly(0), y1 = ly(h); c.fillRect(x0, y1, x1 - x0, y0 - y1); c.strokeRect(Math.round(x0) + .5, Math.round(y1) + .5, Math.round(x1 - x0), Math.round(y0 - y1)); });
  } else if (p.type === 'box' || p.type === 'modbox') {
    const s = N.oneVar(xs, fr || undefined); const band = [GH * 0.22, GH * 0.5, GH * 0.78][idx]; const hh = 10;
    let lo = s.minX, hi = s.maxX; const iqr = s.Q3 - s.Q1; const out = [];
    if (p.type === 'modbox') { const lf = s.Q1 - 1.5 * iqr, uf = s.Q3 + 1.5 * iqr; const inside = xs.filter(x => x >= lf && x <= uf); lo = Math.min(...inside); hi = Math.max(...inside); xs.forEach(x => { if (x < lf || x > uf) out.push(x); }); }
    c.strokeStyle = p.color; c.lineWidth = 1.2; c.beginPath();
    c.moveTo(lx(lo), band); c.lineTo(lx(s.Q1), band); c.moveTo(lx(s.Q3), band); c.lineTo(lx(hi), band);
    c.rect(lx(s.Q1), band - hh, lx(s.Q3) - lx(s.Q1), 2 * hh); c.moveTo(lx(s.Med), band - hh); c.lineTo(lx(s.Med), band + hh); c.stroke();
    out.forEach(x => mark(c, p.mark, lx(x), band, p.color));
  }
}
function drawItem(c, d, lx, ly, shadePass) {
  const w = S().win; c.lineWidth = 1.5; c.strokeStyle = d.color || '#111'; c.fillStyle = d.color || '#111';
  const isShade = d.t === 'shade' || d.t === 'shadeDist';
  if (shadePass !== isShade) return;
  try {
    switch (d.t) {
      case 'h': c.beginPath(); c.moveTo(0, ly(d.y)); c.lineTo(GW, ly(d.y)); c.stroke(); break;
      case 'v': c.beginPath(); c.moveTo(lx(d.x), 0); c.lineTo(lx(d.x), GH); c.stroke(); break;
      case 'line': c.beginPath(); c.moveTo(lx(d.x1), ly(d.y1)); c.lineTo(lx(d.x2), ly(d.y2)); c.stroke(); break;
      case 'circle': c.beginPath(); c.ellipse(lx(d.x), ly(d.y), Math.abs(d.r / dX()), Math.abs(d.r / dY()), 0, 0, 2 * Math.PI); c.stroke(); break;
      case 'pt': mark(c, d.mark || '▪', lx(d.x), ly(d.y), d.off ? '#ffffff' : c.fillStyle); break;
      case 'conic': drawConic(c, d, lx, ly); break;
      case 'pxl': c.fillStyle = d.off ? '#ffffff' : c.fillStyle; c.fillRect(d.col, d.row, 1, 1); break;
      case 'text': c.font = '10px ' + MONO; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillStyle = d.color || '#111'; c.fillText(d.s, d.col, d.row); c.textBaseline = 'middle'; break;
      case 'fn': plotFn(c, x => { try { return E.evalAt(d.toks, x); } catch (e) { return NaN; } }, d.color || '#111', 1.5, false, lx, ly); break;
      case 'tangent': plotFn(c, x => d.y0 + d.m * (x - d.x0), d.color || '#111', 1.2, false, lx, ly); break;
      case 'inv': { c.beginPath(); let first = true; for (let j = 0; j <= 600; j++) { const t = w.Ymin + (w.Ymax - w.Ymin) * j / 600; let xv; try { xv = E.evalAt(d.toks, t); } catch (e) { first = true; continue; } if (!isFinite(xv)) { first = true; continue; } const X = lx(xv), Y = ly(t); first ? c.moveTo(X, Y) : c.lineTo(X, Y); first = false; } c.stroke(); break; }
      case 'shade': case 'shadeDist': {
        c.fillStyle = d.t === 'shadeDist' ? (d.color || '#1f4fff') : 'rgba(17,17,17,.28)'; if (d.t === 'shadeDist') c.globalAlpha = .45;
        for (let i = 0; i < GW; i++) { const x = w.Xmin + i * dX(); if (x < d.xl || x > d.xr) continue; let a, b; try { a = d.lo(x); b = d.hi(x); } catch (e) { continue; } if (!isFinite(a) || !isFinite(b) || b < a) continue; const y1 = ly(b), y0 = ly(a); c.fillRect(i - .5, y1, 1, y0 - y1); }
        c.globalAlpha = 1; if (d.t === 'shadeDist') plotFn(c, d.hi, '#111', 1.5, false, lx, ly);
        break;
      }
    }
  } catch (e) { }
}

/* Conics app: circle, ellipse, hyperbola, parabola from their numbers (kept in st.draw so they survive a reload) */
function drawConic(c, d, lx, ly) {
  const w = S().win, { h, k } = d, pts = [], N2 = 720; c.strokeStyle = d.color || '#1f4fff'; c.lineWidth = 2;
  const path = f => { c.beginPath(); let first = true; for (let i = 0; i <= N2; i++) { const p = f(i / N2); if (!p || !isFinite(p[0]) || !isFinite(p[1])) { first = true; continue; } const X = lx(p[0]), Y = ly(p[1]); if (first) c.moveTo(X, Y); else c.lineTo(X, Y); first = false; } c.stroke(); };
  const span = Math.max(w.Xmax - w.Xmin, w.Ymax - w.Ymin) * 2;
  if (d.kind === 'circle' || d.kind === 'ellipse') { const a = d.kind === 'circle' ? d.r : d.a, b = d.kind === 'circle' ? d.r : d.b; path(t => [h + a * Math.cos(2 * Math.PI * t), k + b * Math.sin(2 * Math.PI * t)]); }
  else if (d.kind === 'hypX' || d.kind === 'hypY') { const U = Math.acosh(Math.max(2, span / Math.min(d.a, d.b) + 2)); [1, -1].forEach(sg => path(t => { const u = -U + 2 * U * t, p = sg * d.a * Math.cosh(u), q = d.b * Math.sinh(u); return d.kind === 'hypX' ? [h + p, k + q] : [h + q, k + p]; })); }
  else { const S2 = Math.sqrt(Math.abs(4 * d.p) * span) + span; path(t => { const s = -S2 + 2 * S2 * t, q = s * s / (4 * d.p); return d.kind === 'parX' ? [h + s, k + q] : [h + q, k + s]; }); }
}

/* ===================== GRAPH SCREEN ===================== */
const Graph = App.graph = {
  mode: 'idle', cx: 132, cy: 82, fnList: [], fi: 0, x: 0, entry: null, calc: null, note: null, shade: null, zbox: null,
  enter() {
    if (stale) { stale = false; App.invalidateGraph(); } // ON stopped the last drawing: GRAPH draws it again
    try { validateWindow(); } catch (e) { setTimeout(() => App.showError(e, { quit: () => App.setScreen(App.windowScreen()) }), 0); return; }
    if (this.mode === 'trace' || this.mode === 'calc') this.refreshFns();
  },
  leave() { this.parCalc = null; this.parResult = null; this.mode = 'idle'; this.calc = null; this.entry = null; this.shade = null; this.resultLabel = null; },
  refreshFns() { this.fnList = gmode() === 'FUNCTION' ? activeFns() : curves(); if (this.fi >= this.fnList.length) this.fi = 0; },
  isPar() { return gmode() !== 'FUNCTION'; },
  pPoint() { const cv = this.cur(); return cv ? E.seqBatch(() => cv.point(this.p)) : [NaN, NaN]; },
  cur() { return this.fnList[this.fi]; },
  step() { return S().traceStep || 2 * dX(); },
  startTrace(keepX) {
    this.refreshFns(); if (!this.fnList.length) { this.mode = 'free'; App.flash('No function selected in Y='); return; }
    this.mode = 'trace'; this.parCalc = null; this.parResult = null; if (!keepX) this.x = N.r12(xOfPx(GW >> 1)); this.resultLabel = null;
    if (this.isPar() && (!keepX || this.p === undefined)) this.p = this.cur().range[0];
  },
  ensureVisible() { // pan horizontally if trace x off screen
    const w = S().win; if (this.x < w.Xmin || this.x > w.Xmax) { const span = w.Xmax - w.Xmin; const nx = this.x - span / 2; Object.assign(w, { Xmin: nx, Xmax: nx + span }); App.save(); }
  },
  render(noStatus) {
    applyGeom(); const st = S(); try { validateWindow(); } catch (e) { G.clear(); G.status(''); return; }
    const core = coreSignature(), sig = core + JSON.stringify(st.draw);
    if (sig !== lastSig) { drawBase(core === lastCore || instantGraph()); lastSig = sig; lastCore = core; }
    const c = G.ctx; if (!noStatus) G.status(this.statusLine()); c.fillStyle = BORDERS[(S().fmt.border || 1) - 1]; c.fillRect(...PANES[GEO]);
    c.drawImage(off, GX, GY, GW, GH);
    c.save(); c.beginPath(); c.rect(GX, GY, GW, GH); c.clip();
    if (this.shade) { const s = this.shade; c.fillStyle = 'rgba(31,79,255,.35)'; for (let i = 0; i < GW; i++) { const x = xOfPx(i); if (x < s.a || x > s.b) continue; const y = fval(s.fn, x); if (!isFinite(y)) continue; const y0 = py(0), y1 = py(y); c.fillRect(GX + i - .5, Math.min(y0, y1), 1, Math.abs(y1 - y0)); } }
    if (this.calc && this.calc.left !== undefined) this.boundMark(this.calc.left, '▶'); if (this.calc && this.calc.right !== undefined) this.boundMark(this.calc.right, '◀');
    if (this.zbox) { c.strokeStyle = '#000'; c.setLineDash([3, 2]); c.lineWidth = 1; c.strokeRect(GX + Math.min(this.zbox.x, this.cx) + .5, GY + Math.min(this.zbox.y, this.cy) + .5, Math.abs(this.cx - this.zbox.x), Math.abs(this.cy - this.zbox.y)); c.setLineDash([]); }
    // cursor
    if (this.mode === 'free' || this.mode === 'zoomcur' || this.mode === 'zbox' || this.mode === 'tool' || (this.mode === 'calc' && this.calc.free)) this.crosshair(GX + this.cx, GY + this.cy);
    else if (this.mode === 'trace' && this.isPar() && this.cur()) { const [x, y] = this.pPoint(); if (isFinite(x) && isFinite(y)) this.traceCursor(px(x), py(y), this.cur().color); }
    else if ((this.mode === 'trace' || this.mode === 'calc') && this.cur()) { const y = this.traceY(); if (isFinite(y)) this.traceCursor(px(this.x), py(y), st.Y[this.cur()].color); }
    if (this.mode === 'tool' && this.tool.draw) this.tool.draw(c);
    if (this.mode === 'trace' && this.isPar() && this.cur() && this.cur().web) { const cv = this.cur(); c.strokeStyle = cv.color; c.lineWidth = 1.2; c.beginPath(); E.seqBatch(() => { for (let s = 0; s <= this.p; s++) { const [x, y] = cv.point(s); if (!isFinite(x) || !isFinite(y)) break; if (s) c.lineTo(px(x), py(y)); else c.moveTo(px(x), py(y)); } }); c.stroke(); }
    c.restore();
    if (job && !noStatus) busyMark();
    this.overlayText();
    if (this.mode === 'tool' && this.tool.top) this.textBar(GY + 8, this.tool.top(), '#000');
    if (this.mode === 'idle' && !this.entry && S().appTrans && gmode() === 'FUNCTION') { const vs = this.transVars(); if (vs.length) { if (!vs.includes(this.trVar)) this.trVar = vs[0]; this.textBar(GY + 8, ((st.trnMode || '>||') === '>||' ? '' : this.trPaused ? '|| ' : st.trnMode + ' ') + vs.map(v => (v === this.trVar ? '▶' : ' ') + v + '=' + niceNum(st.vars[v] || 0)).join(' '), '#000'); } }
  },
  traceY() { if (this.calc && this.calc.sel2 && this.mode === 'calc') { } return fval(this.cur(), this.x); },
  statusLine() {
    if (this.mode === 'trace' && this.parCalc) return 'CALC ' + ({ dydx: 'DY/DX', dydt: 'DY/DT', dxdt: 'DX/DT', drdt: 'DR/DΘ' })[this.parCalc];
    if (this.mode === 'tool') return this.tool.status();
    if (this.mode === 'calc' && this.calc) return 'CALC ' + ({ value: 'VALUE', zero: 'ZERO', minimum: 'MINIMUM', maximum: 'MAXIMUM', intersect: 'INTERSECT', dydx: 'DY/DX', integral: '∫F(X)DX' })[this.calc.kind || this.calc.type] ;
    if (this.mode === 'trace') return this.resultLabel && this.calcDone ? 'CALC ' + ({ zero: 'ZERO', minimum: 'MINIMUM', maximum: 'MAXIMUM', intersect: 'INTERSECT' })[this.calcDone] : '';
    if (this.mode === 'zoomcur') return this.zoomKind === 'int' ? 'ZInteger: move cursor, ENTER' : 'Zoom ' + (this.zoomKind === 'in' ? 'In' : 'Out') + ': move cursor, ENTER';
    if (this.mode === 'zbox') return this.zbox ? 'ZBox: move to 2nd corner, ENTER' : 'ZBox: move to 1st corner, ENTER';
    if (this.mode === 'idle' && !App.flashMsg && S().appIneq && gmode() === 'FUNCTION') return 'SHADES: [alpha][f1]';
    return App.flashMsg || '';
  },
  crosshair(X, Y) { const c = G.ctx; c.strokeStyle = '#000'; c.lineWidth = 1; c.beginPath(); c.moveTo(X - 4, Y + .5); c.lineTo(X + 5, Y + .5); c.moveTo(X + .5, Y - 4); c.lineTo(X + .5, Y + 5); c.stroke(); },
  traceCursor(X, Y, color) {
    const c = G.ctx; c.strokeStyle = App.blinkOn ? '#000' : color; c.lineWidth = 1.5; c.strokeRect(X - 3.5, Y - 3.5, 7, 7);
    c.beginPath(); c.moveTo(X - 7, Y); c.lineTo(X - 4, Y); c.moveTo(X + 4, Y); c.lineTo(X + 7, Y); c.moveTo(X, Y - 7); c.lineTo(X, Y - 4); c.moveTo(X, Y + 4); c.lineTo(X, Y + 7); c.stroke();
  },
  boundMark(x, ch) { // a thin line through the graph with a small triangle at the top, like the CE
    const X = Math.round(px(x)) + .5, c = G.ctx, col = (S().Y[this.cur()] || {}).color || '#1f4fff';
    c.strokeStyle = col; c.globalAlpha = .55; c.lineWidth = 1; c.beginPath(); c.moveTo(X, GY); c.lineTo(X, GY + GH); c.stroke(); c.globalAlpha = 1;
    c.fillStyle = col; c.beginPath(); const d = ch === '▶' ? 1 : -1; c.moveTo(X, GY + 1); c.lineTo(X + 5 * d, GY + 4.5); c.lineTo(X, GY + 8); c.closePath(); c.fill();
  },
  textBar(y, txt, color = '#000', align = 'left', bold = false) {
    const c = G.ctx; c.font = (bold ? 'bold ' : '') + '12.5px ' + MONO; const w = c.measureText(txt).width;
    const x = typeof align === 'number' ? align : align === 'left' ? GX + 2 : GX + GW - 2 - w; c.fillStyle = 'rgba(255,255,255,.92)'; c.fillRect(x - 2, y - 7, w + 4, 14);
    c.fillStyle = color; c.textAlign = 'left'; c.fillText(txt, x, y);
  },
  overlayText() {
    const st = S(); const F = st.fmt; const bot = GY + GH - 8, bot2 = GY + GH - 22;
    if (this.mode === 'trace' && this.isPar() && this.cur()) { // like the CE: equations on top, T=/θ=/n= then X= and Y= at the bottom
      const cv = this.cur(), [x, y] = this.pPoint();
      if (F.expr) { this.textBar(GY + 8, cv.labels[0].slice(0, 20), cv.color); if (cv.labels[1]) this.textBar(GY + 8, cv.labels[1].slice(0, 20), cv.color, GX + GW / 2); }
      if (!this.entry && this.parResult) { this.textBar(bot2, PVAR[gmode()] + '=' + niceNum(N.r12(this.p)), cv.color); this.textBar(bot, this.parResult, cv.color); }
      else if (!this.entry) { this.textBar(bot2, PVAR[gmode()] + '=' + niceNum(N.r12(this.p)), cv.color); const [tx, ty] = xyText(x, y); this.textBar(bot, tx, cv.color); this.textBar(bot, ty, cv.color, GX + GW / 2 - 20); }
    } else if ((this.mode === 'trace' || this.mode === 'calc') && this.cur() && !(this.calc && this.calc.free)) {
      const n = this.cur(); if (F.expr) this.textBar(GY + 8, n + '=' + E.tokText(st.Y[n].toks).slice(0, 34), st.Y[n].color);
      if (!this.entry) { const y = fval(n, this.x); if (F.coord || this.resultLabel) { const col = st.Y[n].color; const [tx, ty] = xyText(this.x, y); this.textBar(bot, tx, col); this.textBar(bot, ty, col, GX + GW / 2 - 20); } } // like the CE: X= left, Y= mid, in the function's color
    } else if ((this.mode === 'free' || this.mode === 'zoomcur' || this.mode === 'zbox' || this.mode === 'tool') && F.coord) {
      const [tx, ty] = xyText(xOfPx(this.cx), yOfPx(this.cy)); this.textBar(bot, tx); this.textBar(bot, ty, '#000', GX + GW / 2 - 20);
    }
    if (this.calc && this.calc.prompt) this.textBar(bot2, this.calc.prompt, '#000', 'left', true);
    if (this.resultLabel) this.textBar(bot2, this.resultLabel, (S().Y[this.cur()] || {}).color || '#000', 'left', true);
    if (this.entry) { const c = G.ctx; c.fillStyle = '#fff'; c.fillRect(GX, bot - 8, GW, 16); App.entryLine(this.entry.label, this.entry.ed, GX + 2, bot, GRIDS.small); }
    if (this.note) { const n = this.note.length; this.note.forEach((t, i) => { const y = GY + GH - 8 - (n - 1 - i) * 14; if (Array.isArray(t)) { this.textBar(y, t[0], this.noteColor || '#000'); this.textBar(y, t[1], this.noteColor || '#000', GX + GW / 2 - 20); } else this.textBar(y, t, this.noteColor || '#000'); }); }
  },
  /* -------- keys -------- */
  key(k) {
    if (this.entry) return this.entryKey(k);
    switch (this.mode) {
      case 'idle': return this.idleKey(k);
      case 'free': return this.freeKey(k);
      case 'trace': return this.traceKey(k);
      case 'calc': return this.calcKey(k);
      case 'zoomcur': return this.zoomKey(k);
      case 'zbox': return this.zboxKey(k);
      case 'tool': return this.toolKey(k);
    }
    return false;
  },
  moveFree(k) { const d = { '#left': [-1, 0], '#right': [1, 0], '#up': [0, -1], '#down': [0, 1] }[k]; if (!d) return false; this.cx = Math.max(0, Math.min(GW - 1, this.cx + d[0])); this.cy = Math.max(0, Math.min(GH - 1, this.cy + d[1])); return true; },
  idleKey(k) {
    if (S().appTrans && gmode() === 'FUNCTION' && this.transKey(k)) return true;
    if (k === '#f1' && S().appIneq && gmode() === 'FUNCTION') { // Inequalz SHADES menu
      const set = v => () => { S().ineqShade = v; App.save(); App.setScreen(Graph); };
      App.setScreen(new App.Menu([{ name: 'SHADES', items: [{ label: 'Ineq Intersection', run: set('I') }, { label: 'Ineq Union', run: set('U') }] }], Graph, { title: 'SHADES' })); return true;
    }
    if (['#left', '#right', '#up', '#down'].includes(k)) { this.note = null; this.mode = 'free'; this.cx = GW >> 1; this.cy = GH >> 1; return true; }
    if (k === '#clear' || k === '#enter') { this.note = null; App.setScreen(App.home); return true; }
    return false;
  },
  transVars() { const st = S(), used = new Set([].concat(...activeFns().map(n => st.Y[n].toks))); return ['A', 'B', 'C', 'D'].filter(v => used.has(v)); },
  transKey(k) {
    const vs = this.transVars(); if (!vs.length) return false; const st = S(); if (!vs.includes(this.trVar)) this.trVar = vs[0];
    if (k === '#up' || k === '#down') { this.trVar = vs[(vs.indexOf(this.trVar) + (k === '#down' ? 1 : vs.length - 1)) % vs.length]; return true; }
    const play = (st.trnMode || '>||') !== '>||';
    if (play && k === '#enter') { this.trPaused = !this.trPaused; App.save(); return true; } // ENTER pauses / plays
    if (k === '#left' || k === '#right') { this.trDir = k === '#right' ? 1 : -1; st.vars[this.trVar] = N.r12((st.vars[this.trVar] || 0) + this.trDir * (st.trnStep || 1)); App.invalidateGraph(); App.save(); return true; }
    if (App.isTok(k) && /^[0-9.⁻]$/.test(k)) { const v = this.trVar; this.openEntry(v + '=', x => { st.vars[v] = x; App.invalidateGraph(); App.save(); }, k); return true; }
    return false;
  },
  freeKey(k) {
    if (this.moveFree(k)) return true;
    if (k === '#clear') { this.mode = 'idle'; return true; }
    if (k === '#enter') return true;
    return false;
  },
  traceKey(k) {
    const st = S();
    if (this.isPar()) { // trace by T, θ or n
      const cv = this.cur(); if (!cv) return k[0] !== '#';
      const [a, b, s] = cv.range;
      if (k === '#left' || k === '#right') { this.parResult = null; this.p = N.r12(Math.min(b, Math.max(a, this.p + (k === '#left' ? -s : s)))); return true; }
      if (k === '#enter' && this.parCalc) { this.parDeriv(); return true; }
      if (k === '#up' || k === '#down') { if (this.fnList.length) this.fi = (this.fi + (k === '#up' ? -1 : 1) + this.fnList.length) % this.fnList.length; return true; }
      if (k === '#enter') { const [x, y] = this.pPoint(), w = st.win; if (isFinite(x) && isFinite(y)) setWin({ Xmin: x - (w.Xmax - w.Xmin) / 2, Xmax: x + (w.Xmax - w.Xmin) / 2, Ymin: y - (w.Ymax - w.Ymin) / 2, Ymax: y + (w.Ymax - w.Ymin) / 2 }); return true; }
      if (k === '#clear') { this.mode = 'idle'; return true; }
      if (App.isTok(k) && /^[0-9.⁻(πe]$|^ᴇ$/.test(k)) { this.openEntry(PVAR[gmode()] + '=', v => { this.p = v; if (this.parCalc) this.parDeriv(); }, k); return true; }
      if (App.isTok(k)) return true;
      this.mode = 'idle'; this.parCalc = null; return false;
    }
    if (k === '#left' || k === '#right') { this.resultLabel = null; this.x = N.r12(this.x + (k === '#left' ? -1 : 1) * this.step()); this.ensureVisible(); this.storeXY(); return true; }
    if (k === '#up' || k === '#down') { if (this.fnList.length) { this.fi = (this.fi + (k === '#up' ? -1 : 1) + this.fnList.length) % this.fnList.length; } this.storeXY(); return true; }
    if (k === '#enter') { const w = st.win, span = w.Xmax - w.Xmin; setWin({ Xmin: this.x - span / 2, Xmax: this.x + span / 2 }); const y = fval(this.cur(), this.x); if (isFinite(y)) { const sh = (w.Ymax - w.Ymin); setWin({ Ymin: y - sh / 2, Ymax: y + sh / 2 }); } return true; }
    if (k === '#clear') { this.mode = 'idle'; this.resultLabel = null; return true; }
    if (k === '#trace') { this.startTrace(true); return true; }
    if (App.isTok(k) && /^[0-9.⁻(πe]$|^ᴇ$/.test(k)) { this.openEntry('X=', v => { this.x = v; this.ensureVisible(); this.storeXY(); }, k); return true; }
    return false;
  },
  storeXY() { const y = fval(this.cur(), this.x); S().vars.X = this.x; if (isFinite(y)) S().vars.Y = y; },
  openEntry(label, cb, first) { this.entry = { label, cb, ed: new App.LineEditor() }; if (first) this.entry.ed.insert(first); },
  entryKey(k) {
    const en = this.entry;
    if (k === '#enter') {
      try { const v = E.evalNumber(en.ed.toks); const w = S().win; if (en.label === 'X=' && (v < w.Xmin || v > w.Xmax)) N.fail('INVALID'); this.entry = null; en.cb(v); }
      catch (err) { this.entry = null; App.showError(err, { quit: () => App.setScreen(Graph) }); }
      return true;
    }
    if (k === '#clear') { if (en.ed.empty) this.entry = null; else en.ed.set([]); return true; }
    if (App.isTok(k)) { en.ed.insert(k); return true; }
    return en.ed.key(k) || true;
  },
  insert(t) { if (this.entry) this.entry.ed.insert(t); else { App.setScreen(App.home); App.home.insert(t); } },
  /* -------- CALC menu -------- */
  startCalc(type) {
    if (this.isPar()) { // PARAMETRIC/POLAR/SEQ: value asks for T, θ or n and traces there
      this.refreshFns(); if (!this.fnList.length) { App.setScreen(Graph); App.flash('Select an equation in Y= first'); return; }
      this.mode = 'trace'; this.p = this.cur().range[0]; App.setScreen(Graph); this.parCalc = type === 'value' ? null : type; this.parResult = null;
      if (!this.parCalc) this.openEntry(PVAR[gmode()] + '=', v => { this.p = v; });
      return;
    }
    this.refreshFns(); this.shade = null; this.resultLabel = null; this.note = null; this.calcDone = null;
    if (!this.fnList.length) { App.setScreen(Graph); App.flash('Select a function in Y= first'); return; }
    this.mode = 'calc'; this.x = N.r12(xOfPx(GW >> 1));
    const prompts = { value: null, zero: 'LeftBound?', minimum: 'LeftBound?', maximum: 'LeftBound?', intersect: 'First curve?', dydx: null, integral: 'Lower Limit?' };
    this.calc = { type, step: 0, prompt: prompts[type] };
    if (type === 'value') { this.calc.prompt = null; this.openEntry('X=', v => { this.x = v; this.mode = 'trace'; this.calc = null; this.storeXY(); }); }
    if (type === 'dydx') this.calc.prompt = 'dy/dx: move cursor, ENTER';
    App.setScreen(Graph);
  },
  calcKey(k) {
    const C = this.calc;
    if (k === '#clear') { this.mode = 'idle'; this.calc = null; return true; }
    if (k === '#left' || k === '#right') { this.x = N.r12(this.x + (k === '#left' ? -1 : 1) * this.step()); this.ensureVisible(); return true; }
    if (k === '#up' || k === '#down') {
      const allowSwitch = !(C.type === 'intersect' && C.step === 2) && !(['zero', 'minimum', 'maximum', 'integral'].includes(C.type) && C.step > 0);
      if (allowSwitch && this.fnList.length > 1) this.fi = (this.fi + (k === '#up' ? -1 : 1) + this.fnList.length) % this.fnList.length; return true;
    }
    if (App.isTok(k) && /^[0-9.⁻(πe]$|^ᴇ$/.test(k)) { this.openEntry('X=', v => { this.x = v; this.calcEnter(); }, k); return true; }
    if (k === '#enter') { this.calcEnter(); return true; }
    if (App.isTok(k)) return true;
    this.mode = 'idle'; this.calc = null; return false; // GRAPH, TRACE, ZOOM… leave CALC
  },
  /* PARAMETRIC/POLAR CALC: dy/dx, dy/dt, dx/dt, dr/dθ at the traced T or θ (centered difference, like nDeriv) */
  parDeriv() {
    const cv = this.cur(), t = this.p, h = 1e-3;
    const d = f => (E.seqBatch(() => f(t + h)) - E.seqBatch(() => f(t - h))) / (2 * h);
    const dx = d(u => cv.point(u)[0]), dy = d(u => cv.point(u)[1]);
    const v = { dydx: dy / dx, dydt: dy, dxdt: dx, drdt: d(cv.cols[0].val) }[this.parCalc];
    const name = { dydx: 'dy/dx', dydt: 'dy/dt', dxdt: 'dx/dt', drdt: 'dr/dθ' }[this.parCalc];
    this.parResult = name + '=' + (isFinite(v) ? niceNum(N.r12(Number(v.toPrecision(10)))) : 'undefined');
  },
  calcEnter() {
    const C = this.calc, fn = this.cur(); const f = x => fval(fn, x);
    const done = (label, x, y) => { if (!isFinite(y)) N.fail('NO SIGN CHANGE'); this.mode = 'trace'; this.calcDone = C.type; this.calc = null; this.x = x; this.ensureVisible(); this.resultLabel = label; S().vars.X = x; S().vars.Y = y; App.save(); };
    try {
      switch (C.type) {
        case 'zero': case 'minimum': case 'maximum':
          if (C.step === 0) { C.left = this.x; C.step = 1; C.prompt = 'RightBound?'; return; }
          if (C.step === 1) { if (this.x <= C.left) { App.flash('Right bound must be right of left'); return; } C.right = this.x; C.step = 2; C.prompt = 'Guess?'; this.x = N.r12((C.left + C.right) / 2); return; }
          if (C.step === 2) {
            const g = Math.min(Math.max(this.x, C.left), C.right); let x;
            if (C.type === 'zero') x = N.zeroIn(f, C.left, C.right, g);
            else x = N.extremum(f, C.left, C.right, C.type === 'maximum');
            const y = f(x); done(C.type === 'zero' ? 'Zero' : (C.type === 'minimum' ? 'Minimum' : 'Maximum'), x, C.type === 'zero' && Math.abs(y) < 1e-10 ? 0 : y);
          }
          return;
        case 'intersect':
          if (C.step === 0) { C.f1 = fn; C.step = 1; C.prompt = 'Second curve?'; if (this.fnList.length > 1) this.fi = (this.fi + 1) % this.fnList.length; return; }
          if (C.step === 1) { if (fn === C.f1) { App.flash('Choose a different curve'); return; } C.f2 = fn; C.step = 2; C.prompt = 'Guess?'; return; }
          if (C.step === 2) {
            const f1 = x => fval(C.f1, x), f2 = x => fval(C.f2, x);
            const x = N.solveNear(t => f1(t) - f2(t), this.x, S().win.Xmin - (S().win.Xmax - S().win.Xmin), S().win.Xmax + (S().win.Xmax - S().win.Xmin));
            this.fi = this.fnList.indexOf(C.f1); done('Intersection', N.snap(x), f1(N.snap(x)));
          }
          return;
        case 'dydx': { const h = 1e-3; const d = (f(this.x + h) - f(this.x - h)) / (2 * h); this.mode = 'trace'; this.calc = null; this.resultLabel = 'dy/dx=' + niceNum(N.r12(d)); S().ans = d; return; }
        case 'integral':
          if (C.step === 0) { C.left = this.x; C.step = 1; C.prompt = 'Upper Limit?'; return; }
          if (C.step === 1) { const a = C.left, b = this.x; const v = N.integrate(f, a, b); this.shade = { fn, a: Math.min(a, b), b: Math.max(a, b) }; this.mode = 'trace'; this.calc = null; this.resultLabel = '∫f(x)dx=' + niceNum(N.r12(v)); S().ans = v; return; }
      }
    } catch (err) { this.mode = 'idle'; this.calc = null; App.showError(err, { quit: () => App.setScreen(Graph) }); }
  },
  /* -------- zoom with cursor -------- */
  startZoomCursor(kind) { this.mode = 'zoomcur'; this.zoomKind = kind; this.cx = GW >> 1; this.cy = GH >> 1; App.setScreen(Graph); },
  zoomKey(k) {
    if (this.moveFree(k)) return true;
    if (k === '#clear') { this.mode = 'idle'; return true; }
    if (k === '#enter') {
      const w = S().win; const x = xOfPx(this.cx), y = yOfPx(this.cy);
      if (this.zoomKind === 'int') { setWin({ Xmin: Math.round(x) - (GW - 1) / 2, Xmax: Math.round(x) + (GW - 1) / 2, Ymin: Math.round(y) - (GH - 1) / 2, Ymax: Math.round(y) + (GH - 1) / 2, Xscl: 10, Yscl: 10 }); this.mode = 'idle'; return true; }
      const zf = S().zfact || { x: 4, y: 4 }; // ZOOM MEMORY ▸ SetFactors…
      const fx = this.zoomKind === 'in' ? 1 / zf.x : zf.x, fy = this.zoomKind === 'in' ? 1 / zf.y : zf.y;
      const hx = (w.Xmax - w.Xmin) * fx / 2, hy = (w.Ymax - w.Ymin) * fy / 2;
      setWin({ Xmin: x - hx, Xmax: x + hx, Ymin: y - hy, Ymax: y + hy }); this.cx = GW >> 1; this.cy = GH >> 1; return true;
    }
    if (App.isTok(k)) return true;
    this.mode = 'idle'; return false; // any other key (GRAPH, TRACE, ZOOM, QUIT…) ends Zoom In/Out
  },
  startZBox() { this.mode = 'zbox'; this.zbox = null; this.cx = GW >> 1; this.cy = GH >> 1; App.setScreen(Graph); },
  zboxKey(k) {
    if (this.moveFree(k)) return true;
    if (k === '#clear') { this.mode = 'idle'; this.zbox = null; return true; }
    if (k === '#enter') {
      if (!this.zbox) { this.zbox = { x: this.cx, y: this.cy }; return true; }
      if (this.zbox.x === this.cx || this.zbox.y === this.cy) return true;
      const x1 = xOfPx(this.zbox.x), x2 = xOfPx(this.cx), y1 = yOfPx(this.zbox.y), y2 = yOfPx(this.cy);
      setWin({ Xmin: Math.min(x1, x2), Xmax: Math.max(x1, x2), Ymin: Math.min(y1, y2), Ymax: Math.max(y1, y2) }); this.zbox = null; this.mode = 'idle'; return true;
    }
    if (App.isTok(k)) return true;
    this.mode = 'idle'; this.zbox = null; return false;
  }
};

/* ===================== ZOOM / CALC MENUS ===================== */
const go = () => { Graph.mode = 'idle'; App.setScreen(Graph); };
function zoomStat() {
  const st = S(); let xs = [], ys = []; let hist = false, boxOnly = true;
  st.plots.forEach(p => { if (!p.on) return; const L = plotLists(p); xs = xs.concat(L.xs); if (p.type === 'scatter' || p.type === 'xyLine') { ys = ys.concat(L.ys); boxOnly = false; } if (p.type === 'histogram') { hist = true; boxOnly = false; } if (p.type === 'normprob') { const n = L.xs.length, z = N.invNorm((n - 0.5) / n); if ((p.axis || 'X') === 'X') ys = ys.concat([-z, z]); else { xs = xs.slice(0, xs.length - n).concat([-z, z]); ys = ys.concat(L.xs); } boxOnly = false; } });
  if (!xs.length) N.fail('STAT');
  const pad = (a, b) => { const r = (b - a) || Math.max(1, Math.abs(a)); return [a - r * 0.1, b + r * 0.1]; };
  const [x0, x1] = pad(Math.min(...xs), Math.max(...xs)); const o = { Xmin: x0, Xmax: x1 };
  if (hist) { const p = st.plots.find(q => q.on && q.type === 'histogram'); const L = plotLists(p); const xr = Math.max(...L.xs) - Math.min(...L.xs); const scl = xr > 0 ? xr / 7 : 1; o.Xmin = Math.min(...L.xs); o.Xmax = Math.max(...L.xs) + scl; o.Xscl = N.r12(scl); const bins = new Map(); L.xs.forEach((x, i) => { const b = Math.floor((x - o.Xmin) / scl + 1e-9); bins.set(b, (bins.get(b) || 0) + (L.fr ? L.fr[i] : 1)); }); const mx = Math.max(...bins.values()); o.Ymin = -mx * 0.25; o.Ymax = mx * 1.1; }
  else if (ys.length) { const [y0, y1] = pad(Math.min(...ys), Math.max(...ys)); o.Ymin = y0; o.Ymax = y1; }
  else if (boxOnly) { o.Ymin = -10; o.Ymax = 10; }
  setWin(o);
}
function zoomFit() { const st = S(); const w = st.win; let lo = Infinity, hi = -Infinity; activeFns().forEach(n => { for (let i = 0; i < GW; i++) { const y = fval(n, xOfPx(i)); if (isFinite(y)) { lo = Math.min(lo, y); hi = Math.max(hi, y); } } }); if (!isFinite(lo)) N.fail('INVALID'); if (lo === hi) { lo -= 1; hi += 1; } setWin({ Ymin: lo, Ymax: hi }); }
const ZOOMS = {
  ZStandard: () => setWin({ Xmin: -10, Xmax: 10, Xscl: 1, Ymin: -10, Ymax: 10, Yscl: 1, Tmin: 0, Tmax: 2 * Math.PI, Tstep: Math.PI / 24, θmin: 0, θmax: 2 * Math.PI, θstep: Math.PI / 24, nMin: 1, nMax: 10, PlotStart: 1, PlotStep: 1 }),
  ZDecimal: () => setWin({ Xmin: -6.6, Xmax: 6.6, Xscl: 1, Ymin: -4.1, Ymax: 4.1, Yscl: 1 }),
  ZTrig: () => S().mode.angle === 'DEGREE' ? setWin({ Xmin: -352.5, Xmax: 352.5, Xscl: 90, Ymin: -4, Ymax: 4, Yscl: 1 }) : setWin({ Xmin: -6.152285613, Xmax: 6.152285613, Xscl: Math.PI / 2, Ymin: -4, Ymax: 4, Yscl: 1 }),
  ZInteger: () => { const w = S().win; const cx = Math.round((w.Xmin + w.Xmax) / 2), cy = Math.round((w.Ymin + w.Ymax) / 2); setWin({ Xmin: cx - (GW - 1) / 2, Xmax: cx + (GW - 1) / 2, Ymin: cy - (GH - 1) / 2, Ymax: cy + (GH - 1) / 2, Xscl: 10, Yscl: 10 }); },
  ZSquare: () => { const w = S().win; const dx = dX(), dy = dY(); const cx = (w.Xmin + w.Xmax) / 2, cy = (w.Ymin + w.Ymax) / 2; if (dx > dy) setWin({ Ymin: cy - 82 * dx, Ymax: cy + 82 * dx }); else setWin({ Xmin: cx - 132 * dy, Xmax: cx + 132 * dy }); },
  ZoomStat: zoomStat, ZoomFit: zoomFit,
  ZQuadrant1: () => setWin({ Xmin: 0, Xmax: 13.2, Xscl: 1, Ymin: 0, Ymax: 8.2, Yscl: 1 })
};
// ZFrac1/n: ΔX = ΔY = 1/(2n) so tracing steps by 1/n, centered on the origin
const ZFRACS = [2, 3, 4, 5, 8, 10];
ZFRACS.forEach(n => { ZOOMS['ZFrac1/' + n] = () => setWin({ Xmin: -132 / (2 * n), Xmax: 132 / (2 * n), Ymin: -82 / (2 * n), Ymax: 82 / (2 * n), Xscl: 1, Yscl: 1 }); });
App.zoomFactors = () => { const zf = S().zfact; const num = (label, k) => ({ kind: 'num', label, get: () => zf[k], set: v => { if (!(v >= 1)) N.fail('DOMAIN'); zf[k] = v; App.save(); } });
  return new App.Form({ title: 'ZOOM FACTORS', fields: [num('XFact=', 'x'), num('YFact=', 'y')] }); };
const runZoom = (name) => () => { try { ZOOMS[name](); go(); } catch (e) { App.showError(e); } };
App.zoomMenu = () => new App.Menu([
  { name: 'ZOOM', items: [
    { label: 'ZBox', run: () => Graph.startZBox() }, { label: 'Zoom In', run: () => Graph.startZoomCursor('in') }, { label: 'Zoom Out', run: () => Graph.startZoomCursor('out') },
    { label: 'ZDecimal', run: runZoom('ZDecimal') }, { label: 'ZSquare', run: runZoom('ZSquare') }, { label: 'ZStandard', run: runZoom('ZStandard') },
    { label: 'ZTrig', run: runZoom('ZTrig') }, { label: 'ZInteger', run: () => Graph.startZoomCursor('int') }, { label: 'ZoomStat', run: runZoom('ZoomStat') },
    { label: 'ZoomFit', run: runZoom('ZoomFit') }, { label: 'ZQuadrant1', run: runZoom('ZQuadrant1') }].concat(ZFRACS.map(n => ({ label: 'ZFrac1⁄' + n, run: runZoom('ZFrac1/' + n) }))) },
  { name: 'MEMORY', items: [
    { label: 'ZPrevious', run: () => { const st = S(); if (st.zprev) { const cur = Object.assign({}, st.win); Object.assign(st.win, st.zprev); st.zprev = cur; } go(); } },
    { label: 'ZoomSto', run: () => { S().zsto = Object.assign({}, S().win); App.save(); go(); } },
    { label: 'ZoomRcl', run: () => { if (S().zsto) setWin(S().zsto); go(); } },
    { label: 'SetFactors…', run: () => App.setScreen(App.zoomFactors()) }] }
], Graph);
const PAR_CALC = { PARAMETRIC: [['dy/dx', 'dydx'], ['dy/dt', 'dydt'], ['dx/dt', 'dxdt']], POLAR: [['dy/dx', 'dydx'], ['dr/dθ', 'drdt']], SEQ: [] };
App.calcMenu = () => gmode() !== 'FUNCTION' ? new App.Menu([{ name: 'CALCULATE', items: [{ label: 'value', run: () => Graph.startCalc('value') }].concat(PAR_CALC[gmode()].map(([label, type]) => ({ label, run: () => Graph.startCalc(type) }))) }], Graph, { title: 'CALCULATE' }) : new App.Menu([{ name: 'CALCULATE', items: [
  { label: 'value', run: () => Graph.startCalc('value') }, { label: 'zero', run: () => Graph.startCalc('zero') }, { label: 'minimum', run: () => Graph.startCalc('minimum') },
  { label: 'maximum', run: () => Graph.startCalc('maximum') }, { label: 'intersect', run: () => Graph.startCalc('intersect') }, { label: 'dy/dx', run: () => Graph.startCalc('dydx') },
  { label: '∫f(x)dx', run: () => Graph.startCalc('integral') }] }], Graph, { title: 'CALCULATE' });

/* ===================== DRAW COMMAND HOOK ===================== */
E.hooks.command = function (c, a) {
  const st = S(); const ev = n => { const v = E.ev(n); if (typeof v !== 'number') N.fail('DATA TYPE'); return v; };
  const exprToks = (node) => node; // nodes
  const graphAction = { action: 'graph' };
  if (ZOOMS[c]) { ZOOMS[c](); Graph.mode = 'idle'; return graphAction; }
  switch (c) {
    case 'ClrDraw': st.draw = []; Graph.note = null; return graphAction;
    case 'Manual-Fit ': { const yref = a[0] && a[0].t === 'yvar' ? a[0].n : null; if (a[0] && !yref) N.fail('SYNTAX'); Graph.useTool(manualFit(yref)); return graphAction; }
    case 'Select(': { if (a.length !== 2 || a[0].t !== 'lname' || a[1].t !== 'lname') N.fail('SYNTAX'); Graph.useTool(selectTool(a[0].n, a[1].n)); return graphAction; }
    case 'Horizontal ': st.draw.push({ t: 'h', y: ev(a[0]) }); return graphAction;
    case 'Vertical ': st.draw.push({ t: 'v', x: ev(a[0]) }); return graphAction;
    case 'Line(': if (a.length < 4) N.fail('ARGUMENT'); st.draw.push({ t: 'line', x1: ev(a[0]), y1: ev(a[1]), x2: ev(a[2]), y2: ev(a[3]) }); return graphAction;
    case 'Circle(': if (a.length < 3) N.fail('ARGUMENT'); st.draw.push({ t: 'circle', x: ev(a[0]), y: ev(a[1]), r: ev(a[2]) }); return graphAction;
    case 'Pt-On(': case 'Pt-Off(': case 'Pt-Change(': {
      if (a.length < 2) N.fail('ARGUMENT'); const x = ev(a[0]), y = ev(a[1]), mk = a[2] ? ({ 1: '▪', 2: '□', 3: '+', 4: '·' })[ev(a[2])] || '▪' : '▪';
      const lit = st.draw.filter(d => d.t === 'pt' && d.x === x && d.y === y).pop(), on = c === 'Pt-On(' || (c === 'Pt-Change(' && !(lit && !lit.off));
      st.draw.push({ t: 'pt', x, y, mark: mk, off: !on }); return graphAction;
    }
    case 'Pxl-On(': case 'Pxl-Off(': case 'Pxl-Change(': { // row 0–164, column 0–264 of the graph area
      if (a.length < 2) N.fail('ARGUMENT'); const row = Math.round(ev(a[0])), col = Math.round(ev(a[1]));
      if (row < 0 || row > GH || col < 0 || col > GW) N.fail('DOMAIN');
      const lit = st.draw.filter(d => d.t === 'pxl' && d.row === row && d.col === col).pop(), on = c === 'Pxl-On(' || (c === 'Pxl-Change(' && !(lit && !lit.off));
      st.draw.push({ t: 'pxl', row, col, off: !on }); return graphAction;
    }
    case 'DrawF ': case 'DrawInv ': { const toks = App.lastRunToks.slice(1); st.draw.push({ t: c === 'DrawF ' ? 'fn' : 'inv', toks }); return graphAction; }
    case 'Tangent(': {
      if (a.length < 2) N.fail('ARGUMENT'); const x0 = ev(a[a.length - 1]);
      const f = x => { const old = st.vars.X; st.vars.X = x; try { return ev(a[0]); } finally { st.vars.X = old; } };
      const h = 1e-3, m = (f(x0 + h) - f(x0 - h)) / (2 * h), y0 = f(x0);
      st.draw.push({ t: 'tangent', x0, y0, m }); Graph.note = ['dy/dx=' + niceNum(N.r12(m))]; Graph.noteColor = '#000'; return graphAction;
    }
    case 'Shade(': {
      if (a.length < 2) N.fail('ARGUMENT'); const mk = node => x => { const old = st.vars.X; st.vars.X = x; try { return ev(node); } finally { st.vars.X = old; } };
      const xl = a[2] ? ev(a[2]) : -Infinity, xr = a[3] ? ev(a[3]) : Infinity;
      st.draw.push({ t: 'shade', lo: mk(a[0]), hi: mk(a[1]), xl, xr, _toks: true }); return graphAction;
    }
    case 'ShadeNorm(': case 'Shade_t(': case 'Shadeχ²(': case 'ShadeF(': {
      const v = a.map(ev); let pdf, area, lo = v[0], hi = v[1];
      if (c === 'ShadeNorm(') { const m = v[2] || 0, s = v[3] || 1; pdf = x => N.normalpdf(x, m, s); area = N.normalcdf(lo, hi, m, s); }
      else if (c === 'Shade_t(') { pdf = x => N.tpdf(x, v[2]); area = N.tcdf(lo, hi, v[2]); }
      else if (c === 'Shadeχ²(') { pdf = x => N.chipdf(x, v[2]); area = N.chicdf(lo, hi, v[2]); }
      else { pdf = x => N.Fpdf(x, v[2], v[3]); area = N.Fcdf(lo, hi, v[2], v[3]); }
      st.draw = st.draw.filter(d => d.t !== 'shadeDist');
      const col = App.nextShadeColor || '#1f4fff'; App.nextShadeColor = null;
      st.draw.push({ t: 'shadeDist', lo: () => 0, hi: pdf, xl: lo, xr: hi, color: col });
      Graph.note = ['Area=' + E.fmtReal(Number(area.toPrecision(5))), ['low=' + E.fmtReal(lo, { sig: 5 }), 'up=' + E.fmtReal(hi, { sig: 5 })]]; Graph.noteColor = col; st.ans = area; return graphAction;
    }
    case 'Text(': { // Text(row,column,value…) — writes the values on the graph
      if (a.length < 3) N.fail('ARGUMENT'); const row = Math.round(ev(a[0])), col = Math.round(ev(a[1]));
      const s = a.slice(2).map(n => E.format(E.ev(n))[0]).join('');
      st.draw.push({ t: 'text', row, col, s, color: st.textColor || '#111' }); return graphAction;
    }
  }
  N.fail('INVALID');
};
/* ===================== TABLE ===================== */
const Table = App.table = {
  row: 0, col: 0, start: null, colOff: 0, entry: null, ask: [], revealed: new Set(),
  enter() { const t = S().tbl; if (this.start === null || this.lastStart !== t.start) { this.start = t.start; this.lastStart = t.start; this.row = 0; } this.revealed = new Set(); if (gmode() === 'SEQ' && this.start < S().win.nMin) { this.start = S().win.nMin; this.row = 0; } },
  fns() { return gmode() === 'FUNCTION' ? activeFns().map(n => ({ name: n, color: S().Y[n].color, val: x => fval(n, x) })) : [].concat(...curves().map(cv => cv.cols.map(c => ({ name: c.name, color: cv.color, val: c.val })))); },
  xAt(r) { const t = S().tbl; if (t.indpnt === 'ASK') return this.ask[r]; return N.r12(this.start + r * t.step); },
  render() {
    G.clear(); G.status(this.entry ? '' : 'PRESS + FOR ΔTbl'); const c = G.ctx; const fns = this.fns(); const st = S();
    const GT = split() === 'GRAPH-TABLE', X0 = GT ? 160 : 0, NC = GT ? 2 : 5;
    const cols = [{ name: PVAR[gmode()] || 'X', fn: null }].concat(fns.slice(this.colOff, this.colOff + NC - 1).map(f => ({ name: f.name, fn: f })));
    const CWD = GT ? 80 : 64, HY = SB, RH = 16, NR = 10, top = SB + 20;
    c.font = 'bold 15px ' + MONO; c.textAlign = 'center';
    for (let i = 0; i < NC; i++) {
      const x = X0 + i * CWD; const col = cols[i];
      if (col) { c.fillStyle = col.fn ? col.fn.color : '#000'; c.fillText(col.name, x + CWD / 2, HY + 11); }
    }
    c.strokeStyle = '#000'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(X0, top - .5); c.lineTo(320, top - .5); c.stroke();
    c.lineWidth = 1; c.beginPath(); for (let i = 1; i < NC; i++) { c.moveTo(X0 + i * CWD + .5, HY); c.lineTo(X0 + i * CWD + .5, top + RH * NR); } for (let r = 1; r < NR; r++) { c.moveTo(X0, top + r * RH + .5); c.lineTo(320, top + r * RH + .5); } c.strokeStyle = '#c8c8c8'; c.stroke();
    c.strokeStyle = '#000'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(X0, top + RH * NR); c.lineTo(320, top + RH * NR); c.stroke();
    c.font = '14.5px ' + MONO;
    for (let r = 0; r < NR; r++) {
      const x = this.xAt(r);
      for (let i = 0; i < cols.length; i++) {
        let txt = '';
        if (x !== undefined) {
          if (i === 0) txt = fmtShort(x);
          else if (st.tbl.depend === 'AUTO' || this.revealed.has(cols[i].name + '@' + x)) txt = fmtShort(E.seqBatch(() => cols[i].fn.val(x)));
        }
        const sel = r === this.row && i === this.col;
        if (sel) { c.fillStyle = '#000'; c.fillRect(X0 + i * CWD + 1, top + r * RH + 1, CWD - 1, RH - 1); }
        c.fillStyle = sel ? '#fff' : (i ? cols[i].fn.color : '#000'); c.textAlign = 'center'; c.fillText(txt, X0 + i * CWD + CWD / 2, top + r * RH + RH / 2 + 1);
      }
    }
    // bottom line
    const by = top + RH * NR + 18; c.font = '16px ' + MONO; c.textAlign = 'left'; c.fillStyle = '#000';
    if (this.entry) { App.entryLine(this.entry.label, this.entry.ed, X0 + 4, by); return; }
    const x = this.xAt(this.row); const cc = cols[this.col];
    let bt = '';
    if (this.col === 0) bt = cols[0].name + '=' + (x === undefined ? '' : E.fmtReal(x));
    else if (cc) { const y = x === undefined ? NaN : E.seqBatch(() => cc.fn.val(x)); bt = cc.name + '=' + (x === undefined || (st.tbl.depend === 'ASK' && !this.revealed.has(cc.name + '@' + x)) ? '' : (isFinite(y) ? E.fmtReal(y) : 'ERROR')); }
    c.fillText(bt, X0 + 6, by);
  },
  key(k) {
    const t = S().tbl; const NC = split() === 'GRAPH-TABLE' ? 2 : 5; const ncols = 1 + Math.min(NC - 1, this.fns().length);
    if (this.entry) {
      const en = this.entry;
      if (k === '#enter') { try { const v = E.evalNumber(en.ed.toks); this.entry = null; en.cb(v); } catch (err) { this.entry = null; App.showError(err, { quit: () => App.setScreen(Table) }); } return true; }
      if (k === '#clear') { this.entry = null; return true; }
      if (App.isTok(k)) { en.ed.insert(k); return true; }
      return en.ed.key(k) || true;
    }
    switch (k) {
      case '#up': if (this.row > 0) this.row--; else if (t.indpnt === 'AUTO') this.start = N.r12(this.start - t.step); return true;
      case '#down': if (this.row < 9) { if (t.indpnt === 'ASK' && this.xAt(this.row) === undefined) return true; this.row++; } else if (t.indpnt === 'AUTO') this.start = N.r12(this.start + t.step); return true;
      case '#left': if (this.col > 0) this.col--; else if (this.colOff > 0) this.colOff--; return true;
      case '#right': if (this.col < ncols - 1) this.col++; else if (this.colOff + NC - 1 < this.fns().length) this.colOff++; return true;
      case '#enter': if (this.col > 0 && t.depend === 'ASK') { const x = this.xAt(this.row); if (x !== undefined) this.revealed.add(this.fns()[this.colOff + this.col - 1].name + '@' + x); } return true;
      case '#clear': return false;
      case '#del': if (t.indpnt === 'ASK' && this.col === 0) { this.ask.splice(this.row, 1); } return true;
    }
    if (k === '+') { this.entry = { label: 'ΔTbl=', ed: new App.LineEditor(), cb: v => { if (v === 0) N.fail('DOMAIN'); t.step = v; App.save(); } }; return true; }
    if (App.isTok(k) && this.col === 0) {
      this.entry = { label: 'X=', ed: new App.LineEditor(), cb: v => { if (t.indpnt === 'ASK') { this.ask[this.row] = v; if (this.row < 9) this.row++; } else { this.start = v; t.start = v; this.lastStart = v; this.row = 0; App.save(); } } };
      this.entry.ed.insert(k); return true;
    }
    return App.isTok(k);
  }
};
/* ===================== GRAPH TOOLS: Pen, Manual-Fit, QuickPlot&Fit-EQ, Select( =====================
   A tool owns the free cursor: its status line, what ENTER does, and what it draws over the graph. */
Graph.useTool = function (tool) { this.note = null; this.mode = 'tool'; this.tool = tool; this.cx = GW >> 1; this.cy = GH >> 1; };
Graph.startTool = function (tool) { App.setScreen(Graph); this.useTool(tool); App.render(); }; // after setScreen: leaving the graph ends a tool
Graph.toolKey = function (k) {
  const t = this.tool;
  if (this.moveFree(k)) { if (t.move) t.move(); return true; }
  if (t.key(k)) return true;
  if (k === '#clear') { this.mode = 'idle'; this.tool = null; return true; }
  if (App.isTok(k)) return true;
  this.mode = 'idle'; this.tool = null; return false;
};
const cursorXY = () => [N.r12(xOfPx(Graph.cx)), N.r12(yOfPx(Graph.cy))];
const sig5 = v => E.fmtReal(v, { sig: 5 });
/* DRAW ▸ Pen: ENTER puts the pen down / lifts it; moving with the pen down draws */
App.penTool = function () {
  let down = false; const dot = () => { S().draw.push({ t: 'pxl', row: Graph.cy, col: Graph.cx }); App.invalidateGraph(); };
  return { status: () => 'PEN ' + (down ? 'DOWN' : 'UP') + ': [enter] switches', key(k) { if (k !== '#enter') return false; down = !down; if (down) dot(); return true; }, move() { if (down) dot(); } };
};
/* STAT CALC ▸ Manual-Fit: ENTER at two points, the line through them is y=mX+b */
function manualFit(yref) {
  let p1 = null;
  return {
    status: () => 'MANUAL-FIT Y=mX+b',
    top: () => p1 ? 'Select 2nd point' : 'Select 1st point',
    key(k) {
      if (k !== '#enter') return false;
      const [x, y] = cursorXY(); if (!p1) { p1 = [x, y]; return true; } if (x === p1[0]) return true;
      const m = N.r12((y - p1[1]) / (x - p1[0])), b = N.r12(p1[1] - m * p1[0]);
      const eq = E.regEqToks(E.REG['LinReg(ax+b) '], { a: m, b }); const st = S(); st.regEQ = eq; Object.assign(st.stat, { a: m, b });
      if (yref) { st.Y[yref].toks = eq.slice(); st.Y[yref].on = true; } else st.draw.push({ t: 'tangent', x0: 0, y0: b, m });
      Graph.mode = 'idle'; Graph.tool = null; Graph.note = [['m=' + sig5(m), 'b=' + sig5(b)]]; Graph.noteColor = '#000'; App.invalidateGraph(); App.save(); return true;
    },
    draw(c) { if (!p1) return; c.strokeStyle = '#111'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(px(p1[0]), py(p1[1])); c.lineTo(GX + Graph.cx, GY + Graph.cy); c.stroke(); }
  };
}
App.manualFit = yref => Graph.startTool(manualFit(yref));
/* STAT CALC ▸ QuickPlot&Fit-EQ: ENTER drops points, GRAPH picks the kind of fit */
const QP_FITS = ['LinReg(ax+b) ', 'QuadReg ', 'CubicReg ', 'QuartReg ', 'LnReg ', 'ExpReg ', 'PwrReg '];
App.quickPlot = function () {
  const pts = [];
  const tool = {
    status: () => 'QUICKPLOT&FIT-EQ  [graph]=FIT',
    top: () => pts.length + ' point' + (pts.length === 1 ? '' : 's'),
    key(k) {
      if (k === '#enter') { const [x, y] = cursorXY(); pts.push([x, y]); S().draw.push({ t: 'pt', x, y, mark: '□' }); App.invalidateGraph(); return true; }
      if (k !== '#graph') return false;
      if (pts.length < 2) { App.flash('Drop at least 2 points with [enter]'); return true; }
      App.setScreen(new App.Menu([{ name: 'FIT', items: QP_FITS.map(cmd => ({ label: cmd.trim(), run: () => {
        try {
          const D = E.REG[cmd]; const s = N.regress(D.title === 'LinReg' ? cmd.trim() : D.title, pts.map(p => p[0]), pts.map(p => p[1]));
          const eq = E.regEqToks(D, s); const st = S(); st.regEQ = eq; ['a', 'b', 'c', 'd', 'e', 'r', 'r2', 'R2'].forEach(k2 => st.stat[k2] = s[k2] !== undefined ? s[k2] : NaN);
          st.draw = st.draw.filter(d => d.t !== 'fn' || !d.qp); st.draw.push({ t: 'fn', toks: eq, color: '#1f4fff', qp: true });
          Graph.useTool(tool); Graph.note = [D.form + '  (RegEQ)']; Graph.noteColor = '#1f4fff'; App.invalidateGraph(); App.save(); App.setScreen(Graph);
        } catch (err) { App.showError(err, { quit: () => App.setScreen(Graph) }); }
      } })) }], Graph, { back: { enter() { Graph.startTool(tool); }, render() { }, key() { return false; } } }));
      return true;
    }
  };
  Graph.startTool(tool);
};
/* LIST OPS ▸ Select(: pick the stat-plot points between a left and right bound into two lists */
function selectTool(xn, yn) {
  const p = S().plots.find(q => q.on && (q.type === 'scatter' || q.type === 'xyLine')); if (!p) N.fail('INVALID');
  let left = null;
  return {
    status: () => 'SELECT',
    top: () => left === null ? 'Left Bound?' : 'Right Bound?',
    key(k) {
      if (k !== '#enter') return false;
      const x = xOfPx(Graph.cx); if (left === null) { left = x; return true; }
      const lo = Math.min(left, x), hi = Math.max(left, x), { xs, ys } = plotLists(p), st = S(); const keep = xs.map((v, i) => i).filter(i => xs[i] >= lo && xs[i] <= hi);
      st.lists[xn] = keep.map(i => xs[i]); st.lists[yn] = keep.map(i => ys[i]);
      Graph.mode = 'idle'; Graph.tool = null; Graph.note = [keep.length + ' points stored to ' + xn + ', ' + yn]; Graph.noteColor = '#000'; App.save(); return true;
    },
    draw(c) { if (left !== null) { c.strokeStyle = '#000'; c.setLineDash([2, 2]); c.beginPath(); c.moveTo(px(left) + .5, GY); c.lineTo(px(left) + .5, GY + GH); c.stroke(); c.setLineDash([]); } }
  };
}

/* ===================== STAT TEST "Draw" =====================
   o: { dist: 'z'|'t'|'chi'|'F', name, stat, alt (0 ≠, 1 <, 2 >), df, df2, p } */
App.drawTest = function (o) {
  const st = S(); let pdf, x0, x1;
  if (o.dist === 'z' || o.dist === 't') { pdf = o.dist === 'z' ? x => N.normalpdf(x, 0, 1) : x => N.tpdf(x, o.df); const r = Math.max(3.5, Math.min(Math.abs(o.stat) + .5, 50)); x0 = -r; x1 = r; }
  else if (o.dist === 'chi') { pdf = x => N.chipdf(x, o.df); x0 = 0; x1 = Math.max(Math.min(o.stat * 1.2, o.df * 20 + 20), o.df + 4 * Math.sqrt(2 * o.df)); }
  else { pdf = x => N.Fpdf(x, o.df, o.df2); x0 = 0; x1 = Math.max(Math.min(o.stat * 1.2, 100), 5); }
  let ymax = 0; for (let i = 1; i <= 200; i++) { const y = safe(() => pdf(x0 + (x1 - x0) * i / 200)); if (isFinite(y)) ymax = Math.max(ymax, y); }
  if (!(ymax > 0)) ymax = 1; if (ymax > 2) ymax = 2;
  setWin({ Xmin: x0, Xmax: x1, Xscl: o.dist === 'z' || o.dist === 't' ? 1 : Math.max(1, Math.round((x1 - x0) / 10)), Ymin: -ymax * .25, Ymax: ymax * 1.2, Yscl: ymax });
  const s = o.stat, left = [-Infinity, s], right = [s, Infinity];
  let regions;
  if (o.alt === 1) regions = [left];
  else if (o.alt === 2) regions = [right];
  else if (o.dist === 'z' || o.dist === 't') regions = [[-Infinity, -Math.abs(s)], [Math.abs(s), Infinity]];
  else regions = [o.dist === 'F' && N.Fcdf(0, s, o.df, o.df2) < .5 ? left : right];
  st.draw = st.draw.filter(d => d.t !== 'shadeDist');
  regions.forEach(([xl, xr]) => st.draw.push({ t: 'shadeDist', lo: () => 0, hi: pdf, xl, xr, color: '#1f4fff' }));
  const f = v => E.fmtReal(v, { sig: 5 });
  Graph.note = [[o.name + '=' + f(s), 'p=' + f(o.p)]]; Graph.noteColor = '#000';
  App.invalidateGraph(); Graph.mode = 'idle'; App.setScreen(Graph);
};

/* ===================== SPLIT SCREEN (MODE: HORIZONTAL / GRAPH-TABLE) =====================
   HORIZONTAL: graph on top, home screen below. GRAPH-TABLE: graph on the left, table on the right.
   The half being used draws the status bar; the other half shows what it last showed. */
const baseRender = App.render;
/* Transfrm Play (>) and Play-Fast (>>): the selected letter keeps changing by Step until ENTER pauses */
setInterval(() => {
  const st = S(), m = st.trnMode || '>||';
  if (m === '>||' || App.screen !== Graph || !st.appTrans || gmode() !== 'FUNCTION' || Graph.mode !== 'idle' || Graph.entry || Graph.trPaused || App.off) return;
  const now = Date.now(); if (now - (Graph.trLast || 0) < (m === '>' ? 700 : 250)) return; Graph.trLast = now;
  const vs = Graph.transVars(); if (!vs.length) return; if (!vs.includes(Graph.trVar)) Graph.trVar = vs[0];
  st.vars[Graph.trVar] = N.r12((st.vars[Graph.trVar] || 0) + (Graph.trDir || 1) * (st.trnStep || 1)); App.invalidateGraph(); App.render();
}, 50);
App.render = function () {
  const sp = split(), scr = App.screen;
  applyGeom();
  const other = sp === 'HORIZONTAL' ? App.home : Table;
  if (App.off || sp === 'FULL' || (scr !== Graph && scr !== other)) return baseRender();
  try {
    if (sp === 'HORIZONTAL') { App.paneTop = SB + 106; App.home.render(); App.paneTop = null; }
    else Table.render();
    Graph.render(scr !== Graph);
    const c = G.ctx; c.fillStyle = '#4d5157';
    if (sp === 'HORIZONTAL') c.fillRect(0, SB + 105, 320, 1); else c.fillRect(159, SB, 1, 210);
  } catch (e) { console.error(e); }
  App.listeners.forEach(f => f());
};
})();
