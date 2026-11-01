/* engine.js — calculator state, token set, parser, evaluator, formatter */
(function (G) {
'use strict';
const N = G.Numeric || require('./numeric.js');
const { CalcError, fail } = N;
const E = {};

/* ======================= STATE ======================= */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZθ'.split('');
const LISTS = ['L₁', 'L₂', 'L₃', 'L₄', 'L₅', 'L₆'];
const YN = ['Y₁', 'Y₂', 'Y₃', 'Y₄', 'Y₅', 'Y₆', 'Y₇', 'Y₈', 'Y₉', 'Y₀'];
// parametric X₁ᴛ/Y₁ᴛ, polar r₁ (six each) and sequences u, v, w
const SUBS = ['₁', '₂', '₃', '₄', '₅', '₆'];
const XT = SUBS.map(d => 'X' + d + 'ᴛ'), YT = SUBS.map(d => 'Y' + d + 'ᴛ'), RN = SUBS.map(d => 'r' + d), SEQS = ['u', 'v', 'w'];
E.XT = XT; E.YT = YT; E.RN = RN; E.SEQS = SEQS;
const STRS = ['Str1', 'Str2', 'Str3', 'Str4', 'Str5', 'Str6', 'Str7', 'Str8', 'Str9', 'Str0'];
const MATS = ['[A]', '[B]', '[C]', '[D]', '[E]', '[F]', '[G]', '[H]', '[I]', '[J]'];
const YCOLORS = ['#1f4fff', '#e0201b', '#111111', '#e020c8', '#119e3a', '#ff8a00', '#8b3a12', '#1b2a7a', '#3aa6ff', '#d6b400'];
E.STRS = STRS; E.LETTERS = LETTERS; E.LISTS = LISTS; E.YN = YN; E.MATS = MATS; E.YCOLORS = YCOLORS;

function defaultState() {
  const S = {
    mode: { notation: 'NORMAL', float: 'FLOAT', angle: 'RADIAN', graph: 'FUNCTION', complex: 'REAL', fracType: 'n/d', answers: 'AUTO', statDiag: false, statWiz: true, mathprint: 'MATHPRINT', lineStyle: 'THICK', simul: false },
    vars: {}, ans: 0, lists: {}, mats: {}, Y: {},
    win: { Xmin: -10, Xmax: 10, Xscl: 1, Ymin: -10, Ymax: 10, Yscl: 1, Xres: 1,
      Tmin: 0, Tmax: 2 * Math.PI, Tstep: Math.PI / 24, θmin: 0, θmax: 2 * Math.PI, θstep: Math.PI / 24, nMin: 1, nMax: 10, PlotStart: 1, PlotStep: 1 },
    par: [0, 1, 2, 3, 4, 5].map(i => ({ x: [], y: [], on: true, color: YCOLORS[i] })),
    pol: [0, 1, 2, 3, 4, 5].map(i => ({ toks: [], on: true, color: YCOLORS[i] })),
    seq: { u: { toks: [], init: [], on: true, color: YCOLORS[0] }, v: { toks: [], init: [], on: true, color: YCOLORS[1] }, w: { toks: [], init: [], on: true, color: YCOLORS[2] } },
    traceStep: null,
    zprev: null, zsto: null, zfact: { x: 4, y: 4 },
    tbl: { start: 0, step: 1, indpnt: 'AUTO', depend: 'AUTO' },
    fmt: { coord: true, grid: 'OFF', axes: true, label: false, expr: true, detectAsym: true },
    stat: {}, regEQ: [],
    tvm: { N: 0, I: 0, PV: 0, PMT: 0, FV: 0, PY: 1, CY: 1, begin: false },
    plots: [0, 1, 2].map(i => ({ on: false, type: 'scatter', x: 'L₁', y: 'L₂', freq: '1', mark: '□', color: ['#1f4fff', '#e0201b', '#111111'][i] })),
    strs: {}, draw: [], entries: [], solver: { eq: [], vars: {}, bound: [-1e99, 1e99] },
    programs: {} // name → array of lines (token arrays)
  };
  LETTERS.forEach(l => S.vars[l] = 0);
  LISTS.forEach(l => S.lists[l] = []);
  YN.forEach((y, i) => S.Y[y] = { toks: [], on: true, color: YCOLORS[i], style: 'line' });
  return S;
}
E.defaultState = defaultState;
let S = defaultState();
E.getState = () => S;
E.setState = s => { S = s; parseCache.clear(); };
E.reset = () => { S = defaultState(); parseCache.clear(); return S; };
E.graphPx = { w: 264, h: 164 }; // graph area in pixels minus 1 (smaller in split screen)
E.deltaX = () => (S.win.Xmax - S.win.Xmin) / E.graphPx.w;
E.deltaY = () => (S.win.Ymax - S.win.Ymin) / E.graphPx.h;

/* ======================= TOKENS ======================= */
// Internal ids that display differently from their id
const DISP = {
  'nPr': ' nPr ', 'nCr': ' nCr ', 'and': ' and ', 'or': ' or ', 'xor': ' xor ', '*': '*', '-': '-', '⁻': '⁻',
  'tvm.N': 'N', 'tvm.I%': 'I%', 'tvm.PV': 'PV', 'tvm.PMT': 'PMT', 'tvm.FV': 'FV', 'tvm.P/Y': 'P/Y', 'tvm.C/Y': 'C/Y',
  'reg.a': 'a', 'reg.b': 'b', 'reg.c': 'c', 'reg.d': 'd', 'reg.e': 'e', 'reg.r': 'r', 'reg.r2': 'r²', 'reg.R2': 'R²',
  'stat.n': 'n', 'seq.n': 'n', 'stat.F': 'F', 'win.ΔX': 'ΔX', 'win.ΔY': 'ΔY', 'LEFT': 'LEFT', 'CENTER': 'CENTER', 'RIGHT': 'RIGHT',
  // MathPrint templates (linear fallback text outside the home screen)
  'frac.n': '(', 'frac.d': '⁄', 'frac.e': ')', 'mix.u': '(', 'mix.n': 'ᵤ', 'mix.d': '⁄', 'mix.e': ')',
  'pow.b': '^(', 'pow.e': ')', 'exp.b': 'e^(', 'exp.e': ')', 'tenx.b': '10^(', 'tenx.e': ')',
  'sqrt.b': '√(', 'sqrt.e': ')', 'abs.b': 'abs(', 'abs.e': ')',
  'nder.b': 'd/d', 'nder.x': '(', 'nder.v': ')|=', 'nder.e': '▸', 'fint.b': '∫(', 'fint.u': ',', 'fint.x': ',', 'fint.v': ',', 'fint.e': ')',
  'sum.b': 'Σ(', 'sum.s': '=', 'sum.u': ',', 'sum.x': ',', 'sum.e': ')', 'logb.b': 'log(', 'logb.x': ',', 'logb.e': ')',
  'pw1.b': 'piecewise(', 'pw2.b': 'piecewise(', 'pw3.b': 'piecewise(', 'pw4.b': 'piecewise(', 'pw5.b': 'piecewise(', 'pw.c': ',', 'pw.r': ',', 'pw.e': ')'
};
/* MathPrint templates: opening token, slot separators, closing token, and how it is drawn (kind).
   infix: the template follows its base (exponent box); fn: one-slot template that evaluates as that function */
const TEMPLATES = {
  'frac.n': { seps: ['frac.d'], end: 'frac.e', kind: 'frac' },
  'mix.u': { seps: ['mix.n', 'mix.d'], end: 'mix.e', kind: 'mix' },
  'pow.b': { seps: [], end: 'pow.e', kind: 'sup', infix: true },
  'exp.b': { seps: [], end: 'exp.e', kind: 'sup', prefix: 'e', fn: 'e^(' },
  'tenx.b': { seps: [], end: 'tenx.e', kind: 'sup', prefix: '10', fn: '10^(' },
  'sqrt.b': { seps: [], end: 'sqrt.e', kind: 'sqrt', fn: '√(' },
  'abs.b': { seps: [], end: 'abs.e', kind: 'abs', fn: 'abs(' },
  // slot order follows the CE's ▶ order; `order` maps slots to the function's arguments
  'nder.b': { seps: ['nder.x', 'nder.v'], end: 'nder.e', kind: 'nder', fn: 'nDeriv(', order: [1, 0, 2] }, // d/d[var]([expr])|var=[value]
  'fint.b': { seps: ['fint.u', 'fint.x', 'fint.v'], end: 'fint.e', kind: 'fint', fn: 'fnInt(', order: [2, 3, 0, 1] }, // ∫ from [lo] to [hi] of ([expr]) d[var]
  'sum.b': { seps: ['sum.s', 'sum.u', 'sum.x'], end: 'sum.e', kind: 'sum', fn: 'Σ(', order: [3, 0, 1, 2] }, // Σ [var]=[start] to [end] of ([expr])
  'logb.b': { seps: ['logb.x'], end: 'logb.e', kind: 'logb', fn: 'logBASE(', order: [1, 0] } // log base [b] of ([x])
};
// piecewise( with 1–5 pieces: a brace, then one row per piece: [expr] , [condition]
for (let n = 1; n <= 5; n++) TEMPLATES['pw' + n + '.b'] = { seps: [].concat(...Array.from({ length: n }, (_, i) => i ? ['pw.r', 'pw.c'] : ['pw.c'])), end: 'pw.e', kind: 'pw', fn: 'piecewise(' };
const TMPL_STOP = new Set(), TMPL_TOKS = new Set(Object.keys(TEMPLATES));
Object.values(TEMPLATES).forEach(T => T.seps.concat(T.end).forEach(t => { TMPL_STOP.add(t); TMPL_TOKS.add(t); }));
E.TEMPLATES = TEMPLATES; E.TMPL_TOKS = TMPL_TOKS;
E.disp = t => DISP[t] !== undefined ? DISP[t] : t;
E.tokText = toks => toks.map(E.disp).join('');

const isDigitTok = t => t !== undefined && (/^[0-9]$/.test(t) || t === '.' || t === 'ᴇ');
const SPECIAL_VARS = {
  'Xmin': ['win', 'Xmin'], 'Xmax': ['win', 'Xmax'], 'Xscl': ['win', 'Xscl'], 'Ymin': ['win', 'Ymin'], 'Ymax': ['win', 'Ymax'], 'Yscl': ['win', 'Yscl'], 'Xres': ['win', 'Xres'],
  'win.ΔX': ['fn', () => E.deltaX()], 'win.ΔY': ['fn', () => E.deltaY()], 'TraceStep': ['fn', () => S.traceStep || 2 * E.deltaX()],
  'Tmin': ['win', 'Tmin'], 'Tmax': ['win', 'Tmax'], 'Tstep': ['win', 'Tstep'], 'θmin': ['win', 'θmin'], 'θmax': ['win', 'θmax'], 'θstep': ['win', 'θstep'],
  'nMin': ['win', 'nMin'], 'nMax': ['win', 'nMax'], 'PlotStart': ['win', 'PlotStart'], 'PlotStep': ['win', 'PlotStep'],
  'seq.n': ['fn', () => seqN], // n in sequence formulas
  'TblStart': ['tbl', 'start'], 'ΔTbl': ['tbl', 'step'],
  'tvm.N': ['tvm', 'N'], 'tvm.I%': ['tvm', 'I'], 'tvm.PV': ['tvm', 'PV'], 'tvm.PMT': ['tvm', 'PMT'], 'tvm.FV': ['tvm', 'FV'], 'tvm.P/Y': ['tvm', 'PY'], 'tvm.C/Y': ['tvm', 'CY'],
  'x̄': ['stat', 'x̄'], 'Σx': ['stat', 'Σx'], 'Σx²': ['stat', 'Σx²'], 'Sx': ['stat', 'Sx'], 'σx': ['stat', 'σx'], 'stat.n': ['stat', 'n'],
  'ȳ': ['stat', 'ȳ'], 'Σy': ['stat', 'Σy'], 'Σy²': ['stat', 'Σy²'], 'Sy': ['stat', 'Sy'], 'σy': ['stat', 'σy'], 'Σxy': ['stat', 'Σxy'],
  'minX': ['stat', 'minX'], 'maxX': ['stat', 'maxX'], 'minY': ['stat', 'minY'], 'maxY': ['stat', 'maxY'], 'Q₁': ['stat', 'Q1'], 'Med': ['stat', 'Med'], 'Q₃': ['stat', 'Q3'],
  'reg.a': ['stat', 'a'], 'reg.b': ['stat', 'b'], 'reg.c': ['stat', 'c'], 'reg.d': ['stat', 'd'], 'reg.e': ['stat', 'e'], 'reg.r': ['stat', 'r'], 'reg.r2': ['stat', 'r2'], 'reg.R2': ['stat', 'R2'],
  'p': ['stat', 'p'], 'z': ['stat', 'z'], 't': ['stat', 't'], 'χ²': ['stat', 'χ²'], 'df': ['stat', 'df'], 'p̂': ['stat', 'p̂'], 's': ['stat', 's'], 'stat.F': ['stat', 'F'],
  'ZXmin': ['fn', () => zwin('Xmin')], 'ZXmax': ['fn', () => zwin('Xmax')], 'ZXscl': ['fn', () => zwin('Xscl')], 'ZYmin': ['fn', () => zwin('Ymin')], 'ZYmax': ['fn', () => zwin('Ymax')], 'ZYscl': ['fn', () => zwin('Yscl')], 'ZXres': ['fn', () => zwin('Xres')],
  'XFact': ['zfact', 'x'], 'YFact': ['zfact', 'y'],
  'getKey': ['fn', () => E.hooks.getKey ? E.hooks.getKey() : 0], // key code of the last key pressed while a program runs
  'LEFT': ['const', 0], 'CENTER': ['const', 1], 'RIGHT': ['const', 2]
};
// PRGM ▸ COLOR tokens: the CE's color numbers 10–24
const COLOR_NAMES = ['BLUE', 'RED', 'BLACK', 'MAGENTA', 'GREEN', 'ORANGE', 'BROWN', 'NAVY', 'LTBLUE', 'YELLOW', 'WHITE', 'LTGRAY', 'MEDGRAY', 'GRAY', 'DARKGRAY'];
const COLOR_HEX = ['#1f4fff', '#e0201b', '#111111', '#e020c8', '#119e3a', '#ff8a00', '#8b3a12', '#1b2a7a', '#3aa6ff', '#d6b400', '#ffffff', '#c8c8c8', '#a0a0a0', '#808080', '#505050'];
COLOR_NAMES.forEach((n, i) => { SPECIAL_VARS['col.' + n] = ['const', 10 + i]; DISP['col.' + n] = n; });
E.SPECIAL_VARS = SPECIAL_VARS;
const zwin = k => { const z = S.zsto || defaultState().win; return z[k] === undefined ? 1 : z[k]; }; // ZoomSto window (ZXmin…)
const POSTFIX = new Set(['²', '³', '⁻¹', '!', '°', 'ʳ', 'ᵀ', "'", '"']);
const CONV = new Set(['▶Frac', '▶Dec', '▶DMS', '▶Rect', '▶Polar', '▶F◀▶D', '▶n/d◀▶Un/d']);
const RELOPS = new Set(['=', '≠', '>', '≥', '<', '≤']);

/* ======================= VALUES ======================= */
class Cx { constructor(re, im) { this.re = re; this.im = im; } }
E.Cx = Cx;
const isCx = v => v instanceof Cx;
const isList = Array.isArray;
const isMat = v => v !== null && typeof v === 'object' && Array.isArray(v.mat);
const isScalar = v => typeof v === 'number' || isCx(v);
E.isList = isList; E.isMat = isMat; E.isCx = isCx;
const mk = (re, im) => {
  if (im === 0 || Math.abs(im) <= 1e-13 * Math.abs(re)) return re;
  if (Math.abs(re) <= 1e-13 * Math.abs(im)) re = 0;
  return new Cx(re, im);
};
const C = v => isCx(v) ? v : new Cx(v, 0);
const realMode = () => S.mode.complex === 'REAL';
function needReal(v) { if (!isScalar(v)) fail('DATA TYPE'); return v; }
function num(v) { if (typeof v !== 'number') { if (isCx(v)) fail('DATA TYPE'); fail('DATA TYPE'); } return v; }

function cmul(a, b) { return mk(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re); }
function cdiv(a, b) { const d = b.re * b.re + b.im * b.im; if (d === 0) fail('DIVIDE BY 0'); return mk((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); }
function cexp(a) { const m = Math.exp(a.re); return mk(m * cosR(a.im), m * sinR(a.im)); }
function cln(a) { if (a.re === 0 && a.im === 0) fail('DOMAIN'); return mk(Math.log(Math.hypot(a.re, a.im)), Math.atan2(a.im, a.re)); }
const sinR = x => { const r = Math.sin(x); return Math.abs(r) < 1e-15 * Math.max(1, Math.abs(x)) ? 0 : r; };
const cosR = x => { const r = Math.cos(x); return Math.abs(r) < 1e-15 * Math.max(1, Math.abs(x)) ? 0 : r; };

/* broadcast helper for element-wise binary ops on lists */
function bcast(a, b, f) {
  if (isList(a) || isList(b)) {
    if (isList(a) && isList(b)) { if (a.length !== b.length) fail('DIM MISMATCH'); return a.map((v, i) => f(v, b[i])); }
    if (isMat(a) || isMat(b)) fail('DATA TYPE');
    return isList(a) ? a.map(v => f(v, b)) : b.map(v => f(a, v));
  }
  return f(a, b);
}
function map1(a, f) { if (isList(a)) return a.map(f); if (isMat(a)) fail('DATA TYPE'); return f(a); }

const ops = {
  add(a, b) {
    if (typeof a === 'string' || typeof b === 'string') { if (typeof a !== 'string' || typeof b !== 'string') fail('DATA TYPE'); return a + b; } // joining strings
    if (isMat(a) || isMat(b)) { if (!(isMat(a) && isMat(b))) fail('DATA TYPE'); if (a.mat.length !== b.mat.length || a.mat[0].length !== b.mat[0].length) fail('DIM MISMATCH'); return { mat: a.mat.map((r, i) => r.map((v, j) => N.r14(v + b.mat[i][j]))) }; }
    return bcast(a, b, (x, y) => (typeof x === 'number' && typeof y === 'number') ? x + y : mk(C(x).re + C(y).re, C(x).im + C(y).im));
  },
  sub(a, b) {
    if (isMat(a) || isMat(b)) { if (!(isMat(a) && isMat(b))) fail('DATA TYPE'); if (a.mat.length !== b.mat.length || a.mat[0].length !== b.mat[0].length) fail('DIM MISMATCH'); return { mat: a.mat.map((r, i) => r.map((v, j) => N.r14(v - b.mat[i][j]))) }; }
    return bcast(a, b, (x, y) => (typeof x === 'number' && typeof y === 'number') ? x - y : mk(C(x).re - C(y).re, C(x).im - C(y).im));
  },
  mul(a, b) {
    if (isMat(a) && isMat(b)) return { mat: N.matMul(a.mat, b.mat) };
    if (isMat(a) || isMat(b)) { const m = isMat(a) ? a : b, s = isMat(a) ? b : a; if (!(typeof s === 'number')) fail('DATA TYPE'); return { mat: m.mat.map(r => r.map(v => v * s)) }; }
    return bcast(a, b, (x, y) => (typeof x === 'number' && typeof y === 'number') ? x * y : cmul(C(x), C(y)));
  },
  div(a, b) {
    if (isMat(b)) fail('DATA TYPE');
    if (isMat(a)) { num(b); if (b === 0) fail('DIVIDE BY 0'); return { mat: a.mat.map(r => r.map(v => v / b)) }; }
    return bcast(a, b, (x, y) => {
      if (typeof x === 'number' && typeof y === 'number') { if (y === 0) fail('DIVIDE BY 0'); return x / y; }
      return cdiv(C(x), C(y));
    });
  },
  neg(a) { if (isMat(a)) return { mat: a.mat.map(r => r.map(v => -v)) }; return map1(a, x => typeof x === 'number' ? -x : mk(-x.re, -x.im)); },
  pow(a, b) {
    if (isMat(a)) { num(b); if (!Number.isInteger(b) || b < 0) fail('DOMAIN'); const n = a.mat.length; if (n !== a.mat[0].length) fail('INVALID DIM'); let r = { mat: a.mat.map((row, i) => row.map((_, j) => i === j ? 1 : 0)) }; for (let k = 0; k < b; k++) r = { mat: N.matMul(r.mat, a.mat) }; return r; }
    return bcast(a, b, powS);
  }
};
function powS(x, y) {
  if (typeof x === 'number' && typeof y === 'number') {
    if (x === 0) { if (y === 0) fail('DOMAIN'); if (y < 0) fail('DIVIDE BY 0'); return 0; }
    if (x > 0 || Number.isInteger(y)) { const r = Math.pow(x, y); if (Number.isInteger(y) && Number.isInteger(x) && Math.abs(r) < 9e15) return r; return r; }
    // negative base, non-integer exponent
    const fr = toFrac(y, 999);
    if (fr && fr[1] % 2 === 1) { const r = Math.pow(-x, y); return fr[0] % 2 === 0 ? r : -r; }
    if (realMode()) fail('NONREAL ANSWERS');
  }
  const cx = C(x), cy = C(y);
  if (cx.re === 0 && cx.im === 0) return 0;
  if (realMode() && !isCx(x) && !isCx(y)) fail('NONREAL ANSWERS');
  return cexp(cmul(C(cln(cx)), cy));
}
E.ops = ops;

/* angle helpers */
const toRad = x => S.mode.angle === 'DEGREE' ? x * Math.PI / 180 : x;
const fromRad = x => S.mode.angle === 'DEGREE' ? x * 180 / Math.PI : x;
function trig(fn) {
  return x => {
    if (isCx(x)) fail('DATA TYPE');
    if (S.mode.angle === 'DEGREE') {
      const m = ((x % 360) + 360) % 360;
      if (fn === 'tan' && (Math.abs(m - 90) < 1e-10 || Math.abs(m - 270) < 1e-10)) fail('DOMAIN');
      if (fn === 'sin') { if (m === 0 || m === 180) return 0; if (m === 30 || m === 150) return 0.5; if (m === 210 || m === 330) return -0.5; }
      if (fn === 'cos') { if (m === 90 || m === 270) return 0; if (m === 60 || m === 300) return 0.5; if (m === 120 || m === 240) return -0.5; }
      if (fn === 'tan' && (m === 45 || m === 225)) return 1;
      if (fn === 'tan' && (m === 135 || m === 315)) return -1;
    }
    const r = Math[fn](toRad(x));
    return Math.abs(r) < 1e-13 ? 0 : (Math.abs(Math.abs(r) - 1) < 1e-14 ? Math.sign(r) : r);
  };
}

/* ======================= FRACTIONS ======================= */
function toFrac(x, maxDen = 9999) {
  if (!isFinite(x)) return null; const sign = x < 0 ? -1 : 1; x = Math.abs(x);
  if (Number.isInteger(x)) return [sign * x, 1];
  let h1 = 1, h0 = 0, k1 = 0, k0 = 1, b = x;
  for (let i = 0; i < 40; i++) {
    const a = Math.floor(b); const h2 = a * h1 + h0, k2 = a * k1 + k0;
    if (k2 > maxDen) break;
    h0 = h1; h1 = h2; k0 = k1; k1 = k2;
    if (Math.abs(x - h1 / k1) <= 1e-12 * Math.max(1, x)) return [sign * h1, k1];
    const f = b - a; if (f < 1e-15) break; b = 1 / f;
  }
  return null;
}
E.toFrac = toFrac;

/* ======================= NUMBER FORMAT ======================= */
function fmtReal(x, opts = {}) {
  if (Number.isNaN(x)) return 'undef';
  if (!isFinite(x)) fail('OVERFLOW');
  const M = S.mode; const fl = opts.float !== undefined ? opts.float : M.float; const nota = opts.notation || M.notation;
  const sig = opts.sig || 10;
  let r = Number(x.toPrecision(sig)); if (Math.abs(r) < 1e-99) r = 0; if (Math.abs(r) >= 1e100) fail('OVERFLOW');
  let s;
  const sci = (v, eng) => {
    if (v === 0) return fl === 'FLOAT' ? '0' : (0).toFixed(fl) + 'ᴇ0';
    let e = Math.floor(Math.log10(Math.abs(v))); let m = v / Math.pow(10, e);
    if (Math.abs(Number(m.toPrecision(sig))) >= 10) { e++; m = v / Math.pow(10, e); }
    if (eng) { const sh = ((e % 3) + 3) % 3; e -= sh; m *= Math.pow(10, sh); }
    let ms = fl === 'FLOAT' ? String(Number(m.toPrecision(sig))) : m.toFixed(fl);
    if (Math.abs(Number(ms)) >= (eng ? 1000 : 10)) { e += eng ? 3 : 1; m /= eng ? 1000 : 10; ms = fl === 'FLOAT' ? String(Number(m.toPrecision(sig))) : m.toFixed(fl); }
    return ms + 'ᴇ' + e;
  };
  if (nota === 'SCI') s = sci(r, false);
  else if (nota === 'ENG') s = sci(r, true);
  else {
    const a = Math.abs(r);
    if (r !== 0 && (a >= 1e10 || (fl === 'FLOAT' && a < 1e-3))) s = sci(r, false);
    else if (fl === 'FLOAT') { s = String(r); if (/e/.test(s)) s = r.toFixed(12).replace(/0+$/, '').replace(/\.$/, ''); }
    else s = r.toFixed(fl);
  }
  s = s.replace(/-/g, '⁻'); // the CE (OS 5.x) keeps the leading zero: 0.25, ⁻0.5
  return s;
}
E.fmtReal = fmtReal;
function fmtFrac(x, mixed) {
  const f = toFrac(x); if (!f || f[1] === 1) return fmtReal(x);
  let [n, d] = f; const neg = n < 0; n = Math.abs(n);
  if (mixed && n > d) { const w = Math.floor(n / d); return (neg ? '⁻' : '') + w + ' ' + (n - w * d) + '/' + d; }
  return (neg ? '⁻' : '') + n + '/' + d;
}
function fmtScalar(v, conv) {
  const useFrac = conv === '▶Frac' || conv === '▶F◀▶D' || conv === '▶n/d◀▶Un/d' || conv === 'auto-frac' || (conv !== '▶Dec' && S.mode.answers === 'FRAC-APPROX');
  // ▶n/d◀▶Un/d shows the opposite of MODE's FRACTION TYPE
  const mixed = conv === '▶n/d◀▶Un/d' ? S.mode.fracType !== 'Un/d' : S.mode.fracType === 'Un/d';
  const fr = x => useFrac ? fmtFrac(x, mixed) : fmtReal(x);
  if (isCx(v)) {
    const polar = conv === '▶Polar' || (S.mode.complex === 're^θi' && conv !== '▶Rect');
    if (polar) { const r = Math.hypot(v.re, v.im), t = fromRad(Math.atan2(v.im, v.re)); return fr(r) + 'e^(' + fr(t) + 'i)'; }
    const re = Number(v.re.toPrecision(10)), im = Number(v.im.toPrecision(10));
    const ims = Math.abs(im) === 1 ? '' : fr(Math.abs(im));
    if (re === 0) return (im < 0 ? '⁻' : '') + ims + 'i';
    return fr(re) + (im < 0 ? '-' : '+') + ims + 'i';
  }
  if (conv === '▶DMS') {
    const neg = v < 0; let a = Math.abs(v); const d = Math.floor(a); a = (a - d) * 60; const m = Math.floor(a); const s = N.r12((a - m) * 60);
    return (neg ? '⁻' : '') + d + '°' + m + "'" + fmtReal(s) + '"';
  }
  return fr(v);
}
E.fmtScalar = fmtScalar;
/* returns array of display lines */
E.format = function (v, conv) {
  if (typeof v === 'string') return [v];
  if (isList(v)) return ['{' + v.map(x => fmtScalar(x, conv)).join(' ') + '}'];
  if (isMat(v)) {
    const cells = v.mat.map(r => r.map(x => fmtScalar(x, conv)));
    const w = []; cells.forEach(r => r.forEach((c, j) => w[j] = Math.max(w[j] || 0, c.length)));
    return cells.map((r, i) => (i === 0 ? '[' : ' ') + '[' + r.map((c, j) => c.padStart(w[j])).join(' ') + ']' + (i === cells.length - 1 ? ']' : ''));
  }
  return [fmtScalar(v, conv)];
};

/* ======================= PARSER ======================= */
function canStart(t) {
  if (t === undefined) return false;
  if (isDigitTok(t) || t === '(' || t === '{' || t === '[' || t === '⁻' || (TEMPLATES[t] && !TEMPLATES[t].infix)) return true;
  if (LETTERS.includes(t) || t === 'π' || t === 'e' || t === 'i' || t === 'Ans' || t === 'rand') return true;
  if (XT.includes(t) || YT.includes(t) || RN.includes(t) || SEQS.includes(t)) return true;
  if (isLN(t) || YN.includes(t) || MATS.includes(t) || STRS.includes(t) || SPECIAL_VARS[t] || t === '"') return true;
  if (FUNCS[t] || SPECIAL[t]) return true;
  return false;
}
/* named lists: the tokens ʟ A B C become one name ʟABC (a letter, then up to 4 letters or digits) */
const isLN = n => LISTS.includes(n) || (typeof n === 'string' && n.length > 1 && n[0] === 'ʟ');
E.isListName = isLN;
function joinNamed(toks) {
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    if (toks[i] !== 'ʟ') { out.push(toks[i]); continue; }
    const ch = t => LETTERS.includes(t) ? t : (DISP[t] && LETTERS.includes(DISP[t]) ? DISP[t] : null); // typed text may read N as the TVM N
    let n = ''; while (i + 1 < toks.length && n.length < 5 && (ch(toks[i + 1]) || (n && /^[0-9]$/.test(toks[i + 1])))) n += ch(toks[++i]) || toks[i];
    if (!n) throw new CalcError('SYNTAX', i); out.push('ʟ' + n);
  }
  return out;
}
class Parser {
  constructor(toks) { this.t = toks.includes('ʟ') ? joinNamed(toks) : toks; this.i = 0; }
  peek(k = 0) { return this.t[this.i + k]; }
  next() { return this.t[this.i++]; }
  err(type = 'SYNTAX') { throw new CalcError(type, this.i); }
  atEndish() { const p = this.peek(); return p === undefined || p === '→' || p === ':' || CONV.has(p) || TMPL_STOP.has(p); }
  close(ch = ')') { if (this.peek() === ch) { this.i++; return; } if (this.atEndish()) return; this.err(); }
  expr() { return this.orE(); }
  orE() { let a = this.andE(); while (this.peek() === 'or' || this.peek() === 'xor') { const op = this.next(); a = { t: 'bin', op, a, b: this.andE() }; } return a; }
  andE() { let a = this.relE(); while (this.peek() === 'and') { this.next(); a = { t: 'bin', op: 'and', a, b: this.relE() }; } return a; }
  relE() { let a = this.addE(); while (RELOPS.has(this.peek())) { const op = this.next(); a = { t: 'bin', op, a, b: this.addE() }; } return a; }
  addE() { let a = this.mulE(); while (this.peek() === '+' || this.peek() === '-') { const op = this.next(); a = { t: 'bin', op, a, b: this.mulE() }; } return a; }
  mulE() {
    let a = this.permE();
    for (;;) {
      const p = this.peek();
      if (p === '*' || p === '/') { this.next(); a = { t: 'bin', op: p, a, b: this.permE() }; }
      else if (canStart(p)) { const b = this.permE(); const dms = n => n.t === 'post' && ['°', "'", '"'].includes(n.op); a = (dms(a) || (a.t === 'bin' && a.dms)) && dms(b) ? { t: 'bin', op: '+', a, b, dms: true } : { t: 'bin', op: '*', a, b }; }
      else break;
    }
    return a;
  }
  permE() { let a = this.negE(); while (this.peek() === 'nPr' || this.peek() === 'nCr') { const op = this.next(); a = { t: 'bin', op, a, b: this.negE() }; } return a; }
  negE() { if (this.peek() === '⁻') { this.next(); return { t: 'neg', a: this.negE() }; } return this.powE(); }
  powE() {
    let a = this.postE();
    while (this.peek() === '^' || this.peek() === 'ˣ√' || this.peek() === 'pow.b') {
      const op = this.next();
      if (op === 'pow.b') { // exponent box, then any postfix typed after leaving it: 2^□ then ² is (2^□)²
        if (this.peek() === 'pow.e') this.err(); const b = this.expr(); if (this.peek() !== 'pow.e') this.err(); this.next();
        a = { t: 'bin', op: '^', a, b };
        while (POSTFIX.has(this.peek())) a = { t: 'post', op: this.next(), a };
        continue;
      } let neg = 0; while (this.peek() === '⁻') { this.next(); neg++; }
      let b = this.postE(); if (neg % 2) b = { t: 'neg', a: b };
      a = op === '^' ? { t: 'bin', op: '^', a, b } : { t: 'bin', op: 'root', a, b };
    }
    return a;
  }
  postE() {
    let a = this.primary();
    while (POSTFIX.has(this.peek())) { a = { t: 'post', op: this.next(), a }; }
    return a;
  }
  args() { // after '(' already consumed by token
    const out = [];
    if (this.peek() === ')') { this.next(); return out; }
    if (this.atEndish()) return out;
    for (;;) { out.push(this.expr()); if (this.peek() === ',') { this.next(); continue; } this.close(); break; }
    return out;
  }
  number() {
    let s = ''; let seenDot = false, seenE = false;
    while (isDigitTok(this.peek()) || (seenE && this.peek() === '⁻' && /ᴇ$/.test(s))) {
      const t = this.next();
      if (t === '.') { if (seenDot || seenE) this.err(); seenDot = true; s += '.'; }
      else if (t === 'ᴇ') { if (seenE) this.err(); seenE = true; s += (s === '' ? '1' : '') + 'ᴇ'; }
      else if (t === '⁻') s += '-';
      else s += t;
    }
    if (s === '.' ) this.err();
    const [m, e] = s.split('ᴇ'); let v = Number(m === '' || m === '.' ? NaN : m);
    if (e !== undefined) { if (e === '' || e === '-') this.err(); v = v * Math.pow(10, Number(e)); v = N.r14(v); }
    if (Number.isNaN(v)) this.err();
    return { t: 'num', v };
  }
  primary() {
    const p = this.peek();
    if (p === undefined) this.err();
    if (isDigitTok(p)) return this.number();
    if (p === '(') { this.next(); const e = this.expr(); this.close(); return e; }
    if (p === '"') { // string: everything up to the closing quote (or the end of the statement)
      this.next(); let s = '';
      while (this.peek() !== undefined && this.peek() !== '"' && this.peek() !== '→') s += E.disp(this.next());
      if (this.peek() === '"') this.next();
      return { t: 'str', v: s };
    }
    if (TEMPLATES[p] && !TEMPLATES[p].infix) { // a template acts like one parenthesized value; every slot must be filled
      this.next(); const T = TEMPLATES[p]; const parts = [];
      for (const stop of T.seps.concat(T.end)) { if (this.peek() === stop) this.err(); parts.push(this.expr()); if (this.peek() !== stop) this.err(); this.next(); }
      if (T.fn) return { t: 'call', f: T.fn, args: T.order ? T.order.map(i => parts[i]) : parts };
      return p === 'frac.n' ? { t: 'bin', op: '/', a: parts[0], b: parts[1] } : { t: 'mix', w: parts[0], n: parts[1], d: parts[2] };
    }
    if (p === '{') { this.next(); const items = []; if (this.peek() === '}') { this.next(); return { t: 'list', items }; } for (;;) { items.push(this.expr()); if (this.peek() === ',') { this.next(); continue; } this.close('}'); break; } return { t: 'list', items }; }
    if (p === '[') { // matrix literal
      this.next(); const rows = [];
      while (this.peek() === '[') { this.next(); const r = []; for (;;) { r.push(this.expr()); if (this.peek() === ',') { this.next(); continue; } this.close(']'); break; } rows.push(r); }
      this.close(']'); if (!rows.length || rows.some(r => r.length !== rows[0].length)) this.err('INVALID DIM');
      return { t: 'mlit', rows };
    }
    this.next();
    if (LETTERS.includes(p)) return { t: 'var', n: p };
    if (p === 'π') return { t: 'num', v: Math.PI };
    if (p === 'e') return { t: 'num', v: Math.E };
    if (p === 'i') return { t: 'i' };
    if (p === 'Ans') return { t: 'ans' };
    if (p === 'rand') { if (this.peek() === '(') { this.next(); const a = this.args(); return { t: 'call', f: 'rand(', args: a }; } return { t: 'call', f: 'rand(', args: [] }; }
    if (SPECIAL_VARS[p]) return { t: 'svar', n: p };
    if (isLN(p)) { if (this.peek() === '(') { this.next(); const a = this.args(); if (a.length !== 1) this.err(); return { t: 'lidx', n: p, i: a[0] }; } return { t: 'lname', n: p }; }
    if (STRS.includes(p)) return { t: 'strvar', n: p };
    if (MATS.includes(p)) { if (this.peek() === '(') { this.next(); const a = this.args(); if (a.length !== 2) this.err(); return { t: 'midx', n: p, i: a[0], j: a[1] }; } return { t: 'mname', n: p }; }
    if (XT.includes(p) || YT.includes(p) || RN.includes(p) || SEQS.includes(p)) { if (this.peek() === '(') { this.next(); const a = this.args(); if (a.length !== 1) this.err(); return { t: 'pvar', n: p, x: a[0] }; } return { t: 'pvar', n: p }; }
    if (YN.includes(p)) { if (this.peek() === '(') { this.next(); const a = this.args(); if (a.length !== 1) this.err(); return { t: 'yvar', n: p, x: a[0] }; } return { t: 'yvar', n: p }; }
    if (FUNCS[p] || SPECIAL[p]) { const pos = this.i - 1; const a = this.args(); return { t: 'call', f: p, args: a, pos }; }
    this.i--; this.err();
  }
}
/* statement level */
const COMMANDS = {};
E.COMMANDS = COMMANDS;
function parseStatement(toks) {
  const P = new Parser(toks);
  const stmts = [];
  for (;;) {
    if (P.peek() === undefined) { if (!stmts.length) P.err(); break; }
    const t = P.peek(); let st;
    if (COMMANDS[t]) {
      P.next(); const args = [];
      if (P.peek() !== undefined && P.peek() !== ':') { for (;;) { args.push(P.expr()); if (P.peek() === ',') { P.next(); continue; } break; } if (t.endsWith('(') && P.peek() === ')') P.next(); }
      st = { cmd: t, args };
    } else {
      const node = P.expr(); st = { node };
      while (CONV.has(P.peek())) st.conv = P.next();
      if (P.peek() === '→') { P.next(); const pos = P.i; const tg = P.t[P.i]; if (tg === undefined) P.err();
        if (LETTERS.includes(tg) || isLN(tg) || MATS.includes(tg) || STRS.includes(tg) || (SPECIAL_VARS[tg] && SPECIAL_VARS[tg][0] !== 'fn' && SPECIAL_VARS[tg][0] !== 'const')) {
          P.next(); if ((isLN(tg) || MATS.includes(tg)) && P.peek() === '(') { P.next(); const a = P.args(); st.store = { n: tg, idx: a }; } else st.store = { n: tg };
        } else if (YN.includes(tg)) { P.err(); } else { P.i = pos; P.err(); }
      }
    }
    stmts.push(st);
    if (P.peek() === ':') { P.next(); continue; }
    if (P.peek() !== undefined) P.err();
    break;
  }
  return stmts;
}
E.parseStatement = parseStatement;
function parseExpr(toks) {
  const P = new Parser(toks); if (!toks.length) P.err();
  const n = P.expr(); if (P.peek() !== undefined) P.err(); return n;
}
const parseCache = new Map();
E.parseExprCached = function (toks) {
  const key = toks.join('\u0001'); let r = parseCache.get(key);
  if (!r) { try { r = { node: parseExpr(toks) }; } catch (e) { r = { err: e }; } if (parseCache.size > 500) parseCache.clear(); parseCache.set(key, r); }
  if (r.err) throw r.err; return r.node;
};
E.parseExpr = parseExpr;
/* comma-separated arguments (used by program commands such as For( and Output( ); a closing ) is optional */
E.parseArgs = function (toks) { const P = new Parser(toks); const a = P.args(); if (P.peek() !== undefined) P.err(); return a; };

/* ======================= EVALUATOR ======================= */
let yDepth = 0;
function getVar(n) { return S.vars[n]; }
/* archived variables (MEM ▸ Archive) can't be used or changed until UnArchive, like the CE's ERR:ARCHIVED */
const ARCH_T = new Set(['var', 'lname', 'lidx', 'mname', 'midx', 'strvar']);
function ev(n) {
  if (S.archived && S.archived.length && ARCH_T.has(n.t) && S.archived.includes(n.n)) fail('ARCHIVED');
  switch (n.t) {
    case 'num': return n.v;
    case 'str': return n.v;
    case 'strvar': { const v = (S.strs || {})[n.n]; if (v === undefined) fail('UNDEFINED'); return v; }
    case 'i': return new Cx(0, 1);
    case 'var': return getVar(n.n);
    case 'ans': return S.ans;
    case 'svar': {
      const d = SPECIAL_VARS[n.n];
      if (d[0] === 'fn') return d[1]();
      if (d[0] === 'const') return d[1];
      const v = S[d[0]][d[1]]; if (v === undefined || v === null || Number.isNaN(v)) fail('UNDEFINED'); return v;
    }
    case 'list': return n.items.map(x => { const v = ev(x); if (!isScalar(v)) fail('DATA TYPE'); return v; });
    case 'lname': { const l = S.lists[n.n]; if (!l) fail('UNDEFINED'); return l.slice(); }
    case 'lidx': { const l = S.lists[n.n]; if (!l) fail('UNDEFINED'); const i = num(ev(n.i)); if (!Number.isInteger(i) || i < 1 || i > l.length) fail('INVALID DIM'); return l[i - 1]; }
    case 'mname': { const m = S.mats[n.n]; if (!m) fail('UNDEFINED'); return { mat: m.map(r => r.slice()) }; }
    case 'midx': { const m = S.mats[n.n]; if (!m) fail('UNDEFINED'); const i = num(ev(n.i)), j = num(ev(n.j)); if (i < 1 || j < 1 || i > m.length || j > m[0].length) fail('INVALID DIM'); return m[i - 1][j - 1]; }
    case 'mlit': return { mat: n.rows.map(r => r.map(x => num(ev(x)))) };
    case 'pvar': { // X₁ᴛ(t), Y₁ᴛ(t), r₁(θ), u(n); without ( ) they use the current T, θ or n
      const at = n.x ? ev(n.x) : (RN.includes(n.n) ? S.vars['θ'] : SEQS.includes(n.n) ? seqN : S.vars.T);
      if (SEQS.includes(n.n)) return map1(at, k => E.seqVal(n.n, num(k)));
      if (RN.includes(n.n)) return map1(at, th => E.evalPol(RN.indexOf(n.n), th));
      return map1(at, t => E.evalPar(XT.includes(n.n) ? XT.indexOf(n.n) : YT.indexOf(n.n), XT.includes(n.n) ? 'x' : 'y', t));
    }
    case 'yvar': {
      if (n.x) { const xv = ev(n.x); return map1(xv, x => E.evalY(n.n, x)); }
      return E.evalY(n.n, S.vars.X);
    }
    case 'neg': return ops.neg(ev(n.a));
    case 'post': return post(n.op, ev(n.a));
    case 'bin': return bin(n.op, n.a, n.b);
    case 'mix': { const w = ev(n.w), f = ops.div(ev(n.n), ev(n.d)); return bcast(w, f, (a, b) => num(a) < 0 ? a - num(b) : a + num(b)); } // ⁻1ᵤ1/2 = ⁻1.5
    case 'call': return call(n);
  }
  fail('SYNTAX');
}
E.ev = ev;
function post(op, v) {
  switch (op) {
    case '²': return isMat(v) ? ops.mul(v, v) : ops.mul(v, v);
    case '³': return isMat(v) ? ops.mul(ops.mul(v, v), v) : ops.pow(v, 3);
    case '⁻¹': if (isMat(v)) return { mat: N.inverse(v.mat) }; return ops.div(1, v);
    case '!': return map1(v, x => N.factorial(num(x)));
    case '°': return map1(v, x => S.mode.angle === 'DEGREE' ? x : num(x) * Math.PI / 180);
    case 'ʳ': return map1(v, x => S.mode.angle === 'RADIAN' ? x : num(x) * 180 / Math.PI);
    case "'": return map1(v, x => S.mode.angle === 'DEGREE' ? num(x) / 60 : num(x) / 60 * Math.PI / 180);
    case '"': return map1(v, x => S.mode.angle === 'DEGREE' ? num(x) / 3600 : num(x) / 3600 * Math.PI / 180);
    case 'ᵀ': if (!isMat(v)) fail('DATA TYPE'); return { mat: v.mat[0].map((_, j) => v.mat.map(r => r[j])) };
  }
}
function truth(x) { return x !== 0 ? 1 : 0; }
function bin(op, an, bn) {
  const a = ev(an), b = ev(bn);
  switch (op) {
    case '+': return ops.add(a, b);
    case '-': return ops.sub(a, b);
    case '*': return ops.mul(a, b);
    case '/': return ops.div(a, b);
    case '^': return ops.pow(a, b);
    case 'root': return bcast(a, b, (x, y) => { num(x); num(y); if (x === 0) fail('DIVIDE BY 0'); if (y < 0) { const n = Math.round(x); if (n === x && n % 2 === 1) return -Math.pow(-y, 1 / x); if (realMode()) fail('NONREAL ANSWERS'); } return Math.pow(y, 1 / x); });
    case 'nPr': return bcast(a, b, (x, y) => N.nPr(num(x), num(y)));
    case 'nCr': return bcast(a, b, (x, y) => N.nCr(num(x), num(y)));
    case '=': case '≠': {
      if (typeof a === 'string' || typeof b === 'string') return (op === '=') === (a === b) ? 1 : 0;
      if (isMat(a) || isMat(b)) { const e = isMat(a) && isMat(b) && a.mat.length === b.mat.length && a.mat.every((r, i) => r.every((v, j) => N.eq(v, b.mat[i][j]))); return (op === '=') === e ? 1 : 0; }
      return bcast(a, b, (x, y) => { const e = N.eq(C(x).re, C(y).re) && N.eq(C(x).im, C(y).im); return (op === '=') === e ? 1 : 0; });
    }
    case '>': return bcast(a, b, (x, y) => (num(x) > num(y) && !N.eq(x, y)) ? 1 : 0);
    case '<': return bcast(a, b, (x, y) => (num(x) < num(y) && !N.eq(x, y)) ? 1 : 0);
    case '≥': return bcast(a, b, (x, y) => (num(x) > num(y) || N.eq(x, y)) ? 1 : 0);
    case '≤': return bcast(a, b, (x, y) => (num(x) < num(y) || N.eq(x, y)) ? 1 : 0);
    case 'and': return bcast(a, b, (x, y) => truth(num(x)) & truth(num(y)));
    case 'or': return bcast(a, b, (x, y) => truth(num(x)) | truth(num(y)));
    case 'xor': return bcast(a, b, (x, y) => truth(num(x)) ^ truth(num(y)));
  }
}
/* evaluate a parametric or polar equation with T or θ set to the given value */
function withVar(v, val, toks) {
  if (!toks.length) fail('UNDEFINED'); if (yDepth > 20) fail('MEMORY');
  const old = S.vars[v]; S.vars[v] = val; yDepth++;
  try { return ev(E.parseExprCached(toks)); } finally { yDepth--; S.vars[v] = old; }
}
E.evalPar = (i, axis, t) => withVar('T', t, S.par[i][axis]);
E.evalPol = (i, th) => withVar('θ', th, S.pol[i].toks);
/* sequences: u(nMin) holds the first term (or {u(nMin+1),u(nMin)} for two); later terms are built up in order and remembered */
let seqN = 0, seqMemo = null, seqOverride = null;
E.seqBatch = f => { const top = !seqMemo; if (top) seqMemo = new Map(); try { return f(); } finally { if (top) seqMemo = null; } };
E.seqVal = function (name, k) {
  const d = S.seq[name]; if (!d || !d.toks.length) fail('UNDEFINED');
  const n0 = S.win.nMin; k = Math.round(k); if (k < n0) fail('INVALID DIM');
  if (seqOverride && seqOverride.key === name + k) return seqOverride.x;
  const shift = { 'n+1': 1, 'n+2': 2 }[S.seqType] || 0;
  return E.seqBatch(() => {
    const key = name + k; if (seqMemo.has(key)) return seqMemo.get(key);
    const init = d.init.length ? ev(E.parseExprCached(d.init)) : undefined;
    let firsts = init === undefined ? [] : (isList(init) ? init.slice().reverse() : [init]); // {u(nMin+1),u(nMin)}
    if (shift === 2) firsts = [init, d.init1 && d.init1.length ? ev(E.parseExprCached(d.init1)) : undefined].filter(v => v !== undefined);
    firsts.forEach((v, j) => seqMemo.set(name + (n0 + j), num(v)));
    for (let j = n0 + firsts.length; j <= k; j++) if (!seqMemo.has(name + j)) {
      const old = seqN; seqN = j - shift; if (yDepth > 40) fail('MEMORY'); yDepth++;
      try { seqMemo.set(name + j, num(ev(E.parseExprCached(d.toks)))); } finally { yDepth--; seqN = old; }
    }
    return seqMemo.get(key);
  });
};
E.seqWebF = function (name, x) { // Web format: u(n) as a function of x = u(n-1)
  const d = S.seq[name], n = S.win.nMin + 1, old = seqN; seqN = n; seqOverride = { key: name + (n - 1 + ({ 'n+1': 1 }[S.seqType] || 0)), x };
  try { return E.seqBatch(() => num(ev(E.parseExprCached(d.toks)))); } finally { seqN = old; seqOverride = null; }
};
E.evalY = function (name, x) {
  const y = S.Y[name]; if (!y || !y.toks.length) fail('UNDEFINED');
  if (yDepth > 20) fail('MEMORY');
  const old = S.vars.X; S.vars.X = x; yDepth++;
  try { const v = ev(E.parseExprCached(y.toks)); return v; }
  finally { yDepth--; S.vars.X = old; }
};
/* evaluate a function of a variable (closure for numeric methods) */
function lambda(node, v) {
  return x => { const old = S.vars[v]; S.vars[v] = x; try { const r = ev(node); if (!isScalar(r)) fail('DATA TYPE'); if (isCx(r)) fail('NONREAL ANSWERS'); return r; } finally { S.vars[v] = old; } };
}
E.lambda = lambda;
E.evalAt = function (toks, x) { const node = E.parseExprCached(toks); return lambda(node, 'X')(x); };

/* ======================= BUILTIN FUNCTIONS ======================= */
const lst = v => { if (!isList(v)) fail('DATA TYPE'); return v; };
const int = v => { num(v); if (!Number.isInteger(N.r12(v))) fail('DOMAIN'); return Math.round(v); };
const FUNCS = {};
function def(names, n, f, opt = {}) { names.split('|').forEach(nm => FUNCS[nm] = Object.assign({ n, f }, opt)); }
// element-wise real functions
function defEW(name, f) { FUNCS[name] = { n: [1, 1], f: (x) => map1(x, f) }; }
defEW('sin(', x => trig('sin')(x)); defEW('cos(', x => trig('cos')(x)); defEW('tan(', x => trig('tan')(x));
defEW('sin⁻¹(', x => { num(x); if (x < -1 || x > 1) fail('DOMAIN'); return fromRad(Math.asin(x)); });
defEW('cos⁻¹(', x => { num(x); if (x < -1 || x > 1) fail('DOMAIN'); return fromRad(Math.acos(x)); });
defEW('tan⁻¹(', x => fromRad(Math.atan(num(x))));
defEW('sinh(', x => Math.sinh(num(x))); defEW('cosh(', x => Math.cosh(num(x))); defEW('tanh(', x => Math.tanh(num(x)));
defEW('sinh⁻¹(', x => Math.asinh(num(x))); defEW('cosh⁻¹(', x => { if (num(x) < 1) fail('DOMAIN'); return Math.acosh(x); }); defEW('tanh⁻¹(', x => { if (Math.abs(num(x)) >= 1) fail('DOMAIN'); return Math.atanh(x); });
defEW('ln(', x => { if (isCx(x)) return cln(x); if (x === 0) fail('DOMAIN'); if (x < 0) { if (realMode()) fail('NONREAL ANSWERS'); return cln(C(x)); } return Math.log(x); });
defEW('log(', x => { if (isCx(x)) return ops.div(cln(x), Math.LN10); if (x === 0) fail('DOMAIN'); if (x < 0) { if (realMode()) fail('NONREAL ANSWERS'); return ops.div(cln(C(x)), Math.LN10); } const r = Math.log10(x); return Math.abs(r - Math.round(r)) < 1e-14 ? Math.round(r) : r; });
defEW('e^(', x => isCx(x) ? cexp(x) : Math.exp(x));
defEW('10^(', x => isCx(x) ? powS(10, x) : (Number.isInteger(x) && Math.abs(x) < 23 ? (x >= 0 ? Math.pow(10, x) : 1 / Math.pow(10, -x)) : Math.pow(10, x)));
defEW('√(', x => { if (isCx(x)) return powS(x, 0.5); if (x < 0) { if (realMode()) fail('NONREAL ANSWERS'); return new Cx(0, Math.sqrt(-x)); } return Math.sqrt(x); });
defEW('³√(', x => Math.cbrt(num(x)));
defEW('abs(', x => isCx(x) ? Math.hypot(x.re, x.im) : Math.abs(x));
defEW('iPart(', x => Math.trunc(N.r14(num(x)))); defEW('fPart(', x => { x = N.r14(num(x)); return N.r14(x - Math.trunc(x)); });
defEW('int(', x => Math.floor(N.r14(num(x))));
defEW('conj(', x => isCx(x) ? mk(x.re, -x.im) : x); defEW('real(', x => isCx(x) ? x.re : x); defEW('imag(', x => isCx(x) ? x.im : 0);
defEW('angle(', x => isCx(x) ? fromRad(Math.atan2(x.im, x.re)) : (x < 0 ? fromRad(Math.PI) : 0));
defEW('not(', x => num(x) === 0 ? 1 : 0);
FUNCS['abs('].f = x => isMat(x) ? fail('DATA TYPE') : map1(x, v => isCx(v) ? Math.hypot(v.re, v.im) : Math.abs(v));
FUNCS['round('] = { n: [1, 2], f: (x, d = 9) => map1(x, v => { if (isCx(v)) return mk(Number(v.re.toFixed(d)), Number(v.im.toFixed(d))); return Number((Math.sign(v) * Math.round(N.r14(Math.abs(v) * Math.pow(10, d))) / Math.pow(10, d)).toPrecision(14)); }) };
def('min(', [1, 2], (a, b) => b === undefined ? Math.min(...lst(a).map(num)) : bcast(a, b, (x, y) => Math.min(num(x), num(y))));
def('max(', [1, 2], (a, b) => b === undefined ? Math.max(...lst(a).map(num)) : bcast(a, b, (x, y) => Math.max(num(x), num(y))));
const gcd2 = (a, b) => { a = Math.abs(int(a)); b = Math.abs(int(b)); while (b) [a, b] = [b, a % b]; return a; };
def('gcd(', [2, 2], (a, b) => bcast(a, b, gcd2));
def('lcm(', [2, 2], (a, b) => bcast(a, b, (x, y) => { const g = gcd2(x, y); return g === 0 ? 0 : Math.abs(int(x) * int(y)) / g; }));
def('remainder(', [2, 2], (a, b) => bcast(a, b, (x, y) => { x = int(x); y = int(y); if (y === 0) fail('DIVIDE BY 0'); return ((x % y) + y) % y; }));
def('logBASE(', [2, 2], (x, b) => bcast(x, b, (v, bb) => { num(v); num(bb); if (v <= 0 || bb <= 0 || bb === 1) fail('DOMAIN'); const r = Math.log(v) / Math.log(bb); return Math.abs(r - Math.round(r)) < 1e-13 ? Math.round(r) : r; }));
def('R▶Pr(', [2, 2], (x, y) => bcast(x, y, (a, b) => Math.hypot(num(a), num(b))));
def('R▶Pθ(', [2, 2], (x, y) => bcast(x, y, (a, b) => fromRad(Math.atan2(num(b), num(a)))));
def('P▶Rx(', [2, 2], (r, t) => bcast(r, t, (a, b) => num(a) * trig('cos')(num(b))));
def('P▶Ry(', [2, 2], (r, t) => bcast(r, t, (a, b) => num(a) * trig('sin')(num(b))));
// probability
def('rand(', [0, 1], (n) => { if (n === undefined) return Math.random(); n = int(n); if (n < 1) fail('DOMAIN'); return Array.from({ length: n }, Math.random); });
def('randInt(', [2, 3], (a, b, n) => { a = int(a); b = int(b); if (a > b) [a, b] = [b, a]; const r = () => a + Math.floor(Math.random() * (b - a + 1)); return n === undefined ? r() : Array.from({ length: int(n) }, r); });
const rnorm = () => { let u = 0, v = 0; while (u === 0) u = Math.random(); while (v === 0) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
def('randNorm(', [2, 3], (m, s, n) => n === undefined ? m + s * rnorm() : Array.from({ length: int(n) }, () => m + s * rnorm()));
def('randBin(', [2, 3], (nn, p, n) => { const one = () => { let c = 0; for (let k = 0; k < nn; k++) if (Math.random() < p) c++; return c; }; return n === undefined ? one() : Array.from({ length: int(n) }, one); });
def('randIntNoRep(', [2, 3], (a, b, n) => { a = int(a); b = int(b); if (a > b) [a, b] = [b, a]; const arr = []; for (let k = a; k <= b; k++) arr.push(k); for (let k = arr.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [arr[k], arr[j]] = [arr[j], arr[k]]; } return n === undefined ? arr : arr.slice(0, int(n)); });
// distributions (broadcast over first list arg)
function defD(name, n, f) { FUNCS[name] = { n, f: (...a) => { const li = a.findIndex(isList); if (li >= 0 && name.indexOf('binom') < 0) return a[li].map(v => { const b = a.slice(); b[li] = v; return f(...b.map(num)); }); return f(...a.map(x => isList(x) ? x : num(x))); } }; }
defD('normalpdf(', [1, 3], N.normalpdf); defD('normalcdf(', [2, 4], N.normalcdf); defD('invNorm(', [1, 4], N.invNorm);
defD('tpdf(', [2, 2], N.tpdf); defD('tcdf(', [3, 3], N.tcdf); defD('invT(', [2, 2], N.invT);
defD('χ²pdf(', [2, 2], N.chipdf); defD('χ²cdf(', [3, 3], N.chicdf); defD('Fpdf(', [3, 3], N.Fpdf); defD('Fcdf(', [4, 4], N.Fcdf);
FUNCS['binompdf('] = { n: [2, 3], f: (n, p, x) => isList(x) ? x.map(v => N.binompdf(num(n), num(p), num(v))) : N.binompdf(num(n), num(p), x === undefined ? undefined : num(x)) };
FUNCS['binomcdf('] = { n: [2, 3], f: (n, p, x) => isList(x) ? x.map(v => N.binomcdf(num(n), num(p), num(v))) : N.binomcdf(num(n), num(p), x === undefined ? undefined : num(x)) };
defD('invBinom(', [3, 3], N.invBinom);
defD('poissonpdf(', [2, 2], N.poissonpdf); defD('poissoncdf(', [2, 2], N.poissoncdf); defD('geometpdf(', [2, 2], N.geometpdf); defD('geometcdf(', [2, 2], N.geometcdf);
// lists
def('dim(', [1, 1], a => isMat(a) ? [a.mat.length, a.mat[0].length] : lst(a).length);
def('sum(', [1, 3], (a, s = 1, e) => { a = lst(a); e = e === undefined ? a.length : e; return a.slice(s - 1, e).reduce((x, y) => ops.add(x, y), 0); });
def('prod(', [1, 3], (a, s = 1, e) => { a = lst(a); e = e === undefined ? a.length : e; return a.slice(s - 1, e).reduce((x, y) => ops.mul(x, y), 1); });
const freqStats = (a, f) => { a = lst(a).map(num); if (!a.length) fail('INVALID DIM'); return N.oneVar(a, f === undefined ? undefined : (isList(f) ? f : a.map(() => f))); };
def('mean(', [1, 2], (a, f) => freqStats(a, f)['x̄']);
def('median(', [1, 2], (a, f) => freqStats(a, f).Med);
def('stdDev(', [1, 2], (a, f) => { const s = freqStats(a, f); if (s.n < 2) fail('DOMAIN'); return s.Sx; });
def('variance(', [1, 2], (a, f) => { const s = freqStats(a, f); if (s.n < 2) fail('DOMAIN'); return s.Sx * s.Sx; });
def('cumSum(', [1, 1], a => { if (isMat(a)) { const m = a.mat.map(r => r.slice()); for (let i = 1; i < m.length; i++) for (let j = 0; j < m[0].length; j++) m[i][j] += m[i - 1][j]; return { mat: m }; } let s = 0; return lst(a).map(v => (s = ops.add(s, v))); });
def('ΔList(', [1, 1], a => { a = lst(a); if (a.length < 2) fail('INVALID DIM'); return a.slice(1).map((v, i) => ops.sub(v, a[i])); });
def('augment(', [2, 2], (a, b) => { if (isMat(a) && isMat(b)) { if (a.mat.length !== b.mat.length) fail('DIM MISMATCH'); return { mat: a.mat.map((r, i) => r.concat(b.mat[i])) }; } return lst(a).concat(lst(b)); });
def('SortA(', [1, 1], a => lst(a).slice().sort((x, y) => num(x) - num(y)));
def('SortD(', [1, 1], a => lst(a).slice().sort((x, y) => num(y) - num(x)));
// matrices
const mat = v => { if (!isMat(v)) fail('DATA TYPE'); return v.mat; };
def('det(', [1, 1], a => N.det(mat(a)));
def('identity(', [1, 1], n => { n = int(n); if (n < 1 || n > 99) fail('INVALID DIM'); return { mat: Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 1 : 0)) }; });
def('randM(', [2, 2], (r, c) => ({ mat: Array.from({ length: int(r) }, () => Array.from({ length: int(c) }, () => Math.floor(Math.random() * 19) - 9)) }));
def('rref(', [1, 1], a => ({ mat: N.rref(mat(a), true) }));
def('ref(', [1, 1], a => ({ mat: N.rref(mat(a), false) }));
def('Matr▶list(', [1, 1], a => { const m = mat(a); return m.map(r => r[0]); });
// row operations (rows are 1-based like the TI)
const rowIdx = (m, r) => { r = int(r); if (r < 1 || r > m.length) fail('INVALID DIM'); return r - 1; };
def('rowSwap(', [3, 3], (a, r1, r2) => { const m = mat(a).map(r => r.slice()); const i = rowIdx(m, r1), j = rowIdx(m, r2); [m[i], m[j]] = [m[j], m[i]]; return { mat: m }; });
def('row+(', [3, 3], (a, r1, r2) => { const m = mat(a).map(r => r.slice()); const i = rowIdx(m, r1), j = rowIdx(m, r2); m[j] = m[j].map((v, k) => N.r14(v + m[i][k])); return { mat: m }; });
def('*row(', [3, 3], (s, a, r) => { const m = mat(a).map(r => r.slice()); const i = rowIdx(m, r); m[i] = m[i].map(v => N.r14(num(s) * v)); return { mat: m }; });
def('*row+(', [4, 4], (s, a, r1, r2) => { const m = mat(a).map(r => r.slice()); const i = rowIdx(m, r1), j = rowIdx(m, r2); m[j] = m[j].map((v, k) => N.r14(v + num(s) * m[i][k])); return { mat: m }; });
// finance
def('tvm_Pmt', [0, 7], (...a) => N.tvmSolve(withArgs(a, 'PMT'), 'PMT'));
def('tvm_I%', [0, 7], (...a) => N.tvmSolve(withArgs(a, 'I'), 'I'));
def('tvm_PV', [0, 7], (...a) => N.tvmSolve(withArgs(a, 'PV'), 'PV'));
def('tvm_N', [0, 7], (...a) => N.tvmSolve(withArgs(a, 'N'), 'N'));
def('tvm_FV', [0, 7], (...a) => N.tvmSolve(withArgs(a, 'FV'), 'FV'));
function withArgs(a, which) { // TI arg order: tvm_Pmt(N,I%,PV,FV,P/Y,C/Y) — omitted 'which'
  const order = ['N', 'I', 'PV', 'PMT', 'FV', 'PY', 'CY'].filter(k => k !== which);
  const t = Object.assign({}, S.tvm); a.forEach((v, i) => t[order[i]] = num(v)); return t;
}
def('npv(', [3, 4], (r, c0, cf, fr) => N.npv(num(r), num(c0), lst(cf).map(num), fr ? lst(fr).map(num) : undefined));
def('irr(', [2, 3], (c0, cf, fr) => N.irr(num(c0), lst(cf).map(num), fr ? lst(fr).map(num) : undefined));
const balF = n => n <= 0 ? S.tvm.PV : -N.tvmSolve(Object.assign({}, S.tvm, { N: n }), 'FV');
def('bal(', [1, 2], (k, rv) => { const v = balF(int(k)); return rv === undefined ? N.r12(v) : Number(v.toFixed(int(rv))); });
def('ΣPrn(', [2, 3], (a, b) => N.r12(balF(int(b)) - balF(int(a) - 1)));
def('ΣInt(', [2, 3], (a, b) => { a = int(a); b = int(b); return N.r12((b - a + 1) * S.tvm.PMT - (balF(b) - balF(a - 1))); });
def('▶Nom(', [2, 2], (eff, cy) => cy * 100 * (Math.pow(1 + num(eff) / 100, 1 / num(cy)) - 1));
def('▶Eff(', [2, 2], (nom, cy) => 100 * (Math.pow(1 + num(nom) / 100 / num(cy), num(cy)) - 1));
def('dbd(', [2, 2], (d1, d2) => {
  const parse = d => { const [w, f] = num(d).toFixed(4).split('.'); const W = Number(w); let mm, dd, yy;
    if (W <= 12) { mm = W; dd = Number(f.slice(0, 2)); yy = Number(f.slice(2, 4)); } else { dd = Math.floor(W / 100); mm = W % 100; yy = Number(f.slice(0, 2)); }
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) fail('DOMAIN'); return Date.UTC(yy < 50 ? 2000 + yy : 1900 + yy, mm - 1, dd); };
  return Math.round((parse(d2) - parse(d1)) / 864e5);
});

/* special forms (unevaluated args) */
const SPECIAL = {};
const varName = (node) => { if (!node || node.t !== 'var') fail('SYNTAX'); return node.n; };
SPECIAL['nDeriv('] = (a) => { if (a.length < 3) fail('ARGUMENT'); const v = varName(a[1]); const f = lambda(a[0], v); const at = ev(a[2]); const h = a[3] ? num(ev(a[3])) : 1e-3; return map1(at, x => { num(x); const r = (f(x + h) - f(x - h)) / (2 * h); return N.r12(r); }); };
SPECIAL['fnInt('] = (a) => { if (a.length < 4) fail('ARGUMENT'); const v = varName(a[1]); const f = lambda(a[0], v); const tol = a[4] ? num(ev(a[4])) : 1e-5; return N.r12(N.integrate(f, num(ev(a[2])), num(ev(a[3])), tol)); };
SPECIAL['fMin('] = (a) => { if (a.length < 4) fail('ARGUMENT'); const v = varName(a[1]); return N.fMin(lambda(a[0], v), num(ev(a[2])), num(ev(a[3]))); };
SPECIAL['fMax('] = (a) => { if (a.length < 4) fail('ARGUMENT'); const v = varName(a[1]); return N.fMax(lambda(a[0], v), num(ev(a[2])), num(ev(a[3]))); };
SPECIAL['Σ('] = (a) => { if (a.length !== 4) fail('ARGUMENT'); const v = varName(a[1]); const lo = int(ev(a[2])), hi = int(ev(a[3])); const old = S.vars[v]; let s = 0; try { for (let k = lo; k <= hi; k++) { S.vars[v] = k; s = ops.add(s, ev(a[0])); } } finally { S.vars[v] = old; } return s; };
SPECIAL['seq('] = (a) => { if (a.length < 4) fail('ARGUMENT'); const v = varName(a[1]); const lo = num(ev(a[2])), hi = num(ev(a[3])), st = a[4] ? num(ev(a[4])) : 1; if (st === 0) fail('DOMAIN'); const old = S.vars[v]; const out = []; try { for (let k = lo; st > 0 ? k <= hi + 1e-12 : k >= hi - 1e-12; k = N.r14(k + st)) { S.vars[v] = k; out.push(ev(a[0])); if (out.length > 999) fail('INVALID DIM'); } } finally { S.vars[v] = old; } return out; };
SPECIAL['solve('] = (a) => { if (a.length < 3) fail('ARGUMENT'); const v = varName(a[1]); const g = ev(a[2]); let lo = -1e99, hi = 1e99, guess = g; if (isList(g)) { guess = g[0]; if (g.length > 2) { lo = g[1]; hi = g[2]; } else if (g.length === 2) { lo = g[0]; hi = g[1]; guess = (lo + hi) / 2; } } return N.solveNear(lambda(a[0], v), num(guess), lo, hi); };
/* strings: text back into calculator tokens (longest match first), and the string functions */
let tokIndex = null;
E.tokenize = function (text) {
  if (!tokIndex) {
    const all = new Set([].concat(Object.keys(FUNCS), Object.keys(SPECIAL), Object.keys(COMMANDS), Object.keys(SPECIAL_VARS), LISTS, ['ʟ'], YN, MATS, STRS, [...CONV], [...POSTFIX],
      ['Ans', 'rand', 'π', 'and', 'or', 'xor', 'nPr', 'nCr', '→', 'ᴇ', '⁻']));
    tokIndex = [...all].map(t => [E.disp(t), t]).filter(([d]) => d.length).sort((a, b) => b[0].length - a[0].length);
  }
  const out = []; let i = 0;
  while (i < text.length) { const m = tokIndex.find(([d]) => text.startsWith(d, i)); if (m) { out.push(m[1]); i += m[0].length; } else { out.push(text[i] === '-' ? '-' : text[i]); i++; } }
  return out;
};
const str = v => { if (typeof v !== 'string') fail('DATA TYPE'); return v; };
def('length(', [1, 1], s => [...str(s)].length);
def('sub(', [1, 3], (s, a, n) => { if (typeof s === 'number' && a === undefined) return s / 100; const c = [...str(s)]; a = int(a); n = int(n); if (a < 1 || n < 1 || a + n - 1 > c.length) fail('DOMAIN'); return c.slice(a - 1, a - 1 + n).join(''); });
def('inString(', [2, 3], (s, t, a = 1) => { const i = str(s).indexOf(str(t), int(a) - 1); return i + 1; });
def('expr(', [1, 1], s => ev(parseExpr(E.tokenize(str(s)))));
def('toString(', [1, 2], v => E.format(v)[0]);
def('eval(', [1, 1], v => E.format(v)[0]);
COMMANDS['Equ▶String('] = (a) => { if (a.length !== 2 || a[0].t !== 'yvar' || a[1].t !== 'strvar') fail('SYNTAX'); S.strs[a[1].n] = E.tokText(S.Y[a[0].n].toks); return { done: true }; };
COMMANDS['String▶Equ('] = (a) => { if (a.length !== 2 || a[0].t !== 'strvar' || a[1].t !== 'yvar') fail('SYNTAX'); S.Y[a[1].n].toks = E.tokenize(ev(a[0])); parseCache.clear(); return { done: true }; };
// piecewise(expr1,cond1,expr2,cond2,…[,otherwise]) — first piece whose condition is true; none true → no value
SPECIAL['piecewise('] = (a) => {
  if (a.length < 2) fail('ARGUMENT');
  for (let k = 0; k + 1 < a.length; k += 2) if (num(ev(a[k + 1])) !== 0) return ev(a[k]);
  if (a.length % 2) return ev(a[a.length - 1]);
  fail('UNDEFINED');
};
E.FUNCS = FUNCS; E.SPECIAL = SPECIAL;

function call(n) {
  if (SPECIAL[n.f]) return SPECIAL[n.f](n.args);
  const F = FUNCS[n.f]; if (!F) fail('SYNTAX');
  if (n.args.length < F.n[0] || n.args.length > F.n[1]) fail('ARGUMENT');
  const args = n.args.map(ev);
  return F.f(...args);
}

/* ======================= STORE ======================= */
function store(target, v) {
  const n = target.n;
  if (S.archived && S.archived.includes(n)) fail('ARCHIVED');
  if (LETTERS.includes(n)) { if (!isScalar(v)) fail('DATA TYPE'); S.vars[n] = v; return; }
  if (STRS.includes(n)) { if (typeof v !== 'string') fail('DATA TYPE'); (S.strs || (S.strs = {}))[n] = v; return; }
  if (isLN(n)) {
    if (target.idx) { const i = int(ev(target.idx[0])); const l = S.lists[n] || (S.lists[n] = []); if (i < 1 || i > l.length + 1) fail('INVALID DIM'); if (!isScalar(v)) fail('DATA TYPE'); l[i - 1] = v; return; }
    if (!isList(v)) fail('DATA TYPE'); S.lists[n] = v.slice(); return;
  }
  if (MATS.includes(n)) {
    if (target.idx) { const m = S.mats[n]; const i = int(ev(target.idx[0])), j = int(ev(target.idx[1])); if (!m || i < 1 || j < 1 || i > m.length || j > m[0].length) fail('INVALID DIM'); m[i - 1][j - 1] = num(v); return; }
    if (!isMat(v)) fail('DATA TYPE'); S.mats[n] = v.mat.map(r => r.slice()); return;
  }
  const d = SPECIAL_VARS[n]; if (d) { S[d[0]][d[1]] = num(v); return; }
  fail('SYNTAX');
}
E.store = store;

/* ======================= RUN LINE ======================= */
E.hooks = { command: null };
function checkResult(v) {
  const chk = x => { if (typeof x === 'number') { if (!isFinite(x) || Math.abs(x) >= 1e100) fail('OVERFLOW'); } else if (isCx(x)) { chk(x.re); chk(x.im); } };
  if (isList(v)) v.forEach(chk); else if (isMat(v)) v.mat.forEach(r => r.forEach(chk)); else chk(v);
}
/* returns {value, conv} | {lines} | {done:true} | {action} */
E.run = function (toks) {
  const stmts = parseStatement(toks);
  let result = null;
  for (const st of stmts) {
    if (st.cmd) { result = E.runCommand(st.cmd, st.args); continue; }
    let v = ev(st.node);
    if (st.conv === '▶Rect' || st.conv === '▶Polar') { if (S.mode.complex === 'REAL' && !isCx(v)) fail('DATA TYPE'); }
    checkResult(v);
    // ANSWERS: AUTO shows a fraction when the input used a fraction template and has no decimal point
    if (!st.conv && S.mode.answers === 'AUTO' && (toks.includes('frac.n') || toks.includes('mix.u')) && !toks.includes('.')) st.conv = 'auto-frac';
    if (st.store) store(st.store, v);
    if (typeof v === 'number') v = N.r14(v) === 0 && Math.abs(v) < 1e-99 ? 0 : v;
    S.ans = v;
    result = { value: v, conv: st.conv };
  }
  return result;
};
E.evalNumber = function (toks) { // used by forms (WINDOW etc.)
  if (!toks.length) fail('SYNTAX');
  const v = ev(parseExpr(toks)); if (typeof v !== 'number') fail('DATA TYPE'); return v;
};

/* ---------- commands ---------- */
const listArg = (node, dflt) => { if (!node) return dflt ? S.lists[dflt] : undefined; const v = ev(node); if (!isList(v)) fail('DATA TYPE'); return v.map(num); };
function statLines(title, pairs) { return { title: true, lines: [title].concat(pairs.filter(p => p).map(([k, v]) => ' ' + k + '=' + (typeof v === 'number' ? fmtReal(v) : v))) }; }
E.statLines = statLines;
COMMANDS['1-Var Stats '] = (a) => {
  const xs = listArg(a[0], 'L₁'); const fs = a[1] ? (() => { const v = ev(a[1]); return isList(v) ? v.map(num) : xs.map(() => num(v)); })() : undefined;
  const s = N.oneVar(xs, fs); Object.keys(s).forEach(k => { if (!k.startsWith('_')) S.stat[k] = s[k]; });
  return statLines('1-Var Stats', [['x̄', s['x̄']], ['Σx', s['Σx']], ['Σx²', s['Σx²']], ['Sx', s.Sx], ['σx', s['σx']], ['n', s.n], ['minX', s.minX], ['Q₁', s.Q1], ['Med', s.Med], ['Q₃', s.Q3], ['maxX', s.maxX]]);
};
COMMANDS['2-Var Stats '] = (a) => {
  const xs = listArg(a[0], 'L₁'), ys = listArg(a[1], 'L₂'); const fs = a[2] ? listArg(a[2]) : undefined;
  const s = N.twoVar(xs, ys, fs); Object.keys(s).forEach(k => { if (!k.startsWith('_')) S.stat[k] = s[k]; });
  return statLines('2-Var Stats', [['x̄', s['x̄']], ['Σx', s['Σx']], ['Σx²', s['Σx²']], ['Sx', s.Sx], ['σx', s['σx']], ['ȳ', s['ȳ']], ['Σy', s['Σy']], ['Σy²', s['Σy²']], ['Sy', s.Sy], ['σy', s['σy']], ['Σxy', s['Σxy']], ['n', s.n], ['minX', s.minX], ['maxX', s.maxX], ['minY', s.minY], ['maxY', s.maxY]]);
};
const REG = {
  'LinReg(ax+b) ': { title: 'LinReg', form: 'y=ax+b', eq: s => [s.a, '*X+', s.b], c: ['a', 'b'], r: true },
  'LinReg(a+bx) ': { title: 'LinReg', form: 'y=a+bx', eq: s => [s.a, '+', s.b, '*X'], c: ['a', 'b'], r: true },
  'QuadReg ': { title: 'QuadReg', form: 'y=ax²+bx+c', eq: s => [s.a, '*X^2+', s.b, '*X+', s.c], c: ['a', 'b', 'c'], R: true },
  'CubicReg ': { title: 'CubicReg', form: 'y=ax³+bx²+cx+d', eq: s => [s.a, '*X^3+', s.b, '*X^2+', s.c, '*X+', s.d], c: ['a', 'b', 'c', 'd'], R: true },
  'QuartReg ': { title: 'QuartReg', form: 'y=ax⁴+bx³+cx²+dx+e', eq: s => [s.a, '*X^4+', s.b, '*X^3+', s.c, '*X^2+', s.d, '*X+', s.e], c: ['a', 'b', 'c', 'd', 'e'], R: true },
  'LnReg ': { title: 'LnReg', form: 'y=a+bln(x)', eq: s => [s.a, '+', s.b, '*ln(X)'], c: ['a', 'b'], r: true },
  'ExpReg ': { title: 'ExpReg', form: 'y=a*b^x', eq: s => [s.a, '*', s.b, '^X'], c: ['a', 'b'], r: true },
  'PwrReg ': { title: 'PwrReg', form: 'y=a*x^b', eq: s => [s.a, '*X^', s.b], c: ['a', 'b'], r: true },
  'Logistic ': { title: 'Logistic', form: 'y=c/(1+a*e^(-bx))', eq: s => [s.c, '/(1+', s.a, '*e^(⁻', s.b, '*X))'], c: ['a', 'b', 'c'] },
  'SinReg ': { title: 'SinReg', form: 'y=a*sin(bx+c)+d', eq: s => [s.a, '*sin(', s.b, '*X+', s.c, ')+', s.d], c: ['a', 'b', 'c', 'd'] },
  'Med-Med ': { title: 'Med-Med', form: 'y=ax+b', eq: s => [s.a, '*X+', s.b], c: ['a', 'b'] }
};
E.REG = REG;
/* convert number to token array */
E.numToToks = function (v) {
  let s = String(Number(v.toPrecision(10)));
  if (/e/.test(s)) { const [m, e] = s.split('e'); s = m + 'ᴇ' + Number(e); }
  const out = []; for (const ch of s) out.push(ch === '-' ? '⁻' : ch); return out;
};
E.strToToks = function (str) { // simple tokenizer for internal equation strings
  const out = []; const multi = ['sin(', 'ln(', 'e^(', 'L₁', 'L₂', 'L₃', 'L₄', 'L₅', 'L₆'];
  for (let i = 0; i < str.length;) { const m = multi.find(t => str.startsWith(t, i)); if (m) { out.push(m); i += m.length; } else { out.push(str[i]); i++; } }
  return out;
};
E.regEqToks = function (def, s) {
  const out = [];
  def.eq(s).forEach(p => { if (typeof p === 'number') out.push(...E.numToToks(p)); else out.push(...E.strToToks(p)); });
  // tidy "+⁻" → "-"
  for (let i = 0; i < out.length - 1; i++) if (out[i] === '+' && out[i + 1] === '⁻') { out.splice(i, 2, '-'); }
  return out;
};
Object.keys(REG).forEach(name => {
  COMMANDS[name] = (a) => {
    const D = REG[name];
    let yref = null; const args = a.slice();
    if (args.length && args[args.length - 1].t === 'yvar' && !args[args.length - 1].x) yref = args.pop().n;
    const xs = listArg(args[0], 'L₁'), ys = listArg(args[1], 'L₂'); const fs = args[2] ? listArg(args[2]) : undefined;
    const s = N.regress(D.title === 'LinReg' ? name.trim() : D.title, xs, ys, fs);
    ['a', 'b', 'c', 'd', 'e', 'r', 'r2', 'R2'].forEach(k => S.stat[k] = s[k] !== undefined ? s[k] : NaN);
    const eq = E.regEqToks(D, s); S.regEQ = eq;
    if (yref) { S.Y[yref].toks = eq.slice(); S.Y[yref].on = true; parseCache.clear(); }
    const pairs = D.c.map(k => [k, s[k]]);
    if (D.r && S.mode.statDiag) { pairs.push(['r²', s.r2]); pairs.push(['r', s.r]); }
    if (D.R && S.mode.statDiag) pairs.push(['R²', s.R2]);
    return { title: true, lines: [D.title, ' ' + D.form].concat(pairs.map(([k, v]) => ' ' + k + '=' + fmtReal(v))) };
  };
});
// List▶matr(L₁,L₂,…,[A]): lists become the columns of the matrix
COMMANDS['List▶matr('] = (a) => {
  const t = a[a.length - 1]; if (a.length < 2 || !t || t.t !== 'mname') fail('SYNTAX');
  const cols = a.slice(0, -1).map(n => { const v = ev(n); if (!isList(v)) fail('DATA TYPE'); return v.map(num); });
  const rows = Math.max(...cols.map(c => c.length)); if (!rows) fail('INVALID DIM');
  S.mats[t.n] = Array.from({ length: rows }, (_, i) => cols.map(c => c[i] === undefined ? 0 : c[i])); return { done: true };
};
// ANOVA(L₁,L₂,…): one-way analysis of variance
COMMANDS['ANOVA('] = (a) => {
  if (a.length < 2) fail('ARGUMENT');
  const groups = a.map(n => { const v = ev(n); if (!isList(v) || v.length < 1) fail('DATA TYPE'); return v.map(num); });
  const all = [].concat(...groups), n = all.length, k = groups.length, grand = all.reduce((s, v) => s + v, 0) / n;
  let ssf = 0, sse = 0;
  groups.forEach(g => { const m = g.reduce((s, v) => s + v, 0) / g.length; ssf += g.length * (m - grand) ** 2; g.forEach(v => sse += (v - m) ** 2); });
  const df1 = k - 1, df2 = n - k; if (df2 < 1) fail('STAT');
  const msf = ssf / df1, mse = sse / df2, F = msf / mse, p = N.Fcdf(F, 1e99, df1, df2);
  Object.assign(S.stat, { F, p, df: df2 });
  const f = fmtReal;
  return { title: true, lines: ['One-way ANOVA', ' F=' + f(F), ' p=' + f(p), ' Factor', '  df=' + f(df1), '  SS=' + f(ssf), '  MS=' + f(msf), ' Error', '  df=' + f(df2), '  SS=' + f(sse), '  MS=' + f(mse), ' Sxp=' + f(Math.sqrt(mse))] };
};
/* MODE and FORMAT settings as commands (pasted from MODE/FORMAT in the program editor, or typed from CATALOG) */
const SETTING_CMDS = {
  Radian: ['mode', 'angle', 'RADIAN'], Degree: ['mode', 'angle', 'DEGREE'], Normal: ['mode', 'notation', 'NORMAL'], Sci: ['mode', 'notation', 'SCI'], Eng: ['mode', 'notation', 'ENG'],
  Float: ['mode', 'float', 'FLOAT'], Func: ['mode', 'graph', 'FUNCTION'], Param: ['mode', 'graph', 'PARAMETRIC'], Polar: ['mode', 'graph', 'POLAR'], Seq: ['mode', 'graph', 'SEQ'],
  Real: ['mode', 'complex', 'REAL'], 'a+bi': ['mode', 'complex', 'a+bi'], 're^θi': ['mode', 'complex', 're^θi'],
  Sequential: ['mode', 'simul', false], Simul: ['mode', 'simul', true],
  Thick: ['mode', 'lineStyle', 'THICK'], 'Dot-Thick': ['mode', 'lineStyle', 'DOT-THICK'], Thin: ['mode', 'lineStyle', 'THIN'], 'Dot-Thin': ['mode', 'lineStyle', 'DOT-THIN'],
  MATHPRINT: ['mode', 'mathprint', 'MATHPRINT'], CLASSIC: ['mode', 'mathprint', 'CLASSIC'], AUTO: ['mode', 'answers', 'AUTO'], DEC: ['mode', 'answers', 'DEC'], 'FRAC-APPROX': ['mode', 'answers', 'FRAC-APPROX'],
  'STATWIZARD ON': ['mode', 'statWiz', true], 'STATWIZARD OFF': ['mode', 'statWiz', false],
  AxesOn: ['fmt', 'axes', true], AxesOff: ['fmt', 'axes', false], GridOff: ['fmt', 'grid', 'OFF'], GridDot: ['fmt', 'grid', 'DOT'], GridLine: ['fmt', 'grid', 'LINE'],
  CoordOn: ['fmt', 'coord', true], CoordOff: ['fmt', 'coord', false], LabelOn: ['fmt', 'label', true], LabelOff: ['fmt', 'label', false], ExprOn: ['fmt', 'expr', true], ExprOff: ['fmt', 'expr', false],
  DetectAsymOn: ['fmt', 'detectAsym', true], DetectAsymOff: ['fmt', 'detectAsym', false],
  IndpntAuto: ['tbl', 'indpnt', 'AUTO'], IndpntAsk: ['tbl', 'indpnt', 'ASK'], DependAuto: ['tbl', 'depend', 'AUTO'], DependAsk: ['tbl', 'depend', 'ASK']
};
Object.keys(SETTING_CMDS).forEach(name => { COMMANDS[name] = () => { const [grp, key, v] = SETTING_CMDS[name]; S[grp][key] = v; parseCache.clear(); return { done: true }; }; });
E.SETTING_CMDS = SETTING_CMDS;
COMMANDS['Fix '] = (a) => { const k = int(ev(a[0])); if (k < 0 || k > 9) fail('DOMAIN'); S.mode.float = k; return { done: true }; };
// settings the app shows but has no choices for yet (split screen, GraphStyle backgrounds, polar coordinates readout)
['Full', 'Horiz', 'G-T'].forEach((n, i) => { COMMANDS[n] = () => { S.mode.split = ['FULL', 'HORIZONTAL', 'GRAPH-TABLE'][i]; return { done: true }; }; });
['RectGC', 'PolarGC'].forEach((n, i) => { COMMANDS[n] = () => { S.fmt.polarGC = i === 1; return { done: true }; }; });
['Time', 'Web', 'uvAxes', 'vwAxes', 'uwAxes'].forEach(n => { COMMANDS[n] = () => { S.fmt.seqFmt = n.replace('Axes', ''); return { done: true }; }; });
COMMANDS['BackgroundOff'] = () => { S.fmt.bg = null; S.fmt.bgImage = null; return { done: true }; };
// BackgroundOn Image1–Image0 (a picture loaded with the Files button) or a color 10–24
COMMANDS['BackgroundOn '] = (a) => { const n = num(ev(a[0]));
  if (Number.isInteger(n) && n >= 0 && n <= 9) { if (!(S.images || {})[n]) fail('UNDEFINED'); S.fmt.bgImage = n; S.fmt.bg = null; }
  else if (n >= 10 && n < 10 + COLOR_NAMES.length) { S.fmt.bg = COLOR_NAMES[n - 10]; S.fmt.bgImage = null; } else fail('DOMAIN');
  return { done: true }; };
['PrintScreen', 'GarbageCollect', 'ClockOn', 'ClockOff'].forEach(n => { COMMANDS[n] = () => ({ done: true }); });
/* Archive / UnArchive real, list, matrix and string variables */
const archName = node => { if (!node || !['var', 'lname', 'mname', 'strvar'].includes(node.t)) fail('SYNTAX'); const n = node.n;
  const exists = node.t === 'var' || (node.t === 'lname' ? !!S.lists[n] : node.t === 'mname' ? !!S.mats[n] : (S.strs || {})[n] !== undefined); if (!exists) fail('UNDEFINED'); return n; };
COMMANDS['Archive '] = (a) => { if (!a.length) fail('ARGUMENT'); a.forEach(node => { const n = archName(node); S.archived = S.archived || []; if (!S.archived.includes(n)) S.archived.push(n); }); return { done: true }; };
COMMANDS['UnArchive '] = (a) => { if (!a.length) fail('ARGUMENT'); a.forEach(node => { const n = archName(node); S.archived = (S.archived || []).filter(x => x !== n); }); return { done: true }; };
E.isArchived = n => !!(S.archived && S.archived.includes(n));
E.setArchived = (n, on) => { S.archived = (S.archived || []).filter(x => x !== n); if (on) S.archived.push(n); };
['setDate(', 'setTime(', 'setDtFmt(', 'setTmFmt('].forEach(n => { COMMANDS[n] = () => ({ done: true }); });
COMMANDS['BorderColor '] = (a) => { const k = int(ev(a[0])); if (k < 1 || k > 4) fail('DOMAIN'); S.fmt.border = k; return { done: true }; };
COMMANDS['TextColor('] = (a) => { const c = int(ev(a[0])); if (c < 10 || c > 24) fail('DOMAIN'); S.textColor = COLOR_HEX[c - 10]; return { done: true }; };
COMMANDS['Wait '] = (a) => { const t = num(ev(a[0])); if (t < 0) fail('DOMAIN'); return { done: true, wait: t }; }; // a running program pauses; on the home screen it just finishes
// Plot1(type,Xlist[,Ylist][,mark][,color]) and the plot-type tokens
const PLOT_TYPES = ['Scatter', 'xyLine', 'Histogram', 'ModBoxplot', 'Boxplot', 'NormProbPlot'], PLOT_IDS = ['scatter', 'xyLine', 'histogram', 'modbox', 'box', 'normprob'];
PLOT_TYPES.forEach((t, i) => { SPECIAL_VARS['plot.' + t] = ['const', i]; DISP['plot.' + t] = t; });
[1, 2, 3].forEach(k => {
  COMMANDS['Plot' + k + '('] = (a) => {
    if (a.length < 2) fail('ARGUMENT'); const p = S.plots[k - 1]; const ti = int(ev(a[0])); if (!PLOT_IDS[ti]) fail('DOMAIN');
    const names = a.slice(1).filter(n => n.t === 'lname').map(n => n.n), col = a.slice(1).filter(n => n.t === 'svar' && n.n.startsWith('col.')).pop();
    p.type = PLOT_IDS[ti]; p.on = true; if (names[0]) p.x = names[0];
    if (names[1]) { if (p.type === 'scatter' || p.type === 'xyLine') p.y = names[1]; else p.freq = names[1]; }
    if (col) p.color = COLOR_HEX[ev(col) - 10];
    return { done: true };
  };
});
// Pic1–Pic0, GDB1–GDB0, Image1–Image0 name the slots used by StorePic/RecallPic, StoreGDB/RecallGDB, BackgroundOn
['Pic', 'GDB', 'Image'].forEach(kind => [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].forEach(d => { SPECIAL_VARS[kind + d] = ['const', d]; }));
/* clock (CE: CATALOG) */
const now = () => new Date();
def('getDtStr(', [1, 1], f => { const d = now(), m = d.getMonth() + 1, dd = d.getDate(), y = d.getFullYear(); return [m + '/' + dd + '/' + y, dd + '/' + m + '/' + y, y + '/' + m + '/' + dd][int(f) - 1] || fail('DOMAIN'); });
def('getTmStr(', [1, 1], f => { const d = now(), mm = String(d.getMinutes()).padStart(2, '0'); f = int(f); if (f === 24) return d.getHours() + ':' + mm; if (f !== 12) fail('DOMAIN'); const h = d.getHours() % 12 || 12; return h + ':' + mm + (d.getHours() < 12 ? 'AM' : 'PM'); });
def('dayOfWk(', [3, 3], (y, m, d) => new Date(int(y), int(m) - 1, int(d)).getDay() + 1); // 1 = Sunday, like the CE
def('checkTmr(', [1, 1], t => Math.floor(Date.now() / 1000) - int(t));
def('timeCnv(', [1, 1], s => { s = int(s); return [Math.floor(s / 86400), Math.floor(s % 86400 / 3600), Math.floor(s % 3600 / 60), s % 60]; });
SPECIAL_VARS.getDate = ['fn', () => { const d = now(); return [d.getFullYear(), d.getMonth() + 1, d.getDate()]; }];
SPECIAL_VARS.getTime = ['fn', () => { const d = now(); return [d.getHours(), d.getMinutes(), d.getSeconds()]; }];
SPECIAL_VARS.startTmr = ['fn', () => Math.floor(Date.now() / 1000)];
SPECIAL_VARS.isClockOn = ['const', 1]; SPECIAL_VARS.getDtFmt = ['const', 1]; SPECIAL_VARS.getTmFmt = ['const', 12];
// GraphColor(n,color): color of Yn (n = 1…9, 0)
COMMANDS['GraphColor('] = (a) => { if (a.length !== 2) fail('ARGUMENT'); const k = int(ev(a[0])), c = int(ev(a[1])); if (k < 0 || k > 9 || c < 10 || c > 24) fail('DOMAIN'); S.Y[YN[k === 0 ? 9 : k - 1]].color = COLOR_HEX[c - 10]; return { done: true }; };
// DRAW ▸ STO: pictures (drawings) and graph databases, numbered 1–9, 0
const slot = n => { const k = int(ev(n)); if (k < 0 || k > 9) fail('DOMAIN'); return k; };
COMMANDS['StorePic '] = (a) => { (S.pics || (S.pics = {}))[slot(a[0])] = JSON.parse(JSON.stringify(S.draw.filter(d => !d._toks && d.t !== 'shade' && d.t !== 'shadeDist'))); return { done: true }; };
COMMANDS['RecallPic '] = (a) => { const p = (S.pics || {})[slot(a[0])]; if (!p) fail('UNDEFINED'); S.draw.push(...JSON.parse(JSON.stringify(p))); return { action: 'graph' }; };
COMMANDS['StoreGDB '] = (a) => { (S.gdbs || (S.gdbs = {}))[slot(a[0])] = JSON.parse(JSON.stringify({ win: S.win, fmt: S.fmt, Y: S.Y })); return { done: true }; };
COMMANDS['RecallGDB '] = (a) => { const g = (S.gdbs || {})[slot(a[0])]; if (!g) fail('UNDEFINED'); Object.assign(S.win, g.win); Object.assign(S.fmt, g.fmt); Object.keys(g.Y).forEach(k => Object.assign(S.Y[k], g.Y[k])); parseCache.clear(); return { done: true }; };
COMMANDS['GraphStyle('] = (a) => { if (a.length !== 2) fail('ARGUMENT'); const k = int(ev(a[0])), st = int(ev(a[1])); if (k < 0 || k > 9 || st < 1 || st > 7) fail('DOMAIN'); S.Y[YN[k === 0 ? 9 : k - 1]].style = st; return { done: true }; };
// pxl-Test(row,col): 1 if that graph pixel was turned on with Pxl-On(
def('pxl-Test(', [2, 2], (r, c) => { r = int(r); c = int(c); const d = S.draw.filter(x => x.t === 'pxl' && x.row === r && x.col === c).pop(); return d && !d.off ? 1 : 0; });
COMMANDS['ClrList '] = (a) => { a.forEach(n => { if (n.t !== 'lname') fail('SYNTAX'); S.lists[n.n] = []; }); return { done: true }; };
COMMANDS['ClrAllLists'] = () => { Object.keys(S.lists).forEach(l => S.lists[l] = []); return { done: true }; };
COMMANDS['SortA('] = (a) => { if (a[0]?.t !== 'lname') fail('SYNTAX'); const keys = a.map(n => { if (n.t !== 'lname') fail('SYNTAX'); return n.n; }); const idx = S.lists[keys[0]].map((v, i) => i).sort((i, j) => S.lists[keys[0]][i] - S.lists[keys[0]][j]); keys.forEach(k => { const l = S.lists[k]; if (l.length !== idx.length) fail('DIM MISMATCH'); S.lists[k] = idx.map(i => l[i]); }); return { done: true }; };
COMMANDS['SortD('] = (a) => { if (a[0]?.t !== 'lname') fail('SYNTAX'); const keys = a.map(n => n.n); const idx = S.lists[keys[0]].map((v, i) => i).sort((i, j) => S.lists[keys[0]][j] - S.lists[keys[0]][i]); keys.forEach(k => { const l = S.lists[k]; if (l.length !== idx.length) fail('DIM MISMATCH'); S.lists[k] = idx.map(i => l[i]); }); return { done: true }; };
COMMANDS['Fill('] = (a) => { const v = num(ev(a[0])); const t = a[1]; if (t.t === 'lname') S.lists[t.n] = S.lists[t.n].map(() => v); else if (t.t === 'mname') S.mats[t.n] = S.mats[t.n].map(r => r.map(() => v)); else fail('SYNTAX'); return { done: true }; };
COMMANDS['Pmt_End'] = () => { S.tvm.begin = false; return { done: true }; };
COMMANDS['Pmt_Bgn'] = () => { S.tvm.begin = true; return { done: true }; };
COMMANDS['ClrHome'] = () => ({ action: 'clrhome' });
COMMANDS['DiagnosticOn'] = () => { S.mode.statDiag = true; return { done: true }; };
COMMANDS['DiagnosticOff'] = () => { S.mode.statDiag = false; return { done: true }; };
COMMANDS['FnOn '] = (a) => { const ids = a.length ? a.map(n => num(ev(n))) : [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]; ids.forEach(k => S.Y[YN[k === 0 ? 9 : k - 1]].on = true); return { done: true }; };
COMMANDS['FnOff '] = (a) => { const ids = a.length ? a.map(n => num(ev(n))) : [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]; ids.forEach(k => S.Y[YN[k === 0 ? 9 : k - 1]].on = false); return { done: true }; };
COMMANDS['Disp '] = (a) => ({ lines: a.map(n => E.format(ev(n))[0]) });
// graph commands (handled by UI hook)
['ClrDraw', 'Line(', 'Horizontal ', 'Vertical ', 'Tangent(', 'DrawF ', 'Shade(', 'DrawInv ', 'Circle(', 'Pt-On(', 'Pt-Off(', 'Pt-Change(', 'Pxl-On(', 'Pxl-Off(', 'Pxl-Change(', 'Text(',
 'ZStandard', 'ZDecimal', 'ZTrig', 'ZInteger', 'ZSquare', 'ZoomStat', 'ZoomFit', 'ZQuadrant1', 'ZFrac1/2', 'ZFrac1/3', 'ZFrac1/4', 'ZFrac1/5', 'ZFrac1/8', 'ZFrac1/10', 'ShadeNorm(', 'Shade_t(', 'Shadeχ²(', 'ShadeF(', 'Manual-Fit ', 'Select('].forEach(c => {
  COMMANDS[c] = (a) => { if (!E.hooks.command) fail('INVALID'); return E.hooks.command(c, a); };
});
E.runCommand = (c, a) => COMMANDS[c](a);
E.isCommand = t => !!COMMANDS[t];
E.isFunc = t => !!(FUNCS[t] || SPECIAL[t]);

G.Engine = E;
if (typeof module !== 'undefined') module.exports = E;
})(typeof window !== 'undefined' ? window : globalThis);
