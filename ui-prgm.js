/* ui-prgm.js — PRGM: program list (EXEC / EDIT / NEW), program editor, TI-BASIC interpreter and its run screen */
(function () {
'use strict';
const E = window.Engine, N = window.Numeric, App = window.App, G = App.G;
const { GRIDS, COL, SB } = App;
const S = () => E.getState();
const progs = () => S().programs || (S().programs = {});
const Menu = App.Menu;

/* ===================== COMMAND MENUS (PRGM key inside the editor) ===================== */
const NOT_YET = new Set(['OpenLib(', 'ExecLib', 'GetCalc(', 'Get(', 'Send(']);
const CTL = ['If ', 'Then', 'Else', 'For(', 'While ', 'Repeat ', 'End', 'Pause ', 'Lbl ', 'Goto ', 'IS>(', 'DS<(', 'Menu(', 'prgm', 'Return', 'Stop', 'DelVar ', 'GraphStyle(', 'GraphColor(', 'OpenLib(', 'ExecLib'];
const IO = ['Input ', 'Prompt ', 'Disp ', 'DispGraph', 'DispTable', 'Output(', 'getKey', 'ClrHome', 'ClrTable', 'GetCalc(', 'Get(', 'Send(', 'eval(', 'expr(', 'toString(', 'String▶Equ('];
const cmdItem = t => NOT_YET.has(t) ? { label: t, disabled: true } : { label: t, tok: t };
const nameToks = name => ['prgm'].concat([...name]);
const execItems = () => Object.keys(progs()).sort().map(n => ({ label: n, toks: nameToks(n) }));
function commandMenu(editor) {
  return new Menu([
    { name: 'CTL', items: CTL.map(cmdItem) },
    { name: 'I/O', items: IO.map(cmdItem) },
    { name: 'COLOR', items: App.COLORS.map(c => ({ label: c[0], tok: 'col.' + c[0] })) },
    { name: 'EXEC', items: execItems }
  ], editor, { back: editor });
}

/* ===================== PRGM KEY: EXEC / EDIT / NEW ===================== */
App.prgmScreen = function (prev) {
  if (prev && prev.isPrgmEditor) return commandMenu(prev);
  return new Menu([
    { name: 'EXEC', items: execItems },
    { name: 'EDIT', items: () => Object.keys(progs()).sort().map(n => ({ label: n, run: () => App.setScreen(editor(n)) })) },
    { name: 'NEW', items: [{ label: 'Create New', run: () => App.setScreen(newName()) }] }
  ], App.home, { status: 'TI-BASIC' });
};

/* "PROGRAM / Name=" prompt: letters (alpha-lock on), digits after the first letter, 8 characters at most */
function newName() {
  let name = '';
  return {
    enter() { App.shift = 'alpha'; App.alphaLock = true; },
    leave() { App.shift = null; App.alphaLock = false; },
    render() { G.clear(); G.status(''); const g = GRIDS.big; G.text(g, 0, 0, 'PROGRAM'); G.text(g, 0, 1, 'Name=' + name); G.cursor(g, 5 + name.length, 1, ''); },
    key(k) {
      if (/^[A-Zθ]$/.test(k) || (/^[0-9]$/.test(k) && name.length)) { if (name.length < 8) name += k; return true; }
      if (k === '#del' || k === '#bksp') { name = name.slice(0, -1); return true; }
      if (k === '#clear') { if (name) name = ''; else App.setScreen(App.home); return true; }
      // with alpha-lock on, ENTER arrives as SOLVE
      if (k === '#enter' || k === '#solve') { if (!name) return true; if (!progs()[name]) { progs()[name] = [[]]; App.save(); } App.setScreen(editor(name)); return true; }
      return k !== '#quit';
    }
  };
}

/* ===================== PROGRAM EDITOR ===================== */
function editor(name, line = 0) {
  const g = GRIDS.big, W = g.cols - 1;
  const ed = {
    isPrgmEditor: true, name, row: Math.min(line, progs()[name].length - 1), top: 0, ed: null,
    get lines() { return progs()[this.name]; },
    bind() { this.ed = new App.LineEditor(this.lines[this.row]); },
    commit() { this.lines[this.row] = this.ed.toks.slice(); App.save(); },
    rowsOf(i) { const t = i === this.row ? this.ed.text() : E.tokText(this.lines[i]); return Math.max(1, Math.ceil((App.cells(t).length + (i === this.row ? 1 : 0)) / W)); },
    render() {
      G.clear(); G.status('EDIT MENU: [alpha] [f5]'); G.text(g, 0, 0, 'PROGRAM:' + this.name);
      const avail = g.rows - 1;
      if (this.row < this.top) this.top = this.row;
      const used = () => { let h = 0; for (let i = this.top; i <= this.row; i++) h += this.rowsOf(i); return h; };
      while (used() > avail && this.top < this.row) this.top++;
      let r = 1;
      for (let i = this.top; i < this.lines.length && r <= avail; i++) {
        G.text(g, 0, r, ':');
        if (i === this.row) r += this.ed.render(g, 1, r, W, true, avail - r + 1);
        else { const ch = App.cells(E.tokText(this.lines[i])); const n = this.rowsOf(i); for (let k = 0; k < n && r <= avail; k++, r++) G.text(g, 1, r, ch.slice(k * W, (k + 1) * W).join('')); }
      }
    },
    key(k) {
      switch (k) {
        case '#up': if (this.row > 0) { this.commit(); this.row--; this.bind(); this.ed.cur = this.ed.toks.length; } return true;
        case '#down': if (this.row < this.lines.length - 1) { this.commit(); this.row++; this.bind(); this.ed.cur = 0; } return true;
        case '#enter': this.commit(); this.lines.splice(this.row + 1, 0, []); this.row++; this.bind(); App.save(); return true;
        case '#clear': this.lastCleared = this.ed.toks.slice(); this.ed.set([]); this.commit(); return true;
        case '#f5': this.commit(); App.setScreen(editMenu(this)); return true; // ALPHA GRAPH
        case '#mode': App.setScreen(settingMenu(this, 'mode')); return true; // MODE/FORMAT paste settings, like the CE editor
        case '#format': App.setScreen(settingMenu(this, 'fmt')); return true;
        case '#del': if (this.ed.empty && this.lines.length > 1) { this.lines.splice(this.row, 1); if (this.row >= this.lines.length) this.row--; this.bind(); this.ed.cur = 0; App.save(); return true; } break;
        case '#quit': this.commit(); return false;
      }
      if (App.isTok(k)) { this.ed.insert(k); this.commit(); return true; }
      if (this.ed.key(k)) { this.commit(); return true; }
      return false;
    },
    canInsert() { return true; },
    insert(t) { this.ed.insert(t); this.commit(); },
    insertMany(a) { a.forEach(t => this.ed.insert(t)); this.commit(); },
    leave() { this.commit(); }
  };
  ed.bind();
  return ed;
}
App.prgmEditor = editor;
/* ALPHA F5 in the editor */
let clip = null;
function editMenu(ed) {
  const back = () => { ed.bind(); App.setScreen(ed); }, L = ed.lines;
  const item = (label, f) => ({ label, run: () => { f(); App.save(); } });
  return new Menu([{ name: 'EDIT MENU', items: [
    item('Execute Program', () => { App.setScreen(App.home); try { App.runProgram(ed.name); } catch (e) { App.showError(e); } }),
    item('Undo Clear', () => { if (ed.lastCleared) L[ed.row] = ed.lastCleared.slice(); back(); }),
    item('Insert Line Above', () => { L.splice(ed.row, 0, []); back(); }),
    item('Cut Line', () => { clip = L[ed.row].slice(); if (L.length > 1) { L.splice(ed.row, 1); if (ed.row >= L.length) ed.row--; } else L[0] = []; back(); }),
    item('Copy Line', () => { clip = L[ed.row].slice(); back(); }),
    item('Paste Line Below', () => { if (clip) { L.splice(ed.row + 1, 0, clip.slice()); ed.row++; } back(); }),
    item('Insert Comment Above', () => { L.splice(ed.row, 0, ['"']); back(); }),
    item('Quit Editor', () => App.setScreen(App.home))
  ] }], ed, { title: 'EDIT MENU', back: ed });
}
/* MODE / FORMAT inside the editor paste the setting as a command */
function settingMenu(ed, grp) {
  const names = Object.keys(E.SETTING_CMDS).filter(n => (grp === 'fmt' ? ['fmt', 'tbl'] : ['mode']).includes(E.SETTING_CMDS[n][0]));
  const extra = grp === 'mode' ? ['Fix '] : ['BorderColor ', 'BackgroundOn ', 'BackgroundOff', 'RectGC', 'PolarGC'];
  return new Menu([{ name: grp === 'mode' ? 'MODE' : 'FORMAT', items: names.concat(extra).map(t => ({ label: t.trim(), tok: t })) }], ed, { title: grp === 'mode' ? 'MODE' : 'FORMAT', back: ed });
}

/* ===================== INTERPRETER ===================== */
/* split a program into statements: each line, and again at ':' outside strings */
function statements(name) {
  const lines = progs()[name]; if (!lines) N.fail('UNDEFINED');
  const out = [];
  lines.forEach((toks, line) => {
    let cur = [], str = false;
    toks.forEach(t => { if (t === '"') str = !str; if (t === ':' && !str) { out.push({ toks: cur, line }); cur = []; } else cur.push(t); });
    out.push({ toks: cur, line });
  });
  return out.filter(s => s.toks.length);
}
/* split the argument tokens of a command at top-level commas; drops a final ')' */
function splitArgs(toks) {
  const parts = [[]]; let depth = 0, str = false;
  toks.forEach(t => {
    if (t === '"') str = !str;
    if (!str) { if (t.endsWith('(') || t === '{' || t === '[') depth++; else if (t === ')' || t === '}' || t === ']') depth--; }
    if (t === ',' && depth === 0 && !str) parts.push([]); else parts[parts.length - 1].push(t);
  });
  const last = parts[parts.length - 1]; if (depth < 0 && last[last.length - 1] === ')') last.pop();
  return parts;
}
const OPENERS = new Set(['Then', 'For(', 'While ', 'Repeat ']);
const head = s => s.toks[0];
const evalToks = toks => E.ev(E.parseExpr(toks));
const evalNum = toks => { const v = evalToks(toks); if (typeof v !== 'number') N.fail('DATA TYPE'); return v; };
const textOf = toks => { const v = evalToks(toks); return typeof v === 'string' ? v : E.format(v)[0]; };
const labelOf = toks => toks.map(E.disp).join('');
/* TI key codes for getKey */
const KEYCODE = { yequ: 11, window: 12, zoom: 13, trace: 14, graph: 15, '2nd': 21, mode: 22, del: 23, left: 24, up: 25, right: 26, alpha: 31, xt: 32, stat: 33, down: 34,
  math: 41, apps: 42, prgm: 43, vars: 44, clear: 45, inv: 51, sin: 52, cos: 53, tan: 54, pow: 55, sq: 61, comma: 62, lpar: 63, rpar: 64, div: 65,
  log: 71, n7: 72, n8: 73, n9: 74, mul: 75, ln: 81, n4: 82, n5: 83, n6: 84, sub: 85, sto: 91, n1: 92, n2: 93, n3: 94, add: 95, n0: 102, dot: 103, neg: 104, enter: 105 };

class Runner {
  constructor(name, entryToks) {
    this.name = name; this.entryToks = entryToks;
    this.frames = [{ name, stmts: statements(name), pc: 0, ctl: [] }];
    this.screen = runScreen(this); this.wait = null; this.lastKey = 0; this.done = false;
  }
  get f() { return this.frames[this.frames.length - 1]; }
  start() { Runner.active = this; App.setScreen(this.screen); this.tick(); }
  /* run statements in slices so the screen updates and ON can break an endless loop */
  tick() {
    if (this.done || this.wait) return;
    try {
      for (let n = 0; n < 400 && !this.wait && !this.done; n++) this.step();
    } catch (err) { this.error(err); return; }
    App.render();
    if (!this.done && !this.wait) this.timer = setTimeout(() => this.tick(), 0);
  }
  step() {
    const f = this.f;
    if (f.pc >= f.stmts.length) { if (this.frames.length > 1) { this.frames.pop(); return; } this.finish(); return; }
    const s = f.stmts[f.pc]; this.cur = s;
    const h = head(s), rest = s.toks.slice(1);
    const findEnd = (from, wantElse) => {
      let depth = 0;
      for (let i = from; i < f.stmts.length; i++) {
        const t = head(f.stmts[i]);
        if (OPENERS.has(t)) depth++;
        else if (t === 'Else' && depth === 0 && wantElse) return i;
        else if (t === 'End') { if (depth === 0) return i; depth--; }
      }
      N.fail('SYNTAX');
    };
    switch (h) {
      case 'If ': {
        const v = evalNum(rest), next = f.stmts[f.pc + 1];
        if (next && head(next) === 'Then') {
          if (v) { f.ctl.push({ type: 'if' }); f.pc += 2; }
          else { const j = findEnd(f.pc + 2, true); if (head(f.stmts[j]) === 'Else') { f.ctl.push({ type: 'if' }); } f.pc = j + 1; }
        } else f.pc += v ? 1 : 2;
        return;
      }
      case 'Then': f.pc++; return;
      case 'Else': { f.ctl.pop(); f.pc = findEnd(f.pc + 1, false) + 1; return; }
      case 'For(': {
        const a = splitArgs(rest); if (a.length < 3) N.fail('ARGUMENT');
        const v = labelOf(a[0]), from = evalNum(a[1]), to = evalNum(a[2]), step = a[3] ? evalNum(a[3]) : 1;
        if (step === 0) N.fail('INCREMENT');
        E.store({ n: v }, from);
        if (step > 0 ? from > to : from < to) { f.pc = findEnd(f.pc + 1, false) + 1; return; }
        f.ctl.push({ type: 'for', v, to, step, body: f.pc + 1 }); f.pc++; return;
      }
      case 'While ': {
        if (evalNum(rest)) { f.ctl.push({ type: 'while', cond: rest, body: f.pc + 1 }); f.pc++; }
        else f.pc = findEnd(f.pc + 1, false) + 1;
        return;
      }
      case 'Repeat ': f.ctl.push({ type: 'repeat', cond: rest, body: f.pc + 1 }); f.pc++; return;
      case 'End': {
        const c = f.ctl[f.ctl.length - 1];
        if (!c) { f.pc++; return; }
        if (c.type === 'for') {
          const v = S().vars[c.v] + c.step; E.store({ n: c.v }, N.r14(v));
          if (c.step > 0 ? v <= c.to + 1e-12 : v >= c.to - 1e-12) { f.pc = c.body; return; }
        } else if (c.type === 'while') { if (evalNum(c.cond)) { f.pc = c.body; return; } }
        else if (c.type === 'repeat') { if (!evalNum(c.cond)) { f.pc = c.body; return; } }
        f.ctl.pop(); f.pc++; return;
      }
      case 'Lbl ': f.pc++; return;
      case 'Goto ': this.goto(labelOf(rest)); return;
      case 'IS>(': case 'DS<(': {
        const a = splitArgs(rest), v = labelOf(a[0]), lim = evalNum(a[1]);
        const nv = S().vars[v] + (h === 'IS>(' ? 1 : -1); E.store({ n: v }, nv);
        f.pc += (h === 'IS>(' ? nv > lim : nv < lim) ? 2 : 1; return;
      }
      case 'prgm': { const n = labelOf(rest); f.pc++; this.frames.push({ name: n, stmts: statements(n), pc: 0, ctl: [] }); if (this.frames.length > 40) N.fail('MEMORY'); return; }
      case 'Return': if (this.frames.length > 1) this.frames.pop(); else this.finish(); return;
      case 'Stop': this.finish(); return;
      case 'DelVar ': { const v = labelOf(rest); if (E.LISTS.includes(v)) S().lists[v] = []; else if (E.LETTERS.includes(v)) S().vars[v] = 0; f.pc++; return; }
      case 'ClrHome': this.screen.clear(); f.pc++; return;
      case 'ClrTable': f.pc++; return;
      case 'Disp ': {
        if (!rest.length) { App.setScreen(this.screen); f.pc++; return; }
        splitArgs(rest).forEach(a => { const v = evalToks(a); if (typeof v === 'string') this.screen.print(v, 'left'); else E.format(v).forEach(l => this.screen.print(l, 'right')); });
        App.setScreen(this.screen); f.pc++; return;
      }
      case 'Output(': {
        const a = splitArgs(rest); if (a.length < 3) N.fail('ARGUMENT');
        this.screen.put(Math.round(evalNum(a[0])), Math.round(evalNum(a[1])), textOf(a[2])); App.setScreen(this.screen); f.pc++; return;
      }
      case 'Pause ': {
        if (rest.length) { const v = evalToks(rest); if (typeof v === 'string') this.screen.print(v, 'left'); else E.format(v).forEach(l => this.screen.print(l, 'right')); }
        f.pc++; this.wait = { type: 'pause' }; return;
      }
      case 'Input ': case 'Prompt ': {
        const a = splitArgs(rest); const asks = [];
        if (h === 'Prompt ') a.forEach(v => asks.push({ prompt: labelOf(v) + '=?', v: labelOf(v) }));
        else if (a.length === 2) asks.push({ prompt: textOf(a[0]), v: labelOf(a[1]) });
        else if (a.length === 1 && a[0].length) asks.push({ prompt: '?', v: labelOf(a[0]) });
        else N.fail('SYNTAX');
        f.pc++; this.wait = { type: 'input', asks, k: 0 }; this.screen.ask(asks[0].prompt); return;
      }
      case 'Menu(': {
        const a = splitArgs(rest); if (a.length < 3 || a.length % 2 === 0) N.fail('ARGUMENT');
        const title = textOf(a[0]), opts = []; for (let i = 1; i < a.length; i += 2) opts.push({ label: textOf(a[i]), lbl: labelOf(a[i + 1]) });
        f.pc++; this.wait = { type: 'menu' };
        const m = new Menu([{ name: title, items: opts.map(o => ({ label: o.label, run: () => { App.setScreen(this.screen); this.wait = null; try { this.goto(o.lbl); } catch (e) { this.error(e); return; } this.tick(); } })) }], this.screen, { title });
        const mk = m.key.bind(m); m.key = k => k === '#clear' ? true : k === '#quit' ? (this.finish(), true) : mk(k); // a program menu stays until a choice is made
        App.setScreen(m);
        return;
      }
      case 'DispGraph': f.pc++; App.setScreen(App.graph); return;
      case 'DispTable': f.pc++; App.setScreen(App.table); return;
    }
    // anything else: an expression, a store (→) or a home-screen command
    const r = E.run(s.toks);
    if (r && r.action === 'clrhome') this.screen.clear();
    f.pc++;
    if (r && r.wait) { this.wait = { type: 'timer' }; this.waitTimer = setTimeout(() => { if (!this.done) this.resume(); }, r.wait * 1000); }
  }
  goto(lbl) {
    const f = this.f; const i = f.stmts.findIndex(s => head(s) === 'Lbl ' && labelOf(s.toks.slice(1)) === lbl);
    if (i < 0) N.fail('LABEL');
    f.pc = i + 1; f.ctl = [];
  }
  /* a key while the program runs: getKey, Pause/Input answers, ON to break */
  key(id) {
    if (id === 'on') { this.error(new N.CalcError('BREAK')); return true; }
    this.lastKey = KEYCODE[id] || 0;
    return false;
  }
  resume() { this.wait = null; App.setScreen(this.screen); this.tick(); }
  finish() {
    if (this.done) return; this.done = true; clearTimeout(this.timer); Runner.active = null;
    const st = S(), lines = this.screen.usedLines();
    const ent = { toks: this.entryToks, out: lines.concat([' '.repeat(GRIDS.big.cols - 4) + 'Done']), left: true };
    st.entries.push(ent); if (st.entries.length > 40) st.entries.splice(0, st.entries.length - 40); App.save();
    if (App.screen === this.screen || App.screen instanceof Menu) App.setScreen(App.home);
  }
  error(err) {
    this.done = true; clearTimeout(this.timer); Runner.active = null; App.save();
    const s = this.cur, prog = this.f.name;
    if (!(err && err.type)) console.error(err);
    App.showError(err && err.type ? err : new N.CalcError('SYNTAX'), { quit: () => App.setScreen(App.home), goto: s ? () => App.setScreen(editor(prog, s.line)) : null });
  }
}
Runner.active = null;
E.hooks.getKey = () => { const r = Runner.active; if (!r) return 0; const k = r.lastKey; r.lastKey = 0; return k; };

/* the program's text screen: 10 rows × 26 columns in the big font, like the home screen in Classic */
function runScreen(run) {
  const g = GRIDS.big, R = g.rows, C = g.cols;
  const blank = () => Array.from({ length: R }, () => ' '.repeat(C));
  let rows = blank(), line = 0, ed = null, prompt = '';
  const scroll = () => { rows.shift(); rows.push(' '.repeat(C)); line = R - 1; };
  return {
    clear() { rows = blank(); line = 0; },
    print(s, align) {
      const cs = App.cells(s);
      if (cs.length > C) { for (let i = 0; i < cs.length; i += C) this.print(cs.slice(i, i + C).join(''), 'left'); return; }
      if (line >= R) scroll();
      const text = align === 'right' ? ' '.repeat(C - cs.length) + s : s + ' '.repeat(C - cs.length);
      rows[line] = text; line++;
    },
    put(r, c, s) {
      if (r < 1 || r > R || c < 1 || c > C) N.fail('DOMAIN');
      let rr = r - 1, cc = c - 1;
      App.cells(s).forEach(ch => { if (rr >= R) return; const cs = App.cells(rows[rr]); cs[cc] = ch; rows[rr] = cs.join(''); cc++; if (cc >= C) { cc = 0; rr++; } });
    },
    ask(p) { prompt = p; ed = new App.LineEditor(); if (line >= R) scroll(); },
    usedLines() { let last = -1; rows.forEach((r, i) => { if (r.trim()) last = i; }); return rows.slice(0, last + 1).map(r => r.replace(/\s+$/, '')); },
    render() {
      G.clear(); G.status(run.wait ? (run.wait.type === 'pause' ? 'PAUSED — press ENTER' : '') : 'running…');
      rows.forEach((r, i) => G.text(g, 0, i, r));
      if (ed && run.wait && run.wait.type === 'input') {
        const t = App.cells(prompt + ed.text()); G.text(g, 0, line, t.slice(0, C).join('') + ' '.repeat(Math.max(0, C - t.length)));
        const cp = App.cells(prompt).length + ed.offsets()[ed.cur]; if (cp < C) G.cursor(g, cp, line, t[cp]);
      }
    },
    canInsert() { return !!(ed && run.wait && run.wait.type === 'input'); },
    insert(t) { if (this.canInsert()) ed.insert(t); },
    key(k) {
      const w = run.wait;
      if (k === '#quit' && !run.done) { run.finish(); return true; } // 2nd QUIT stops the program
      if (w && w.type === 'pause') { if (k === '#enter') run.resume(); return true; }
      if (w && w.type === 'input') {
        if (k === '#enter') {
          const a = w.asks[w.k];
          try { const v = E.STRS.includes(a.v) ? E.tokText(ed.toks) : ed.empty ? N.fail('SYNTAX') : evalToks(ed.toks); E.store({ n: a.v }, v); } // Input into Str1 keeps the typed text
          catch (err) { run.error(err); return true; }
          this.print(prompt + ed.text(), 'left'); ed = null;
          w.k++; if (w.k < w.asks.length) { this.ask(w.asks[w.k].prompt); return true; }
          run.resume(); return true;
        }
        if (k === '#clear') { ed.set([]); return true; }
        if (App.isTok(k)) { ed.insert(k); return true; }
        if (ed.key(k)) return true;
        return false;
      }
      if (run.done) { App.setScreen(App.home); return true; }
      return true; // keys are only read through getKey while running
    },
    blinks: true
  };
}

/* run a program by name; entryToks is what shows in the home-screen history (prgmNAME) */
App.runProgram = function (name, entryToks) {
  if (!progs()[name]) N.fail('UNDEFINED');
  new Runner(name, entryToks || nameToks(name)).start();
};
/* while a program runs, every physical key goes to it first (getKey, ON to break) */
const press = App.press;
App.press = function (id, fromLog) {
  const r = Runner.active;
  if (r && !r.wait && r.key(id)) return;
  if (r && r.wait && id === 'on') { r.key('on'); return; }
  press(id, fromLog);
};
App.Runner = Runner;
})();
