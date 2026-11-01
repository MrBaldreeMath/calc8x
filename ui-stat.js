/* ui-stat.js — list editor, STAT / LIST / DISTR menus, stat wizards, hypothesis tests, STAT PLOT setup */
(function () {
'use strict';
const E = window.Engine, N = window.Numeric, App = window.App, G = App.G;
const { GRIDS, COL, SB, MONO } = App;
const S = () => E.getState();
const T = s => E.strToToks(s);
const fmt = v => (typeof v === 'number' ? E.fmtReal(v) : String(v));

/* ===================== LIST EDITOR ===================== */
const ListEd = App.listEditor = {
  row: 0, top: 0, col: 0, colOff: 0, entry: null,
  names() { const st = S(); return (st.edCols || E.LISTS).filter(n => st.lists[n]); }, // SetUpEditor / INS can add named lists (ʟNAME)
  render() {
    G.clear(); G.status(''); const c = G.ctx; const st = S(); const CWD = 64, RH = 16, NR = 10, top = SB + 20;
    const names = this.names().slice(this.colOff, this.colOff + 5);
    // CE look: list names left-aligned on top, black column lines, values left-aligned, ------ after the last value
    const font = GRIDS.small.font; c.font = font; c.textAlign = 'left';
    names.forEach((n, i) => { const sel = this.row === -1 && this.col === i; if (sel) { c.fillStyle = '#000'; c.fillRect(i * CWD + 1, SB + 1, CWD - 1, 18); } c.fillStyle = sel ? '#fff' : '#000'; c.fillText(n.replace(/^ʟ/, ''), i * CWD + 4, SB + 11); });
    c.strokeStyle = '#000'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, top - .5); c.lineTo(320, top - .5); c.moveTo(0, top + RH * NR + .5); c.lineTo(320, top + RH * NR + .5);
    for (let i = 1; i < 5; i++) { c.moveTo(i * CWD + .5, SB); c.lineTo(i * CWD + .5, top + RH * NR); } c.stroke();
    for (let r = 0; r < NR; r++) {
      const idx = this.top + r;
      names.forEach((n, i) => {
        const l = st.lists[n] || []; const v = l[idx]; const sel = this.row === idx && this.col === i;
        if (sel) { c.fillStyle = '#000'; c.fillRect(i * CWD + 1, top + r * RH + 1, CWD - 1, RH - 1); }
        c.fillStyle = sel ? '#fff' : '#000'; c.textAlign = 'left'; c.font = font;
        if (v !== undefined) c.fillText(E.isCx(v) ? 'cplx' : App.fmtShort(v), i * CWD + 6, top + r * RH + RH / 2 + 1);
        else if (idx === l.length) c.fillText('------', i * CWD + 6, top + r * RH + RH / 2 + 1);
      });
    }
    const by = top + RH * NR + 18; c.font = '16px ' + MONO; c.textAlign = 'left'; c.fillStyle = '#000';
    const n = names[this.col], dn = n.replace(/^ʟ/, '');
    if (this.entry) { App.entryLine(this.entry.label, this.entry.ed, 4, by); return; }
    if (this.row === -1) c.fillText(dn + '=', 6, by);
    else { const v = st.lists[n][this.row]; c.fillText(dn + '(' + (this.row + 1) + ')=' + (v === undefined ? '' : E.format(v)[0]), 6, by); }
  },
  maxRow() { return (S().lists[this.names()[this.colOff + this.col]] || []).length; },
  key(k) {
    const st = S(); const name = this.names()[this.colOff + this.col];
    if (this.entry && this.entry.nameEntry) { // INS on a list name: Name= adds a list (L₁…L₆ or a named list) to the editor here
      const en = this.entry;
      if (k === '#enter') {
        const raw = en.ed.toks; let n = raw.length === 1 && E.LISTS.includes(raw[0]) ? raw[0] : (raw[0] === 'ʟ' ? raw.slice(1) : raw).join('');
        if (!E.LISTS.includes(n)) { if (!/^[A-Zθ][A-Zθ0-9]{0,4}$/.test(n)) { App.flash('Name: a letter, then up to 4 letters or digits'); return true; } n = 'ʟ' + n; if (!st.lists[n]) st.lists[n] = []; }
        const cols = this.names().filter(c => c !== n); cols.splice(Math.min(this.colOff + this.col, cols.length), 0, n); st.edCols = cols;
        this.entry = null; App.shift = null; App.alphaLock = false; App.save(); return true;
      }
      if (k === '#clear' || k === '#quit') { this.entry = null; App.shift = null; App.alphaLock = false; return k === '#clear'; }
      if (App.isTok(k)) { en.ed.insert(k); return true; }
      return en.ed.key(k) || true;
    }
    if (this.entry) {
      const en = this.entry;
      if ((k === '#up' || k === '#down') && en.ed.vert(k === '#down' ? 1 : -1)) return true;
      if (k === '#enter' || ((k === '#down' || k === '#up') && en.cell)) {
        try {
          if (en.header) { if (en.ed.empty) st.lists[name] = []; else { const v = E.ev(E.parseExpr(en.ed.toks)); if (!E.isList(v)) N.fail('DATA TYPE'); st.lists[name] = v.slice(); } }
          else if (!en.ed.empty) { const v = E.ev(E.parseExpr(en.ed.toks)); if (E.isList(v) || E.isMat(v)) N.fail('DATA TYPE'); const l = st.lists[name]; while (l.length < this.row) l.push(0); l[this.row] = v; }
          this.entry = null; App.save();
          if (k === '#up') { if (this.row > 0) this.row--; } else if (this.row >= 0) this.row = Math.min(this.row + 1, this.maxRow());
          this.scroll();
        } catch (err) { const self = this; App.showError(err, { quit: () => { self.entry = null; App.setScreen(ListEd); }, goto: (pos) => { App.setScreen(ListEd); en.ed.cur = Math.min(pos || 0, en.ed.toks.length); } }); }
        return true;
      }
      if (k === '#clear') { en.ed.set([]); return true; }
      if (App.isTok(k)) { en.ed.insert(k); return true; }
      return en.ed.key(k) || (k === '#left' || k === '#right');
    }
    switch (k) {
      case '#up': if (this.row > -1) this.row--; this.scroll(); return true;
      case '#down': if (this.row < this.maxRow()) this.row++; this.scroll(); return true;
      case '#left': if (this.col > 0) this.col--; else if (this.colOff > 0) this.colOff--; this.row = Math.min(this.row, this.maxRow()); this.scroll(); return true;
      case '#right': if (this.col < Math.min(4, this.names().length - 1)) this.col++; else if (this.colOff + 5 < this.names().length) this.colOff++; this.row = Math.min(this.row, this.maxRow()); this.scroll(); return true;
      case '#enter':
        if (this.row === -1) { this.entry = { label: name + '=', ed: new App.LineEditor(), header: true }; return true; }
        { const v = st.lists[name][this.row]; this.entry = { label: name + '(' + (this.row + 1) + ')=', ed: new App.LineEditor(v === undefined ? [] : E.numToToks(v)), cell: true }; } return true;
      case '#clear': if (this.row === -1) { this.entry = { label: name + '=', ed: new App.LineEditor(), header: true }; return true; } this.entry = { label: name + '(' + (this.row + 1) + ')=', ed: new App.LineEditor(), cell: true }; return true;
      case '#del': if (this.row === -1) { if (this.names().length > 1) { st.edCols = this.names().filter(c => c !== name); this.col = Math.min(this.col, this.names().length - 1); App.save(); } return true; } // removes the list from the editor only
        if (this.row >= 0 && this.row < st.lists[name].length) { st.lists[name].splice(this.row, 1); App.save(); } return true;
      case '#ins': if (this.row === -1) { this.entry = { label: 'Name=', ed: new App.LineEditor(), nameEntry: true }; App.shift = 'alpha'; App.alphaLock = true; return true; }
        if (this.row >= 0) { st.lists[name].splice(this.row, 0, 0); App.save(); } return true;
    }
    if (App.isTok(k)) {
      if (this.row === -1) this.entry = { label: name + '=', ed: new App.LineEditor(), header: true };
      else this.entry = { label: name + '(' + (this.row + 1) + ')=', ed: new App.LineEditor(), cell: true };
      this.entry.ed.insert(k); return true;
    }
    return false;
  },
  insert(t) { if (this.entry) this.entry.ed.insert(t); else this.key(t); },
  scroll() { if (this.row >= 0) { if (this.row < this.top) this.top = this.row; if (this.row >= this.top + 10) this.top = this.row - 9; } }
};
E.COMMANDS['SetUpEditor '] = E.COMMANDS['SetUpEditor'] = (a) => { // SetUpEditor ʟABC,L₁ — no names puts back L₁…L₆
  const names = (a || []).map(n => { if (n.t !== 'lname') N.fail('SYNTAX'); if (!S().lists[n.n]) S().lists[n.n] = []; return n.n; });
  S().edCols = names.length ? names : null; ListEd.colOff = 0; ListEd.col = 0; return { done: true };
};
E.COMMANDS['PlotsOff '] = (a) => { const ids = a.length ? a.map(n => E.ev(n)) : [1, 2, 3]; ids.forEach(i => { if (S().plots[i - 1]) S().plots[i - 1].on = false; }); return { done: true }; };
E.COMMANDS['PlotsOn '] = (a) => { const ids = a.length ? a.map(n => E.ev(n)) : [1, 2, 3]; ids.forEach(i => { if (S().plots[i - 1]) S().plots[i - 1].on = true; }); return { done: true }; };

/* ===================== WIZARD HELPERS ===================== */
const exprField = (label, obj, key, hidden) => ({ kind: 'expr', label, get: () => obj[key], set: v => { obj[key] = v; }, hidden });
const wizVals = {};
const DRAWABLE = new Set(['Z-Test', 'T-Test', '2-SampZTest', '2-SampTTest', '1-PropZTest', '2-PropZTest', 'χ²-Test', 'χ²GOF-Test', '2-SampFTest']);
let testDraw = null, lastStored = {};
function wizard(name, specs, onGo, goLabel = 'Calculate', extra = {}) {
  const vals = wizVals[name] || (wizVals[name] = {});
  specs.forEach(s => { if (vals[s.key] === undefined) vals[s.key] = s.kind === 'choice' || s.kind === 'cycle' ? s.opts[0] : T(s.dflt || ''); });
  const fields = specs.map(s => s.kind === 'cycle'
    ? { kind: 'cycle', label: s.label, opts: s.opts, get: () => vals[s.key], set: v => { vals[s.key] = v; }, swatch: s.swatch, light: s.light, width: s.width }
    : s.kind === 'choice'
    ? { kind: 'choice', label: s.label, opts: s.opts, names: s.names, get: () => vals[s.key], set: v => { vals[s.key] = v; }, hidden: s.hidden ? () => s.hidden(vals) : undefined }
    : exprField(s.label, vals, s.key, s.hidden ? () => s.hidden(vals) : undefined));
  const form = new App.Form(Object.assign({ title: name, titleCenter: true, indent: true, fields }, extra));
  if (goLabel === 'Calculate' && DRAWABLE.has(name)) goLabel = ['Calculate', 'Draw'];
  (Array.isArray(goLabel) ? goLabel : [goLabel]).forEach(gl => form.fields.push({ kind: 'action', label: gl, run: () => {
    testDraw = gl === 'Draw' && DRAWABLE.has(name) ? { alt: vals.alt ? altIdx(vals.alt) : 2 } : null;
    try { onGo(vals, gl, form); } finally { testDraw = null; }
  } }));
  form.fixIdx();
  return form;
}
App.wizard = wizard;
/* evaluate a wizard field */
function wnum(toks, name) { if (!toks || !toks.length) N.fail('SYNTAX'); return E.evalNumber(toks); }
function wlist(toks) { if (!toks || !toks.length) N.fail('SYNTAX'); const v = E.ev(E.parseExpr(toks)); if (!E.isList(v)) N.fail('DATA TYPE'); return v.map(x => { if (typeof x !== 'number') N.fail('DATA TYPE'); return x; }); }
function wfreq(toks, n) { if (!toks || !toks.length || (toks.length === 1 && toks[0] === '1')) return undefined; const v = E.ev(E.parseExpr(toks)); if (E.isList(v)) { if (v.length !== n) N.fail('DIM MISMATCH'); return v; } return Array(n).fill(v); }
App.wnum = wnum; App.wlist = wlist;

/* ===================== STAT CALC (wizards) ===================== */
const REGS = ['Med-Med ', 'LinReg(ax+b) ', 'QuadReg ', 'CubicReg ', 'QuartReg ', 'LinReg(a+bx) ', 'LnReg ', 'ExpReg ', 'PwrReg ', 'Logistic ', 'SinReg '];
function statCalcItem(cmd) {
  return {
    label: cmd.trim(), run: (target) => {
      if (!S().mode.statWiz) { const tg = App.home; tg.insert(cmd); App.setScreen(tg); return; }
      let form;
      if (cmd === '1-Var Stats ') form = wizard('1-Var Stats', [{ key: 'L', label: 'List:', dflt: 'L₁' }, { key: 'F', label: 'FreqList:' }], v => { const t = [cmd, ...v.L]; if (v.F.length) t.push(',', ...v.F); App.home.runToks(t); });
      else if (cmd === '2-Var Stats ') form = wizard('2-Var Stats', [{ key: 'X', label: 'Xlist:', dflt: 'L₁' }, { key: 'Y', label: 'Ylist:', dflt: 'L₂' }, { key: 'F', label: 'FreqList:' }], v => { const t = [cmd, ...v.X, ',', ...v.Y]; if (v.F.length) t.push(',', ...v.F); App.home.runToks(t); });
      else form = wizard(cmd.trim(), [{ key: 'X', label: 'Xlist:', dflt: 'L₁' }, { key: 'Y', label: 'Ylist:', dflt: 'L₂' }, { key: 'F', label: 'FreqList:' }, { key: 'R', label: 'Store RegEQ:' }], v => {
        const t = [cmd, ...v.X, ',', ...v.Y]; if (v.F.length) t.push(',', ...v.F); if (v.R.length) t.push(',', ...v.R); App.home.runToks(t);
      });
      App.setScreen(form);
    }
  };
}

/* ===================== HYPOTHESIS TESTS ===================== */
const ALT = { ne: '≠', lt: '<', gt: '>' };
function pval(cdf, alt) { const c = cdf; return alt === 0 ? 2 * Math.min(c, 1 - c) : alt === 1 ? c : 1 - c; }
const altIdx = v => ({ '≠': 0, '<': 1, '>': 2 })[v[0]];
/* Draw: the test's distribution with the p-value region shaded and "z=…  p=…" at the bottom, like the CE */
function show(lines) {
  if (!testDraw) return App.setScreen(new App.ResultScreen(lines));
  const o = lastStored, num = k => { const l = lines.find(x => x.startsWith(' ' + k + '=')); return l === undefined ? NaN : wnum(E.tokenize(l.slice(k.length + 2))); };
  const key = 'z' in o ? 'z' : 't' in o ? 't' : 'χ²' in o ? 'χ²' : 'F';
  const stat = key === 'F' ? num('F') : o[key];
  let df = o.df, df2;
  if (key === 'F') { df = num('n1') - 1; df2 = num('n2') - 1; }
  App.drawTest({ dist: { z: 'z', t: 't', 'χ²': 'chi', F: 'F' }[key], name: key, stat, alt: testDraw.alt, df, df2, p: o.p });
}
function store(o) { lastStored = o; Object.assign(S().stat, o); }
function dataStats(v, suffix = '') {
  if (v.inpt === 'Data') { const xs = wlist(v['L' + suffix]); const fr = wfreq(v['F' + suffix], xs.length); const s = N.oneVar(xs, fr); return { xbar: s['x̄'], sx: s.Sx, n: s.n }; }
  return { xbar: wnum(v['x' + suffix]), sx: v['s' + suffix] ? (v['s' + suffix].length ? wnum(v['s' + suffix]) : NaN) : NaN, n: wnum(v['n' + suffix]) };
}
const D = v => v.inpt === 'Data', St = v => v.inpt !== 'Data';
const inpt = { key: 'inpt', kind: 'choice', label: 'Inpt:', opts: ['Data', 'Stats'] };
const ln = (k, v) => ' ' + k + '=' + fmt(v);
const TESTS = [
  ['Z-Test…', () => wizard('Z-Test', [inpt, { key: 'm0', label: 'μ0:', dflt: '0' }, { key: 'sig', label: 'σ:', dflt: '1' }, { key: 'L', label: 'List:', dflt: 'L₁', hidden: St }, { key: 'F', label: 'Freq:', dflt: '1', hidden: St }, { key: 'x', label: 'x̄:', dflt: '0', hidden: D }, { key: 'n', label: 'n:', dflt: '0', hidden: D }, { key: 'alt', kind: 'choice', label: 'μ:', opts: ['≠μ0', '<μ0', '>μ0'] }],
    v => tryRun(() => { const d = dataStats(v); const m0 = wnum(v.m0), sg = wnum(v.sig); const z = (d.xbar - m0) / (sg / Math.sqrt(d.n)); const p = pval(N.Phi(z), altIdx(v.alt)); store({ z, p }); show(['Z-Test', ' μ' + v.alt[0] + fmt(m0), ln('z', z), ln('p', p), ln('x̄', d.xbar)].concat(D(v) ? [ln('Sx', d.sx)] : [], [ln('n', d.n)])); }))],
  ['T-Test…', () => wizard('T-Test', [inpt, { key: 'm0', label: 'μ0:', dflt: '0' }, { key: 'L', label: 'List:', dflt: 'L₁', hidden: St }, { key: 'F', label: 'Freq:', dflt: '1', hidden: St }, { key: 'x', label: 'x̄:', dflt: '0', hidden: D }, { key: 's', label: 'Sx:', dflt: '0', hidden: D }, { key: 'n', label: 'n:', dflt: '0', hidden: D }, { key: 'alt', kind: 'choice', label: 'μ:', opts: ['≠μ0', '<μ0', '>μ0'] }],
    v => tryRun(() => { const d = dataStats(v); const m0 = wnum(v.m0); const df = d.n - 1; const t = (d.xbar - m0) / (d.sx / Math.sqrt(d.n)); const p = pval(N.tCDF(t, df), altIdx(v.alt)); store({ t, p, df }); show(['T-Test', ' μ' + v.alt[0] + fmt(m0), ln('t', t), ln('p', p), ln('df', df), ln('x̄', d.xbar), ln('Sx', d.sx), ln('n', d.n)]); }))],
  ['2-SampZTest…', () => wizard('2-SampZTest', [inpt, { key: 'sig1', label: 'σ1:', dflt: '1' }, { key: 'sig2', label: 'σ2:', dflt: '1' }, { key: 'L1', label: 'List1:', dflt: 'L₁', hidden: St }, { key: 'L2', label: 'List2:', dflt: 'L₂', hidden: St }, { key: 'F1', label: 'Freq1:', dflt: '1', hidden: St }, { key: 'F2', label: 'Freq2:', dflt: '1', hidden: St }, { key: 'x1', label: 'x̄1:', dflt: '0', hidden: D }, { key: 'n1', label: 'n1:', dflt: '0', hidden: D }, { key: 'x2', label: 'x̄2:', dflt: '0', hidden: D }, { key: 'n2', label: 'n2:', dflt: '0', hidden: D }, { key: 'alt', kind: 'choice', label: 'μ1:', opts: ['≠μ2', '<μ2', '>μ2'] }],
    v => tryRun(() => { const a = dataStats(v, '1'), b = dataStats(v, '2'); const s1 = wnum(v.sig1), s2 = wnum(v.sig2); const z = (a.xbar - b.xbar) / Math.sqrt(s1 * s1 / a.n + s2 * s2 / b.n); const p = pval(N.Phi(z), altIdx(v.alt)); store({ z, p }); show(['2-SampZTest', ' μ1' + v.alt[0] + 'μ2', ln('z', z), ln('p', p), ln('x̄1', a.xbar), ln('x̄2', b.xbar), ln('n1', a.n), ln('n2', b.n)]); }))],
  ['2-SampTTest…', () => wizard('2-SampTTest', [inpt, { key: 'L1', label: 'List1:', dflt: 'L₁', hidden: St }, { key: 'L2', label: 'List2:', dflt: 'L₂', hidden: St }, { key: 'F1', label: 'Freq1:', dflt: '1', hidden: St }, { key: 'F2', label: 'Freq2:', dflt: '1', hidden: St }, { key: 'x1', label: 'x̄1:', dflt: '0', hidden: D }, { key: 's1', label: 'Sx1:', dflt: '0', hidden: D }, { key: 'n1', label: 'n1:', dflt: '0', hidden: D }, { key: 'x2', label: 'x̄2:', dflt: '0', hidden: D }, { key: 's2', label: 'Sx2:', dflt: '0', hidden: D }, { key: 'n2', label: 'n2:', dflt: '0', hidden: D }, { key: 'alt', kind: 'choice', label: 'μ1:', opts: ['≠μ2', '<μ2', '>μ2'] }, { key: 'pool', kind: 'choice', label: 'Pooled:', opts: ['No', 'Yes'] }],
    v => tryRun(() => { const a = dataStats(v, '1'), b = dataStats(v, '2'); const r = twoT(a, b, v.pool === 'Yes'); const t = (a.xbar - b.xbar) / r.se; const p = pval(N.tCDF(t, r.df), altIdx(v.alt)); store({ t, p, df: r.df }); show(['2-SampTTest', ' μ1' + v.alt[0] + 'μ2', ln('t', t), ln('p', p), ln('df', r.df), ln('x̄1', a.xbar), ln('x̄2', b.xbar), ln('Sx1', a.sx), ln('Sx2', b.sx)].concat(r.sp ? [ln('Sxp', r.sp)] : [], [ln('n1', a.n), ln('n2', b.n)])); }))],
  ['1-PropZTest…', () => wizard('1-PropZTest', [{ key: 'p0', label: 'p0:', dflt: '.5' }, { key: 'x', label: 'x:', dflt: '0' }, { key: 'n', label: 'n:', dflt: '0' }, { key: 'alt', kind: 'choice', label: 'prop', opts: ['≠p0', '<p0', '>p0'] }],
    v => tryRun(() => { const p0 = wnum(v.p0), x = wnum(v.x), n = wnum(v.n); const ph = x / n; const z = (ph - p0) / Math.sqrt(p0 * (1 - p0) / n); const p = pval(N.Phi(z), altIdx(v.alt)); store({ z, p, 'p̂': ph }); show(['1-PropZTest', ' prop' + v.alt[0] + fmt(p0), ln('z', z), ln('p', p), ln('p̂', ph), ln('n', n)]); }))],
  ['2-PropZTest…', () => wizard('2-PropZTest', [{ key: 'x1', label: 'x1:', dflt: '0' }, { key: 'n1', label: 'n1:', dflt: '0' }, { key: 'x2', label: 'x2:', dflt: '0' }, { key: 'n2', label: 'n2:', dflt: '0' }, { key: 'alt', kind: 'choice', label: 'p1:', opts: ['≠p2', '<p2', '>p2'] }],
    v => tryRun(() => { const x1 = wnum(v.x1), n1 = wnum(v.n1), x2 = wnum(v.x2), n2 = wnum(v.n2); const p1 = x1 / n1, p2 = x2 / n2, pp = (x1 + x2) / (n1 + n2); const z = (p1 - p2) / Math.sqrt(pp * (1 - pp) * (1 / n1 + 1 / n2)); const p = pval(N.Phi(z), altIdx(v.alt)); store({ z, p, 'p̂': pp }); show(['2-PropZTest', ' p1' + v.alt[0] + 'p2', ln('z', z), ln('p', p), ln('p̂1', p1), ln('p̂2', p2), ln('p̂', pp), ln('n1', n1), ln('n2', n2)]); }))],
  ['ZInterval…', () => wizard('ZInterval', [inpt, { key: 'sig', label: 'σ:', dflt: '1' }, { key: 'L', label: 'List:', dflt: 'L₁', hidden: St }, { key: 'F', label: 'Freq:', dflt: '1', hidden: St }, { key: 'x', label: 'x̄:', dflt: '0', hidden: D }, { key: 'n', label: 'n:', dflt: '0', hidden: D }, { key: 'C', label: 'C-Level:', dflt: '.95' }],
    v => tryRun(() => { const d = dataStats(v); const sg = wnum(v.sig), C = cl(v.C); const zs = N.invPhi((1 + C) / 2); const m = zs * sg / Math.sqrt(d.n); show(['ZInterval', ' (' + fmt(d.xbar - m) + ',' + fmt(d.xbar + m) + ')', ln('x̄', d.xbar)].concat(D(v) ? [ln('Sx', d.sx)] : [], [ln('n', d.n)])); }), 'Calculate')],
  ['TInterval…', () => wizard('TInterval', [inpt, { key: 'L', label: 'List:', dflt: 'L₁', hidden: St }, { key: 'F', label: 'Freq:', dflt: '1', hidden: St }, { key: 'x', label: 'x̄:', dflt: '0', hidden: D }, { key: 's', label: 'Sx:', dflt: '0', hidden: D }, { key: 'n', label: 'n:', dflt: '0', hidden: D }, { key: 'C', label: 'C-Level:', dflt: '.95' }],
    v => tryRun(() => { const d = dataStats(v); const C = cl(v.C); const df = d.n - 1; const ts = N.invT((1 + C) / 2, df); const m = ts * d.sx / Math.sqrt(d.n); store({ df }); show(['TInterval', ' (' + fmt(d.xbar - m) + ',' + fmt(d.xbar + m) + ')', ln('x̄', d.xbar), ln('df', df), ln('Sx', d.sx), ln('n', d.n)]); }))],
  ['2-SampZInt…', () => wizard('2-SampZInt', [inpt, { key: 'sig1', label: 'σ1:', dflt: '1' }, { key: 'sig2', label: 'σ2:', dflt: '1' }, { key: 'L1', label: 'List1:', dflt: 'L₁', hidden: St }, { key: 'L2', label: 'List2:', dflt: 'L₂', hidden: St }, { key: 'F1', label: 'Freq1:', dflt: '1', hidden: St }, { key: 'F2', label: 'Freq2:', dflt: '1', hidden: St }, { key: 'x1', label: 'x̄1:', dflt: '0', hidden: D }, { key: 'n1', label: 'n1:', dflt: '0', hidden: D }, { key: 'x2', label: 'x̄2:', dflt: '0', hidden: D }, { key: 'n2', label: 'n2:', dflt: '0', hidden: D }, { key: 'C', label: 'C-Level:', dflt: '.95' }],
    v => tryRun(() => { const a = dataStats(v, '1'), b = dataStats(v, '2'); const C = cl(v.C); const zs = N.invPhi((1 + C) / 2); const m = zs * Math.sqrt(wnum(v.sig1) ** 2 / a.n + wnum(v.sig2) ** 2 / b.n); const d = a.xbar - b.xbar; show(['2-SampZInt', ' (' + fmt(d - m) + ',' + fmt(d + m) + ')', ln('x̄1', a.xbar), ln('x̄2', b.xbar), ln('n1', a.n), ln('n2', b.n)]); }))],
  ['2-SampTInt…', () => wizard('2-SampTInt', [inpt, { key: 'L1', label: 'List1:', dflt: 'L₁', hidden: St }, { key: 'L2', label: 'List2:', dflt: 'L₂', hidden: St }, { key: 'F1', label: 'Freq1:', dflt: '1', hidden: St }, { key: 'F2', label: 'Freq2:', dflt: '1', hidden: St }, { key: 'x1', label: 'x̄1:', dflt: '0', hidden: D }, { key: 's1', label: 'Sx1:', dflt: '0', hidden: D }, { key: 'n1', label: 'n1:', dflt: '0', hidden: D }, { key: 'x2', label: 'x̄2:', dflt: '0', hidden: D }, { key: 's2', label: 'Sx2:', dflt: '0', hidden: D }, { key: 'n2', label: 'n2:', dflt: '0', hidden: D }, { key: 'C', label: 'C-Level:', dflt: '.95' }, { key: 'pool', kind: 'choice', label: 'Pooled:', opts: ['No', 'Yes'] }],
    v => tryRun(() => { const a = dataStats(v, '1'), b = dataStats(v, '2'); const C = cl(v.C); const r = twoT(a, b, v.pool === 'Yes'); const ts = N.invT((1 + C) / 2, r.df); const m = ts * r.se; const d = a.xbar - b.xbar; store({ df: r.df }); show(['2-SampTInt', ' (' + fmt(d - m) + ',' + fmt(d + m) + ')', ln('df', r.df), ln('x̄1', a.xbar), ln('x̄2', b.xbar), ln('Sx1', a.sx), ln('Sx2', b.sx), ln('n1', a.n), ln('n2', b.n)]); }))],
  ['1-PropZInt…', () => wizard('1-PropZInt', [{ key: 'x', label: 'x:', dflt: '0' }, { key: 'n', label: 'n:', dflt: '0' }, { key: 'C', label: 'C-Level:', dflt: '.95' }],
    v => tryRun(() => { const x = wnum(v.x), n = wnum(v.n), C = cl(v.C); const ph = x / n; const m = N.invPhi((1 + C) / 2) * Math.sqrt(ph * (1 - ph) / n); show(['1-PropZInt', ' (' + fmt(ph - m) + ',' + fmt(ph + m) + ')', ln('p̂', ph), ln('n', n)]); }))],
  ['2-PropZInt…', () => wizard('2-PropZInt', [{ key: 'x1', label: 'x1:', dflt: '0' }, { key: 'n1', label: 'n1:', dflt: '0' }, { key: 'x2', label: 'x2:', dflt: '0' }, { key: 'n2', label: 'n2:', dflt: '0' }, { key: 'C', label: 'C-Level:', dflt: '.95' }],
    v => tryRun(() => { const x1 = wnum(v.x1), n1 = wnum(v.n1), x2 = wnum(v.x2), n2 = wnum(v.n2), C = cl(v.C); const p1 = x1 / n1, p2 = x2 / n2; const m = N.invPhi((1 + C) / 2) * Math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2); const d = p1 - p2; show(['2-PropZInt', ' (' + fmt(d - m) + ',' + fmt(d + m) + ')', ln('p̂1', p1), ln('p̂2', p2), ln('n1', n1), ln('n2', n2)]); }))],
  ['χ²-Test…', () => wizard('χ²-Test', [{ key: 'O', label: 'Observed:', dflt: '[A]' }, { key: 'Ex', label: 'Expected:', dflt: '[B]' }],
    v => tryRun(() => {
      const O = E.ev(E.parseExpr(v.O)); if (!E.isMat(O)) N.fail('DATA TYPE'); const m = O.mat; const R = m.length, Cn = m[0].length; if (R < 2 || Cn < 2) N.fail('INVALID DIM');
      const rs = m.map(r => r.reduce((a, b) => a + b, 0)), cs = m[0].map((_, j) => m.reduce((a, r) => a + r[j], 0)), tot = rs.reduce((a, b) => a + b, 0);
      const Ex = m.map((r, i) => r.map((_, j) => rs[i] * cs[j] / tot)); let x2 = 0; m.forEach((r, i) => r.forEach((o, j) => x2 += (o - Ex[i][j]) ** 2 / Ex[i][j]));
      const df = (R - 1) * (Cn - 1); const p = 1 - N.chiCDF(x2, df);
      const tn = E.tokText(v.Ex); if (E.MATS.includes(tn)) S().mats[tn] = Ex; store({ 'χ²': x2, p, df }); show(['χ²-Test', ln('χ²', x2), ln('p', p), ln('df', df)]);
    }))],
  ['χ²GOF-Test…', () => wizard('χ²GOF-Test', [{ key: 'O', label: 'Observed:', dflt: 'L₁' }, { key: 'Ex', label: 'Expected:', dflt: 'L₂' }, { key: 'df', label: 'df:', dflt: '' }],
    v => tryRun(() => { const O = wlist(v.O), Ex = wlist(v.Ex); if (O.length !== Ex.length) N.fail('DIM MISMATCH'); const ctr = O.map((o, i) => (o - Ex[i]) ** 2 / Ex[i]); const x2 = ctr.reduce((a, b) => a + b, 0); const df = wnum(v.df); const p = 1 - N.chiCDF(x2, df); store({ 'χ²': x2, p, df }); show(['χ²GOF-Test', ln('χ²', x2), ln('p', p), ln('df', df), ' CNTRB={' + ctr.map(c => App.fmtShort(c)).join(' ') + '}']); }))],
  ['2-SampFTest…', () => wizard('2-SampFTest', [inpt, { key: 'L1', label: 'List1:', dflt: 'L₁', hidden: St }, { key: 'L2', label: 'List2:', dflt: 'L₂', hidden: St }, { key: 'F1', label: 'Freq1:', dflt: '1', hidden: St }, { key: 'F2', label: 'Freq2:', dflt: '1', hidden: St }, { key: 's1', label: 'Sx1:', dflt: '0', hidden: D }, { key: 'n1', label: 'n1:', dflt: '0', hidden: D }, { key: 's2', label: 'Sx2:', dflt: '0', hidden: D }, { key: 'n2', label: 'n2:', dflt: '0', hidden: D }, { key: 'alt', kind: 'choice', label: 'σ1:', opts: ['≠σ2', '<σ2', '>σ2'] }],
    v => tryRun(() => { const a = v.inpt === 'Data' ? dataStats(v, '1') : { sx: wnum(v.s1), n: wnum(v.n1) }, b = v.inpt === 'Data' ? dataStats(v, '2') : { sx: wnum(v.s2), n: wnum(v.n2) }; const F = a.sx ** 2 / b.sx ** 2; const d1 = a.n - 1, d2 = b.n - 1; const p = pval(N.FCDF(F, d1, d2), altIdx(v.alt)); store({ F, p }); show(['2-SampFTest', ' σ1' + v.alt[0] + 'σ2', ln('F', F), ln('p', p), ln('Sx1', a.sx), ln('Sx2', b.sx), ln('n1', a.n), ln('n2', b.n)]); }))],
  ['LinRegTTest…', () => wizard('LinRegTTest', [{ key: 'X', label: 'Xlist:', dflt: 'L₁' }, { key: 'Y', label: 'Ylist:', dflt: 'L₂' }, { key: 'F', label: 'Freq:', dflt: '1' }, { key: 'alt', kind: 'choice', label: 'β & ρ:', opts: ['≠0', '<0', '>0'] }, { key: 'R', label: 'RegEQ:' }],
    v => tryRun(() => { const r = linT(v); const t = r.b / r.seb; const p = pval(N.tCDF(t, r.df), altIdx(v.alt)); store({ t, p, df: r.df, s: r.s, a: r.a, b: r.b, r: r.r, r2: r.r * r.r }); storeEq(v.R, r); show(['LinRegTTest', ' y=a+bx', ' β' + v.alt + ' and ρ' + v.alt, ln('t', t), ln('p', p), ln('df', r.df), ln('a', r.a), ln('b', r.b), ln('s', r.s), ln('r²', r.r * r.r), ln('r', r.r)]); }))],
  ['LinRegTInt…', () => wizard('LinRegTInt', [{ key: 'X', label: 'Xlist:', dflt: 'L₁' }, { key: 'Y', label: 'Ylist:', dflt: 'L₂' }, { key: 'F', label: 'Freq:', dflt: '1' }, { key: 'C', label: 'C-Level:', dflt: '.95' }, { key: 'R', label: 'RegEQ:' }],
    v => tryRun(() => { const r = linT(v); const C = cl(v.C); const m = N.invT((1 + C) / 2, r.df) * r.seb; store({ df: r.df, s: r.s }); storeEq(v.R, r); show(['LinRegTInt', ' y=a+bx', ' (' + fmt(r.b - m) + ',' + fmt(r.b + m) + ')', ln('b', r.b), ln('df', r.df), ln('s', r.s), ln('a', r.a), ln('r²', r.r * r.r), ln('r', r.r)]); }))]
];
function cl(t) { let c = wnum(t); if (c > 1 && c < 100) c /= 100; if (!(c > 0 && c < 1)) N.fail('DOMAIN'); return c; }
function twoT(a, b, pooled) {
  if (pooled) { const sp = Math.sqrt(((a.n - 1) * a.sx ** 2 + (b.n - 1) * b.sx ** 2) / (a.n + b.n - 2)); return { se: sp * Math.sqrt(1 / a.n + 1 / b.n), df: a.n + b.n - 2, sp }; }
  const v1 = a.sx ** 2 / a.n, v2 = b.sx ** 2 / b.n; return { se: Math.sqrt(v1 + v2), df: (v1 + v2) ** 2 / (v1 * v1 / (a.n - 1) + v2 * v2 / (b.n - 1)) };
}
function linT(v) {
  const xs = wlist(v.X), ys = wlist(v.Y); if (xs.length !== ys.length) N.fail('DIM MISMATCH'); const fr = wfreq(v.F, xs.length);
  const s = N.twoVar(xs, ys, fr); const b = s._sp / s._ssx, a = s['ȳ'] - b * s['x̄']; const n = s.n; const df = n - 2; if (df < 1) N.fail('STAT');
  let sse = 0; xs.forEach((x, i) => sse += (fr ? fr[i] : 1) * (ys[i] - a - b * x) ** 2); const se = Math.sqrt(sse / df);
  return { a, b, df, s: se, seb: se / Math.sqrt(s._ssx), r: s._sp / Math.sqrt(s._ssx * s._ssy) };
}
function storeEq(R, r) { const eq = E.regEqToks(E.REG['LinReg(a+bx) '], { a: r.a, b: r.b }); S().regEQ = eq; if (R && R.length && E.YN.includes(R[0])) { S().Y[R[0]].toks = eq.slice(); S().Y[R[0]].on = true; } }
function tryRun(f) { try { f(); App.save(); } catch (err) { const back = App.screen; App.showError(err, { quit: () => App.setScreen(back) }); } }

App.statMenu = (target) => new App.Menu([
  { name: 'EDIT', items: [{ label: 'Edit…', run: () => App.setScreen(ListEd) }, { label: 'SortA(', tok: 'SortA(' }, { label: 'SortD(', tok: 'SortD(' }, { label: 'ClrList', tok: 'ClrList ' }, { label: 'SetUpEditor', tok: 'SetUpEditor' }] },
  { name: 'CALC', items: ['1-Var Stats ', '2-Var Stats '].concat(REGS).map(statCalcItem).concat([{ label: 'Manual-Fit Y=mX+b', run: () => {
    if (!S().mode.statWiz) { App.home.insert('Manual-Fit '); App.setScreen(App.home); return; }
    App.setScreen(wizard('Manual-Fit', [{ key: 'R', label: 'Store EQ:' }], v => { if (v.R.length && !E.YN.includes(v.R.join(''))) return tryRun(() => N.fail('SYNTAX')); App.manualFit(v.R.length ? v.R.join('') : null); }));
  } }, { label: 'QuickPlot&Fit-EQ', run: () => App.quickPlot() }]) },
  { name: 'TESTS', items: TESTS.map(([label, mk]) => ({ label, run: () => App.setScreen(mk()) })).concat([{ label: 'ANOVA(', tok: 'ANOVA(' }]) }
], target);

App.listMenu = (target) => new App.Menu([
  { name: 'NAMES', items: () => E.LISTS.map(l => ({ label: l, tok: l })).concat(Object.keys(S().lists).filter(n => n[0] === 'ʟ').sort().map(n => ({ label: n, toks: ['ʟ', ...App.cells(n.slice(1))] }))) },
  { name: 'OPS', items: ['SortA(', 'SortD(', 'dim(', 'Fill(', 'seq(', 'cumSum(', 'ΔList(', 'Select(', 'augment(', 'List▶matr(', 'Matr▶list(', 'ʟ']
    .map(t => ({ label: t, tok: t })) },
  { name: 'MATH', items: ['min(', 'max(', 'mean(', 'median(', 'sum(', 'prod(', 'stdDev(', 'variance('].map(t => ({ label: t, tok: t })) }
], target);

/* ===================== DISTR (with wizards) ===================== */
const DIST = [
  ['normalpdf(', [['x', 'x:'], ['m', 'μ:', '0'], ['s', 'σ:', '1']]],
  ['normalcdf(', [['lo', 'lower:', '⁻1ᴇ99'], ['hi', 'upper:'], ['m', 'μ:', '0'], ['s', 'σ:', '1']]],
  ['invNorm(', [['a', 'area:'], ['m', 'μ:', '0'], ['s', 'σ:', '1']], true],
  ['invT(', [['a', 'area:'], ['df', 'df:']]],
  ['tpdf(', [['x', 'x:'], ['df', 'df:']]],
  ['tcdf(', [['lo', 'lower:', '⁻1ᴇ99'], ['hi', 'upper:'], ['df', 'df:']]],
  ['χ²pdf(', [['x', 'x:'], ['df', 'df:']]],
  ['χ²cdf(', [['lo', 'lower:'], ['hi', 'upper:'], ['df', 'df:']]],
  ['Fpdf(', [['x', 'x:'], ['n', 'df1:'], ['d', 'df2:']]],
  ['Fcdf(', [['lo', 'lower:'], ['hi', 'upper:'], ['n', 'df1:'], ['d', 'df2:']]],
  ['binompdf(', [['n', 'trials:'], ['p', 'p:'], ['x', 'x value:']]],
  ['binomcdf(', [['n', 'trials:'], ['p', 'p:'], ['x', 'x value:']]],
  ['invBinom(', [['a', 'area:'], ['n', 'trials:'], ['p', 'p:']]],
  ['poissonpdf(', [['m', 'μ:'], ['x', 'x value:']]],
  ['poissoncdf(', [['m', 'μ:'], ['x', 'x value:']]],
  ['geometpdf(', [['p', 'p:'], ['x', 'x value:']]],
  ['geometcdf(', [['p', 'p:'], ['x', 'x value:']]]
];
function distItem([tok, args, tail]) {
  return {
    label: tok, run: (target) => {
      const tgt = target && target.insert ? target : App.home;
      if (!S().mode.statWiz) { tgt.insert(tok); App.setScreen(tgt); return; }
      const specs = args.map(([key, label, d]) => ({ key, label, dflt: d || '' }));
      if (tail) specs.push({ key: 'tail', kind: 'choice', label: 'Tail:', opts: ['LEFT', 'CENTER', 'RIGHT'] });
      const form = wizard(tok.replace('(', ''), specs, (v) => {
        const parts = args.map(([k]) => v[k]); while (parts.length && !parts[parts.length - 1].length) parts.pop();
        const out = [tok]; parts.forEach((p, i) => { if (i) out.push(','); out.push(...p); });
        if (tail && v.tail !== 'LEFT') out.push(',', v.tail);
        out.push(')'); out.forEach(t => tgt.insert(t)); App.setScreen(tgt);
      }, 'Paste');
      App.setScreen(form);
    }
  };
}
/* DISTR ▸ DRAW: wizards that shade the area right away (Draw), like the CE */
const SHADES = [
  ['ShadeNorm(', [['lo', 'lower:', '⁻1ᴇ99'], ['hi', 'upper:'], ['m', 'μ:', '0'], ['s', 'σ:', '1']]],
  ['Shade_t(', [['lo', 'lower:', '⁻1ᴇ99'], ['hi', 'upper:'], ['df', 'df:']]],
  ['Shadeχ²(', [['lo', 'lower:', '0'], ['hi', 'upper:'], ['df', 'df:']]],
  ['ShadeF(', [['lo', 'lower:', '0'], ['hi', 'upper:'], ['n', 'numerator df:'], ['d', 'denominator df:']]]
];
function shadeItem([tok, args]) {
  return { label: tok, run: (target) => {
    if (!S().mode.statWiz) { const tgt = target && target.insert ? target : App.home; tgt.insert(tok); App.setScreen(tgt); return; }
    const hex = n => (App.COLORS.find(c => c[0] === n) || [])[1];
    const specs = args.map(([key, label, d]) => ({ key, label, dflt: d || '' })).concat([{ key: 'col', kind: 'cycle', label: 'Color:', opts: App.COLORS.map(c => c[0]), swatch: hex, light: n => App.LIGHT_COLORS.has(n) }]);
    App.setScreen(wizard(tok.replace('(', ''), specs, v => {
      const out = [tok]; args.forEach(([k], i) => { if (i) out.push(','); out.push(...v[k]); }); out.push(')');
      App.nextShadeColor = hex(v.col); App.home.runToks(out);
    }, 'Draw'));
  } };
}
App.distrMenu = (target) => new App.Menu([
  { name: 'DISTR', items: DIST.map(distItem) },
  { name: 'DRAW', items: SHADES.map(shadeItem) }
], target);

/* ===================== STAT PLOT ===================== */
// TI order of the Type icons; NormProbPlot is shown but not available yet
const TYPES = ['scatter', 'xyLine', 'histogram', 'modbox', 'box', 'normprob'];
const MARKS = ['□', '+', '▪', '·'];
const PCOLORS = App.COLORS, LIGHT = App.LIGHT_COLORS;
const hasY = p => p.type === 'scatter' || p.type === 'xyLine';
const hasMark = p => p.type !== 'histogram' && p.type !== 'box';
/* little picture of a plot type in a 24×12 box with top-left (x, y) */
function plotIcon(c, type, x, y, color) {
  c.save(); c.strokeStyle = color; c.fillStyle = color; c.lineWidth = 1;
  const axes = () => { c.beginPath(); c.moveTo(x + .5, y); c.lineTo(x + .5, y + 11.5); c.lineTo(x + 24, y + 11.5); c.stroke(); };
  const line = pts => { c.beginPath(); pts.forEach(([a, b], k) => k ? c.lineTo(x + a, y + b) : c.moveTo(x + a, y + b)); c.stroke(); };
  const box = (lo, q1, q3, hi) => { line([[lo, 6.5], [q1, 6.5]]); line([[q3, 6.5], [hi, 6.5]]); c.strokeRect(x + q1 + .5, y + 2.5, q3 - q1, 8); line([[11.5, 2.5], [11.5, 10.5]]); };
  switch (type) {
    case 'scatter': axes(); [[5, 8], [9, 6], [13, 7], [17, 4], [21, 2]].forEach(([a, b]) => c.fillRect(x + a, y + b, 1.6, 1.6)); break;
    case 'xyLine': axes(); line([[3, 9], [9, 4], [14, 7], [22, 2]]); break;
    case 'histogram': line([[0, 11.5], [24, 11.5]]); [7, 11, 5, 2].forEach((h, k) => c.strokeRect(x + 2.5 + k * 5, y + 11.5 - h, 5, h)); break;
    case 'modbox': box(4, 8, 16, 19); c.fillRect(x, y + 6, 1.6, 1.6); c.fillRect(x + 22, y + 6, 1.6, 1.6); break;
    case 'box': box(1, 7, 16, 23); break;
    case 'normprob': axes(); [[4, 9], [8, 8], [12, 6], [16, 5], [20, 3]].forEach(([a, b]) => c.fillRect(x + a, y + b, 1.6, 1.6)); break;
  }
  c.restore();
}
/* 2nd Y= : STAT PLOTS menu, each plot with a small summary line under it */
App.statPlotMenu = () => ({
  idx: 0,
  render() {
    G.clear(); G.status(App.flashMsg || ''); const g = GRIDS.big, sm = GRIDS.small, c = G.ctx, st = S();
    G.text(g, 0, 0, 'STAT PLOTS', { inv: true });
    const big = (y, k, label) => { // "1:Label" with "1:" highlighted when selected
      if (this.idx === k) { c.fillStyle = COL.inv; c.fillRect(g.x0, y + 1, 2 * g.cw, g.rh - 1); }
      App.cells((k + 1) + ':' + label).forEach((ch, j) => G.raw(g.x0 + j * g.cw + g.cw / 2, y + g.rh / 2 + 1, ch, g.font, j < 2 && this.idx === k ? COL.invText : COL.text, 'center'));
    };
    let y = SB + g.rh;
    st.plots.forEach((p, k) => {
      big(y, k, 'Plot' + (k + 1) + '…' + (p.on ? 'On' : 'Off')); y += g.rh;
      plotIcon(c, p.type, 28, y + 1, p.color);
      G.raw(62, y + 7.5, p.x || '', sm.font, COL.text); G.raw(110, y + 7.5, hasY(p) ? (p.y || '') : (p.freq || '1'), sm.font, COL.text);
      if (hasMark(p)) App.drawMark(c, p.mark, 166, y + 7, COL.text);
      y += 16;
    });
    big(y, 3, 'PlotsOff'); big(y + g.rh, 4, 'PlotsOn');
  },
  choose(k) {
    if (k < 3) { App.setScreen(App.plotEditor(k)); return; }
    App.setScreen(App.home); App.home.insert(k === 3 ? 'PlotsOff ' : 'PlotsOn ');
  },
  key(k) {
    if (k === '#up') { this.idx = (this.idx + 4) % 5; return true; }
    if (k === '#down') { this.idx = (this.idx + 1) % 5; return true; }
    if (k === '#enter') { this.choose(this.idx); return true; }
    if (k === '#clear') { App.setScreen(App.home); return true; }
    if (/^[1-5]$/.test(k)) { this.idx = Number(k) - 1; this.choose(this.idx); return true; }
    return App.isTok(k);
  }
});
/* Plot1/Plot2/Plot3 editor: tabs, On/Off, Type icons, lists, Mark, Color */
App.plotEditor = function (i) {
  const LABEL = { x: 'Xlist:', y: 'Ylist:', freq: 'Freq:' };
  const scr = {
    i, field: 'onoff', opt: 0, ed: null, dirty: false,
    get p() { return S().plots[this.i]; },
    fields() { const p = this.p; if (p.type === 'normprob') return ['tabs', 'onoff', 'type', 'x', 'axis', 'mark', 'color']; return ['tabs', 'onoff', 'type', 'x', hasY(p) ? 'y' : 'freq'].concat(hasMark(p) ? ['mark'] : [], ['color']); },
    opts(f) { return { tabs: [0, 1, 2], onoff: [true, false], type: TYPES, mark: MARKS, color: PCOLORS.map(c => c[1]), axis: ['X', 'Y'] }[f]; },
    value(f) { const p = this.p; return { tabs: this.i, onoff: p.on, type: p.type, mark: p.mark, color: p.color, axis: p.axis || 'X' }[f]; },
    focus(f) {
      this.field = f; this.ed = null; this.dirty = false; const o = this.opts(f);
      if (o) this.opt = Math.max(0, o.indexOf(this.value(f)));
      else { this.ed = new App.LineEditor(this.p[f] ? E.strToToks(this.p[f]) : []); this.ed.cur = 0; this.ed.fresh = true; } // typing replaces the list name
    },
    /* save a typed list name; anything but L₁–L₆ (or a whole number for Freq) is ERROR: DATA TYPE */
    commit(silent) {
      if (!this.ed || !this.dirty) return true;
      const key = this.field, s = E.tokText(this.ed.toks);
      if (s && !E.LISTS.includes(s) && !(key === 'freq' && /^[0-9]+$/.test(s))) {
        if (!silent) { try { N.fail('DATA TYPE'); } catch (err) { App.showError(err, { quit: () => { this.focus(key); App.setScreen(this); } }); } }
        return false;
      }
      this.p[key] = s || (key === 'freq' ? '1' : ''); this.dirty = false; App.save(); return true;
    },
    move(d) { if (!this.commit()) return; const F = this.fields(); this.focus(F[Math.min(F.length - 1, Math.max(0, F.indexOf(this.field) + d))]); },
    render() {
      G.clear(); G.status(App.flashMsg || ''); const g = GRIDS.big, c = G.ctx, p = this.p;
      const top = r => SB + r * g.rh;
      const box = (x, r, w, onDark) => { if (!App.blinkOn) return; c.strokeStyle = onDark ? '#ffcf5a' : '#000'; c.lineWidth = 1.5; c.strokeRect(x + .5, top(r) + 1.5, w - 1, g.rh - 2); };
      const sel = (x, r, w) => { c.fillStyle = COL.inv; c.fillRect(x, top(r) + 1, w, g.rh - 1); };
      this.fields().forEach((f, r) => {
        const cur = f === this.field;
        if (f === 'tabs') [0, 1, 2].forEach(k => { // small-font tabs like the CE
          const sm = GRIDS.small, x = g.x0 + k * 46, w = 5 * sm.cw + 4;
          if (k === this.i) sel(x, r, w); G.raw(x + w / 2, top(r) + g.rh / 2 + 1, 'Plot' + (k + 1), sm.font, k === this.i ? COL.invText : COL.text, 'center');
          if (cur && k === this.i) box(x, r, w, true);
        });
        else if (f === 'onoff') [['On', true, 0], ['Off', false, 3]].forEach(([s, v, col], k) => { G.text(g, col, r, s, { inv: p.on === v }); if (cur && this.opt === k) box(g.x0 + col * g.cw, r, s.length * g.cw, p.on === v); });
        else if (f === 'type') {
          G.text(g, 0, r, 'Type:');
          TYPES.forEach((t, k) => { const x = 66 + k * 41, on = p.type === t; if (on) sel(x, r, 32); plotIcon(c, t, x + 4, top(r) + 5, on ? COL.invText : COL.text); if (cur && this.opt === k) box(x, r, 32, on); });
        } else if (f === 'mark') {
          G.text(g, 0, r, 'Mark', {}); G.text(g, 5, r, ':');
          MARKS.forEach((m, k) => { const x = 76 + k * 30, on = p.mark === m; if (on) sel(x, r, 20); App.drawMark(c, m, x + 10, top(r) + 11, on ? COL.invText : COL.text); if (cur && this.opt === k) box(x, r, 20, on); });
        } else if (f === 'axis') {
          G.text(g, 0, r, 'Data Axis:'); ['X', 'Y'].forEach((a, k) => { const x = g.x0 + (11 + k * 2) * g.cw, on = (p.axis || 'X') === a; if (on) sel(x, r, g.cw); G.raw(x + g.cw / 2, top(r) + g.rh / 2 + 1, a, g.font, on ? COL.invText : COL.text, 'center'); if (cur && this.opt === k) box(x, r, g.cw, on); });
        } else if (f === 'color') {
          G.text(g, 0, r, 'Color:'); const x = 76, w = 160, name = (PCOLORS.find(pc => pc[1] === p.color) || ['', ''])[0];
          c.fillStyle = p.color; c.fillRect(x, top(r) + 2, w, g.rh - 3);
          G.raw(x + w / 2, top(r) + g.rh / 2 + 1, name, g.font, LIGHT.has(name) ? COL.text : COL.invText, 'center');
          if (cur && App.blinkOn) { c.strokeStyle = '#000'; c.lineWidth = 1.5; c.strokeRect(x - 1.5, top(r) + .5, w + 3, g.rh); }
        } else {
          const lab = f === 'x' && p.type === 'normprob' ? 'Data List:' : LABEL[f]; G.text(g, 0, r, lab);
          if (cur && this.ed) this.ed.render(g, lab.length, r, g.cols - lab.length, true, 1); else G.text(g, lab.length, r, p[f] || '');
        }
      });
    },
    key(k) {
      const f = this.field, o = this.opts(f), p = this.p, lr = k === '#left' ? -1 : k === '#right' ? 1 : 0;
      if (k === '#up') { this.move(-1); return true; }
      if (k === '#down') { this.move(1); return true; }
      if (k === '#clear') { if (this.ed) { this.ed.set([]); this.dirty = true; } else App.setScreen(App.home); return true; }
      if (f === 'tabs') { if (lr) { this.i = (this.i + lr + 3) % 3; } return k !== '#quit' && (App.isTok(k) || !!lr || k === '#enter'); }
      if (f === 'color') { if (lr) { const n = PCOLORS.length, j = PCOLORS.findIndex(pc => pc[1] === p.color); p.color = PCOLORS[((j < 0 ? 0 : j) + lr + n) % n][1]; App.save(); } return k !== '#quit' && (App.isTok(k) || !!lr || k === '#enter'); }
      if (o) {
        if (lr) { this.opt = (this.opt + lr + o.length) % o.length; return true; }
        if (k === '#enter') {
          const v = o[this.opt];
          p[{ onoff: 'on', type: 'type', mark: 'mark', axis: 'axis' }[f]] = v; App.save(); return true;
        }
        return App.isTok(k);
      }
      if (this.ed) {
        if (k === '#enter') { if (this.commit()) this.move(1); return true; }
        if (App.isTok(k)) { this.ed.insert(k); this.dirty = true; return true; }
        if (k === '#del' || k === '#bksp') { this.ed.key(k); this.dirty = true; return true; }
        if (this.ed.key(k)) return true;
      }
      return false;
    },
    canInsert() { return !!this.ed; },
    insert(t) { if (this.ed) { this.ed.insert(t); this.dirty = true; } },
    leave() { this.commit(true); }
  };
  scr.focus('onoff');
  return scr;
};
})();
