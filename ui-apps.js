/* ui-apps.js — menus (MATH, TEST, ANGLE, VARS, DRAW, MATRIX, MEM, APPS, CATALOG), Finance/TVM, PlySmlt2, Matrix editor, Equation Solver */
(function () {
'use strict';
const E = window.Engine, N = window.Numeric, App = window.App, G = App.G;
const { GRIDS, COL, SB, MONO } = App;
const S = () => E.getState();
const Menu = App.Menu;
const it = (t, label) => ({ label: label || E.disp(t), tok: t });
const off = (label) => ({ label, disabled: true });

/* ===================== MATH family ===================== */
App.mathMenu = (target) => new Menu([
  { name: 'MATH', items: [it('▶Frac'), it('▶Dec'), it('³'), it('³√('), it('ˣ√'), it('fMin('), it('fMax('), it('nDeriv('), it('fnInt('), { label: 'summation Σ(', tok: 'Σ(' }, it('logBASE('), { label: 'piecewise(', run: (target) => pieces(target) }, { label: 'Numeric Solver…', run: () => App.setScreen(App.solverEq()) }] },
  { name: 'NUM', items: [it('abs('), it('round('), it('iPart('), it('fPart('), it('int('), it('min('), it('max('), it('lcm('), it('gcd('), it('remainder('), it('▶n/d◀▶Un/d'), it('▶F◀▶D'), { label: 'Un/d', tok: 'mix.u' }, { label: 'n/d', tok: 'frac.n' }] },
  { name: 'CMPLX', items: [it('conj('), it('real('), it('imag('), it('angle('), it('abs('), it('▶Rect'), it('▶Polar')] },
  { name: 'PROB', items: [it('rand'), it('nPr', 'nPr'), it('nCr', 'nCr'), it('!'), it('randInt('), it('randNorm('), it('randBin('), it('randIntNoRep(')] },
  { name: 'FRAC', items: fracItems() }
], target);
function fracItems() { return [{ label: 'n/d', tok: 'frac.n' }, { label: 'Un/d', tok: 'mix.u' }, it('▶F◀▶D'), it('▶n/d◀▶Un/d')]; }
function pieces(target) {
  const tg = target && target.insert ? target : App.home, mp = E.getState().mode.mathprint === 'MATHPRINT' && tg.ed && tg.ed.mathprint;
  if (!mp) { tg.insert('piecewise('); App.setScreen(tg); return; }
  let n = 2; const form = new App.Form({ title: 'PIECEWISE FUNCTION', titleCenter: true, fields: [
    { kind: 'choice', label: 'Pieces: ', opts: [1, 2, 3, 4, 5], get: () => n, set: v => { n = v; } },
    { kind: 'action', label: 'OK', run: () => { App.setScreen(tg); tg.insert('pw' + n + '.b'); App.render(); } }] });
  form.fixIdx(); App.setScreen(form);
}
// TEST ▸ CONDITIONS: ready-made conditions for piecewise( (pasted as written, cursor at the end)
const cond = (label, toks) => ({ label, toks, raw: true });
const CONDITIONS = [cond('X≤', ['X', '≤']), cond('X<', ['X', '<']), cond('X≥', ['X', '≥']), cond('X>', ['X', '>']),
  cond('≤X and X≤', ['≤', 'X', 'and', 'X', '≤']), cond('<X and X<', ['<', 'X', 'and', 'X', '<']), cond('≤X and X<', ['≤', 'X', 'and', 'X', '<']), cond('<X and X≤', ['<', 'X', 'and', 'X', '≤']),
  cond('X=', ['X', '=']), cond('X≠', ['X', '≠'])].concat(['≤', '<', '≥', '>', '=', '≠'].map(r => cond('|X|' + r, ['abs.b', 'X', 'abs.e', r])));
App.testMenu = (target) => new Menu([
  { name: 'TEST', items: ['=', '≠', '>', '≥', '<', '≤'].map(t => it(t)) },
  { name: 'LOGIC', items: [it('and', 'and'), it('or', 'or'), it('xor', 'xor'), it('not(')] },
  { name: 'CONDITIONS', items: CONDITIONS }
], target);
App.angleMenu = (target) => new Menu([{ name: 'ANGLE', items: [it('°'), it("'"), it('ʳ'), it('▶DMS'), it('R▶Pr('), it('R▶Pθ('), it('P▶Rx('), it('P▶Ry(')] }], target);
App.drawMenu = (target) => new Menu([
  { name: 'DRAW', items: [it('ClrDraw'), it('Line('), it('Horizontal '), it('Vertical '), it('Tangent('), it('DrawF '), it('Shade('), it('DrawInv '), it('Circle('), it('Text('), { label: 'Pen', run: () => App.graph.startTool(App.penTool()) }] },
  { name: 'POINTS', items: [it('Pt-On('), it('Pt-Off('), it('Pt-Change('), it('Pxl-On('), it('Pxl-Off('), it('Pxl-Change('), it('pxl-Test(')] },
  { name: 'STO', items: [it('StorePic '), it('RecallPic '), it('StoreGDB '), it('RecallGDB ')] },
  { name: 'BACKGROUND', items: [off('BackgroundOn'), off('BackgroundOff')] }
], target);
/* ALPHA F1–F4 shortcut menus: a box over the current screen with FRAC FUNC MTRX YVAR tabs along the bottom */
const POP_TABS = [
  { name: 'FRAC', items: [['n/d', 'frac.n', '□/□'], ['Un/d', 'mix.u', '□□/□'], ['▶n/d◀▶Un/d', '▶n/d◀▶Un/d'], ['▶F◀▶D', '▶F◀▶D']] },
  { name: 'FUNC', items: [['abs(', 'abs.b', '|□|'], ['summation Σ(', 'Σ(', 'Σ□'], ['nDeriv(', 'nDeriv(', 'd/d□'], ['fnInt(', 'fnInt(', '∫□d□'], ['logBASE(', 'logBASE(', 'log□'], ['ˣ√', 'ˣ√', '□√□'], ['nPr', 'nPr', '□P□'], ['nCr', 'nCr', '□C□'], ['!', '!', '□!']] },
  { name: 'MTRX' },
  { name: 'YVAR', items: E.YN.map(y => [y, y]) }
];
class Popup {
  constructor(tab, target) { this.back = App.screen; this.target = target; this.go(tab); }
  go(tab) { this.tab = tab; this.idx = 0; this.col = 0; this.mr = 2; this.mc = 2; }
  render() {
    if (this.back && this.back.render) this.back.render();
    const c = G.ctx, sm = GRIDS.small, T = POP_TABS[this.tab], rh = 14;
    const box = (x, y, w, h) => { c.fillStyle = '#fff'; c.fillRect(x, y, w, h); c.strokeStyle = '#000'; c.lineWidth = 1; c.strokeRect(x + .5, y + .5, w - 1, h - 1); };
    const txt = (x, y, s, inv, color) => { if (inv) { c.fillStyle = COL.inv; c.fillRect(x - 1, y - 6, App.cells(s).length * sm.cw + 2, 13); } G.raw(x, y + 1, s, sm.font, inv ? COL.invText : (color || COL.text)); };
    // tabs
    POP_TABS.forEach((t, k) => { const x = 2 + k * 52; box(x, 226, 50, 14); txt(x + 25 - App.cells(t.name).length * 4, 233, t.name, k === this.tab); });
    if (T.name === 'MTRX') { // Row × Col picker
      const x0 = 110, y0 = 226 - (8 * rh + 6); box(x0, y0, 100, 8 * rh + 6);
      txt(x0 + 14, y0 + 9, 'Row'); txt(x0 + 60, y0 + 9, 'Col');
      for (let k = 1; k <= 6; k++) { txt(x0 + 22, y0 + 9 + k * rh, String(k), this.col === 0 && this.mr === k); txt(x0 + 68, y0 + 9 + k * rh, String(k), this.col === 1 && this.mc === k); }
      txt(x0 + 42, y0 + 9 + 7 * rh, 'OK', this.col === 2); return;
    }
    if (T.name === 'YVAR') {
      const x0 = 150, y0 = 226 - (5 * rh + 6); box(x0, y0, 120, 5 * rh + 6);
      T.items.forEach(([lab], k) => { const col = k < 5 ? 0 : 1, row = k % 5; txt(x0 + 6 + col * 58, y0 + 10 + row * rh, LABELS[k] + ':' + lab, k === this.idx); });
      return;
    }
    const n = T.items.length, w = T.name === 'FUNC' ? 214 : 170, y0 = 226 - (n * rh + 6); box(2, y0, w, n * rh + 6);
    T.items.forEach(([lab, , prev], k) => { txt(8, y0 + 10 + k * rh, LABELS[k] + ':' + lab, k === this.idx); if (prev) txt(w - 8 - App.cells(prev).length * sm.cw, y0 + 10 + k * rh, prev, false, COL.accent); });
  }
  choose(k) {
    const T = POP_TABS[this.tab], tgt = this.target && this.target.insert ? this.target : App.home;
    App.setScreen(tgt);
    if (T.name === 'MTRX') { // a matrix with empty entries to fill in: [[ , ][ , ]]
      const toks = []; for (let r = 0; r < this.mr; r++) { toks.push('['); for (let j = 0; j < this.mc - 1; j++) toks.push(','); toks.push(']'); }
      toks.unshift('['); toks.push(']'); tgt.insert(toks[0]); tgt.insert(toks[1]); const rest = toks.slice(2);
      if (tgt.ed && tgt.ed.insertMany) { const at = tgt.ed.cur; tgt.ed.insertMany(rest); tgt.ed.cur = at; if (tgt.sync) tgt.sync(); } else rest.forEach(t => tgt.insert(t));
      return;
    }
    tgt.insert(T.items[k][1]);
  }
  key(k) {
    const T = POP_TABS[this.tab], F = ['#f1', '#f2', '#f3', '#f4'].indexOf(k);
    if (F >= 0) { this.go(F); return true; }
    if (k === '#clear' || k === '#quit') { App.setScreen(this.back || App.home); return true; }
    if (T.name === 'MTRX') {
      if (k === '#left') { this.col = Math.max(0, this.col - 1); return true; }
      if (k === '#right') { this.col = Math.min(2, this.col + 1); return true; }
      if (k === '#up' || k === '#down') { const d = k === '#up' ? -1 : 1; if (this.col === 0) this.mr = Math.min(6, Math.max(1, this.mr + d)); else if (this.col === 1) this.mc = Math.min(6, Math.max(1, this.mc + d)); return true; }
      if (/^[1-6]$/.test(k) && this.col < 2) { if (this.col === 0) this.mr = Number(k); else this.mc = Number(k); return true; }
      if (k === '#enter') { if (this.col < 2) this.col++; else this.choose(); return true; }
      return true;
    }
    const n = T.items.length;
    if (k === '#up') { this.idx = (this.idx - 1 + n) % n; return true; }
    if (k === '#down') { this.idx = (this.idx + 1) % n; return true; }
    if (k === '#left' || k === '#right') { if (T.name === 'YVAR') this.idx = (this.idx + 5) % 10; return true; }
    if (k === '#enter') { this.choose(this.idx); return true; }
    const li = LABELS.indexOf(k); if (li >= 0 && li < n) { this.choose(li); return true; }
    return true;
  }
}
const LABELS = '1234567890ABCDEFGHIJ'.split('');
App.popupMenu = (tab, target) => new Popup(tab, target);
const yvarItems = () => E.YN.map(y => it(y));

/* ===================== VARS ===================== */
App.varsMenu = (target) => new Menu([
  { name: 'VARS', items: [
    { label: 'Window…', subTitle: null, sub: () => [{ name: 'X/Y', items: ['Xmin', 'Xmax', 'Xscl', 'Ymin', 'Ymax', 'Yscl', 'Xres', 'win.ΔX', 'win.ΔY', 'XFact', 'YFact', 'TraceStep'].map(t => it(t)) },
      { name: 'T/θ', items: ['Tmin', 'Tmax', 'Tstep', 'θmin', 'θmax', 'θstep'].map(t => it(t)) }, { name: 'U/V/W', items: ['nMin', 'nMax', 'PlotStart', 'PlotStep'].map(t => it(t)) }] },
    { label: 'Zoom…', sub: () => [{ name: 'ZX/ZY', items: ['ZXmin', 'ZXmax', 'ZXscl', 'ZYmin', 'ZYmax', 'ZYscl', 'ZXres'].map(t => it(t)) }, { name: 'ZT/Zθ', items: [off('ZTmin'), off('ZTmax'), off('ZTstep'), off('Zθmin'), off('Zθmax'), off('Zθstep')] }, { name: 'ZU', items: [off('Zu(nMin)'), off('Zv(nMin)'), off('Zw(nMin)'), off('ZnMin'), off('ZnMax'), off('ZPlotStart'), off('ZPlotStep')] }] },
    off('GDB…'), off('Picture & Background…'),
    { label: 'Statistics…', sub: () => [
      { name: 'XY', items: ['stat.n', 'x̄', 'Sx', 'σx', 'ȳ', 'Sy', 'σy', 'minX', 'maxX', 'minY', 'maxY'].map(t => it(t)) },
      { name: 'Σ', items: ['Σx', 'Σx²', 'Σy', 'Σy²', 'Σxy'].map(t => it(t)) },
      { name: 'EQ', items: [{ label: 'RegEQ', run: (tg) => { const t = tg && tg.insert ? tg : App.home; S().regEQ.forEach(x => t.insert(x)); App.setScreen(t); } }].concat(['reg.a', 'reg.b', 'reg.c', 'reg.d', 'reg.e', 'reg.r', 'reg.r2', 'reg.R2'].map(t => it(t))) },
      { name: 'TEST', items: ['p', 'z', 't', 'χ²', 'stat.F', 'df', 'p̂', 's'].map(t => it(t)) },
      { name: 'PTS', items: ['Q₁', 'Med', 'Q₃'].map(t => it(t)) }] },
    { label: 'Table…', sub: () => [{ name: 'TABLE', items: [it('TblStart'), it('ΔTbl')] }] },
    { label: 'String…', sub: () => [{ name: 'STRING', items: E.STRS.map(t => it(t)) }] }] },
  { name: 'Y-VARS', items: [
    { label: 'Function…', sub: () => [{ name: 'FUNCTION', items: yvarItems() }] },
    { label: 'Parametric…', sub: () => [{ name: 'PARAMETRIC', items: [].concat(...E.XT.map((x, i) => [it(x), it(E.YT[i])])) }] },
    { label: 'Polar…', sub: () => [{ name: 'POLAR', items: E.RN.map(r => it(r)) }] },
    { label: 'On/Off…', sub: () => [{ name: 'ON/OFF', items: [it('FnOn '), it('FnOff ')] }] }] }
], target);

/* ===================== FINANCE ===================== */
App.tvmSolver = function () {
  const t = S().tvm; let solved = null;
  const num = (label, key) => ({ kind: 'num', label, key, get: () => t[key], set: v => { t[key] = v; if (key === 'PY') t.CY = v; solved = null; App.save(); }, mark: () => solved === key });
  return new App.Form({
    fields: [num('N=', 'N'), num('I%=', 'I'), num('PV=', 'PV'), num('PMT=', 'PMT'), num('FV=', 'FV'), num('P/Y=', 'PY'), num('C/Y=', 'CY'),
      { kind: 'choice', label: 'PMT:', opts: ['END', 'BEGIN'], get: () => t.begin ? 'BEGIN' : 'END', set: v => { t.begin = v === 'BEGIN'; App.save(); } }],
    indent: true, // the CE indents the TVM rows; ALPHA ENTER (SOLVE) solves the highlighted one
    onSolve(f) {
      if (!f.key || f.key === 'PY' || f.key === 'CY') return;
      try { const v = N.tvmSolve(t, f.key); if (!isFinite(v)) N.fail('NO SIGN CHANGE'); t[f.key] = N.r12(v); solved = f.key; App.save(); }
      catch (err) { const self = this; App.showError(err, { quit: () => App.setScreen(self) }); }
    }
  });
};
App.financeMenu = (target) => new Menu([
  { name: 'CALC', items: [{ label: 'TVM Solver…', run: () => App.setScreen(App.tvmSolver()) }, it('tvm_Pmt'), it('tvm_I%'), it('tvm_PV'), it('tvm_N'), it('tvm_FV'), it('npv('), it('irr('), it('bal('), it('ΣPrn('), it('ΣInt('), it('▶Nom('), it('▶Eff('), it('dbd('), it('Pmt_End'), it('Pmt_Bgn')] },
  { name: 'VARS', items: ['tvm.N', 'tvm.I%', 'tvm.PV', 'tvm.PMT', 'tvm.FV', 'tvm.P/Y', 'tvm.C/Y'].map(t => it(t)) }
], target);

/* ===================== PLYSMLT2 ===================== */
const PS = { deg: 2, coef: {}, neq: 2, nvar: 2, sys: {} };
function polyForm() {
  const f = new App.Form({
    title: 'POLY ROOT FINDER',
    fields: [{ kind: 'choice', label: 'ORDER ', opts: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], get: () => PS.deg, set: v => PS.deg = v },
      { kind: 'info', label: '' }, { kind: 'info', label: 'Pick degree, then NEXT.', color: COL.hint },
      { kind: 'action', label: 'NEXT ▶', run: () => App.setScreen(polyCoef()) }]
  });
  return f;
}
const supNum = n => String(n).split('').map(d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]).join('');
function polyCoef() {
  const n = PS.deg; const fields = [];
  for (let k = n; k >= 0; k--) { const key = 'a' + k; if (PS.coef[key] === undefined) PS.coef[key] = 0; fields.push({ kind: 'num', label: 'a' + k + '=', get: () => PS.coef[key], set: v => PS.coef[key] = v }); }
  const form = new App.Form({
    title: [(() => { let s = ''; for (let k = n; k >= 0; k--) s += 'a' + (k ? (k > 1 ? 'x' + supNum(k) : 'x') : '') + (k ? '+' : ''); return s.length > 26 ? 'aₙxⁿ+…+a₁x+a₀=0' : s + '=0'; })()],
    fields: fields.concat([{ kind: 'action', label: 'SOLVE', run: () => solvePoly(form) }, { kind: 'action', label: '◀ BACK', run: () => App.setScreen(polyForm()) }])
  });
  return form;
}
function solvePoly(back) {
  try {
    const coef = []; for (let k = PS.deg; k >= 0; k--) coef.push(PS.coef['a' + k]);
    if (coef[0] === 0) N.fail('DOMAIN');
    const roots = N.polyRoots(coef);
    const lines = ['POLY ROOT FINDER'].concat(roots.map((r, i) => ' x' + (i + 1) + '=' + (r.im === 0 ? E.fmtReal(r.re) : E.fmtScalar(new E.Cx(r.re, r.im)))));
    if (roots.some(r => r.im !== 0) && S().mode.complex === 'REAL') lines.push({ text: ' (complex roots shown)', color: COL.hint });
    App.setScreen(new App.TextScreen(lines, { titleInv: true, back }));
  } catch (err) { App.showError(err, { quit: () => App.setScreen(back) }); }
}
function sysForm() {
  return new App.Form({
    title: 'SIMULT EQN SOLVER',
    fields: [{ kind: 'choice', label: 'EQUATIONS ', opts: [2, 3, 4, 5, 6], get: () => PS.neq, set: v => PS.neq = v },
      { kind: 'choice', label: 'UNKNOWNS  ', opts: [2, 3, 4, 5, 6], get: () => PS.nvar, set: v => PS.nvar = v },
      { kind: 'info', label: '' }, { kind: 'action', label: 'NEXT ▶', run: () => App.setScreen(sysCoef()) }]
  });
}
function sysCoef() {
  const fields = []; const vn = k => 'x' + k;
  for (let i = 1; i <= PS.neq; i++) {
    fields.push({ kind: 'info', label: 'E' + i + ': ' + Array.from({ length: PS.nvar }, (_, j) => 'a' + i + (j + 1) + vn(j + 1)).join('+').slice(0, 18) + '=b' + i, color: COL.hint });
    for (let j = 1; j <= PS.nvar + 1; j++) { const key = i + ',' + j; if (PS.sys[key] === undefined) PS.sys[key] = 0; fields.push({ kind: 'num', label: ' ' + (j <= PS.nvar ? 'a' + i + ',' + j : 'b' + i) + '=', get: () => PS.sys[key], set: v => PS.sys[key] = v }); }
  }
  const form = new App.Form({ title: 'SYSTEM MATRIX (' + PS.neq + '×' + (PS.nvar + 1) + ')', fields: fields.concat([{ kind: 'action', label: 'SOLVE', run: () => solveSys(form) }, { kind: 'action', label: '◀ BACK', run: () => App.setScreen(sysForm()) }]) });
  return form;
}
function solveSys(back) {
  try {
    const M = []; for (let i = 1; i <= PS.neq; i++) { const r = []; for (let j = 1; j <= PS.nvar + 1; j++) r.push(PS.sys[i + ',' + j]); M.push(r); }
    const R = N.rref(M); const nv = PS.nvar; const lines = ['SOLUTION'];
    const inconsistent = R.some(r => r.slice(0, nv).every(v => v === 0) && r[nv] !== 0);
    const rank = R.filter(r => r.slice(0, nv).some(v => v !== 0)).length;
    if (inconsistent) lines.push(' NO SOLUTION FOUND');
    else if (rank < nv) { lines.push(' INFINITE SOLUTIONS'); lines.push({ text: ' rref of system:', color: COL.hint }); R.forEach(r => lines.push(' [' + r.map(v => App.fmtShort(v)).join(' ') + ']')); }
    else for (let j = 0; j < nv; j++) { const row = R.find(r => r[j] === 1 && r.slice(0, nv).every((v, k) => k === j || v === 0)); lines.push(' x' + (j + 1) + '=' + E.fmtReal(row ? row[nv] : 0)); }
    App.setScreen(new App.TextScreen(lines, { titleInv: true, back }));
  } catch (err) { App.showError(err, { quit: () => App.setScreen(back) }); }
}
App.plysmlt = () => new Menu([{ name: 'MAIN MENU', items: [
  { label: 'POLY ROOT FINDER', run: () => App.setScreen(polyForm()) },
  { label: 'SIMULT EQN SOLVER', run: () => App.setScreen(sysForm()) },
  { label: 'ABOUT', run: () => App.setScreen(new App.TextScreen(['PlySmlt2', ' Polynomial root finder', ' (degree 1–10) and', ' simultaneous equation', ' solver (up to 6×6).'], { titleInv: true, back: App.plysmlt() })) },
  { label: 'QUIT', run: () => App.setScreen(App.home) }] }], App.home, { title: 'PLYSMLT2  MAIN MENU' });

App.appsMenu = (target) => new Menu([{ name: 'APPLICATIONS', items: [
  { label: 'Finance…', run: () => App.setScreen(App.financeMenu(target)) },
  { label: 'PlySmlt2', run: () => App.setScreen(App.plysmlt()) }] }], target, { title: 'APPLICATIONS' });

/* ===================== MATRIX ===================== */
const dimStr = n => { const m = S().mats[n]; return m ? m.length + '×' + m[0].length : ''; };
App.matrixMenu = (target) => new Menu([
  { name: 'NAMES', items: () => E.MATS.map(m => ({ label: () => m + ' ' + dimStr(m), tok: m })) },
  { name: 'MATH', items: [it('det('), it('ᵀ'), it('dim('), it('Fill('), it('identity('), it('randM('), it('augment('), it('Matr▶list('), it('List▶matr('), it('cumSum('), it('ref('), it('rref('), it('rowSwap('), it('row+('), it('*row('), it('*row+(')] },
  { name: 'EDIT', items: () => E.MATS.map(m => ({ label: () => m + ' ' + dimStr(m), run: () => App.setScreen(matrixEditor(m)) })) }
], target);
function matrixEditor(name) {
  const st = S(); if (!st.mats[name]) st.mats[name] = [[0]];
  return {
    r: 0, c: 0, top: 0, left: 0, entry: null, dimSel: 0,
    get m() { return S().mats[name]; },
    render() {
      G.clear(); G.status(''); const g = GRIDS.big; const m = this.m; const c = G.ctx;
      G.text(g, 0, 0, 'MATRIX' + name); const rs = String(m.length), cs = String(m[0].length);
      G.text(g, 11, 0, rs, { inv: this.dimSel === 0 }); G.text(g, 11 + rs.length + 1, 0, '×'); G.text(g, 11 + rs.length + 3, 0, cs, { inv: this.dimSel === 1 });
      const CW = 96, RH = 20, x0 = 14, y0 = SB + 26;
      c.font = '15px ' + MONO; c.textAlign = 'center';
      for (let i = 0; i < 8 && this.top + i < m.length; i++) for (let j = 0; j < 3 && this.left + j < m[0].length; j++) {
        const ri = this.top + i, cj = this.left + j; const sel = this.dimSel < 0 && ri === this.r && cj === this.c;
        if (sel) { c.fillStyle = '#000'; c.fillRect(x0 + j * CW + 2, y0 + i * RH, CW - 4, RH - 2); }
        c.fillStyle = sel ? '#fff' : '#000'; c.fillText(App.fmtShort(m[ri][cj], 8), x0 + j * CW + CW / 2, y0 + i * RH + RH / 2);
      }
      c.strokeStyle = '#000'; c.lineWidth = 1.5; c.beginPath(); const h = Math.min(8, m.length) * RH; c.moveTo(x0 + 4, y0 - 2); c.lineTo(x0, y0 - 2); c.lineTo(x0, y0 + h); c.lineTo(x0 + 4, y0 + h); const xr = x0 + Math.min(3, m[0].length) * CW; c.moveTo(xr - 4, y0 - 2); c.lineTo(xr, y0 - 2); c.lineTo(xr, y0 + h); c.lineTo(xr - 4, y0 + h); c.stroke();
      c.font = '16px ' + MONO; c.textAlign = 'left'; c.fillStyle = '#000'; const by = 228;
      if (this.entry) App.entryLine(this.entry.label, this.entry.ed, 4, by);
      else if (this.dimSel < 0) c.fillText(name + '(' + (this.r + 1) + ',' + (this.c + 1) + ')=' + E.fmtReal(m[this.r][this.c]), 6, by);
      else c.fillText(this.dimSel ? 'columns' : 'rows', 6, by);
    },
    resize(R, C) { if (!Number.isInteger(R) || !Number.isInteger(C) || R < 1 || C < 1 || R > 20 || C > 20) N.fail('INVALID DIM'); const m = this.m; S().mats[name] = Array.from({ length: R }, (_, i) => Array.from({ length: C }, (_, j) => (m[i] && m[i][j] !== undefined) ? m[i][j] : 0)); this.r = Math.min(this.r, R - 1); this.c = Math.min(this.c, C - 1); App.save(); },
    key(k) {
      const m = this.m;
      if (this.entry) {
        const en = this.entry;
        if (k === '#enter') { try { const v = E.evalNumber(en.ed.toks); this.entry = null; en.cb(v); } catch (err) { this.entry = null; const self = this; App.showError(err, { quit: () => App.setScreen(self) }); } return true; }
        if (k === '#clear') { this.entry = null; return true; }
        if (App.isTok(k)) { en.ed.insert(k); return true; }
        return en.ed.key(k) || true;
      }
      if (this.dimSel >= 0) {
        if (k === '#left' || k === '#right') { this.dimSel = 1 - this.dimSel; return true; }
        if (k === '#down' || k === '#enter') { this.dimSel = -1; return true; }
        // size entry: rows → columns → first cell, like the CE
        if (App.isTok(k)) { const which = this.dimSel; this.entry = { label: (which ? 'columns' : 'rows') + '=', ed: new App.LineEditor([k]), cb: v => { if (which) { this.resize(this.m.length, v); this.dimSel = -1; this.r = 0; this.c = 0; } else { this.resize(v, this.m[0].length); this.dimSel = 1; } } }; return true; }
        return k !== '#quit' && k !== '#clear' && !k.startsWith('#') ? true : (k === '#clear' ? (App.setScreen(App.home), true) : false);
      }
      switch (k) {
        case '#up': if (this.r > 0) this.r--; else this.dimSel = 0; break;
        case '#down': if (this.r < m.length - 1) this.r++; break;
        case '#left': if (this.c > 0) this.c--; else if (this.r > 0) { this.r--; this.c = m[0].length - 1; } break;
        case '#right': if (this.c < m[0].length - 1) this.c++; else if (this.r < m.length - 1) { this.r++; this.c = 0; } break;
        case '#enter': this.entry = { label: name + '(' + (this.r + 1) + ',' + (this.c + 1) + ')=', ed: new App.LineEditor(E.numToToks(m[this.r][this.c])), cb: v => { m[this.r][this.c] = v; App.save(); this.key('#right'); } }; return true;
        case '#clear': App.setScreen(App.home); return true;
        default:
          if (App.isTok(k)) { this.entry = { label: name + '(' + (this.r + 1) + ',' + (this.c + 1) + ')=', ed: new App.LineEditor([k]), cb: v => { m[this.r][this.c] = v; App.save(); this.key('#right'); } }; return true; }
          return false;
      }
      if (this.r < this.top) this.top = this.r; if (this.r >= this.top + 8) this.top = this.r - 7; if (this.c < this.left) this.left = this.c; if (this.c >= this.left + 3) this.left = this.c - 2;
      return true;
    },
    canInsert() { return !!this.entry; }, insert(t) { if (this.entry) this.entry.ed.insert(t); }
  };
}

/* ===================== EQUATION SOLVER ===================== */
/* Numeric Solver (MATH ▸ C), CE style: E1 and E2 boxes, then the variables with SOLVE */
const solverToks = st => ['('].concat(st.solver.e1, [')', '-', '('], st.solver.e2, [')']);
App.solverEq = function () {
  const st = S(), sv = st.solver;
  if (!sv.e1) { sv.e1 = (sv.eq || []).slice(); sv.e2 = sv.eq && sv.eq.length ? ['0'] : []; } // older saved state used 0=expr
  const eds = [new App.LineEditor(sv.e1), new App.LineEditor(sv.e2)];
  const boxY = [SB + 26, SB + 92], boxH = 56;
  return {
    box: 0,
    get ed() { return eds[this.box]; },
    sync() { sv.e1 = eds[0].toks.slice(); sv.e2 = eds[1].toks.slice(); App.save(); },
    render() {
      G.clear(); G.status('ENTER EQUATION E1=E2'); const g = GRIDS.big, c = G.ctx;
      G.text(g, 5, 0, 'EQUATION SOLVER', { inv: true });
      eds.forEach((ed, i) => {
        const y = boxY[i]; c.strokeStyle = '#000'; c.lineWidth = 1.5; c.strokeRect(46.5, y + .5, 268, boxH);
        G.raw(6, y + boxH / 2, 'E' + (i + 1) + ':', g.font, COL.text);
        if (i === this.box) App.entryLine('', ed, 50, y + 12); else G.raw(50, y + 13, E.tokText(ed.toks).slice(0, 21), g.font, COL.text);
      });
      if (!eds[0].empty && !eds[1].empty) { c.strokeStyle = '#000'; c.lineWidth = 1; c.strokeRect(270.5, 222.5, 44, 16); G.raw(292, 231, 'OK', GRIDS.small.font, COL.text, 'center'); }
    },
    next() {
      this.sync(); if (eds[0].empty || eds[1].empty) { if (eds[0].empty) this.box = 0; else this.box = 1; return; }
      try { E.parseExpr(solverToks(st)); } catch (err) { const self = this; App.showError(err, { quit: () => App.setScreen(self) }); return; }
      App.setScreen(App.solverVars());
    },
    key(k) {
      if (k === '#up' || k === '#down') { this.box = k === '#up' ? 0 : 1; return true; }
      if (k === '#enter') { if (this.box === 0) { this.box = 1; this.sync(); } else this.next(); return true; }
      if (k === '#f5') { this.next(); return true; } // OK soft key (ALPHA GRAPH)
      if (k === '#clear') { this.ed.set([]); this.sync(); return true; }
      if (App.isTok(k)) { this.ed.insert(k); this.sync(); return true; }
      const r = this.ed.key(k); this.sync(); return r;
    },
    canInsert() { return true; },
    insert(t) { this.ed.insert(t); this.sync(); }
  };
};
App.solverVars = function () {
  const st = S(), toks = solverToks(st), vars = [];
  toks.forEach(t => { if (E.LETTERS.includes(t) && !vars.includes(t)) vars.push(t); });
  let solved = null, lr = null;
  const node = E.parseExpr(toks);
  const fields = vars.map(v => ({ kind: 'num', label: v + '=', key: v, get: () => st.vars[v], set: x => { st.vars[v] = x; solved = null; lr = null; App.save(); }, mark: () => solved === v }));
  fields.push({ kind: 'info', label: () => 'bound={' + E.fmtReal(st.solver.bound[0]) + ',' + E.fmtReal(st.solver.bound[1]) + '}', mark: () => false });
  fields.push({ kind: 'info', label: () => lr === null ? '' : 'E1-E2=' + E.fmtReal(lr), mark: () => lr !== null });
  const eqText = E.tokText(st.solver.e1) + '=' + E.tokText(st.solver.e2);
  const form = new App.Form({
    title: [() => eqText.slice(0, 24), ''], titleInv: false, fields,
    status: () => solved ? 'SOLUTION IS MARKED ▪' : 'SELECT VARIABLE; PRESS SOLVE',
    footer() { const c = G.ctx; c.strokeStyle = '#000'; c.lineWidth = 1.5; c.strokeRect(2.5, SB + 2.5, 312, 38); c.lineWidth = 1; c.strokeRect(262.5, 222.5, 52, 16); G.raw(288, 231, 'SOLVE', GRIDS.small.font, COL.text, 'center'); },
    onKey(k) {
      if (k === '#up' && this.cur === this.vis()[0]) { App.setScreen(App.solverEq()); return true; }
      if (k === '#f5') { this.key('#solve'); return true; } // SOLVE soft key (ALPHA GRAPH)
      return false;
    },
    onSolve(f) {
      if (!f.key) return;
      try { const fn = E.lambda(node, f.key); const x = N.solveNear(fn, st.vars[f.key] || 0, st.solver.bound[0], st.solver.bound[1]); st.vars[f.key] = N.snap(x); solved = f.key; lr = N.r12(fn(st.vars[f.key])); if (Math.abs(lr) < 1e-12) lr = 0; App.save(); }
      catch (err) { App.showError(err, { quit: () => App.setScreen(form) }); }
    }
  });
  if (!vars.length) { setTimeout(() => App.showError({ type: 'INVALID' }, { quit: () => App.setScreen(App.solverEq()) }), 0); }
  return form;
};

/* ===================== MEM ===================== */
/* Mem Management/Delete…: pick a kind, then DEL deletes the highlighted item (programs ask first) */
function memKinds() {
  const st = S();
  return [
    ['Real…', () => E.LETTERS.filter(v => st.vars[v] !== 0).map(v => ({ name: v, del: () => { st.vars[v] = 0; } }))],
    ['List…', () => E.LISTS.filter(l => st.lists[l].length).map(l => ({ name: l, del: () => { st.lists[l] = []; } })).concat(Object.keys(st.lists).filter(l => l[0] === 'ʟ').sort().map(l => ({ name: l, del: () => { delete st.lists[l]; } })))],
    ['Matrix…', () => E.MATS.filter(m => st.mats[m]).map(m => ({ name: m, del: () => { delete st.mats[m]; } }))],
    ['Y-Vars…', () => E.YN.filter(y => st.Y[y].toks.length).map(y => ({ name: y, noArch: true, del: () => { st.Y[y].toks = []; App.invalidateGraph(); } }))],
    ['Prgm…', () => Object.keys(st.programs || {}).sort().map(n => ({ name: n, ask: true, noArch: true, del: () => { delete st.programs[n]; } }))],
    ['String…', () => E.STRS.filter(k => (st.strs || {})[k] !== undefined).map(k => ({ name: k, del: () => { delete st.strs[k]; } }))],
    ['Group…', () => Object.keys(st.groups || {}).sort().map(n => ({ name: n, ask: true, noArch: true, del: () => { delete st.groups[n]; } }))]
  ];
}
function memMgmt() {
  const kinds = memKinds(), all = () => [].concat(...kinds.map(([, f]) => f()));
  return new Menu([{ name: 'MEMORY MANAGEMENT', items: [{ label: 'All…', run: () => App.setScreen(memList('ALL', all)) }].concat(kinds.map(([label, f]) => ({ label, run: () => App.setScreen(memList(label.replace('…', '').toUpperCase(), f)) }))) }], App.home, { title: 'MEMORY MANAGEMENT' });
}
function memList(title, items) {
  return {
    idx: 0,
    render() {
      G.clear(); G.status('ENTER: archive *   DEL: delete'); const g = GRIDS.big, list = items();
      G.text(g, 0, 0, title, { inv: true });
      if (!list.length) { G.text(g, 1, 2, '(nothing to delete)', { color: COL.dim }); return; }
      if (this.idx >= list.length) this.idx = list.length - 1;
      const top = Math.max(0, this.idx - 8);
      list.slice(top, top + 9).forEach((it, r) => G.text(g, 0, r + 1, (top + r === this.idx ? '▶' : ' ') + (E.isArchived(it.name) ? '*' : ' ') + it.name));
    },
    key(k) {
      const list = items();
      if (k === '#up') { this.idx = Math.max(0, this.idx - 1); return true; }
      if (k === '#down') { this.idx = Math.min(list.length - 1, this.idx + 1); return true; }
      if (k === '#clear') { App.setScreen(memMgmt()); return true; }
      if (k === '#enter' && list[this.idx]) { const it = list[this.idx]; if (!it.noArch) { E.setArchived(it.name, !E.isArchived(it.name)); App.save(); } return true; }
      if (k === '#del' && list[this.idx]) {
        const it = list[this.idx], self = this, go = () => { it.del(); E.setArchived(it.name, false); App.save(); App.setScreen(self); };
        if (it.ask) App.setScreen(new Menu([{ name: 'Are You Sure?', items: [{ label: 'No', run: () => App.setScreen(self) }, { label: 'Yes', run: go }] }], App.home, { title: 'Are You Sure?' }));
        else go();
        return true;
      }
      return k !== '#quit';
    }
  };
}

App.memMenu = () => new Menu([{ name: 'MEMORY', items: [
  { label: 'About', run: () => App.setScreen(new App.TextScreen(['Calc8X', ' Version 1.0', ' Keystrokes and menus', ' follow the TI-84 Plus CE', ' so practice transfers to', ' test day.', '', ' Made for Oakland High', ' School math students.', '', ' Not made by or endorsed', ' by Texas Instruments.', ' TI-84 Plus CE is a', ' trademark of Texas', ' Instruments.', '', ' Free for classroom use.', ' Not for sale.'], { titleInv: true })) },
  { label: 'Mem Management/Delete…', run: () => App.setScreen(memMgmt()) },
  { label: 'Clear Entries', run: () => { S().entries = []; App.home.ed.set([]); App.save(); App.setScreen(App.home); App.flash('Entries cleared'); } },
  { label: 'ClrAllLists', tok: 'ClrAllLists' },
  { label: 'Archive', tok: 'Archive ' }, { label: 'UnArchive', tok: 'UnArchive ' },
  { label: 'Reset…', sub: () => [{ name: 'RAM', items: [{ label: 'All RAM…', sub: () => [{ name: 'RESET RAM', items: [{ label: 'No', run: () => App.setScreen(App.home) }, { label: 'Reset', run: () => { E.reset(); App.home.ed.set([]); App.invalidateGraph(); App.save(); App.setScreen(App.home); App.flash('RAM cleared'); } }] }] }] },
    { name: 'DEFAULTS', items: [{ label: 'Defaults…', sub: () => [{ name: 'RESET DEFAULTS', items: [{ label: 'No', run: () => App.setScreen(App.home) }, { label: 'Reset', run: () => { const d = E.defaultState(); const st = S(); st.mode = d.mode; st.win = d.win; st.fmt = d.fmt; st.tbl = d.tbl; st.traceStep = null; App.save(); App.setScreen(App.home); App.flash('Defaults set'); } }] }] }] }] },
  { label: 'Group…', run: () => App.setScreen(groupMenu()) }] }], App.home, { title: 'MEMORY' });

/* MEM ▸ Group…: GROUP saves copies of chosen variables under a name; UNGROUP puts them back */
const GROUP_KINDS = { 'Real…': ['vars', 'Real'], 'List…': ['lists', 'List'], 'Matrix…': ['mats', 'Matrix'], 'Y-Vars…': ['Y', 'Y-Var'], 'Prgm…': ['programs', 'Prgm'], 'String…': ['strs', 'String'] };
function groupMenu() {
  const st = S();
  return new Menu([
    { name: 'GROUP', items: [{ label: 'Create New', run: () => groupName() }] },
    { name: 'UNGROUP', items: () => Object.keys(st.groups || {}).sort().map(n => ({ label: n, run: () => {
      st.groups[n].forEach(({ store, name, value }) => { const v = JSON.parse(JSON.stringify(value)); if (store === 'Y') st.Y[name].toks = v; else (st[store] || (st[store] = {}))[name] = v; E.setArchived(name, false); });
      App.invalidateGraph(); App.save(); App.setScreen(App.home); App.flash('Ungrouped ' + n);
    } })) }
  ], App.home, { title: 'GROUP' });
}
function groupName() {
  const ed = new App.LineEditor();
  App.setScreen({
    enter() { App.shift = 'alpha'; App.alphaLock = true; }, leave() { App.shift = null; App.alphaLock = false; },
    render() { G.clear(); G.status(''); G.text(GRIDS.big, 0, 0, 'GROUP', { inv: true }); App.entryLine('Name=', ed, GRIDS.big.x0, SB + GRIDS.big.rh * 1.5 + 1); },
    key(k) {
      if (k === '#clear' || k === '#quit') { App.setScreen(groupMenu()); return true; }
      if (k === '#enter') { const n = ed.toks.join(''); if (!/^[A-Zθ][A-Zθ0-9]{0,7}$/.test(n)) { App.flash('Name: a letter, then up to 7 letters or digits'); return true; } App.setScreen(groupPick(n)); return true; }
      if (App.isTok(k)) { if (ed.toks.length < 8) ed.insert(k); return true; }
      return ed.key(k) || true;
    }
  });
}
function groupPick(gname) {
  const st = S(), kinds = memKinds().filter(([l]) => GROUP_KINDS[l]), all = [].concat(...kinds.map(([l, f]) => f().map(it => ({ label: l, name: it.name })))), picked = new Set();
  return {
    idx: 0,
    render() {
      G.clear(); G.status('ENTER: select   ▶: DONE'); const g = GRIDS.big; G.text(g, 0, 0, 'SELECT', { inv: true }); G.text(g, 7, 0, 'DONE');
      if (!all.length) { G.text(g, 1, 2, '(nothing to group)', { color: COL.dim }); return; }
      const top = Math.max(0, this.idx - 8);
      all.slice(top, top + 9).forEach((it, r) => G.text(g, 0, r + 1, (top + r === this.idx ? '▶' : ' ') + (picked.has(top + r) ? '▪' : ' ') + it.name));
    },
    key(k) {
      if (k === '#up') { this.idx = Math.max(0, this.idx - 1); return true; }
      if (k === '#down') { this.idx = Math.min(all.length - 1, this.idx + 1); return true; }
      if (k === '#enter') { if (all.length) { if (picked.has(this.idx)) picked.delete(this.idx); else picked.add(this.idx); } return true; }
      if (k === '#clear') { App.setScreen(groupMenu()); return true; }
      if (k === '#right') {
        if (!picked.size) { App.flash('Select at least one variable'); return true; }
        (st.groups || (st.groups = {}))[gname] = [...picked].sort((a, b) => a - b).map(i => { const it = all[i], store = GROUP_KINDS[it.label][0]; const value = store === 'Y' ? st.Y[it.name].toks : st[store][it.name]; return { store, name: it.name, value: JSON.parse(JSON.stringify(value)) }; });
        App.save(); App.setScreen(App.home); App.flash('Group ' + gname + ' saved'); return true;
      }
      return k !== '#quit';
    }
  };
}

/* ===================== CATALOG ===================== */
const catalogItems = (() => {
  let list = Object.keys(E.FUNCS).concat(Object.keys(E.SPECIAL), Object.keys(E.COMMANDS), ['and', 'or', 'xor', 'nPr', 'nCr', 'Ans', 'rand', 'ᵀ', '▶Frac', '▶Dec', '▶DMS', '▶Rect', '▶Polar', 'LEFT', 'CENTER', 'RIGHT',
    'getDate', 'getTime', 'startTmr', 'isClockOn', 'getDtFmt', 'getTmFmt', 'u', 'v', 'w'],
    Object.keys(E.SPECIAL_VARS).filter(k => /^(plot\.|col\.|Pic\d|GDB\d|Image\d)/.test(k)));
  list = Array.from(new Set(list));
  const key = t => E.disp(t).trim().replace(/^[^A-Za-z]+/, '').toLowerCase() || '~' + t;
  return list.sort((a, b) => key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);
})();
App.catalog = function (target) {
  const tg = target && target.insert ? target : App.home;
  const sc = {
    idx: 0, top: 0,
    enter() { App.shift = 'alpha'; App.alphaLock = true; },
    leave() { if (App.alphaLock) { App.shift = null; App.alphaLock = false; } },
    render() {
      G.clear(); G.status('Press a letter to jump'); const g = GRIDS.big; G.text(g, 0, 0, 'CATALOG', { inv: true });
      const vis = g.rows - 1; if (this.idx < this.top) this.top = this.idx; if (this.idx >= this.top + vis) this.top = this.idx - vis + 1;
      for (let r = 0; r < vis && this.top + r < catalogItems.length; r++) { const i = this.top + r; G.text(g, 0, r + 1, (i === this.idx ? '▶' : ' ') + E.disp(catalogItems[i]).trim()); }
    },
    key(k) {
      if (k === '#up') { this.idx = Math.max(0, this.idx - 1); return true; }
      if (k === '#down') { this.idx = Math.min(catalogItems.length - 1, this.idx + 1); return true; }
      if (k === '#pgup') { this.idx = Math.max(0, this.idx - 9); return true; }
      if (k === '#pgdn') { this.idx = Math.min(catalogItems.length - 1, this.idx + 9); return true; }
      if (k === '#enter' || k === '#solve') { const t = catalogItems[this.idx]; this.leave(); tg.insert(t); App.setScreen(tg); return true; }
      if (k === '#clear') { App.setScreen(tg); return true; }
      if (k === '+' || k === '"') { const t = catalogItems[this.idx], self = this; App.catalogHelp(t, self, () => { self.leave(); tg.insert(t); App.setScreen(tg); }); return true; } // [+] (ALPHA is on here, so it reads as ")
      if (App.isTok(k) && /^[A-Zθ]$/.test(k)) { const i = catalogItems.findIndex(t => E.disp(t).trim().replace(/^[^A-Za-z]+/, '').toUpperCase().startsWith(k)); if (i >= 0) this.idx = i; App.shift = 'alpha'; App.alphaLock = true; return true; }
      return App.isTok(k);
    }
  };
  return sc;
};

})();
