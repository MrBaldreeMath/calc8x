/* ui-main.js — key map, global navigation, keypad, PC keyboard, key-press history, startup */
(function () {
'use strict';
const E = window.Engine, App = window.App;

/* physical key -> { m: main, s: 2nd, a: alpha } ; '#…' = action, otherwise a token */
App.KEYS = {
  yequ: { m: '#yequ', s: '#statplot', a: '#f1' }, window: { m: '#window', s: '#tblset', a: '#f2' }, zoom: { m: '#zoom', s: '#format', a: '#f3' }, trace: { m: '#trace', s: '#calc', a: '#f4' }, graph: { m: '#graph', s: '#table', a: '#f5' },
  mode: { m: '#mode', s: '#quit' }, del: { m: '#del', s: '#ins' },
  xt: { m: 'X', s: null }, stat: { m: '#stat', s: '#list' },
  math: { m: '#math', s: '#test', a: 'A' }, apps: { m: '#apps', s: '#angle', a: 'B' }, prgm: { m: '#prgm', s: '#draw', a: 'C' }, vars: { m: '#vars', s: '#distr', a: null }, clear: { m: '#clear', s: '#clear' },
  inv: { m: '⁻¹', s: '#matrix', a: 'D' }, sin: { m: 'sin(', s: 'sin⁻¹(', a: 'E' }, cos: { m: 'cos(', s: 'cos⁻¹(', a: 'F' }, tan: { m: 'tan(', s: 'tan⁻¹(', a: 'G' }, pow: { m: '^', s: 'π', a: 'H' },
  sq: { m: '²', s: '√(', a: 'I' }, comma: { m: ',', s: 'ᴇ', a: 'J' }, lpar: { m: '(', s: '{', a: 'K' }, rpar: { m: ')', s: '}', a: 'L' }, div: { m: '/', s: 'e', a: 'M' },
  log: { m: 'log(', s: '10^(', a: 'N' }, n7: { m: '7', s: 'u', a: 'O' }, n8: { m: '8', s: 'v', a: 'P' }, n9: { m: '9', s: 'w', a: 'Q' }, mul: { m: '*', s: '[', a: 'R' },
  ln: { m: 'ln(', s: 'e^(', a: 'S' }, n4: { m: '4', s: 'L₄', a: 'T' }, n5: { m: '5', s: 'L₅', a: 'U' }, n6: { m: '6', s: 'L₆', a: 'V' }, sub: { m: '-', s: ']', a: 'W' },
  sto: { m: '→', s: '#rcl', a: 'X' }, n1: { m: '1', s: 'L₁', a: 'Y' }, n2: { m: '2', s: 'L₂', a: 'Z' }, n3: { m: '3', s: 'L₃', a: 'θ' }, add: { m: '+', s: '#mem', a: '"' },
  on: { m: '#on', s: '#off' }, n0: { m: '0', s: '#catalog', a: ' ' }, dot: { m: '.', s: 'i', a: ':' }, neg: { m: '⁻', s: 'Ans', a: '?' }, enter: { m: '#enter', s: '#entry', a: '#solve' },
  up: { m: '#up', s: null, a: '#pgup' }, down: { m: '#down', s: null, a: '#pgdn' }, left: { m: '#left', s: '#home', a: '#left' }, right: { m: '#right', s: '#end', a: '#right' }
};
/* labels for the keypad: [main, 2nd, alpha, style] */
const LBL = {
  yequ: ['y=', 'stat plot', 'f1', 'fn'], window: ['window', 'tblset', 'f2', 'fn'], zoom: ['zoom', 'format', 'f3', 'fn'], trace: ['trace', 'calc', 'f4', 'fn'], graph: ['graph', 'table', 'f5', 'fn'],
  '2nd': ['2nd', '', '', 'second'], mode: ['mode', 'quit', '', 'dark'], del: ['del', 'ins', '', 'dark'],
  alpha: ['alpha', 'A-lock', '', 'alpha'], xt: ['X,T,θ,n', 'link', '', 'dark'], stat: ['stat', 'list', '', 'dark'],
  math: ['math', 'test', 'A', 'dark'], apps: ['apps', 'angle', 'B', 'dark'], prgm: ['prgm', 'draw', 'C', 'dark'], vars: ['vars', 'distr', '', 'dark'], clear: ['clear', '', '', 'dark'],
  inv: ['x⁻¹', 'matrix', 'D', 'dark'], sin: ['sin', 'sin⁻¹', 'E', 'dark'], cos: ['cos', 'cos⁻¹', 'F', 'dark'], tan: ['tan', 'tan⁻¹', 'G', 'dark'], pow: ['^', 'π', 'H', 'dark'],
  sq: ['x²', '√', 'I', 'dark'], comma: [',', 'EE', 'J', 'dark'], lpar: ['(', '{', 'K', 'dark'], rpar: [')', '}', 'L', 'dark'], div: ['÷', 'e', 'M', 'op'],
  log: ['log', '10ˣ', 'N', 'dark'], n7: ['7', 'u', 'O', 'num'], n8: ['8', 'v', 'P', 'num'], n9: ['9', 'w', 'Q', 'num'], mul: ['×', '[', 'R', 'op'],
  ln: ['ln', 'eˣ', 'S', 'dark'], n4: ['4', 'L4', 'T', 'num'], n5: ['5', 'L5', 'U', 'num'], n6: ['6', 'L6', 'V', 'num'], sub: ['−', ']', 'W', 'op'],
  sto: ['sto→', 'rcl', 'X', 'dark'], n1: ['1', 'L1', 'Y', 'num'], n2: ['2', 'L2', 'Z', 'num'], n3: ['3', 'L3', 'θ', 'num'], add: ['+', 'mem', '"', 'op'],
  on: ['on', 'off', '', 'dark'], n0: ['0', 'catalog', '␣', 'num'], dot: ['.', 'i', ':', 'num'], neg: ['(−)', 'ans', '?', 'num'], enter: ['enter', 'entry', 'solve', 'op']
};
const LAYOUT = [
  ['yequ', 'window', 'zoom', 'trace', 'graph'],
  ['2nd', 'mode', 'del', 'DPAD'],
  ['alpha', 'xt', 'stat'],
  ['math', 'apps', 'prgm', 'vars', 'clear'],
  ['inv', 'sin', 'cos', 'tan', 'pow'],
  ['sq', 'comma', 'lpar', 'rpar', 'div'],
  ['log', 'n7', 'n8', 'n9', 'mul'],
  ['ln', 'n4', 'n5', 'n6', 'sub'],
  ['sto', 'n1', 'n2', 'n3', 'add'],
  ['on', 'n0', 'dot', 'neg', 'enter']
];

/* ===================== GLOBAL NAVIGATION ===================== */
function editable(sc) { if (!sc || !sc.insert) return false; if (sc.canInsert) return sc.canInsert(); return true; }
App.graph.canInsert = function () { return !!this.entry; };
App.table.canInsert = function () { return !!this.entry; };
App.yedit.canInsert = function () { return this.row >= 0; };
App.Form.prototype.canInsert = function () { return !!this.ed; };
App.global = function (k) {
  const prev = App.screen; const target = editable(prev) ? prev : App.home;
  const open = (m) => { if (m && m instanceof App.Menu && !m.back) m.back = (prev instanceof App.Menu ? prev.back : prev) || App.home; App.setScreen(m); return true; };
  switch (k) {
    case '#mode': return open(App.modeScreen());
    case '#quit': App.setScreen(App.home); return true;
    case '#yequ': App.setScreen(App.yedit); return true;
    case '#window': return open(App.windowScreen());
    case '#zoom': return open(App.zoomMenu());
    case '#trace': if (prev !== App.graph) { App.graph.mode = 'idle'; App.setScreen(App.graph); } if (App.screen === App.graph) App.graph.startTrace(); return true;
    case '#graph': App.graph.mode = 'idle'; App.graph.note = App.screen === App.graph ? App.graph.note : null; App.setScreen(App.graph); return true;
    case '#statplot': return open(App.statPlotMenu());
    case '#tblset': return open(App.tblsetScreen());
    case '#format': return open(App.formatScreen());
    case '#calc': return open(App.calcMenu());
    case '#table': App.setScreen(App.table); return true;
    case '#stat': return open(App.statMenu(target));
    case '#list': return open(App.listMenu(target));
    case '#math': return open(App.mathMenu(target));
    case '#test': return open(App.testMenu(target));
    case '#apps': return open(App.appsMenu(target));
    case '#angle': return open(App.angleMenu(target));
    case '#prgm': return open(App.prgmScreen(prev));
    case '#draw': return open(App.drawMenu(target));
    case '#vars': return open(App.varsMenu(target));
    case '#distr': return open(App.distrMenu(target));
    case '#matrix': return open(App.matrixMenu(target));
    case '#mem': return open(App.memMenu());
    case '#catalog': return open(App.catalog(target));
    case '#f1': return open(App.popupMenu(0, target));
    case '#f2': return open(App.popupMenu(1, target));
    case '#f3': return open(App.popupMenu(2, target));
    case '#f4': return open(App.popupMenu(3, target));
    case '#f5': return true;
    case '#rcl': return open(App.rclScreen(target));
    case '#off': App.off = true; return true;
    case '#on': case '#clear': case '#enter': case '#entry': case '#solve': case '#ins': case '#del': case '#bksp':
    case '#up': case '#down': case '#left': case '#right': case '#home': case '#end': case '#pgup': case '#pgdn': return true;
  }
  return false;
};

/* ===================== KEYPAD DOM ===================== */
/* press on touch-down (finger, pen or mouse); arrows and DEL repeat while held, like the handheld */
const REPEATS = new Set(['up', 'down', 'left', 'right', 'del']);
function bindKey(b, id) {
  let timer = null;
  const stop = () => { b.classList.remove('pressed'); clearTimeout(timer); clearInterval(timer); timer = null; };
  b.addEventListener('pointerdown', e => {
    e.preventDefault(); b.classList.add('pressed'); App.press(id);
    if (REPEATS.has(id)) timer = setTimeout(() => { timer = setInterval(() => App.press(id), 90); }, 450);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, stop));
  b.addEventListener('contextmenu', e => e.preventDefault()); // no long-press menu on touch screens
}
function keyEl(id) {
  const [main, s, a, style] = LBL[id];
  const wrap = document.createElement('div'); wrap.className = 'kw';
  const top = document.createElement('div'); top.className = 'klabels';
  top.innerHTML = '<span class="l2">' + s + '</span><span class="la">' + a + '</span>';
  const b = document.createElement('button'); b.className = 'key ' + style; b.dataset.id = id; b.textContent = main; b.title = main + (s ? '  |  2nd: ' + s : '') + (a ? '  |  alpha: ' + a : '');
  bindKey(b, id);
  wrap.appendChild(top); wrap.appendChild(b); return wrap;
}
function dpad() {
  const d = document.createElement('div'); d.className = 'dpad';
  [['up', '▲'], ['left', '◀'], ['right', '▶'], ['down', '▼']].forEach(([id, ch]) => {
    const b = document.createElement('button'); b.className = 'dk d-' + id; b.textContent = ch; b.dataset.id = id; b.title = id;
    bindKey(b, id);
    d.appendChild(b);
  });
  return d;
}
function buildKeypad(root) {
  LAYOUT.forEach((row, ri) => {
    row.forEach(id => {
      if (id === 'DPAD') { const d = dpad(); d.style.gridColumn = '4 / span 2'; d.style.gridRow = (ri + 1) + ' / span 2'; root.appendChild(d); return; }
      const el = keyEl(id); el.style.gridRow = String(ri + 1); el.style.gridColumn = String(row.indexOf(id) + 1); root.appendChild(el);
    });
  });
}
function syncShiftUI() {
  document.body.classList.toggle('shift-2nd', App.shift === '2nd');
  document.body.classList.toggle('shift-alpha', App.shift === 'alpha');
}

/* ===================== KEY HISTORY ===================== */
function renderHistory() {
  const box = document.getElementById('history'); if (!box) return;
  box.innerHTML = '';
  App.keyLog.forEach(k => {
    const chip = document.createElement('div'); chip.className = 'chip';
    const L = LBL[k.id]; const isPad = !L;
    let top = '', cls = '';
    if (L && k.shift === '2nd' && L[1]) { top = L[1]; cls = 't2'; } else if (L && k.shift === 'alpha' && L[2]) { top = L[2]; cls = 'ta'; }
    const main = isPad ? { up: '▲', down: '▼', left: '◀', right: '▶' }[k.id] : L[0];
    const style = isPad ? 'pad' : L[3];
    chip.innerHTML = '<div class="ct ' + cls + '">' + (top || '&nbsp;') + '</div><div class="cb ' + style + '">' + main + '</div>';
    box.appendChild(chip);
  });
  box.scrollTop = box.scrollHeight;
}

/* ===================== PC KEYBOARD ===================== */
const ALPHA_KEY = {}; Object.entries(App.KEYS).forEach(([id, d]) => { if (d.a && /^[A-Zθ]$/.test(d.a)) ALPHA_KEY[d.a] = id; });
/* Shift pressed and let go by itself = 2nd; Alt by itself = ALPHA (Shift+letter still types the letter) */
let modAlone = null;
function onKeyUp(e) {
  if ((e.key === 'Shift' || e.key === 'Alt') && modAlone === e.key) { e.preventDefault(); App.press(e.key === 'Shift' ? '2nd' : 'alpha'); }
  modAlone = null;
}
function onKeyDown(e) {
  if (e.ctrlKey || e.metaKey) return;
  const map = { '0': 'n0', '1': 'n1', '2': 'n2', '3': 'n3', '4': 'n4', '5': 'n5', '6': 'n6', '7': 'n7', '8': 'n8', '9': 'n9', '.': 'dot', '+': 'add', '-': 'sub', '*': 'mul', '/': 'div', '^': 'pow', '(': 'lpar', ')': 'rpar', ',': 'comma',
    Enter: 'enter', Delete: 'del', Escape: 'clear', ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    F1: 'yequ', F2: 'window', F3: 'zoom', F4: 'trace', F5: 'graph', Insert: 'sto', PageUp: 'vars', PageDown: 'prgm', Home: 'apps', End: 'stat', _: 'neg' };
  if (e.key === 'Shift' || e.key === 'Alt') { modAlone = e.key; if (e.key === 'Alt') e.preventDefault(); return; }
  modAlone = null;
  let id = map[e.key];
  if (id) { e.preventDefault(); if (App.shift === 'alpha' && !App.alphaLock && /^n[0-9]$|^dot$|^add$|^sub$|^mul$|^div$|^pow$|^lpar$|^rpar$|^comma$/.test(id)) { App.shift = null; } App.press(id); return; }
  if (e.key === 'Backspace') { e.preventDefault(); App.logKey('del'); App.dispatch('#bksp'); return; }
  if (/^[a-zA-Z]$/.test(e.key)) {
    e.preventDefault(); const L = e.key.toUpperCase();
    if (L === 'X' && e.key === 'x') { App.press('xt'); return; }
    const kid = ALPHA_KEY[L]; if (kid) { if (App.shift !== 'alpha') App.press('alpha'); App.press(kid); }
    return;
  }
  const tokMap = { '!': '!', '=': '=', '<': '<', '>': '>', '{': '{', '}': '}', '[': '[', ']': ']', ':': ':' };
  if (tokMap[e.key]) { e.preventDefault(); App.dispatch(tokMap[e.key]); }
}

/* ===================== SAVING FILES ===================== */
/* phones: the Share sheet (Save Image, Save to Files); PC: a normal download */
function saveFile(name, blob) {
  const file = typeof File === 'function' ? new File([blob], name, { type: blob.type }) : null;
  if (file && matchMedia('(pointer: coarse)').matches && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file] }).catch(() => { }); return;
  }
  const a = document.createElement('a'); a.download = name; a.href = URL.createObjectURL(blob); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ===================== PROGRAM FILES (.8xp) ===================== */
function programPanel() {
  const panel = document.getElementById('progPanel'), list = document.getElementById('progList'), msg = document.getElementById('progMsg');
  const fill = () => {
    const progs = E.getState().programs || {}; list.innerHTML = '';
    const names = Object.keys(progs).sort();
    if (!names.length) { list.innerHTML = '<p class="panelnote">No programs yet. Make one with PRGM ▸ NEW, or load a file.</p>'; return; }
    names.forEach(n => {
      const row = document.createElement('div'); row.className = 'panelrow';
      const lab = document.createElement('span'); lab.textContent = n + '  (' + progs[n].length + ' lines)';
      const b = document.createElement('button'); b.textContent = 'Save .8xp';
      b.addEventListener('click', () => {
        saveFile(n + '.8xp', new Blob([window.TIFile.write(n, progs[n])], { type: 'application/octet-stream' }));
      });
      row.appendChild(lab); row.appendChild(b); list.appendChild(row);
    });
  };
  document.getElementById('progs').addEventListener('click', () => { msg.textContent = ''; fill(); panel.hidden = false; });
  document.getElementById('progClose').addEventListener('click', () => { panel.hidden = true; });
  const file = document.getElementById('progFile');
  document.getElementById('progLoad').addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const notes = [];
    for (const f of file.files) {
      try {
        const p = window.TIFile.read(await f.arrayBuffer()); const st = E.getState(); (st.programs || (st.programs = {}))[p.name] = p.lines;
        notes.push('Loaded ' + p.name + (p.unknown ? ' (' + p.unknown + ' command' + (p.unknown > 1 ? 's' : '') + ' this app does not know, shown as ?)' : ''));
      } catch (e) { notes.push(f.name + ': ' + e.message); }
    }
    App.save(); file.value = ''; msg.textContent = notes.join('. '); fill();
  });
  // pictures: shrunk to the graph area (265×165) and kept as JPEG data so they fit in saved state
  const img = document.getElementById('imgFile'), slot = document.getElementById('imgSlot'), imsg = document.getElementById('imgMsg');
  const showImgs = () => { const have = Object.keys(E.getState().images || {}); imsg.textContent = have.length ? 'Loaded: ' + have.map(d => 'Image' + d).join(', ') : 'No pictures loaded.'; };
  document.getElementById('progs').addEventListener('click', showImgs);
  document.getElementById('imgLoad').addEventListener('click', () => img.click());
  document.getElementById('imgClear').addEventListener('click', () => { const st = E.getState(), d = +slot.value; if (st.images) delete st.images[d]; if (st.fmt.bgImage === d) st.fmt.bgImage = null; App.invalidateGraph(); App.save(); showImgs(); });
  img.addEventListener('change', () => {
    const f = img.files[0]; if (!f) return; const url = URL.createObjectURL(f), pic = new Image();
    pic.onload = () => {
      const cv = document.createElement('canvas'); cv.width = 265; cv.height = 165; cv.getContext('2d').drawImage(pic, 0, 0, 265, 165); URL.revokeObjectURL(url);
      const st = E.getState(); (st.images || (st.images = {}))[+slot.value] = cv.toDataURL('image/jpeg', 0.85); App.invalidateGraph(); App.save(); img.value = ''; showImgs();
    };
    pic.onerror = () => { imsg.textContent = f.name + ': not a picture this app can read.'; img.value = ''; };
    pic.src = url;
  });
}

/* ===================== SPLITTER (keypad | screen) ===================== */
function splitter() {
  const bar = document.getElementById('splitter'), main = document.querySelector('main'), root = document.documentElement;
  const setW = w => { const r = main.getBoundingClientRect(); w = Math.round(Math.max(260, Math.min(w, r.width - 32 - 18 - 300))); root.style.setProperty('--calcW', w + 'px'); return w; };
  let saved = null; try { saved = Number(localStorage.getItem('cgc-calcW')) || null; } catch (e) { }
  if (saved) setW(saved);
  let dragging = false;
  bar.addEventListener('pointerdown', e => { dragging = true; bar.classList.add('drag'); bar.setPointerCapture(e.pointerId); e.preventDefault(); });
  bar.addEventListener('pointermove', e => { if (!dragging) return; const r = main.getBoundingClientRect(); setW(e.clientX - r.left - 16 - 9); });
  const end = () => { if (!dragging) return; dragging = false; bar.classList.remove('drag'); try { localStorage.setItem('cgc-calcW', parseInt(getComputedStyle(root).getPropertyValue('--calcW')) || 380); } catch (e) { } };
  bar.addEventListener('pointerup', end); bar.addEventListener('pointercancel', end);
  bar.addEventListener('dblclick', () => { root.style.removeProperty('--calcW'); try { localStorage.removeItem('cgc-calcW'); } catch (e) { } });
  window.addEventListener('resize', () => { const v = parseInt(getComputedStyle(root).getPropertyValue('--calcW')); if (v) setW(v); });
}

/* ===================== STARTUP ===================== */
window.addEventListener('DOMContentLoaded', () => {
  App.load();
  App.G.init(document.getElementById('screen'));
  buildKeypad(document.getElementById('keypad'));
  App.onKeyLog = renderHistory;
  App.listeners.push(syncShiftUI);
  App.setScreen(App.home);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  programPanel();
  splitter();
  document.getElementById('clearHist').addEventListener('click', () => { App.keyLog = []; renderHistory(); });
  // minimize the key history to its title bar so the screen can use the room (remembered for next time)
  const histMin = document.getElementById('histMin'), setMin = on => { document.body.classList.toggle('histmin', on); histMin.textContent = on ? 'Expand' : 'Minimize'; histMin.title = on ? 'Show the key history again' : 'Minimize the key history so the screen can grow'; };
  try { setMin(localStorage.getItem('cgc-histmin') === '1'); } catch (e) { }
  histMin.addEventListener('click', () => { const on = !document.body.classList.contains('histmin'); setMin(on); try { localStorage.setItem('cgc-histmin', on ? '1' : '0'); } catch (e) { } });
  document.getElementById('shot').addEventListener('click', () => { document.getElementById('screen').toBlob(b => saveFile('calculator-screen.png', b), 'image/png'); });
  document.getElementById('projector').addEventListener('click', () => { document.body.classList.toggle('projector'); });
  document.getElementById('histToggle').addEventListener('click', () => { document.body.classList.toggle('nohist'); });
  window.addEventListener('beforeunload', () => { try { App.save(); } catch (e) { } });
  // phones close web apps without beforeunload: save whenever the app goes to the background
  document.addEventListener('visibilitychange', () => { if (document.hidden) try { App.save(); } catch (e) { } });
  // phone/web version: keep working offline (the PC app loads from a file and does not need this)
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => { });
});
})();
