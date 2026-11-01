/* ui-extra.js — APPS: Conics, Inequalz (inequality graphing), Prob Sim, Transfrm (transformation graphing) */
(function () {
'use strict';
const E = window.Engine, N = window.Numeric, App = window.App, G = App.G;
const { GRIDS, COL, SB, W, H } = App;
const S = () => E.getState();
const f5 = v => E.fmtReal(N.r12(Number(v.toPrecision(10))));

/* ===================== APPS MENU ===================== */
/* Inequalz and Transfrm stay on until you pick Quit from their APPS item, like the CE */
function runningApp(key, name, title, lines, onStart) {
  return () => {
    const st = S();
    if (st[key]) { App.setScreen(new App.Menu([{ name, items: [{ label: 'Continue', run: () => onStart() }, { label: 'Quit ' + name, run: () => { st[key] = false; App.invalidateGraph(); App.save(); App.setScreen(App.home); } }] }], App.home, { title: name })); return; }
    st[key] = true; App.invalidateGraph(); App.save();
    App.setScreen(new App.TextScreen([title, ''].concat(lines, ['', 'Press [enter]']), { titleInv: true, back: { enter() { onStart(); }, render() { }, key() { return false; } } }));
  };
}
App.appsMenu = (target) => new App.Menu([{ name: 'APPLICATIONS', items: [
  { label: 'Finance…', run: () => App.setScreen(App.financeMenu(target)) },
  { label: 'CabriJr', run: () => App.setScreen(App.cabriJr()) },
  { label: 'CelSheet', run: () => App.setScreen(App.celSheet()) },
  { label: 'Conics', run: () => App.setScreen(conicsMenu()) },
  { label: 'EasyData', run: () => App.setScreen(easyData()) },
  { label: 'Inequalz', run: runningApp('appIneq', 'Inequalz', 'INEQUALITY GRAPHING', ['In Y=, move onto the =', 'and press [alpha] then', '[f1]–[f5] for = < ≤ > ≥.', 'X₁–X₄ below Y₀ make X=', 'lines. On the graph,', '[alpha][f1] SHADES.'], () => App.setScreen(App.yedit)) },
  { label: 'Periodic', run: () => App.setScreen(App.periodic()) },
  { label: 'PlySmlt2', run: () => App.setScreen(App.plysmlt()) },
  { label: 'Prob Sim', run: () => App.setScreen(probMenu()) },
  { label: 'SciTools', run: () => App.setScreen(App.sciTools()) },
  { label: 'Transfrm', run: runningApp('appTrans', 'Transfrm', 'TRANSFORMATION GRAPHING', ['Use A, B, C, D in Y=', '(example: Y₁=A(X−B)²+C).', 'On the graph: ▲▼ picks a', 'letter, ◀▶ changes it.', 'WINDOW: Step and > play.'], () => App.setScreen(App.yedit)) }
] }], target, { title: 'APPLICATIONS' });

/* ===================== EASYDATA ===================== */
/* EasyData collects data from a USB sensor. A computer has no calculator sensor port, so it shows what the CE shows with none plugged in. */
function easyData() {
  return new App.TextScreen(['EASYDATA', '', 'No sensor is connected.', '', 'EasyData reads data from', 'a sensor plugged into the', 'calculator. This app has', 'no sensor port, so it', 'cannot collect data.', '', '[clear] Quit'], { titleInv: true, back: App.home });
}

/* ===================== CONICS ===================== */
const GEN = (key, dflt) => ({ kind: 'gen', key, eq: 'AX²+BY²+CX+DY+E=0', p: ['A', 'B', 'C', 'D', 'E'], dflt });
const CONICS = {
  CIRCLE: [{ kind: 'circle', eq: '(X−H)²+(Y−K)²=R²', p: ['H', 'K', 'R'] }, { kind: 'gen', key: 'genC', circle: true, eq: 'AX²+AY²+BX+CY+D=0', p: ['A', 'B', 'C', 'D'], dflt: [1, 0, 0, -4] }],
  ELLIPSE: [{ kind: 'ellipse', eq: '(X−H)²/A²+(Y−K)²/B²=1', p: ['A', 'B', 'H', 'K'] }, GEN('genE', [1, 4, 0, 0, -4])],
  HYPERBOLA: [{ kind: 'hypX', eq: '(X−H)²/A²−(Y−K)²/B²=1', p: ['A', 'B', 'H', 'K'] }, { kind: 'hypY', eq: '(Y−K)²/A²−(X−H)²/B²=1', p: ['A', 'B', 'H', 'K'] }, GEN('genH', [1, -1, 0, 0, -1])],
  PARABOLA: [{ kind: 'parX', eq: '(X−H)²=4P(Y−K)', p: ['P', 'H', 'K'] }, { kind: 'parY', eq: '(Y−K)²=4P(X−H)', p: ['P', 'H', 'K'] }, GEN('genP', [1, 0, 0, -4, 0])]
};
/* general form AX²+BY²+CX+DY+E=0 → standard form, by completing the square. Returns [type name, standard form, its numbers] */
function fromGeneral(f, v) {
  const [A, B, C, D, E0] = f.circle ? [v.A, v.A, v.B, v.C, v.D] : [v.A, v.B, v.C, v.D, v.E];
  const F = CONICS, std = (name, i, o) => [name, F[name][i], o];
  if (A && B) {
    const h = -C / (2 * A), k = -D / (2 * B), R = C * C / (4 * A) + D * D / (4 * B) - E0; // A(X−H)²+B(Y−K)²=R
    if (A * B > 0) {
      if (!(R / A > 0)) N.fail('DOMAIN'); // no points, or a single point
      if (A === B) return std('CIRCLE', 0, { H: h, K: k, R: Math.sqrt(R / A) });
      return std('ELLIPSE', 0, { A: Math.sqrt(R / A), B: Math.sqrt(R / B), H: h, K: k });
    }
    if (R === 0) N.fail('DOMAIN'); // two crossing lines
    return R / A > 0 ? std('HYPERBOLA', 0, { A: Math.sqrt(R / A), B: Math.sqrt(-R / B), H: h, K: k }) : std('HYPERBOLA', 1, { A: Math.sqrt(R / B), B: Math.sqrt(-R / A), H: h, K: k });
  }
  if (A && D) { const h = -C / (2 * A); return std('PARABOLA', 0, { P: -D / (4 * A), H: h, K: (C * C / (4 * A) - E0) / D }); } // (X−H)²=4P(Y−K)
  if (B && C) { const k = -D / (2 * B); return std('PARABOLA', 1, { P: -C / (4 * B), H: (D * D / (4 * B) - E0) / C, K: k }); } // (Y−K)²=4P(X−H)
  N.fail('DOMAIN');
}
const conicVals = {};
function conicsMenu() {
  return new App.Menu([{ name: 'CONICS', items: Object.keys(CONICS).map(name => ({ label: name, run: () => {
    const forms = CONICS[name];
    if (forms.length === 1) App.setScreen(conicForm(name, forms[0]));
    else App.setScreen(new App.Menu([{ name, items: forms.map(f => ({ label: f.eq, run: () => App.setScreen(conicForm(name, f)) })) }], App.home, { title: name }));
  } })) }], App.home, { title: 'CONICS' });
}
function conicForm(name, f) {
  const key = f.key || f.kind, v = conicVals[key] || (conicVals[key] = Object.fromEntries(f.p.map((k, i) => [k, f.dflt ? f.dflt[i] : k === 'H' || k === 'K' ? 0 : 1])));
  const num = k => ({ kind: 'num', label: k + '=', get: () => v[k], set: x => { v[k] = x; } });
  const check = () => { if (f.kind === 'gen') return; f.p.forEach(k => { if ((k === 'R' || k === 'A' || k === 'B') && !(v[k] > 0)) N.fail('DOMAIN'); if (k === 'P' && v[k] === 0) N.fail('DOMAIN'); }); };
  const form = new App.Form({ title: name, titleCenter: true, fields: [{ kind: 'info', label: f.eq }].concat(f.p.map(num), [
    { kind: 'action', label: 'Graph', run: () => { try { check(); if (f.kind === 'gen') { const [, sf, sv] = fromGeneral(f, v); graph(sf, sv); } else graph(f, v); } catch (e) { App.showError(e, { quit: () => App.setScreen(form) }); } } },
    { kind: 'action', label: 'Solve', run: () => { try { check(); App.setScreen(new App.TextScreen(f.kind === 'gen' ? genSolve(f, v) : [name].concat(solve(f, v)), { titleInv: true, back: form })); } catch (e) { App.showError(e, { quit: () => App.setScreen(form) }); } } }
  ]) });
  form.fixIdx(); return form;
}
function graph(f, v) {
  const st = S(), d = { t: 'conic', kind: f.kind, h: v.H || 0, k: v.K || 0, r: v.R, a: v.A, b: v.B, p: v.P, color: '#1f4fff' };
  st.draw = st.draw.filter(x => x.t !== 'conic'); st.draw.push(d); App.invalidateGraph(); App.save(); App.graph.mode = 'idle'; App.setScreen(App.graph);
}
/* general form: the conic it turned out to be, its standard form numbers, then the usual answers */
function genSolve(f, v) {
  const [name, sf, sv] = fromGeneral(f, v);
  return [name, sf.eq].concat(sf.p.map(k => ' ' + k + '=' + f5(sv[k])), solve(sf, sv));
}
function solve(f, v) {
  const h = v.H || 0, k = v.K || 0, pt = (x, y) => '(' + f5(x) + ',' + f5(y) + ')';
  if (f.kind === 'circle') return ['Center=' + pt(h, k), 'Radius=' + f5(v.R), 'Area=' + f5(Math.PI * v.R * v.R)];
  if (f.kind === 'ellipse') {
    const { A: a, B: b } = v, c = Math.sqrt(Math.abs(a * a - b * b)), horiz = a >= b;
    const foci = horiz ? [pt(h - c, k), pt(h + c, k)] : [pt(h, k - c), pt(h, k + c)], vert = horiz ? [pt(h - a, k), pt(h + a, k)] : [pt(h, k - b), pt(h, k + b)];
    return ['Center=' + pt(h, k), 'Foci:', ' ' + foci[0], ' ' + foci[1], 'Vertices:', ' ' + vert[0], ' ' + vert[1], 'e=' + f5(c / Math.max(a, b))];
  }
  if (f.kind === 'hypX' || f.kind === 'hypY') {
    const { A: a, B: b } = v, c = Math.sqrt(a * a + b * b), X = f.kind === 'hypX';
    const foci = X ? [pt(h - c, k), pt(h + c, k)] : [pt(h, k - c), pt(h, k + c)], vert = X ? [pt(h - a, k), pt(h + a, k)] : [pt(h, k - a), pt(h, k + a)];
    const m = X ? b / a : a / b;
    return ['Center=' + pt(h, k), 'Foci:', ' ' + foci[0], ' ' + foci[1], 'Vertices:', ' ' + vert[0], ' ' + vert[1], 'e=' + f5(c / a), 'Slopes of', 'asymptotes=±' + f5(m)];
  }
  const p = v.P, X = f.kind === 'parX';
  return ['Vertex=' + pt(h, k), 'Focus=' + (X ? pt(h, k + p) : pt(h + p, k)), 'Directrix:', ' ' + (X ? 'Y=' + f5(k - p) : 'X=' + f5(h - p)), 'Axis:', ' ' + (X ? 'X=' + f5(h) : 'Y=' + f5(k))];
}

/* ===================== PROB SIM ===================== */
/* soft keys under the screen: [y=] [window] [zoom] [trace] [graph]. Pick Marbles and Draw Cards have SET (trace key) before the first trial. */
const MARBLE_COLORS = [['RED', '#e0201b'], ['BLUE', '#1f4fff'], ['GREEN', '#119e3a'], ['YELLOW', '#d6b400'], ['BLACK', '#111111']];
const marbles = { types: 3, counts: [5, 3, 2, 4, 1], replace: true };
const cards = { replace: false };
const SUITS = ['♠', '♥', '♦', '♣'], RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SIMS = [
  { name: 'Toss Coins', verb: 'TOSS', outs: ['H', 'T'], pick: () => Math.random() < .5 ? 0 : 1 },
  { name: 'Roll Dice', verb: 'ROLL', outs: ['1', '2', '3', '4', '5', '6'], pick: () => Math.floor(Math.random() * 6) },
  { name: 'Pick Marbles', verb: 'PICK', settings: () => marbleSet(), colors: () => MARBLE_COLORS.slice(0, marbles.types).map(c => c[1]),
    outs: () => MARBLE_COLORS.slice(0, marbles.types).map(c => c[0][0] + c[0].slice(1).toLowerCase()),
    start(t) { t.bag = marbles.counts.slice(0, marbles.types); },
    pick(t) { const n = t.bag.reduce((a, b) => a + b, 0); if (!n) return null; let r = Math.floor(Math.random() * n), i = 0; while (r >= t.bag[i]) r -= t.bag[i++]; if (!marbles.replace) t.bag[i]--; return i; },
    info: t => marbles.replace ? 'With replacement' : 'Left in bag: ' + t.bag.reduce((a, b) => a + b, 0) },
  { name: 'Spin Spinner', verb: 'SPIN', outs: ['1', '2', '3', '4'], pick: () => Math.floor(Math.random() * 4) },
  { name: 'Draw Cards', verb: 'DRAW', settings: () => cardSet(), outs: SUITS, colors: () => ['#111111', '#e0201b', '#e0201b', '#111111'],
    start(t) { t.deck = []; for (let i = 0; i < 52; i++) t.deck.push(i); },
    pick(t) { if (!t.deck.length) return null; const j = Math.floor(Math.random() * t.deck.length), c = t.deck[j]; if (!cards.replace) t.deck.splice(j, 1); t.card = RANKS[c % 13] + SUITS[Math.floor(c / 13)]; return Math.floor(c / 13); },
    info: t => (t.card ? 'Card: ' + t.card + '   ' : '') + (cards.replace ? '' : 'Left: ' + t.deck.length) },
  { name: 'Random Numbers', verb: 'DRAW', outs: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'], pick: () => Math.floor(Math.random() * 10) }
];
function probMenu() { return new App.Menu([{ name: 'PROB SIM', items: SIMS.map(s => ({ label: s.name, run: () => App.setScreen(simScreen(s)) })) }], App.home, { title: 'PROBABILITY SIMULATION' }); }
function marbleSet() {
  const f = new App.Form({ title: 'PICK MARBLES SET', titleCenter: true, indent: true, fields: [
    { kind: 'choice', label: 'Types: ', opts: [2, 3, 4, 5], get: () => marbles.types, set: v => { marbles.types = v; } },
    ...MARBLE_COLORS.map((c, i) => ({ kind: 'num', label: c[0][0] + c[0].slice(1).toLowerCase() + '=', hidden: () => i >= marbles.types, get: () => marbles.counts[i],
      set: v => { if (!Number.isInteger(v) || v < 0 || v > 99) N.fail('DOMAIN'); marbles.counts[i] = v; } })),
    { kind: 'choice', label: 'Replace: ', opts: ['Yes', 'No'], get: () => marbles.replace ? 'Yes' : 'No', set: v => { marbles.replace = v === 'Yes'; } },
    { kind: 'action', label: 'OK', run: () => { if (!marbles.counts.slice(0, marbles.types).some(n => n > 0)) N.fail('DOMAIN'); App.setScreen(simScreen(SIMS[2])); } }] });
  return f;
}
function cardSet() {
  return new App.Form({ title: 'DRAW CARDS SET', titleCenter: true, indent: true, fields: [
    { kind: 'info', label: 'One 52-card deck' },
    { kind: 'choice', label: 'Replace: ', opts: ['Yes', 'No'], get: () => cards.replace ? 'Yes' : 'No', set: v => { cards.replace = v === 'Yes'; } },
    { kind: 'action', label: 'OK', run: () => App.setScreen(simScreen(SIMS[4])) }] });
}
function simScreen(sim) {
  const outs = typeof sim.outs === 'function' ? sim.outs() : sim.outs, colors = sim.colors ? sim.colors() : null;
  const counts = outs.map(() => 0), t = {}; let last = null, total = 0, empty = false;
  if (sim.start) sim.start(t);
  const run = n => { for (let i = 0; i < n; i++) { const p = sim.pick(t); if (p === null) { empty = true; return; } last = p; counts[last]++; total++; } };
  return {
    render() {
      G.clear(); G.status(empty ? (sim.name === 'Draw Cards' ? 'NO CARDS LEFT  [del] starts over' : 'BAG IS EMPTY  [del] starts over') : sim.name.toUpperCase());
      const c = G.ctx, x0 = 30, y0 = SB + 12, gw = 270, gh = 124, bw = gw / counts.length, max = Math.max(1, ...counts);
      c.strokeStyle = '#000'; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0, y0 + gh); c.lineTo(x0 + gw, y0 + gh); c.stroke();
      c.font = '11px ' + App.MONO; c.textAlign = 'center';
      counts.forEach((n, i) => {
        const h = gh * n / max, x = x0 + i * bw;
        c.fillStyle = colors ? colors[i] : i === last ? '#e0201b' : '#1f4fff'; c.fillRect(x + 3, y0 + gh - h, bw - 6, h);
        if (colors && i === last) { c.strokeStyle = '#000'; c.lineWidth = 2; c.strokeRect(x + 2, y0 + gh - h - 1, bw - 4, h + 1); }
        c.fillStyle = '#000'; c.fillText(outs[i], x + bw / 2, y0 + gh + 9); if (total) c.fillText(n ? String(n) : '', x + bw / 2, Math.max(y0 + 6, y0 + gh - h - 7));
      });
      c.textAlign = 'left'; c.font = '13px ' + App.MONO;
      c.fillText('Trials: ' + total + (last !== null ? '   Last: ' + outs[last] : ''), 6, y0 + gh + 24);
      if (total) c.fillText('P(' + outs[last] + ')≈' + E.fmtReal(counts[last] / total, { sig: 4 }), 200, y0 + gh + 24);
      if (sim.info) c.fillText(sim.info(t), 6, y0 + gh + 40);
      const soft = !total && sim.settings ? [sim.verb, '', '', 'SET', 'ESC'] : [sim.verb, '+1', '+10', '+50', 'ESC'];
      const sw = W / 5; c.font = '12px ' + App.MONO; c.textAlign = 'center';
      soft.forEach((s, i) => { if (!s) return; c.fillStyle = COL.bar; c.fillRect(i * sw + 2, H - 18, sw - 4, 16); c.fillStyle = COL.barText; c.fillText(s, i * sw + sw / 2, H - 9); });
    },
    key(k) {
      if (!total && sim.settings && (k === '#trace' || k === '#window' || k === '#zoom')) { if (k === '#trace') App.setScreen(sim.settings()); return true; }
      const n = { '#yequ': 1, '#window': 1, '#zoom': 10, '#trace': 50, '#enter': 1 }[k];
      if (n) { run(n); return true; }
      if (k === '#graph' || k === '#clear') { App.setScreen(probMenu()); return true; }
      if (k === '#del') { counts.fill(0); total = 0; last = null; empty = false; Object.keys(t).forEach(x => delete t[x]); if (sim.start) sim.start(t); return true; }
      return App.isTok(k);
    }
  };
}
})();
