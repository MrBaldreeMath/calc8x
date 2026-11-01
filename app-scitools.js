/* app-scitools.js — APPS ▸ SciTools: sig-fig calculator, data/graphs wizard, vector calculator, unit converter */
(function () {
'use strict';
const E = window.Engine, N = window.Numeric, App = window.App, G = App.G, { GRIDS, COL, SB, W, H } = App;
const S = () => E.getState();
const fmt = v => E.fmtReal(N.r12(v));

App.sciTools = () => new App.Menu([{ name: 'SCITOOLS', items: [
  { label: 'SIG-FIG CALCULATOR', run: () => App.setScreen(sigFig()) },
  { label: 'DATA/GRAPHS WIZARD', run: () => App.setScreen(dataWizard()) },
  { label: 'VECTOR CALCULATOR', run: () => App.setScreen(vectors()) },
  { label: 'UNIT CONVERTER', run: () => App.setScreen(unitMenu()) }
] }], App.home, { title: 'SCITOOLS' });

/* ---------- SIG-FIG CALCULATOR: + − × ÷ and parentheses on measured numbers, answer rounded by the sig-fig rules ---------- */
function sigParse(toks) {
  let i = 0; const peek = () => toks[i];
  const lit = () => { // a measured number: count its significant figures and its last significant place
    let s = ''; while (i < toks.length && /^[0-9.]$/.test(toks[i])) s += toks[i++];
    let ex = 0; if (peek() === 'ᴇ') { i++; let neg = false; if (peek() === '⁻') { neg = true; i++; } let e = ''; while (i < toks.length && /^[0-9]$/.test(toks[i])) e += toks[i++]; ex = (neg ? -1 : 1) * Number(e || 'x'); }
    if (!/^(\d+\.?\d*|\.\d+)$/.test(s) || !isFinite(ex)) N.fail('SYNTAX');
    const dot = s.indexOf('.'), digits = s.replace('.', ''), firstNZ = digits.search(/[1-9]/);
    const intLen = dot < 0 ? s.length : dot, decimals = dot < 0 ? 0 : s.length - dot - 1;
    let sf, lsd;
    if (firstNZ < 0) { sf = Math.max(1, decimals); lsd = -decimals + ex; } // zero
    else if (dot < 0) { const trimmed = digits.replace(/0+$/, ''); sf = trimmed.length - firstNZ; lsd = intLen - trimmed.length + ex; } // trailing zeros without a point don't count
    else { sf = digits.length - firstNZ; lsd = -decimals + ex; }
    return { v: Number(s) * Math.pow(10, ex), sf, lsd };
  };
  const mag = v => v === 0 ? 0 : Math.floor(Math.log10(Math.abs(v)));
  const fromLsd = (v, lsd) => ({ v, lsd, sf: Math.max(1, mag(v) - lsd + 1) });
  const fromSf = (v, sf) => ({ v, sf, lsd: mag(v) - sf + 1 });
  const atom = () => {
    if (peek() === '⁻') { i++; const a = atom(); return Object.assign({}, a, { v: -a.v }); }
    if (peek() === '(') { i++; const a = sum(); if (peek() !== ')') N.fail('SYNTAX'); i++; return a; }
    return lit();
  };
  const prod = () => { let a = atom(); while (peek() === '*' || peek() === '/') { const op = toks[i++], b = atom(); if (op === '/' && b.v === 0) N.fail('DIVIDE BY 0'); a = fromSf(op === '*' ? a.v * b.v : a.v / b.v, Math.min(a.sf, b.sf)); } return a; };
  const sum = () => { let a = prod(); while (peek() === '+' || peek() === '-') { const op = toks[i++], b = prod(); a = fromLsd(op === '+' ? a.v + b.v : a.v - b.v, Math.max(a.lsd, b.lsd)); } return a; };
  const r = sum(); if (i < toks.length) N.fail('SYNTAX'); return r;
}
function sigText(r) {
  // round at the last significant place in decimal (4.85 → 4.9), then show exactly sf digits
  const scaled = Number((Math.abs(r.v) / Math.pow(10, r.lsd)).toPrecision(12)), v = Math.sign(r.v) * Math.round(scaled) * Math.pow(10, r.lsd);
  const p = Math.min(Math.max(r.sf, 1), 15); let s = Number(v.toPrecision(12)).toPrecision(p);
  if (/e/.test(s)) { const [m, e] = s.split('e'); s = m + 'ᴇ' + Number(e); }
  return s.replace(/-/g, '⁻');
}
App.sigFig = (toks) => { const r = sigParse(toks); return { text: sigText(r), sf: r.sf }; };
function sigFig() {
  const ed = new App.LineEditor(), hist = [];
  return {
    render() {
      G.clear(); G.status('SIG-FIG: + − × ÷ ( )  [clear] quit'); const g = GRIDS.big;
      G.text(g, 0, 0, 'SIG-FIG CALCULATOR', { inv: true });
      hist.slice(-3).forEach((h, k) => { G.text(g, 0, 1 + k * 2, h[0]); G.text(g, Math.max(0, g.cols - App.cells(h[1]).length), 2 + k * 2, h[1]); });
      App.entryLine('', ed, g.x0, SB + g.rh * 8.5 + 1);
    },
    key(k) {
      if (k === '#enter') { if (ed.empty) return true; try { const r = App.sigFig(ed.toks); hist.push([ed.text(), r.text + ' (' + r.sf + ' s.f.)']); ed.set([]); } catch (e) { const self = this; App.showError(e, { quit: () => App.setScreen(self) }); } return true; }
      if (k === '#clear') { if (ed.empty) App.setScreen(App.sciTools()); else ed.set([]); return true; }
      if (App.isTok(k)) { if (/^[0-9.()*/+\-⁻ᴇ]$/.test(k)) ed.insert(k); return true; }
      return ed.key(k) || k !== '#quit';
    }
  };
}

/* ---------- DATA/GRAPHS WIZARD: pick lists, a graph and an optional fit; it sets Plot1 and ZoomStat ---------- */
const FITS = { None: null, LinReg: 'LinReg(ax+b) ', QuadReg: 'QuadReg ', ExpReg: 'ExpReg ', PwrReg: 'PwrReg ' };
function dataWizard() {
  const v = { X: ['L₁'], Y: ['L₂'], type: 'Scatter', fit: 'None' };
  const lst = (label, key) => ({ kind: 'expr', label, get: () => v[key], set: t => { v[key] = t; } });
  const form = new App.Form({ title: 'DATA/GRAPHS WIZARD', titleCenter: true, fields: [
    lst('Xlist:', 'X'), lst('Ylist:', 'Y'),
    { kind: 'choice', label: 'Graph: ', opts: ['Scatter', 'xyLine', 'Histogram', 'Box'], get: () => v.type, set: x => { v.type = x; } },
    { kind: 'choice', label: 'Fit: ', opts: Object.keys(FITS), get: () => v.fit, set: x => { v.fit = x; } },
    { kind: 'action', label: 'GRAPH', run: () => {
      try {
        const xn = v.X.join(''), yn = v.Y.join(''), st = S(); if (!E.isListName(xn) || !st.lists[xn]) N.fail('UNDEFINED');
        const one = v.type === 'Histogram' || v.type === 'Box'; if (!one && (!E.isListName(yn) || !st.lists[yn])) N.fail('UNDEFINED');
        st.plots.forEach((p, i) => { p.on = i === 0; }); Object.assign(st.plots[0], { type: { Scatter: 'scatter', xyLine: 'xyLine', Histogram: 'histogram', Box: 'box' }[v.type], x: xn, y: one ? null : yn, freq: '1' });
        st.draw = st.draw.filter(d => !d.qp);
        if (FITS[v.fit] && !one) { E.run([FITS[v.fit], xn, ',', yn]); st.draw.push({ t: 'fn', toks: st.regEQ.slice(), color: '#e0201b', qp: true }); }
        E.run(['ZoomStat']); App.invalidateGraph(); App.save(); App.graph.mode = 'idle'; App.setScreen(App.graph);
      } catch (e) { App.showError(e, { quit: () => App.setScreen(form) }); }
    } }
  ] });
  form.fixIdx(); return form;
}

/* ---------- VECTOR CALCULATOR: U and V (2-D or 3-D) ---------- */
function vectors() {
  const v = { ux: 3, uy: 4, uz: 0, vx: 1, vy: 2, vz: 0 }; const num = (label, k) => ({ kind: 'num', label, get: () => v[k], set: x => { v[k] = x; } });
  const U = () => [v.ux, v.uy, v.uz], V = () => [v.vx, v.vy, v.vz], len = a => Math.hypot(...a), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const vec = a => '[' + a.map(fmt).join(' ') + ']';
  let form;
  const show = lines => App.setScreen(new App.TextScreen(['VECTOR RESULT'].concat(lines), { titleInv: true, back: form }));
  const act = (label, f) => ({ kind: 'action', label, run: () => { try { show(f()); } catch (e) { App.showError(e, { quit: () => App.setScreen(form) }); } } });
  form = new App.Form({ title: 'VECTOR CALCULATOR', titleCenter: true, fields: [
    num('U x=', 'ux'), num('U y=', 'uy'), num('U z=', 'uz'), num('V x=', 'vx'), num('V y=', 'vy'), num('V z=', 'vz'),
    act('U+V  U−V', () => ['U+V=' + vec(U().map((a, i) => a + V()[i])), 'U−V=' + vec(U().map((a, i) => a - V()[i]))]),
    act('U·V  U×V', () => { const a = U(), b = V(); return ['U·V=' + fmt(dot(a, b)), 'U×V=' + vec([a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]])]; }),
    act('|U| |V| angle', () => { const a = U(), b = V(); if (!len(a) || !len(b)) N.fail('DOMAIN'); const ang = Math.acos(Math.max(-1, Math.min(1, dot(a, b) / len(a) / len(b)))); const deg = S().mode.angle === 'DEGREE';
      return ['|U|=' + fmt(len(a)), '|V|=' + fmt(len(b)), 'angle=' + fmt(deg ? ang * 180 / Math.PI : ang) + (deg ? '°' : ' rad'), 'U direction=' + fmt(Math.atan2(a[1], a[0]) * (deg ? 180 / Math.PI : 1)) + (deg ? '°' : '')]; })
  ] });
  form.fixIdx(); return form;
}

/* ---------- UNIT CONVERTER ---------- */
// factor to the base unit of each kind (temperature is handled by formulas)
const UNITS = {
  LENGTH: { mm: 1e-3, cm: 1e-2, m: 1, km: 1e3, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344 },
  AREA: { 'cm²': 1e-4, 'm²': 1, 'km²': 1e6, 'in²': 0.00064516, 'ft²': 0.09290304, 'yd²': 0.83612736, 'mi²': 2589988.110336, acre: 4046.8564224, hectare: 1e4 },
  VOLUME: { mL: 1e-3, L: 1, 'cm³': 1e-3, 'm³': 1e3, 'in³': 0.016387064, 'ft³': 28.316846592, gal: 3.785411784, qt: 0.946352946, pt: 0.473176473, cup: 0.2365882365, 'fl oz': 0.0295735295625 },
  TIME: { s: 1, min: 60, hr: 3600, day: 86400, week: 604800, yr: 31557600 },
  TEMPERATURE: { '°C': 'C', '°F': 'F', K: 'K' },
  SPEED: { 'm/s': 1, 'km/hr': 1 / 3.6, 'ft/s': 0.3048, 'mi/hr': 0.44704, knot: 1852 / 3600 },
  PRESSURE: { Pa: 1, kPa: 1e3, atm: 101325, mmHg: 133.322387415, psi: 6894.757293168, bar: 1e5 },
  FORCE: { N: 1, dyne: 1e-5, lbf: 4.4482216152605 },
  ENERGY: { J: 1, kJ: 1e3, cal: 4.184, kcal: 4184, BTU: 1055.05585262, kWh: 3.6e6, eV: 1.602176634e-19 },
  MASS: { mg: 1e-6, g: 1e-3, kg: 1, oz: 0.028349523125, lb: 0.45359237, ton: 907.18474 }
};
App.convertUnit = function (kind, x, from, to) {
  const u = UNITS[kind];
  if (kind !== 'TEMPERATURE') return x * u[from] / u[to];
  const k = { C: x + 273.15, F: (x - 32) * 5 / 9 + 273.15, K: x }[u[from]]; if (k < 0) N.fail('DOMAIN');
  return { C: k - 273.15, F: (k - 273.15) * 9 / 5 + 32, K: k }[u[to]];
};
function unitMenu() { return new App.Menu([{ name: 'UNIT CONVERTER', items: Object.keys(UNITS).map(kind => ({ label: kind, run: () => App.setScreen(converter(kind)) })) }], App.home, { title: 'UNIT CONVERTER', back: App.sciTools() }); }
function converter(kind) {
  const names = Object.keys(UNITS[kind]); const v = { x: 1, from: names[0], to: names[1] };
  const form = new App.Form({ title: kind, titleCenter: true, fields: [
    { kind: 'num', label: 'Value=', get: () => v.x, set: x => { v.x = x; } },
    { kind: 'cycle', label: 'From:', opts: names, get: () => v.from, set: x => { v.from = x; }, width: 90 },
    { kind: 'cycle', label: 'To:  ', opts: names, get: () => v.to, set: x => { v.to = x; }, width: 90 },
    { kind: 'info', label: () => { try { const r = App.convertUnit(kind, v.x, v.from, v.to); return '= ' + fmt(r) + ' ' + v.to; } catch (e) { return '= (not possible)'; } } }
  ], status() { return this.cur && this.cur.kind === 'cycle' ? 'PRESS [◀] OR [▶] TO SELECT A UNIT' : ''; } });
  form.fixIdx(); return form;
}
})();
