/* numeric.js — special functions, distributions, numeric methods, regressions, finance, matrices */
(function (G) {
'use strict';
const N = {};
class CalcError extends Error { constructor(type, pos) { super(type); this.type = type; this.pos = pos; } }
N.CalcError = CalcError;
const fail = (t) => { throw new CalcError(t); };
N.fail = fail;

/* ---------- precision helpers ---------- */
N.r14 = x => (isFinite(x) && x !== 0) ? Number(x.toPrecision(14)) : x;
N.r12 = x => (isFinite(x) && x !== 0) ? Number(x.toPrecision(12)) : x;
N.eq = (a, b) => a === b || Math.abs(a - b) <= 1e-12 * Math.max(Math.abs(a), Math.abs(b));

/* ---------- gamma ---------- */
const LG = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
function lgamma(x) {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
  x -= 1; let a = LG[0]; const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += LG[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
function gamma(x) {
  if (Number.isInteger(x)) { if (x <= 0) fail('DOMAIN'); let r = 1; for (let i = 2; i < x; i++) r *= i; return r; }
  if (x < 0.5) return Math.PI / (Math.sin(Math.PI * x) * gamma(1 - x));
  return Math.exp(lgamma(x));
}
N.lgamma = lgamma; N.gamma = gamma;
N.factorial = function (x) {
  if (x < 0 && Number.isInteger(x)) fail('DOMAIN');
  if (!Number.isInteger(x) && !Number.isInteger(x * 2)) fail('DOMAIN');
  if (x > 69) fail('OVERFLOW');
  return N.r14(gamma(x + 1));
};
N.nCr = (n, r) => {
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0) fail('DOMAIN');
  if (r > n) return 0;
  r = Math.min(r, n - r); let v = 1; for (let i = 1; i <= r; i++) v = v * (n - r + i) / i;
  return Math.round(v) === v || v > 1e15 ? v : Math.round(v);
};
N.nPr = (n, r) => {
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0) fail('DOMAIN');
  if (r > n) return 0; let v = 1; for (let i = 0; i < r; i++) v *= (n - i); return v;
};

/* ---------- erf / normal ---------- */
function erfc(x) {
  if (x < 0) return 2 - erfc(-x);
  if (x < 3) { // series for erf
    let sum = x, term = x, n = 0; const x2 = x * x;
    while (Math.abs(term) > 1e-17 * Math.abs(sum)) { n++; term *= -x2 / n; sum += term / (2 * n + 1); if (n > 200) break; }
    return 1 - 2 / Math.sqrt(Math.PI) * sum;
  }
  // continued fraction (Lentz)
  const tiny = 1e-300; let f = x, C = x, D = 0;
  for (let n = 1; n < 300; n++) {
    const an = n / 2; D = x + an * D; D = D === 0 ? tiny : D; C = x + an / C; C = C === 0 ? tiny : C;
    D = 1 / D; const d = C * D; f *= d; if (Math.abs(d - 1) < 1e-16) break;
  }
  return Math.exp(-x * x) / Math.sqrt(Math.PI) / f;
}
N.erfc = erfc;
N.Phi = z => 0.5 * erfc(-z / Math.SQRT2);
N.normalpdf = (x, m = 0, s = 1) => { if (s <= 0) fail('DOMAIN'); const z = (x - m) / s; return Math.exp(-z * z / 2) / (s * Math.sqrt(2 * Math.PI)); };
N.normalcdf = (lo, hi, m = 0, s = 1) => {
  if (s <= 0) fail('DOMAIN'); if (lo > hi) fail('DOMAIN');
  const a = (lo - m) / s, b = (hi - m) / s;
  if (a > 0) return 0.5 * (erfc(a / Math.SQRT2) - erfc(b / Math.SQRT2));
  return N.Phi(b) - N.Phi(a);
};
function invPhi(p) {
  if (p <= 0 || p >= 1) fail('DOMAIN');
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  let x; const pl = 0.02425;
  if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  else if (p <= 1 - pl) { const q = p - 0.5, r = q * q; x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
  else { const q = Math.sqrt(-2 * Math.log(1 - p)); x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  for (let k = 0; k < 3; k++) { const e = N.Phi(x) - p; const u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2); x = x - u / (1 + x * u / 2); }
  return x;
}
N.invPhi = invPhi;
N.invNorm = (p, m = 0, s = 1, tail = 0) => {
  if (s <= 0) fail('DOMAIN');
  if (tail === 1) { const z = invPhi(0.5 + p / 2); return [m - s * z, m + s * z]; }
  if (tail === 2) return m + s * invPhi(1 - p);
  return m + s * invPhi(p);
};

/* ---------- incomplete gamma / beta ---------- */
function gammp(a, x) {
  if (x < 0 || a <= 0) fail('DOMAIN'); if (x === 0) return 0;
  if (x < a + 1) {
    let ap = a, sum = 1 / a, del = sum;
    for (let n = 0; n < 1000; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-16) break; }
    return sum * Math.exp(-x + a * Math.log(x) - lgamma(a));
  }
  return 1 - gammq_cf(a, x);
}
function gammq_cf(a, x) {
  const tiny = 1e-300; let b = x + 1 - a, c = 1 / tiny, d = 1 / b, h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c; if (Math.abs(c) < tiny) c = tiny; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-16) break;
  }
  return Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
}
N.gammp = gammp;
function betacf(a, b, x) {
  const tiny = 1e-300; const qab = a + b, qap = a + 1, qam = a - 1; let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < tiny) d = tiny; d = 1 / d; let h = d;
  for (let m = 1; m <= 1000; m++) {
    const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny; c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny; c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny; d = 1 / d;
    const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-16) break;
  }
  return h;
}
function betai(a, b, x) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return bt * betacf(a, b, x) / a;
  return 1 - bt * betacf(b, a, 1 - x) / b;
}
N.betai = betai;

/* ---------- t, chi2, F ---------- */
N.tpdf = (x, df) => { if (df <= 0) fail('DOMAIN'); return Math.exp(lgamma((df + 1) / 2) - lgamma(df / 2)) / Math.sqrt(df * Math.PI) * Math.pow(1 + x * x / df, -(df + 1) / 2); };
function tCDF(t, df) {
  if (!isFinite(t)) return t > 0 ? 1 : 0;
  const x = df / (df + t * t); const tail = 0.5 * betai(df / 2, 0.5, x);
  return t > 0 ? 1 - tail : tail;
}
N.tCDF = tCDF;
N.tcdf = (lo, hi, df) => { if (df <= 0 || lo > hi) fail('DOMAIN'); if (lo > 0) { return tCDF(-lo, df) - tCDF(-hi, df); } return tCDF(hi, df) - tCDF(lo, df); };
N.invT = (p, df) => {
  if (p <= 0 || p >= 1 || df <= 0) fail('DOMAIN');
  let lo = -1e3, hi = 1e3;
  while (tCDF(lo, df) > p) lo *= 10; while (tCDF(hi, df) < p) hi *= 10;
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (tCDF(m, df) < p) lo = m; else hi = m; if (hi - lo < 1e-14 * Math.max(1, Math.abs(m))) break; }
  return (lo + hi) / 2;
};
N.chipdf = (x, df) => { if (df <= 0) fail('DOMAIN'); if (x < 0) return 0; if (x === 0) return df === 2 ? 0.5 : (df < 2 ? Infinity : 0); return Math.exp((df / 2 - 1) * Math.log(x) - x / 2 - (df / 2) * Math.log(2) - lgamma(df / 2)); };
const chiCDF = (x, df) => x <= 0 ? 0 : (!isFinite(x) ? 1 : gammp(df / 2, x / 2));
N.chiCDF = chiCDF;
N.chicdf = (lo, hi, df) => { if (df <= 0 || lo > hi) fail('DOMAIN'); return chiCDF(hi, df) - chiCDF(lo, df); };
N.Fpdf = (x, n, d) => { if (n <= 0 || d <= 0) fail('DOMAIN'); if (x <= 0) return 0; return Math.exp(0.5 * (n * Math.log(n * x) + d * Math.log(d) - (n + d) * Math.log(n * x + d)) - Math.log(x) - (lgamma(n / 2) + lgamma(d / 2) - lgamma((n + d) / 2))); };
const FCDF = (x, n, d) => x <= 0 ? 0 : (!isFinite(x) ? 1 : betai(n / 2, d / 2, n * x / (n * x + d)));
N.FCDF = FCDF;
N.Fcdf = (lo, hi, n, d) => { if (n <= 0 || d <= 0 || lo > hi) fail('DOMAIN'); return FCDF(hi, n, d) - FCDF(lo, n, d); };

/* ---------- discrete ---------- */
const binpmf = (n, p, x) => {
  if (x < 0 || x > n || !Number.isInteger(x)) return 0;
  if (p === 0) return x === 0 ? 1 : 0; if (p === 1) return x === n ? 1 : 0;
  return Math.exp(lgamma(n + 1) - lgamma(x + 1) - lgamma(n - x + 1) + x * Math.log(p) + (n - x) * Math.log(1 - p));
};
function chkBin(n, p) { if (!Number.isInteger(n) || n < 0 || p < 0 || p > 1) fail('DOMAIN'); }
N.binompdf = (n, p, x) => { chkBin(n, p); if (x === undefined) { const r = []; for (let k = 0; k <= n; k++) r.push(binpmf(n, p, k)); return r; } return binpmf(n, p, x); };
N.binomcdf = (n, p, x) => {
  chkBin(n, p);
  const cdf = (k) => { k = Math.floor(k); if (k < 0) return 0; if (k >= n) return 1; let s = 0; for (let i = 0; i <= k; i++) s += binpmf(n, p, i); return Math.min(1, s); };
  if (x === undefined) { const r = []; for (let k = 0; k <= n; k++) r.push(cdf(k)); return r; } return cdf(x);
};
N.invBinom = (area, n, p) => { chkBin(n, p); if (area < 0 || area > 1) fail('DOMAIN'); let s = 0; for (let k = 0; k <= n; k++) { s += binpmf(n, p, k); if (s >= area - 1e-14) return k; } return n; };
N.poissonpdf = (m, x) => { if (m <= 0) fail('DOMAIN'); if (x < 0 || !Number.isInteger(x)) return 0; return Math.exp(-m + x * Math.log(m) - lgamma(x + 1)); };
N.poissoncdf = (m, x) => { if (m <= 0) fail('DOMAIN'); x = Math.floor(x); if (x < 0) return 0; let s = 0; for (let k = 0; k <= x; k++) s += N.poissonpdf(m, k); return Math.min(1, s); };
N.geometpdf = (p, x) => { if (p <= 0 || p > 1) fail('DOMAIN'); if (x < 1 || !Number.isInteger(x)) return 0; return p * Math.pow(1 - p, x - 1); };
N.geometcdf = (p, x) => { if (p <= 0 || p > 1) fail('DOMAIN'); x = Math.floor(x); if (x < 1) return 0; return 1 - Math.pow(1 - p, x); };

/* ---------- root finding / optimisation ---------- */
function brent(f, a, b, fa, fb, tol = 1e-15) {
  if (fa === undefined) fa = f(a); if (fb === undefined) fb = f(b);
  if (fa === 0) return a; if (fb === 0) return b;
  if (fa * fb > 0) fail('NO SIGN CHANGE');
  let c = a, fc = fa, d = b - a, e = d;
  for (let it = 0; it < 300; it++) {
    if (fb * fc > 0) { c = a; fc = fa; d = b - a; e = d; }
    if (Math.abs(fc) < Math.abs(fb)) { a = b; b = c; c = a; fa = fb; fb = fc; fc = fa; }
    const tol1 = 2 * 2.2e-16 * Math.abs(b) + 0.5 * tol * 1e-3, xm = 0.5 * (c - b);
    if (Math.abs(xm) <= tol1 || fb === 0) return b;
    if (Math.abs(e) >= tol1 && Math.abs(fa) > Math.abs(fb)) {
      let p, q, r; const s = fb / fa;
      if (a === c) { p = 2 * xm * s; q = 1 - s; } else { q = fa / fc; r = fb / fc; p = s * (2 * xm * q * (q - r) - (b - a) * (r - 1)); q = (q - 1) * (r - 1) * (s - 1); }
      if (p > 0) q = -q; p = Math.abs(p);
      if (2 * p < Math.min(3 * xm * q - Math.abs(tol1 * q), Math.abs(e * q))) { e = d; d = p / q; } else { d = xm; e = d; }
    } else { d = xm; e = d; }
    a = b; fa = fb; b += Math.abs(d) > tol1 ? d : (xm > 0 ? tol1 : -tol1); fb = f(b);
  }
  return b;
}
N.brent = brent;
function safe(f) { return x => { try { const y = f(x); return (typeof y === 'number' && isFinite(y)) ? y : NaN; } catch (e) { return NaN; } }; }
N.safe = safe;
/* golden-section minimiser on [a,b] */
function goldenMin(f, a, b) {
  const g = (Math.sqrt(5) - 1) / 2; let c = b - g * (b - a), d = a + g * (b - a), fc = f(c), fd = f(d);
  for (let i = 0; i < 200 && Math.abs(b - a) > 1e-13 * (Math.abs(a) + Math.abs(b) + 1e-10); i++) {
    if (fc < fd || isNaN(fd)) { b = d; d = c; fd = fc; c = b - g * (b - a); fc = f(c); }
    else { a = c; c = d; fc = fd; d = a + g * (b - a); fd = f(d); }
  }
  return (a + b) / 2;
}
N.goldenMin = goldenMin;
function refineExt(f, x, a, b) { // polish an extremum by finding the zero of the central-difference derivative
  const h = 1e-5 * (1 + Math.abs(x)); const g = t => (f(t + h) - f(t - h)) / (2 * h);
  const w = 1e-4 * (1 + Math.abs(x)); const lo = Math.max(a, x - w), hi = Math.min(b, x + w);
  try { const gl = g(lo), gh = g(hi); if (gl * gh < 0) { const r = brent(g, lo, hi, gl, gh); if (f(r) <= f(x) + 1e-15 * Math.abs(f(x))) return r; } } catch (e) { }
  return x;
}
N.fMin = (f, a, b) => { if (a > b) [a, b] = [b, a]; const sf = safe(f); const x = goldenMin(sf, a, b); return N.snap(refineExt(sf, x, a, b)); };
N.fMax = (f, a, b) => { if (a > b) [a, b] = [b, a]; const sf = safe(f), nf = t => -sf(t); const x = goldenMin(nf, a, b); return N.snap(refineExt(nf, x, a, b)); };
N.extremum = (f, a, b, max) => { const sf = safe(f), nf = max ? (t => -sf(t)) : sf; const x = goldenMin(nf, a, b); return N.snap(refineExt(nf, x, a, b)); };
N.snap = x => { const r = N.r12(x); return Math.abs(r) < 1e-9 ? 0 : (Math.abs(r - Math.round(r)) < 1e-8 ? Math.round(r) : x); };

/* find zero of f near guess within [lo,hi] (equation solver / intersect) */
N.solveNear = function (f, guess, lo = -1e99, hi = 1e99) {
  const sf = safe(f); let x0 = Math.min(Math.max(guess, lo), hi), f0 = sf(x0);
  if (f0 === 0) return x0;
  if (!isNaN(f0)) { // secant attempt
    let x1 = x0 + (Math.abs(x0) * 1e-4 + 1e-4), f1 = sf(x1), a = x0, fa = f0;
    for (let i = 0; i < 60 && !isNaN(f1); i++) {
      if (f1 === 0) return x1;
      if (fa * f1 < 0) return brent(sf, a, x1, fa, f1);
      const dn = (f1 - fa); if (dn === 0) break;
      let x2 = x1 - f1 * (x1 - a) / dn; if (!isFinite(x2)) break; x2 = Math.min(Math.max(x2, lo), hi);
      a = x1; fa = f1; x1 = x2; f1 = sf(x1);
      if (Math.abs(x1 - a) < 1e-14 * Math.max(1, Math.abs(x1)) && Math.abs(f1) < 1e-10) return x1;
    }
  }
  // expanding scan for sign change
  let step = Math.max(Math.abs(x0) * 1e-3, 1e-3);
  let pl = x0, pr = x0, fl = f0, fr = f0;
  for (let k = 0; k < 400; k++) {
    const nl = Math.max(x0 - step, lo), nr = Math.min(x0 + step, hi);
    const fnl = sf(nl), fnr = sf(nr);
    if (!isNaN(fnr) && !isNaN(fr) && fnr * fr <= 0) return brent(sf, pr, nr, fr, fnr);
    if (!isNaN(fnl) && !isNaN(fl) && fnl * fl <= 0) return brent(sf, nl, pl, fnl, fl);
    pl = nl; pr = nr; fl = fnl; fr = fnr; step *= 1.6;
    if (nl <= lo && nr >= hi) break;
  }
  // touching zero: minimise |f|
  const xm = goldenMin(x => Math.abs(sf(x)), Math.max(x0 - 1, lo), Math.min(x0 + 1, hi));
  if (Math.abs(sf(xm)) < 1e-9) return xm;
  fail('NO SIGN CHANGE');
};
/* zero within [L,R] for graph CALC zero */
N.zeroIn = function (f, L, R, guess) {
  const sf = safe(f); const n = 400; let prevx = L, prevy = sf(L), best = null;
  if (prevy === 0) return L;
  for (let i = 1; i <= n; i++) {
    const x = L + (R - L) * i / n, y = sf(x);
    if (y === 0) { if (best === null || Math.abs(x - guess) < Math.abs(best - guess)) best = x; }
    else if (!isNaN(y) && !isNaN(prevy) && y * prevy < 0) {
      const r = brent(sf, prevx, x, prevy, y);
      if (Math.abs(sf(r)) < 1e-6 * (1 + Math.abs(prevy) + Math.abs(y)) && (best === null || Math.abs(r - guess) < Math.abs(best - guess))) best = r;
    }
    prevx = x; prevy = y;
  }
  if (best !== null) return best;
  const xm = goldenMin(x => Math.abs(sf(x)), L, R);
  if (Math.abs(sf(xm)) < 1e-8) return xm;
  fail('NO SIGN CHANGE');
};

/* ---------- integration (adaptive Gauss–Kronrod 7/15) ---------- */
const XGK = [0.991455371120812639206854697526329, 0.949107912342758524526189684047851, 0.864864423359769072789712788640926, 0.741531185599394439863864773280788, 0.586087235467691130294144845693013, 0.405845151377397166906606412076961, 0.207784955007898467600689403773245, 0];
const WGK = [0.022935322010529224963732008058970, 0.063092092629978553290700663189204, 0.104790010322250183839876322541518, 0.140653259715525918745189590510238, 0.169004726639267902826583426598550, 0.190350578064785409913256402421014, 0.204432940075298892414161999234649, 0.209482141084727828012999174891714];
const WG = [0.129484966168869693270611432679082, 0.279705391489276667901467771423780, 0.381830050505118944950369775488975, 0.417959183673469387755102040816327];
function gk(f, a, b) {
  const c = (a + b) / 2, h = (b - a) / 2; const fc = f(c); let rk = fc * WGK[7], rg = fc * WG[3];
  for (let j = 0; j < 7; j++) { const dx = h * XGK[j]; const s = f(c - dx) + f(c + dx); rk += WGK[j] * s; if (j % 2 === 1) rg += WG[(j - 1) / 2] * s; }
  return [rk * h, Math.abs((rk - rg) * h)];
}
N.integrate = function (f, a, b, tol = 1e-5) {
  if (a === b) return 0; let sign = 1; if (a > b) { [a, b] = [b, a]; sign = -1; }
  const wrapped = x => { const y = f(x); if (typeof y !== 'number' || !isFinite(y)) fail('DOMAIN'); return y; };
  let total = 0, count = 0;
  const rec = (a, b, depth, tl) => {
    const [r, e] = gk(wrapped, a, b); count++;
    if (count > 4000) fail('TOL NOT MET');
    if (e <= Math.max(tl, 1e-15 * Math.abs(r)) || depth > 40) return r;
    const m = (a + b) / 2; return rec(a, m, depth + 1, tl / 2) + rec(m, b, depth + 1, tl / 2);
  };
  total = rec(a, b, 0, Math.max(tol * 1e-3, 1e-12));
  return sign * total;
};

/* ---------- linear algebra ---------- */
N.matCheck = m => { const r = m.length, c = m[0].length; return [r, c]; };
N.det = function (m) {
  const n = m.length; if (n !== m[0].length) fail('INVALID DIM');
  const a = m.map(r => r.slice()); let d = 1;
  for (let i = 0; i < n; i++) {
    let p = i; for (let k = i + 1; k < n; k++) if (Math.abs(a[k][i]) > Math.abs(a[p][i])) p = k;
    if (a[p][i] === 0) return 0; if (p !== i) { [a[p], a[i]] = [a[i], a[p]]; d = -d; }
    d *= a[i][i]; for (let k = i + 1; k < n; k++) { const f = a[k][i] / a[i][i]; for (let j = i; j < n; j++) a[k][j] -= f * a[i][j]; }
  }
  return N.r14(d);
};
N.inverse = function (m) {
  const n = m.length; if (n !== m[0].length) fail('INVALID DIM');
  const a = m.map((r, i) => r.concat(Array.from({ length: n }, (_, j) => i === j ? 1 : 0)));
  const scale = Math.max(...m.flat().map(Math.abs)) || 1;
  for (let i = 0; i < n; i++) {
    let p = i; for (let k = i + 1; k < n; k++) if (Math.abs(a[k][i]) > Math.abs(a[p][i])) p = k;
    if (Math.abs(a[p][i]) < 1e-13 * scale) fail('SINGULAR MATRIX');
    [a[p], a[i]] = [a[i], a[p]]; const pv = a[i][i]; for (let j = 0; j < 2 * n; j++) a[i][j] /= pv;
    for (let k = 0; k < n; k++) if (k !== i) { const f = a[k][i]; if (f) for (let j = 0; j < 2 * n; j++) a[k][j] -= f * a[i][j]; }
  }
  return a.map(r => r.slice(n).map(N.clean));
};
N.clean = x => Math.abs(x) < 1e-13 ? 0 : N.r14(x);
N.rref = function (m, full = true) {
  const a = m.map(r => r.slice()); const R = a.length, C = a[0].length; let lead = 0;
  const scale = Math.max(...m.flat().map(Math.abs)) || 1;
  for (let r = 0; r < R && lead < C; r++, lead++) {
    let i = r; while (Math.abs(a[i][lead]) < 1e-12 * scale) { i++; if (i === R) { i = r; lead++; if (lead === C) return a.map(x => x.map(N.clean)); } }
    let p = i; for (let k = i + 1; k < R; k++) if (Math.abs(a[k][lead]) > Math.abs(a[p][lead])) p = k;
    [a[p], a[r]] = [a[r], a[p]]; const pv = a[r][lead]; for (let j = 0; j < C; j++) a[r][j] /= pv;
    for (let k = full ? 0 : r + 1; k < R; k++) if (k !== r) { const f = a[k][lead]; for (let j = 0; j < C; j++) a[k][j] -= f * a[r][j]; }
  }
  return a.map(x => x.map(N.clean));
};
N.matMul = (A, B) => { if (A[0].length !== B.length) fail('DIM MISMATCH'); return A.map(r => B[0].map((_, j) => N.r14(r.reduce((s, v, k) => s + v * B[k][j], 0)))); };
N.solveLinear = function (A, b) { // least squares via normal eq with partial pivot gaussian
  const n = A[0].length; const M = Array.from({ length: n }, (_, i) => Array.from({ length: n + 1 }, (_, j) => 0));
  for (let r = 0; r < A.length; r++) for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) M[i][j] += A[r][i] * A[r][j]; M[i][n] += A[r][i] * b[r]; }
  for (let i = 0; i < n; i++) {
    let p = i; for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
    if (Math.abs(M[p][i]) < 1e-300) fail('SINGULAR MATRIX');
    [M[p], M[i]] = [M[i], M[p]];
    for (let k = i + 1; k < n; k++) { const f = M[k][i] / M[i][i]; for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j]; }
  }
  const x = new Array(n).fill(0); for (let i = n - 1; i >= 0; i--) { let s = M[i][n]; for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; }
  return x;
};

/* ---------- statistics ---------- */
function expandFreq(xs, fs) {
  if (!fs) return { xs, fs: xs.map(() => 1) };
  if (fs.length !== xs.length) fail('DIM MISMATCH');
  fs.forEach(f => { if (f < 0) fail('DOMAIN'); });
  return { xs, fs };
}
function median(sorted) { // sorted [value,freq] pairs
  const n = sorted.reduce((s, p) => s + p[1], 0);
  const at = k => { let c = 0; for (const [v, f] of sorted) { c += f; if (k < c) return v; } return sorted[sorted.length - 1][0]; };
  return n % 2 ? at((n - 1) / 2) : (at(n / 2 - 1) + at(n / 2)) / 2;
}
N.oneVar = function (xs, fs) {
  if (!xs || !xs.length) fail('INVALID DIM');
  ({ xs, fs } = expandFreq(xs, fs));
  let n = 0, sx = 0, sx2 = 0;
  xs.forEach((x, i) => { n += fs[i]; sx += x * fs[i]; sx2 += x * x * fs[i]; });
  if (n === 0) fail('STAT');
  const mean = sx / n; let ss = 0; xs.forEach((x, i) => ss += fs[i] * (x - mean) ** 2);
  const pairs = xs.map((x, i) => [x, fs[i]]).filter(p => p[1] > 0).sort((a, b) => a[0] - b[0]);
  const res = { 'x̄': mean, 'Σx': N.r14(sx), 'Σx²': N.r14(sx2), 'Sx': n > 1 ? Math.sqrt(ss / (n - 1)) : NaN, 'σx': Math.sqrt(ss / n), 'n': n, 'minX': pairs[0][0], 'maxX': pairs[pairs.length - 1][0] };
  const intN = Number.isInteger(n);
  if (intN) {
    const flat = []; pairs.forEach(([v, f]) => { for (let k = 0; k < f; k++) flat.push(v); });
    const med = median(pairs); const h = Math.floor(n / 2);
    const lower = flat.slice(0, h), upper = flat.slice(n % 2 ? h + 1 : h);
    const m = a => a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
    res.Q1 = n > 1 ? m(lower) : NaN; res.Med = med; res.Q3 = n > 1 ? m(upper) : NaN;
  } else { res.Med = median(pairs); res.Q1 = NaN; res.Q3 = NaN; }
  return res;
};
N.twoVar = function (xs, ys, fs) {
  if (!xs || !ys) fail('INVALID DIM'); if (xs.length !== ys.length) fail('DIM MISMATCH');
  if (!fs) fs = xs.map(() => 1); else if (fs.length !== xs.length) fail('DIM MISMATCH');
  let n = 0, sx = 0, sy = 0, sx2 = 0, sy2 = 0, sxy = 0;
  xs.forEach((x, i) => { const f = fs[i], y = ys[i]; n += f; sx += f * x; sy += f * y; sx2 += f * x * x; sy2 += f * y * y; sxy += f * x * y; });
  if (n < 1) fail('STAT');
  const mx = sx / n, my = sy / n; let ssx = 0, ssy = 0, sp = 0;
  xs.forEach((x, i) => { const f = fs[i]; ssx += f * (x - mx) ** 2; ssy += f * (ys[i] - my) ** 2; sp += f * (x - mx) * (ys[i] - my); });
  return { 'x̄': mx, 'Σx': N.r14(sx), 'Σx²': N.r14(sx2), 'Sx': Math.sqrt(ssx / (n - 1)), 'σx': Math.sqrt(ssx / n), 'n': n,
    'ȳ': my, 'Σy': N.r14(sy), 'Σy²': N.r14(sy2), 'Sy': Math.sqrt(ssy / (n - 1)), 'σy': Math.sqrt(ssy / n), 'Σxy': N.r14(sxy),
    'minX': Math.min(...xs), 'maxX': Math.max(...xs), 'minY': Math.min(...ys), 'maxY': Math.max(...ys), _ssx: ssx, _ssy: ssy, _sp: sp };
};
function linfit(xs, ys, fs) {
  const s = N.twoVar(xs, ys, fs); if (s._ssx === 0) fail('STAT');
  const a = s._sp / s._ssx, b = s['ȳ'] - a * s['x̄']; const r = s._ssy === 0 ? 0 : s._sp / Math.sqrt(s._ssx * s._ssy);
  return { slope: a, int: b, r, n: s.n };
}
N.regress = function (type, xs, ys, fs) {
  if (!xs || !ys) fail('INVALID DIM'); if (xs.length !== ys.length) fail('DIM MISMATCH'); if (xs.length < 2) fail('STAT');
  const out = { type };
  const polyfit = (deg) => {
    if (xs.length < deg + 1) fail('STAT');
    const w = fs || xs.map(() => 1);
    const A = [], B = []; xs.forEach((x, i) => { const sw = Math.sqrt(w[i]); const row = []; for (let k = deg; k >= 0; k--) row.push(sw * Math.pow(x, k)); A.push(row); B.push(sw * ys[i]); });
    const coef = N.solveLinear(A, B);
    const pred = x => coef.reduce((s, c) => s * x + c, 0);
    let my = 0, n = 0; xs.forEach((x, i) => { my += w[i] * ys[i]; n += w[i]; }); my /= n;
    let sse = 0, sst = 0; xs.forEach((x, i) => { sse += w[i] * (ys[i] - pred(x)) ** 2; sst += w[i] * (ys[i] - my) ** 2; });
    return { coef, R2: sst === 0 ? 1 : 1 - sse / sst };
  };
  switch (type) {
    case 'LinReg(ax+b)': { const f = linfit(xs, ys, fs); Object.assign(out, { a: f.slope, b: f.int, r: f.r, r2: f.r * f.r, eq: ['a', 'x', '+', 'b'] }); break; }
    case 'LinReg(a+bx)': { const f = linfit(xs, ys, fs); Object.assign(out, { a: f.int, b: f.slope, r: f.r, r2: f.r * f.r }); break; }
    case 'QuadReg': case 'CubicReg': case 'QuartReg': {
      const deg = { QuadReg: 2, CubicReg: 3, QuartReg: 4 }[type]; const p = polyfit(deg); const names = ['a', 'b', 'c', 'd', 'e'];
      p.coef.forEach((c, i) => out[names[i]] = c); out.R2 = p.R2; break;
    }
    case 'LnReg': { xs.forEach(x => { if (x <= 0) fail('DOMAIN'); }); const f = linfit(xs.map(Math.log), ys, fs); Object.assign(out, { a: f.int, b: f.slope, r: f.r, r2: f.r * f.r }); break; }
    case 'ExpReg': { ys.forEach(y => { if (y <= 0) fail('DOMAIN'); }); const f = linfit(xs, ys.map(Math.log), fs); Object.assign(out, { a: Math.exp(f.int), b: Math.exp(f.slope), r: f.r, r2: f.r * f.r }); break; }
    case 'PwrReg': { xs.forEach(x => { if (x <= 0) fail('DOMAIN'); }); ys.forEach(y => { if (y <= 0) fail('DOMAIN'); }); const f = linfit(xs.map(Math.log), ys.map(Math.log), fs); Object.assign(out, { a: Math.exp(f.int), b: f.slope, r: f.r, r2: f.r * f.r }); break; }
    case 'Med-Med': {
      const n = xs.length; if (n < 3) fail('STAT');
      const pts = xs.map((x, i) => [x, ys[i]]).sort((p, q) => p[0] - q[0]);
      const k = Math.floor(n / 3), rem = n % 3; const s1 = rem === 2 ? k + 1 : k, s2 = rem === 1 ? k + 1 : k;
      const g1 = pts.slice(0, s1), g2 = pts.slice(s1, s1 + s2), g3 = pts.slice(s1 + s2);
      const med = arr => { const a = arr.slice().sort((p, q) => p - q), m = a.length; return m % 2 ? a[(m - 1) / 2] : (a[m / 2 - 1] + a[m / 2]) / 2; };
      const M = g => [med(g.map(p => p[0])), med(g.map(p => p[1]))];
      const [x1, y1] = M(g1), [x2, y2] = M(g2), [x3, y3] = M(g3);
      const a = (y3 - y1) / (x3 - x1); const b = ((y1 - a * x1) + (y2 - a * x2) + (y3 - a * x3)) / 3;
      Object.assign(out, { a, b }); break;
    }
    case 'Logistic': {
      const my = Math.max(...ys);
      const p0 = [my * 1.1, 0, 0]; // c, a, b  y = c/(1+a e^{-bx})
      // initial guess from linearisation
      const c0 = my * 1.05; const tr = ys.map(y => Math.log(Math.max(c0 / Math.max(y, 1e-12) - 1, 1e-12)));
      try { const f = linfit(xs, tr); p0[1] = Math.exp(f.int); p0[2] = -f.slope; } catch (e) { p0[1] = 1; p0[2] = 1; }
      const fit = N.lm((p, x) => p[0] / (1 + p[1] * Math.exp(-p[2] * x)), xs, ys, [c0, p0[1], p0[2]]);
      Object.assign(out, { a: fit[1], b: fit[2], c: fit[0] }); break;
    }
    case 'SinReg': {
      if (xs.length < 4) fail('STAT');
      const span = Math.max(...xs) - Math.min(...xs); if (span === 0) fail('STAT');
      let best = null;
      const nb = 600, bmin = Math.PI / span, bmax = Math.PI * (xs.length - 1) / span * 1.2;
      for (let i = 0; i <= nb; i++) {
        const b = bmin * 0.5 + (bmax - bmin * 0.5) * i / nb;
        const A = xs.map(x => [Math.sin(b * x), Math.cos(b * x), 1]);
        try { const c = N.solveLinear(A, ys); let sse = 0; xs.forEach((x, k) => sse += (ys[k] - (c[0] * A[k][0] + c[1] * A[k][1] + c[2])) ** 2); if (!best || sse < best.sse) best = { b, c, sse }; } catch (e) { }
      }
      if (!best) fail('STAT');
      const amp = Math.hypot(best.c[0], best.c[1]), ph = Math.atan2(best.c[1], best.c[0]);
      const fit = N.lm((p, x) => p[0] * Math.sin(p[1] * x + p[2]) + p[3], xs, ys, [amp, best.b, ph, best.c[2]]);
      let [a, b, c, d] = fit; if (a < 0) { a = -a; c += Math.PI; } if (b < 0) { b = -b; c = -c + Math.PI; }
      c = ((c % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); if (c > Math.PI) c -= 2 * Math.PI;
      Object.assign(out, { a, b, c, d }); break;
    }
    default: fail('INVALID');
  }
  return out;
};
/* Levenberg–Marquardt */
N.lm = function (model, xs, ys, p) {
  p = p.slice(); let lambda = 1e-3; const m = p.length;
  const sse = q => xs.reduce((s, x, i) => { const r = ys[i] - model(q, x); return s + r * r; }, 0);
  let cur = sse(p);
  for (let it = 0; it < 500; it++) {
    const J = xs.map(x => p.map((pk, k) => { const h = 1e-7 * Math.max(1, Math.abs(pk)); const q = p.slice(); q[k] += h; return (model(q, x) - model(p, x)) / h; }));
    const r = xs.map((x, i) => ys[i] - model(p, x));
    const JTJ = Array.from({ length: m }, (_, i) => Array.from({ length: m }, (_, j) => J.reduce((s, row) => s + row[i] * row[j], 0)));
    const JTr = Array.from({ length: m }, (_, i) => J.reduce((s, row, k) => s + row[i] * r[k], 0));
    let improved = false;
    for (let t = 0; t < 30; t++) {
      const A = JTJ.map((row, i) => row.map((v, j) => i === j ? v * (1 + lambda) + 1e-300 : v));
      let d; try { d = gaussSolve(A, JTr); } catch (e) { lambda *= 10; continue; }
      const q = p.map((v, i) => v + d[i]); const s = sse(q);
      if (isFinite(s) && s < cur) { const rel = (cur - s) / (cur + 1e-300); p = q; cur = s; lambda = Math.max(lambda / 10, 1e-15); improved = true; if (rel < 1e-15) return p; break; }
      lambda *= 10;
    }
    if (!improved) break;
  }
  return p;
};
function gaussSolve(A, b) {
  const n = A.length; const M = A.map((r, i) => r.concat([b[i]]));
  for (let i = 0; i < n; i++) {
    let p = i; for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
    if (Math.abs(M[p][i]) < 1e-300) fail('SINGULAR MATRIX'); [M[p], M[i]] = [M[i], M[p]];
    for (let k = i + 1; k < n; k++) { const f = M[k][i] / M[i][i]; for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j]; }
  }
  const x = new Array(n); for (let i = n - 1; i >= 0; i--) { let s = M[i][n]; for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; }
  return x;
}
N.gaussSolve = gaussSolve;

/* ---------- finance (TVM) ---------- */
function tvmRate(I, PY, CY) { return Math.pow(1 + I / 100 / CY, CY / PY) - 1; }
N.tvmEq = function (t, override = {}) {
  const v = Object.assign({}, t, override); const i = tvmRate(v.I, v.PY, v.CY); const k = v.begin ? 1 : 0;
  if (Math.abs(i) < 1e-14) return v.PV + v.PMT * v.N + v.FV;
  const d = Math.pow(1 + i, -v.N);
  return v.PV + (1 + i * k) * v.PMT * (1 - d) / i + v.FV * d;
};
N.tvmSolve = function (t, which) {
  const i = tvmRate(t.I, t.PY, t.CY), k = t.begin ? 1 : 0;
  if (t.PY <= 0 || t.CY <= 0) fail('DOMAIN');
  const zero = Math.abs(i) < 1e-14;
  switch (which) {
    case 'PV': { if (zero) return -(t.PMT * t.N + t.FV); const d = Math.pow(1 + i, -t.N); return -((1 + i * k) * t.PMT * (1 - d) / i + t.FV * d); }
    case 'FV': { if (zero) return -(t.PV + t.PMT * t.N); const d = Math.pow(1 + i, -t.N); return -(t.PV + (1 + i * k) * t.PMT * (1 - d) / i) / d; }
    case 'PMT': { if (zero) { if (t.N === 0) fail('DOMAIN'); return -(t.PV + t.FV) / t.N; } const d = Math.pow(1 + i, -t.N); const den = (1 + i * k) * (1 - d) / i; if (den === 0) fail('DOMAIN'); return -(t.PV + t.FV * d) / den; }
    case 'N': {
      if (zero) { if (t.PMT === 0) fail('NO SIGN CHANGE'); return -(t.PV + t.FV) / t.PMT; }
      const Gv = (1 + i * k) * t.PMT / i; const v = -(t.PV + Gv) / (t.FV - Gv);
      if (!(v > 0)) fail('NO SIGN CHANGE'); return -Math.log(v) / Math.log(1 + i);
    }
    case 'I': {
      const f = I => N.tvmEq(t, { I });
      let g = t.I || 10; let r;
      try { r = N.solveNear(f, g, -99.9999 * t.CY / 1, 1e6); } catch (e) { fail('NO SIGN CHANGE'); }
      return r;
    }
  }
};
N.npv = (rate, cf0, cfs, freq) => { const i = rate / 100; let t = 0, s = cf0; cfs.forEach((c, k) => { const f = freq ? freq[k] : 1; for (let j = 0; j < f; j++) { t++; s += c / Math.pow(1 + i, t); } }); return s; };
N.irr = (cf0, cfs, freq) => N.solveNear(r => N.npv(r, cf0, cfs, freq), 10, -99.999999, 1e5);

/* ---------- polynomial roots (Durand–Kerner + polish) ---------- */
N.polyRoots = function (coef) { // coef highest first, real
  while (coef.length > 1 && coef[0] === 0) coef = coef.slice(1);
  const n = coef.length - 1; if (n < 1) fail('INVALID');
  const a = coef.map(c => c / coef[0]);
  const C = (re, im) => ({ re, im });
  const mul = (p, q) => C(p.re * q.re - p.im * q.im, p.re * q.im + p.im * q.re);
  const sub = (p, q) => C(p.re - q.re, p.im - q.im);
  const div = (p, q) => { const d = q.re * q.re + q.im * q.im; return C((p.re * q.re + p.im * q.im) / d, (p.im * q.re - p.re * q.im) / d); };
  const ev = z => { let r = C(1, 0); for (let i = 1; i <= n; i++) r = C(r.re * z.re - r.im * z.im + a[i], r.re * z.im + r.im * z.re); return r; };
  const R = 1 + Math.max(...a.slice(1).map(Math.abs));
  let z = Array.from({ length: n }, (_, k) => C(R * 0.9 * Math.cos(2 * Math.PI * k / n + 0.4), R * 0.9 * Math.sin(2 * Math.PI * k / n + 0.4)));
  for (let it = 0; it < 2000; it++) {
    let delta = 0;
    z = z.map((zi, i) => { let den = C(1, 0); z.forEach((zj, j) => { if (i !== j) den = mul(den, sub(zi, zj)); }); const w = div(ev(zi), den); delta = Math.max(delta, Math.hypot(w.re, w.im)); return sub(zi, w); });
    if (delta < 1e-15 * R) break;
  }
  return z.map(r => { const re = Math.abs(r.re) < 1e-11 * R ? 0 : N.r12(r.re); const im = Math.abs(r.im) < 1e-9 * R ? 0 : N.r12(r.im); return C(re, im); })
    .sort((p, q) => (q.re - p.re) || (q.im - p.im));
};

G.Numeric = N;
if (typeof module !== 'undefined') module.exports = N;
})(typeof window !== 'undefined' ? window : globalThis);
