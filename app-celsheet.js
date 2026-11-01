/* app-celsheet.js — APPS ▸ CelSheet: a small spreadsheet (columns A–F, rows 1–99).
   A cell holds a number or expression, "text, or a formula starting with = that can use cells (A1) and ranges (A1:A5). */
(function () {
'use strict';
const E = window.Engine, N = window.Numeric, App = window.App, G = App.G, { GRIDS, COL, SB, W, H } = App;
const S = () => E.getState();
const COLS = 'ABCDEF', ROWS = 99;
const sheet = () => { const st = S(); return st.cel || (st.cel = {}); };
const name = (c, r) => COLS[c] + (r + 1);
const LETTER = t => { const d = E.disp ? E.disp(t) : t; return COLS.includes(d) && d.length === 1 ? d : null; };

/* value of a cell: number, string, '' (empty) or {err} */
function cellValue(id, seen = new Set()) {
  const toks = sheet()[id]; if (!toks || !toks.length) return '';
  if (toks[0] === '"') return E.tokText(toks.slice(1)).replace(/"$/, '');
  if (seen.has(id)) return { err: 'CIRCULAR' };
  seen.add(id);
  try {
    const body = toks[0] === '=' ? substitute(toks.slice(1), seen) : toks;
    const v = E.ev(E.parseExpr(body)); seen.delete(id);
    if (typeof v !== 'number' || !isFinite(v)) return { err: 'DATA TYPE' }; return v;
  } catch (e) { seen.delete(id); return { err: e.type || 'ERROR' }; }
}
/* turn A1 into its value and A1:A5 into a list, so the calculator's own parser can do the rest */
function substitute(toks, seen) {
  const out = [];
  const ref = i => { const c = LETTER(toks[i]); if (!c) return null; let j = i + 1, d = ''; while (j < toks.length && /^[0-9]$/.test(toks[j])) d += toks[j++]; const r = Number(d); if (!d || r < 1 || r > ROWS) return null; return { c: COLS.indexOf(c), r: r - 1, end: j }; };
  const val = (c, r) => { const v = cellValue(name(c, r), seen); if (v && v.err) N.fail(v.err === 'CIRCULAR' ? 'INVALID' : v.err); if (typeof v === 'string') return v === '' ? 0 : N.fail('DATA TYPE'); return v; };
  for (let i = 0; i < toks.length;) {
    const a = ref(i);
    if (!a) { out.push(toks[i++]); continue; }
    if (toks[a.end] === ':' && ref(a.end + 1)) {
      const b = ref(a.end + 1), vals = [];
      for (let c = Math.min(a.c, b.c); c <= Math.max(a.c, b.c); c++) for (let r = Math.min(a.r, b.r); r <= Math.max(a.r, b.r); r++) { const v = cellValue(name(c, r), seen); if (typeof v === 'number') vals.push(v); }
      out.push('{'); vals.forEach((v, k) => { if (k) out.push(','); out.push(...E.numToToks(v)); }); out.push('}'); i = b.end; continue;
    }
    out.push('(', ...E.numToToks(val(a.c, a.r)), ')'); i = a.end;
  }
  return out;
}
App.celValue = id => cellValue(id);

App.celSheet = function () {
  let cc = 0, cr = 0, top = 0, left = 0, ed = null;
  const NC = 5, NR = 10, CW = 58, RH = 16, X0 = 26, Y0 = SB + 16;
  const show = v => v === '' ? '' : v && v.err ? 'ERR' : typeof v === 'number' ? App.fmtShort(v, 7) : String(v);
  return {
    render() {
      G.clear(); G.status(ed ? 'ENTER: save  CLEAR: erase' : 'CELSHEET  [enter] edit  [del] clear'); const c = G.ctx;
      c.font = '12px ' + App.MONO; c.textAlign = 'center'; c.fillStyle = '#d9dde2'; c.fillRect(0, SB, W, 16); c.fillRect(0, SB, X0, 16 + RH * NR);
      for (let i = 0; i < NC; i++) { c.fillStyle = cc === left + i ? '#1f4fff' : '#000'; c.fillText(COLS[left + i], X0 + i * CW + CW / 2, SB + 9); }
      for (let r = 0; r < NR; r++) {
        const row = top + r, y = Y0 + r * RH; c.fillStyle = cr === row ? '#1f4fff' : '#000'; c.textAlign = 'center'; c.fillText(String(row + 1), X0 / 2, y + RH / 2 + 1);
        for (let i = 0; i < NC; i++) {
          const col = left + i, x = X0 + i * CW, sel = col === cc && row === cr, v = cellValue(name(col, row));
          if (sel) { c.fillStyle = '#000'; c.fillRect(x + 1, y + 1, CW - 1, RH - 1); }
          c.fillStyle = sel ? '#fff' : (v && v.err ? '#e0201b' : '#000');
          const t = show(v); c.textAlign = typeof v === 'number' ? 'right' : 'left'; c.fillText(t.slice(0, 7), typeof v === 'number' ? x + CW - 3 : x + 3, y + RH / 2 + 1);
        }
      }
      c.strokeStyle = '#a0a0a0'; c.lineWidth = 1; c.beginPath();
      for (let i = 0; i <= NC; i++) { c.moveTo(X0 + i * CW + .5, SB); c.lineTo(X0 + i * CW + .5, Y0 + RH * NR); }
      for (let r = 0; r <= NR; r++) { c.moveTo(0, Y0 + r * RH + .5); c.lineTo(W, Y0 + r * RH + .5); } c.stroke();
      const by = Y0 + RH * NR + 17, id = name(cc, cr);
      if (ed) { App.entryLine(id + ':', ed, 4, by); return; }
      const toks = sheet()[id] || [], v = cellValue(id); c.font = GRIDS.big.font; c.textAlign = 'left'; c.fillStyle = '#000';
      c.fillText((id + ':' + E.tokText(toks)).slice(0, 26), 4, by);
      if (v && v.err) { c.fillStyle = '#e0201b'; c.font = '12px ' + App.MONO; c.fillText('ERR:' + v.err, 200, by - 12); }
    },
    key(k) {
      const id = name(cc, cr);
      if (ed) {
        if (k === '#enter') { const st = sheet(); if (ed.toks.length) st[id] = ed.toks.slice(); else delete st[id]; ed = null; App.save(); if (cr < ROWS - 1) cr++; this.scroll(); return true; }
        if (k === '#clear') { if (ed.empty) ed = null; else ed.set([]); return true; }
        if (k === '#quit') { ed = null; return false; }
        if (App.isTok(k)) { ed.insert(k); return true; }
        return ed.key(k) || true;
      }
      const mv = { '#up': [0, -1], '#down': [0, 1], '#left': [-1, 0], '#right': [1, 0] }[k];
      if (mv) { cc = Math.max(0, Math.min(COLS.length - 1, cc + mv[0])); cr = Math.max(0, Math.min(ROWS - 1, cr + mv[1])); this.scroll(); return true; }
      if (k === '#enter') { ed = new App.LineEditor((sheet()[id] || []).slice()); ed.cur = ed.toks.length; return true; }
      if (k === '#del') { delete sheet()[id]; App.save(); return true; }
      if (k === '#clear') { App.setScreen(App.home); return true; }
      if (App.isTok(k)) { ed = new App.LineEditor(); ed.insert(k); return true; }
      return false;
    },
    scroll() { if (cr < top) top = cr; if (cr >= top + NR) top = cr - NR + 1; if (cc < left) left = cc; if (cc >= left + NC) left = cc - NC + 1; }
  };
};
})();
