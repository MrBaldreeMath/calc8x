/* app-cabri.js — APPS ▸ CabriJr: interactive geometry.
   [y=] F1 file, [window] F2 draw, [zoom] F3 construct, [trace] F4 transform, [graph] F5 measure/appearance.
   Arrows move the cursor (2nd+arrow = bigger steps), ENTER uses the tool; with the pointer, ENTER grabs a point to drag. */
(function () {
'use strict';
const E = window.Engine, N = window.Numeric, App = window.App, G = App.G, { COL, SB, W, H } = App;
const S = () => E.getState();
const UNIT = 24, OX = 160, OY = SB + (H - SB) / 2; // 1 unit (cm) = 24 pixels, origin in the middle
const doc = () => { const st = S(); return st.cabri || (st.cabri = { objs: [], next: 1, axes: false }); };
const f2 = v => E.fmtReal(N.r12(Number(v.toPrecision(3))));

/* ---------- geometry ---------- */
const byId = id => doc().objs.find(o => o.id === id);
function pt(id) { // position of a point object (free or constructed)
  const o = byId(id); if (!o) return null;
  if (o.t === 'pt') return [o.x, o.y];
  if (o.t === 'mid') { const a = pt(o.a), b = pt(o.b); return a && b ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] : null; }
  if (o.t === 'refl') { const p = pt(o.p), L = line(o.l); if (!p || !L) return null; const [x0, y0] = L.p, [dx, dy] = L.d, t = ((p[0] - x0) * dx + (p[1] - y0) * dy) / (dx * dx + dy * dy); const fx = x0 + t * dx, fy = y0 + t * dy; return [2 * fx - p[0], 2 * fy - p[1]]; }
  return null;
}
function line(id) { // {p: point on it, d: direction, seg: [a, b] when it is a segment}
  const o = byId(id); if (!o) return null;
  if (o.t === 'seg' || o.t === 'line') { const a = pt(o.a), b = pt(o.b); return a && b ? { p: a, d: [b[0] - a[0], b[1] - a[1]], seg: o.t === 'seg' ? [a, b] : null } : null; }
  if (o.t === 'perp' || o.t === 'par') { const L = line(o.l), p = pt(o.p); if (!L || !p) return null; return { p, d: o.t === 'perp' ? [-L.d[1], L.d[0]] : L.d }; }
  return null;
}
const isPoint = o => ['pt', 'mid', 'refl'].includes(o.t), isLine = o => ['seg', 'line', 'perp', 'par'].includes(o.t);
const deps = o => [o.a, o.b, o.c, o.p, o.l].filter(x => x !== undefined).concat(o.of || []);
const toUnits = ([x, y]) => [(x - OX) / UNIT, (OY - y) / UNIT];
function distToObj(o, x, y) {
  if (isPoint(o)) { const p = pt(o.id); return p ? Math.hypot(p[0] - x, p[1] - y) : 1e9; }
  if (isLine(o)) { const L = line(o.id); if (!L) return 1e9; const [px, py] = L.p, [dx, dy] = L.d, len2 = dx * dx + dy * dy || 1; let t = ((x - px) * dx + (y - py) * dy) / len2; if (L.seg) t = Math.max(0, Math.min(1, t)); return Math.hypot(px + t * dx - x, py + t * dy - y); }
  if (o.t === 'circ') { const c = pt(o.c), p = pt(o.p); if (!c || !p) return 1e9; return Math.abs(Math.hypot(x - c[0], y - c[1]) - Math.hypot(p[0] - c[0], p[1] - c[1])); }
  if (o.t === 'tri') { const P = [o.a, o.b, o.c].map(pt); if (P.some(p => !p)) return 1e9; return Math.min(...[0, 1, 2].map(i => segDist(P[i], P[(i + 1) % 3], x, y))); }
  return 1e9;
}
function segDist(a, b, x, y) { const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(a[0] + t * dx - x, a[1] + t * dy - y); }
function nearest(x, y, want) { let best = null, bd = 7; doc().objs.forEach(o => { if (o.t === 'meas' || !want(o)) return; const d = distToObj(o, x, y) - (isPoint(o) ? 1 : 0); if (d < bd) { bd = d; best = o; } }); return best; }
function add(o) { const d = doc(); o.id = d.next++; d.objs.push(o); App.save(); return o; }
function remove(id) { const d = doc(); const gone = new Set([id]); let more = true; while (more) { more = false; d.objs.forEach(o => { if (!gone.has(o.id) && deps(o).some(x => gone.has(x))) { gone.add(o.id); more = true; } }); } d.objs = d.objs.filter(o => !gone.has(o.id)); App.save(); }

/* measurement text for a measurement object */
function measText(m) {
  try {
    if (m.kind === 'len') { const o = byId(m.of[0]); if (o.t === 'circ') { const c = pt(o.c), p = pt(o.p); return f2(2 * Math.PI * Math.hypot(p[0] - c[0], p[1] - c[1]) / UNIT) + ' cm'; }
      if (o.t === 'tri') { const P = [o.a, o.b, o.c].map(pt); return f2([0, 1, 2].reduce((s, i) => s + Math.hypot(P[i][0] - P[(i + 1) % 3][0], P[i][1] - P[(i + 1) % 3][1]), 0) / UNIT) + ' cm'; }
      if (m.of.length === 2) { const a = pt(m.of[0]), b = pt(m.of[1]); return f2(Math.hypot(a[0] - b[0], a[1] - b[1]) / UNIT) + ' cm'; }
      const L = line(o.id); return f2(Math.hypot(...L.d) / UNIT) + ' cm'; }
    if (m.kind === 'area') { const o = byId(m.of[0]); if (o.t === 'circ') { const c = pt(o.c), p = pt(o.p); return f2(Math.PI * ((p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2) / UNIT / UNIT) + ' cm²'; }
      const P = [o.a, o.b, o.c].map(pt); return f2(Math.abs((P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[2][0] - P[0][0]) * (P[1][1] - P[0][1])) / 2 / UNIT / UNIT) + ' cm²'; }
    if (m.kind === 'slope') { const L = line(m.of[0]); return L.d[0] === 0 ? 'undefined' : f2(-L.d[1] / L.d[0]); }
    if (m.kind === 'angle') { const [a, v, c] = m.of.map(pt), u1 = [a[0] - v[0], a[1] - v[1]], u2 = [c[0] - v[0], c[1] - v[1]]; const ang = Math.acos(Math.max(-1, Math.min(1, (u1[0] * u2[0] + u1[1] * u2[1]) / Math.hypot(...u1) / Math.hypot(...u2)))) * 180 / Math.PI; return f2(ang) + '°'; }
    if (m.kind === 'coord') { const o = byId(m.of[0]);
      if (isPoint(o)) { const [x, y] = toUnits(pt(o.id)); return '(' + f2(x) + ',' + f2(y) + ')'; }
      const L = line(o.id); if (L) { const [x0, y0] = toUnits(L.p); if (L.d[0] === 0) return 'x=' + f2(x0); const m2 = -L.d[1] / L.d[0]; return 'y=' + f2(m2) + 'x' + (y0 - m2 * x0 < 0 ? '−' : '+') + f2(Math.abs(y0 - m2 * x0)); }
      if (o.t === 'circ') { const c = toUnits(pt(o.c)), p = toUnits(pt(o.p)); return '(x−' + f2(c[0]) + ')²+(y−' + f2(c[1]) + ')²=' + f2((p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2); }
    }
  } catch (e) { }
  return '?';
}
function measAnchor(m) { const ps = m.of.map(id => { const o = byId(id); if (!o) return null; if (isPoint(o)) return pt(id); if (o.t === 'circ') return pt(o.c); if (o.t === 'tri') { const P = [o.a, o.b, o.c].map(pt); return [(P[0][0] + P[1][0] + P[2][0]) / 3, (P[0][1] + P[1][1] + P[2][1]) / 3]; } const L = line(id); return L ? [L.p[0] + L.d[0] / 2, L.p[1] + L.d[1] / 2] : null; }).filter(Boolean);
  if (!ps.length) return [OX, OY]; return [ps.reduce((s, p) => s + p[0], 0) / ps.length + (m.dx || 8), ps.reduce((s, p) => s + p[1], 0) / ps.length + (m.dy || -10)]; }

/* ---------- tools: each collects picks, then builds ---------- */
const TOOLS = {
  pointer: { name: 'Pointer', prompt: () => 'Move to a point, [enter] to grab' },
  point: { name: 'Point', picks: ['spot'], make: ([p]) => p },
  seg: { name: 'Segment', picks: ['point', 'point'], make: ([a, b]) => add({ t: 'seg', a, b }) },
  line: { name: 'Line', picks: ['point', 'point'], make: ([a, b]) => add({ t: 'line', a, b }) },
  circ: { name: 'Circle', picks: ['point', 'point'], prompt: k => k ? 'Select a point on the circle' : 'Select the center', make: ([c, p]) => add({ t: 'circ', c, p }) },
  tri: { name: 'Triangle', picks: ['point', 'point', 'point'], make: ([a, b, c]) => add({ t: 'tri', a, b, c }) },
  mid: { name: 'Midpoint', picks: ['point', 'point'], make: ([a, b]) => add({ t: 'mid', a, b }) },
  perp: { name: 'Perp.', picks: ['line', 'point'], prompt: k => k ? 'Select a point' : 'Select a line or segment', make: ([l, p]) => add({ t: 'perp', l, p }) },
  par: { name: 'Parallel', picks: ['line', 'point'], prompt: k => k ? 'Select a point' : 'Select a line or segment', make: ([l, p]) => add({ t: 'par', l, p }) },
  refl: { name: 'Reflection', picks: ['point', 'line'], prompt: k => k ? 'Select the mirror line' : 'Select a point to reflect', make: ([p, l]) => add({ t: 'refl', p, l }) },
  len: { name: 'D.&Length', picks: ['any'], make: ([o]) => byId(o) && isPoint(byId(o)) ? null : add({ t: 'meas', kind: 'len', of: [o] }), pointPair: true },
  area: { name: 'Area', picks: ['shape'], make: ([o]) => add({ t: 'meas', kind: 'area', of: [o] }) },
  slope: { name: 'Slope', picks: ['line'], make: ([o]) => add({ t: 'meas', kind: 'slope', of: [o] }) },
  angle: { name: 'Angle', picks: ['point', 'point', 'point'], prompt: k => ['Select a point on one side', 'Select the vertex', 'Select a point on the other side'][k], make: ([a, v, c]) => add({ t: 'meas', kind: 'angle', of: [a, v, c] }) },
  coord: { name: 'Coord.&Eq.', picks: ['any'], make: ([o]) => add({ t: 'meas', kind: 'coord', of: [o] }) },
  del: { name: 'Delete', picks: ['anyM'], make: ([o]) => { remove(o); return null; } }
};
const WANT = { point: isPoint, line: isLine, shape: o => o.t === 'tri' || o.t === 'circ', any: o => o.t !== 'meas', anyM: () => true };

App.cabriJr = function () {
  let cx = OX, cy = OY, tool = 'pointer', picks = [], grab = null, msg = '';
  const pickPrompt = () => { const T = TOOLS[tool]; if (msg) return msg; if (T.prompt) return T.prompt(picks.length); if (!T.picks) return ''; const w = T.picks[picks.length]; return w === 'spot' ? 'Move and press [enter]' : w === 'point' ? 'Select point ' + (picks.length + 1) : w === 'line' ? 'Select a line or segment' : 'Select an object'; };
  const setTool = t => { tool = t; picks = []; grab = null; msg = ''; TOOLS.len.picks = ['any']; App.setScreen(scr); };
  const menu = (title, items) => () => App.setScreen(new App.Menu([{ name: title, items: items.map(([label, run]) => ({ label, run })) }], scr, { title, back: scr }));
  const MENUS = {
    '#yequ': menu('F1 FILE', [['New (clear all)', () => { const d = doc(); d.objs = []; App.save(); setTool('pointer'); }], ['Axes on/off', () => { doc().axes = !doc().axes; App.save(); App.setScreen(scr); }], ['Quit CabriJr', () => App.setScreen(App.home)]]),
    '#window': menu('F2 CREATE', [['Pointer', () => setTool('pointer')], ['Point', () => setTool('point')], ['Segment', () => setTool('seg')], ['Line', () => setTool('line')], ['Circle', () => setTool('circ')], ['Triangle', () => setTool('tri')]]),
    '#zoom': menu('F3 CONSTRUCT', [['Midpoint', () => setTool('mid')], ['Perp.', () => setTool('perp')], ['Parallel', () => setTool('par')]]),
    '#trace': menu('F4 TRANSFORM', [['Reflection', () => setTool('refl')]]),
    '#graph': menu('F5 MEASURE', [['D.&Length', () => setTool('len')], ['Area', () => setTool('area')], ['Slope', () => setTool('slope')], ['Angle', () => setTool('angle')], ['Coord.&Eq.', () => setTool('coord')], ['Delete', () => setTool('del')]])
  };
  const enterKey = () => {
    msg = '';
    if (tool === 'pointer') { if (grab) { grab = null; App.save(); return; } const o = nearest(cx, cy, o2 => o2.t === 'pt'); if (o) grab = o; else msg = 'Only free points can be dragged'; return; }
    const T = TOOLS[tool], want = T.picks[picks.length];
    let id;
    if (want === 'spot' || want === 'point') { const o = nearest(cx, cy, isPoint); id = o ? o.id : (want === 'spot' ? add({ t: 'pt', x: cx, y: cy }).id : add({ t: 'pt', x: cx, y: cy }).id); }
    else { const o = nearest(cx, cy, WANT[want]); if (!o) { msg = 'Nothing there to select'; return; } id = o.id; }
    if (tool === 'len' && picks.length === 0 && isPoint(byId(id))) { picks.push(id); T.picks = ['any', 'point']; return; } // D.&Length between two points
    if (picks.includes(id) && want !== 'any') { msg = 'Pick a different one'; return; }
    picks.push(id);
    if (picks.length === T.picks.length) {
      if (tool === 'len' && picks.length === 2) add({ t: 'meas', kind: 'len', of: picks.slice() }); else T.make(picks.slice());
      T.picks = tool === 'len' ? ['any'] : T.picks; picks = [];
    }
  };
  const scr = {
    render() {
      const c = G.ctx, d = doc(); G.clear(); G.status('CabriJr  ' + TOOLS[tool].name + ':  ' + pickPrompt());
      c.save(); c.beginPath(); c.rect(0, SB, W, H - SB); c.clip();
      if (d.axes) { c.strokeStyle = '#9a9a9a'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, OY + .5); c.lineTo(W, OY + .5); c.moveTo(OX + .5, SB); c.lineTo(OX + .5, H); for (let k = -7; k <= 7; k++) { c.moveTo(OX + k * UNIT + .5, OY - 2); c.lineTo(OX + k * UNIT + .5, OY + 3); c.moveTo(OX - 2, OY + k * UNIT + .5); c.lineTo(OX + 3, OY + k * UNIT + .5); } c.stroke(); }
      const hl = !grab && tool !== 'point' ? nearest(cx, cy, tool === 'pointer' ? (o => o.t === 'pt') : WANT[(TOOLS[tool].picks || [])[picks.length]] || (() => false)) : null;
      d.objs.forEach(o => {
        c.strokeStyle = o === hl ? '#e0201b' : '#1b2a7a'; c.lineWidth = o === hl ? 2 : 1.4;
        if (o.t === 'seg' || o.t === 'tri') { const P = o.t === 'seg' ? [pt(o.a), pt(o.b)] : [pt(o.a), pt(o.b), pt(o.c)]; if (P.some(p => !p)) return; c.beginPath(); c.moveTo(...P[0]); P.slice(1).forEach(p => c.lineTo(...p)); if (o.t === 'tri') c.closePath(); c.stroke(); }
        else if (o.t === 'line' || o.t === 'perp' || o.t === 'par') { const L = line(o.id); if (!L || (!L.d[0] && !L.d[1])) return; const k = 2000 / Math.hypot(...L.d); c.beginPath(); c.moveTo(L.p[0] - L.d[0] * k, L.p[1] - L.d[1] * k); c.lineTo(L.p[0] + L.d[0] * k, L.p[1] + L.d[1] * k); c.stroke(); }
        else if (o.t === 'circ') { const ce = pt(o.c), p = pt(o.p); if (!ce || !p) return; c.beginPath(); c.arc(ce[0], ce[1], Math.hypot(p[0] - ce[0], p[1] - ce[1]), 0, 2 * Math.PI); c.stroke(); }
      });
      d.objs.forEach(o => { if (!isPoint(o)) return; const p = pt(o.id); if (!p) return; c.fillStyle = o === hl || o === grab || picks.includes(o.id) ? '#e0201b' : '#000'; c.fillRect(p[0] - 2, p[1] - 2, 4, 4); });
      c.font = '12px ' + App.MONO; c.textAlign = 'left'; c.fillStyle = '#119e3a';
      d.objs.forEach(o => { if (o.t !== 'meas') return; const [x, y] = measAnchor(o); c.fillStyle = o === hl ? '#e0201b' : '#119e3a'; c.fillText(measText(o), Math.min(W - 60, Math.max(2, x)), Math.min(H - 6, Math.max(SB + 8, y))); });
      // cursor: arrow for pointer (hand while dragging), crosshair for the other tools
      c.strokeStyle = '#000'; c.lineWidth = 1; c.beginPath();
      if (tool === 'pointer') { c.moveTo(cx, cy); c.lineTo(cx, cy + 11); c.lineTo(cx + 3, cy + 8); c.lineTo(cx + 7, cy + 12); c.moveTo(cx, cy); c.lineTo(cx + 8, cy + 8); c.lineTo(cx + 3, cy + 8); if (grab) { c.moveTo(cx - 4, cy - 4); c.lineTo(cx + 4, cy - 4); } }
      else { c.moveTo(cx - 5, cy + .5); c.lineTo(cx + 6, cy + .5); c.moveTo(cx + .5, cy - 5); c.lineTo(cx + .5, cy + 6); }
      c.stroke(); c.restore();
    },
    key(k) {
      const step = App.shift === '2nd' ? 10 : 3, mv = { '#up': [0, -step], '#down': [0, step], '#left': [-step, 0], '#right': [step, 0] }[k];
      if (mv) { cx = Math.max(2, Math.min(W - 2, cx + mv[0])); cy = Math.max(SB + 2, Math.min(H - 2, cy + mv[1])); if (grab) { grab.x = cx; grab.y = cy; } return true; }
      if (k === '#enter') { enterKey(); return true; }
      if (MENUS[k]) { MENUS[k](); return true; }
      if (k === '#clear') { TOOLS.len.picks = ['any']; if (picks.length || grab) { picks = []; grab = null; } else if (tool !== 'pointer') setTool('pointer'); return true; }
      if (k === '#del') { const o = nearest(cx, cy, () => true); if (o) remove(o.id); return true; }
      return App.isTok(k);
    }
  };
  return scr;
};
App.cabriMeasure = (o) => measText(o); // for tests
App.cabriDoc = doc;
})();
