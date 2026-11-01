/* tifile.js — read and write TI-84 Plus CE program files (.8xp) so teachers can load and share TI-BASIC programs.
   window.TIFile.read(bytes) → { name, lines } and TIFile.write(name, lines) → Uint8Array. Lines are arrays of app tokens. */
(function (G) {
'use strict';
const E = G.Engine || require('./engine.js');

/* TI-BASIC token bytes ↔ app tokens. One-byte tokens first, then two-byte (prefix + byte). */
const ONE = {
  0x01: '▶DMS', 0x02: '▶Dec', 0x03: '▶Frac', 0x04: '→', 0x05: 'plot.Boxplot', 0x06: '[', 0x07: ']', 0x08: '{', 0x09: '}', 0x0A: 'ʳ', 0x0B: '°', 0x0C: '⁻¹', 0x0D: '²', 0x0E: 'ᵀ', 0x0F: '³',
  0x10: '(', 0x11: ')', 0x12: 'round(', 0x13: 'pxl-Test(', 0x14: 'augment(', 0x15: 'rowSwap(', 0x16: 'row+(', 0x17: '*row(', 0x18: '*row+(', 0x19: 'max(', 0x1A: 'min(', 0x1B: 'R▶Pr(', 0x1C: 'R▶Pθ(', 0x1D: 'P▶Rx(', 0x1E: 'P▶Ry(', 0x1F: 'median(',
  0x20: 'randM(', 0x21: 'mean(', 0x22: 'solve(', 0x23: 'seq(', 0x24: 'fnInt(', 0x25: 'nDeriv(', 0x27: 'fMin(', 0x28: 'fMax(', 0x29: ' ', 0x2A: '"', 0x2B: ',', 0x2C: 'i', 0x2D: '!', 0x2E: 'CubicReg ', 0x2F: 'QuartReg ',
  0x3A: '.', 0x3B: 'ᴇ', 0x3C: 'or', 0x3D: 'xor', 0x3E: ':', 0x40: 'and', 0x5B: 'θ', 0x5F: 'prgm',
  0x64: 'Radian', 0x65: 'Degree', 0x66: 'Normal', 0x67: 'Sci', 0x68: 'Eng', 0x69: 'Float', 0x6A: '=', 0x6B: '<', 0x6C: '>', 0x6D: '≤', 0x6E: '≥', 0x6F: '≠', 0x70: '+', 0x71: '-', 0x72: 'Ans', 0x73: 'Fix ',
  0x74: 'Horiz', 0x75: 'Full', 0x76: 'Func', 0x77: 'Param', 0x78: 'Polar', 0x79: 'Seq', 0x7A: 'IndpntAuto', 0x7B: 'IndpntAsk', 0x7C: 'DependAuto', 0x7D: 'DependAsk',
  0x82: '*', 0x83: '/', 0x85: 'ClrDraw', 0x86: 'ZStandard', 0x87: 'ZTrig', 0x8B: 'ZSquare', 0x8E: 'ZDecimal', 0x8F: 'ZoomStat', 0x90: 'ZoomRcl', 0x91: 'PrintScreen', 0x92: 'ZoomSto', 0x93: 'Text(', 0x94: 'nPr', 0x95: 'nCr',
  0x96: 'FnOn ', 0x97: 'FnOff ', 0x98: 'StorePic ', 0x99: 'RecallPic ', 0x9A: 'StoreGDB ', 0x9B: 'RecallGDB ', 0x9C: 'Line(', 0x9D: 'Vertical ', 0x9E: 'Pt-On(', 0x9F: 'Pt-Off(',
  0xA0: 'Pt-Change(', 0xA1: 'Pxl-On(', 0xA2: 'Pxl-Off(', 0xA3: 'Pxl-Change(', 0xA4: 'Shade(', 0xA5: 'Circle(', 0xA6: 'Horizontal ', 0xA7: 'Tangent(', 0xA8: 'DrawInv ', 0xA9: 'DrawF ', 0xAB: 'rand', 0xAC: 'π', 0xAD: 'getKey', 0xAE: "'", 0xAF: '?',
  0xB0: '⁻', 0xB1: 'int(', 0xB2: 'abs(', 0xB3: 'det(', 0xB4: 'identity(', 0xB5: 'dim(', 0xB6: 'sum(', 0xB7: 'prod(', 0xB8: 'not(', 0xB9: 'iPart(', 0xBA: 'fPart(', 0xBC: '√(', 0xBD: '³√(', 0xBE: 'ln(', 0xBF: 'e^(',
  0xC0: 'log(', 0xC1: '10^(', 0xC2: 'sin(', 0xC3: 'sin⁻¹(', 0xC4: 'cos(', 0xC5: 'cos⁻¹(', 0xC6: 'tan(', 0xC7: 'tan⁻¹(', 0xC8: 'sinh(', 0xC9: 'sinh⁻¹(', 0xCA: 'cosh(', 0xCB: 'cosh⁻¹(', 0xCC: 'tanh(', 0xCD: 'tanh⁻¹(',
  0xCE: 'If ', 0xCF: 'Then', 0xD0: 'Else', 0xD1: 'While ', 0xD2: 'Repeat ', 0xD3: 'For(', 0xD4: 'End', 0xD5: 'Return', 0xD6: 'Lbl ', 0xD7: 'Goto ', 0xD8: 'Pause ', 0xD9: 'Stop', 0xDA: 'IS>(', 0xDB: 'DS<(', 0xDC: 'Input ', 0xDD: 'Prompt ', 0xDE: 'Disp ', 0xDF: 'DispGraph',
  0xE0: 'Output(', 0xE1: 'ClrHome', 0xE2: 'Fill(', 0xE3: 'SortA(', 0xE4: 'SortD(', 0xE5: 'DispTable', 0xE6: 'Menu(', 0xE9: 'PlotsOn ', 0xEA: 'PlotsOff ', 0xEC: 'Plot1(', 0xED: 'Plot2(', 0xEE: 'Plot3(',
  0xF0: '^', 0xF1: 'ˣ√', 0xF2: '1-Var Stats ', 0xF3: '2-Var Stats ', 0xF4: 'LinReg(a+bx) ', 0xF5: 'ExpReg ', 0xF6: 'LnReg ', 0xF7: 'PwrReg ', 0xF8: 'Med-Med ', 0xF9: 'QuadReg ', 0xFA: 'ClrList ', 0xFB: 'ClrTable', 0xFC: 'plot.Histogram', 0xFD: 'plot.xyLine', 0xFE: 'plot.Scatter', 0xFF: 'LinReg(ax+b) '
};
for (let d = 0; d <= 9; d++) ONE[0x30 + d] = String(d);
for (let k = 0; k < 26; k++) ONE[0x41 + k] = String.fromCharCode(65 + k);
const TWO = {};
const two = (pre, b, tok) => { TWO[(pre << 8) | b] = tok; };
E.MATS.forEach((m, i) => two(0x5C, i, m));
E.LISTS.forEach((l, i) => two(0x5D, i, l));
E.YN.forEach((y, i) => two(0x5E, 0x10 + i, y));
E.XT.forEach((x, i) => { two(0x5E, 0x20 + 2 * i, x); two(0x5E, 0x21 + 2 * i, E.YT[i]); });
E.RN.forEach((r, i) => two(0x5E, 0x40 + i, r));
['u', 'v', 'w'].forEach((s, i) => two(0x5E, 0x80 + i, s));
[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].forEach((d, i) => { two(0x60, i, 'Pic' + d); two(0x61, i, 'GDB' + d); });
E.STRS.forEach((s, i) => two(0xAA, i, s));
// graph format settings (0x7E prefix); only the ones the app has commands for
['Sequential', 'Simul', 'PolarGC', 'RectGC', 'CoordOn', 'CoordOff', 'Thick', 'Dot-Thick', 'AxesOn', 'AxesOff', 'GridDot', 'GridOff', 'LabelOn', 'LabelOff', 'Web', 'Time', 'uvAxes', 'vwAxes', 'uwAxes']
  .forEach((t, i) => { if (E.COMMANDS[t]) two(0x7E, i, t); });
[[0x02, 'stat.n'], [0x03, 'x̄'], [0x04, 'Σx'], [0x05, 'Σx²'], [0x06, 'Sx'], [0x07, 'σx'], [0x08, 'minX'], [0x09, 'maxX'], [0x0A, 'minY'], [0x0B, 'maxY'], [0x0C, 'ȳ'], [0x0D, 'Σy'], [0x0E, 'Σy²'], [0x0F, 'Sy'],
 [0x10, 'σy'], [0x11, 'Σxy'], [0x12, 'reg.r'], [0x13, 'Med'], [0x14, 'Q₁'], [0x15, 'Q₃'], [0x16, 'reg.a'], [0x17, 'reg.b'], [0x18, 'reg.c'], [0x19, 'reg.d'], [0x1A, 'reg.e']].forEach(([b, t]) => two(0x62, b, t));
['npv(', 'irr(', 'bal(', 'ΣPrn(', 'ΣInt(', '▶Nom(', '▶Eff(', 'dbd(', 'lcm(', 'gcd(', 'randInt(', 'randBin(', 'sub(', 'stdDev(', 'variance(', 'inString(', 'normalcdf(', 'invNorm(', 'tcdf(', 'χ²cdf(', 'Fcdf(',
 'binompdf(', 'binomcdf(', 'poissonpdf(', 'poissoncdf(', 'geometpdf(', 'geometcdf(', 'normalpdf(', 'tpdf(', 'χ²pdf(', 'Fpdf(', 'randNorm(', 'tvm_Pmt', 'tvm_I%', 'tvm_PV', 'tvm_N', 'tvm_FV',
 'conj(', 'real(', 'imag(', 'angle(', 'cumSum(', 'expr(', 'length(', 'ΔList(', 'ref(', 'rref(', '▶Rect', '▶Polar', 'e', 'SinReg ', 'Logistic ', null, 'ShadeNorm(', 'Shade_t(', 'Shadeχ²(', 'ShadeF(', 'Matr▶list(', 'List▶matr(']
  .forEach((t, i) => { if (t) two(0xBB, i, t); });
// lowercase letters a–z (0xBBBB is skipped by TI)
'abcdefghijk'.split('').forEach((c, i) => two(0xBB, 0xB0 + i, c));
'lmnopqrstuvwxyz'.split('').forEach((c, i) => two(0xBB, 0xBC + i, c));
ONE[0xEB] = 'ʟ'; // named lists: ʟ then the name's letters
const PREFIX = new Set([0x5C, 0x5D, 0x5E, 0x60, 0x61, 0x62, 0x63, 0x7E, 0xAA, 0xBB, 0xEF]);
const REV = new Map();
Object.entries(ONE).forEach(([b, t]) => { if (!REV.has(t)) REV.set(t, [Number(b)]); });
Object.entries(TWO).forEach(([w, t]) => { if (!REV.has(t)) REV.set(t, [Number(w) >> 8, Number(w) & 255]); });
REV.set('seq.n', REV.get('n')); // sequence n is typed as lowercase n

/* program bytes → lines of app tokens; unknown tokens become '?' and are counted */
function detokenize(bytes) {
  const lines = [[]]; let unknown = 0;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === 0x3F) { lines.push([]); continue; } // new line
    let tok;
    if (PREFIX.has(b) && i + 1 < bytes.length) { tok = TWO[(b << 8) | bytes[i + 1]]; i++; }
    else tok = ONE[b];
    if (tok === undefined) { unknown++; tok = '?'; }
    lines[lines.length - 1].push(tok);
  }
  return { lines, unknown };
}
/* MathPrint templates → their one-line TI forms (that is how a program file stores them) */
function linearize(toks) {
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    const T = E.TEMPLATES[toks[i]];
    if (!T) { if (!E.TMPL_TOKS.has(toks[i])) out.push(toks[i]); continue; }
    // collect the slots of this template
    const slots = [[]]; let depth = 0, j = i + 1;
    for (; j < toks.length; j++) {
      const t = toks[j];
      if (E.TEMPLATES[t]) depth++;
      if (depth === 0 && T.seps.includes(t)) { slots.push([]); continue; }
      if (depth === 0 && t === T.end) break;
      if (Object.values(E.TEMPLATES).some(x => x.end === t)) depth--;
      slots[slots.length - 1].push(t);
    }
    const L = slots.map(linearize), par = a => ['('].concat(a, [')']);
    const args = (fn, order) => [fn].concat(...order.map((k, n) => (n ? [','] : []).concat(L[k])), [')']);
    switch (T.kind) {
      case 'frac': out.push(...par(L[0]), '/', ...par(L[1])); break;
      case 'mix': out.push('(', ...L[0], '+', ...par(L[1]), '/', ...par(L[2]), ')'); break;
      case 'sup': if (T.fn) out.push(T.fn, ...L[0], ')'); else out.push('^', ...par(L[0])); break;
      default: out.push(...args(T.fn, T.order || L.map((_, k) => k)));
    }
    i = j;
  }
  return out;
}
/* app tokens → bytes; tokens with no TI byte are spelled out letter by letter */
function tokenize(lines) {
  const out = [];
  lines.forEach((line, n) => {
    if (n) out.push(0x3F);
    linearize(line).forEach(t => {
      const r = REV.get(t);
      if (r) { out.push(...r); return; }
      [...E.disp(t)].forEach(ch => { const c = REV.get(ch) || REV.get(ch.toUpperCase()); if (c) out.push(...c); });
    });
  });
  return out;
}

const SIG = [0x2A, 0x2A, 0x54, 0x49, 0x38, 0x33, 0x46, 0x2A, 0x1A, 0x0A, 0x00]; // **TI83F*
const u16 = (a, i) => a[i] | (a[i + 1] << 8);
function read(bytes) {
  bytes = new Uint8Array(bytes);
  if (bytes.length < 74 || SIG.some((b, i) => bytes[i] !== b)) throw new Error('Not a TI program file (.8xp)');
  const v = 55, hlen = u16(bytes, v), type = bytes[v + 4];
  if (type !== 0x05 && type !== 0x06) throw new Error('This file is not a program');
  let name = ''; for (let k = 0; k < 8; k++) { const c = bytes[v + 5 + k]; if (!c) break; name += c === 0x5B ? 'θ' : String.fromCharCode(c); }
  const data = v + 2 + hlen + 2, n = u16(bytes, data);
  const r = detokenize(bytes.slice(data + 2, data + 2 + n));
  return { name, lines: r.lines, unknown: r.unknown };
}
function write(name, lines) {
  const toks = tokenize(lines), body = [toks.length & 255, toks.length >> 8].concat(toks);
  const nm = [...name.slice(0, 8)].map(c => c === 'θ' ? 0x5B : c.charCodeAt(0)); while (nm.length < 8) nm.push(0);
  const entry = [0x0D, 0x00, body.length & 255, body.length >> 8, 0x05].concat(nm, [0x00, 0x00, body.length & 255, body.length >> 8], body);
  const comment = [...'Created by Calc8X'].map(c => c.charCodeAt(0)); while (comment.length < 42) comment.push(0);
  let sum = 0; entry.forEach(b => sum = (sum + b) & 0xFFFF);
  return new Uint8Array(SIG.concat(comment, [entry.length & 255, entry.length >> 8], entry, [sum & 255, sum >> 8]));
}

const TIFile = { read, write, detokenize, tokenize, linearize };
G.TIFile = TIFile;
if (typeof module !== 'undefined') module.exports = TIFile;
})(typeof window !== 'undefined' ? window : globalThis);
