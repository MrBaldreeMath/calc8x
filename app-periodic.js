/* app-periodic.js — APPS ▸ Periodic: the periodic table; arrows move, ENTER shows an element's facts */
(function () {
'use strict';
const App = window.App, G = App.G, { GRIDS, COL, SB, W, H } = App;
// symbol,name,atomic mass,category  (am alkali metal, ae alkaline earth, tm transition, pt post-transition, ml metalloid,
// nm other nonmetal, ha halogen, ng noble gas, la lanthanide, ac actinide)
const DATA = ('H,Hydrogen,1.008,nm;He,Helium,4.0026,ng;Li,Lithium,6.94,am;Be,Beryllium,9.0122,ae;B,Boron,10.81,ml;C,Carbon,12.011,nm;N,Nitrogen,14.007,nm;O,Oxygen,15.999,nm;' +
  'F,Fluorine,18.998,ha;Ne,Neon,20.180,ng;Na,Sodium,22.990,am;Mg,Magnesium,24.305,ae;Al,Aluminum,26.982,pt;Si,Silicon,28.085,ml;P,Phosphorus,30.974,nm;S,Sulfur,32.06,nm;' +
  'Cl,Chlorine,35.45,ha;Ar,Argon,39.948,ng;K,Potassium,39.098,am;Ca,Calcium,40.078,ae;Sc,Scandium,44.956,tm;Ti,Titanium,47.867,tm;V,Vanadium,50.942,tm;Cr,Chromium,51.996,tm;' +
  'Mn,Manganese,54.938,tm;Fe,Iron,55.845,tm;Co,Cobalt,58.933,tm;Ni,Nickel,58.693,tm;Cu,Copper,63.546,tm;Zn,Zinc,65.38,tm;Ga,Gallium,69.723,pt;Ge,Germanium,72.630,ml;' +
  'As,Arsenic,74.922,ml;Se,Selenium,78.971,nm;Br,Bromine,79.904,ha;Kr,Krypton,83.798,ng;Rb,Rubidium,85.468,am;Sr,Strontium,87.62,ae;Y,Yttrium,88.906,tm;Zr,Zirconium,91.224,tm;' +
  'Nb,Niobium,92.906,tm;Mo,Molybdenum,95.95,tm;Tc,Technetium,98,tm;Ru,Ruthenium,101.07,tm;Rh,Rhodium,102.91,tm;Pd,Palladium,106.42,tm;Ag,Silver,107.87,tm;Cd,Cadmium,112.41,tm;' +
  'In,Indium,114.82,pt;Sn,Tin,118.71,pt;Sb,Antimony,121.76,ml;Te,Tellurium,127.60,ml;I,Iodine,126.90,ha;Xe,Xenon,131.29,ng;Cs,Cesium,132.91,am;Ba,Barium,137.33,ae;' +
  'La,Lanthanum,138.91,la;Ce,Cerium,140.12,la;Pr,Praseodymium,140.91,la;Nd,Neodymium,144.24,la;Pm,Promethium,145,la;Sm,Samarium,150.36,la;Eu,Europium,151.96,la;' +
  'Gd,Gadolinium,157.25,la;Tb,Terbium,158.93,la;Dy,Dysprosium,162.50,la;Ho,Holmium,164.93,la;Er,Erbium,167.26,la;Tm,Thulium,168.93,la;Yb,Ytterbium,173.05,la;Lu,Lutetium,174.97,la;' +
  'Hf,Hafnium,178.49,tm;Ta,Tantalum,180.95,tm;W,Tungsten,183.84,tm;Re,Rhenium,186.21,tm;Os,Osmium,190.23,tm;Ir,Iridium,192.22,tm;Pt,Platinum,195.08,tm;Au,Gold,196.97,tm;' +
  'Hg,Mercury,200.59,tm;Tl,Thallium,204.38,pt;Pb,Lead,207.2,pt;Bi,Bismuth,208.98,pt;Po,Polonium,209,pt;At,Astatine,210,ha;Rn,Radon,222,ng;Fr,Francium,223,am;Ra,Radium,226,ae;' +
  'Ac,Actinium,227,ac;Th,Thorium,232.04,ac;Pa,Protactinium,231.04,ac;U,Uranium,238.03,ac;Np,Neptunium,237,ac;Pu,Plutonium,244,ac;Am,Americium,243,ac;Cm,Curium,247,ac;' +
  'Bk,Berkelium,247,ac;Cf,Californium,251,ac;Es,Einsteinium,252,ac;Fm,Fermium,257,ac;Md,Mendelevium,258,ac;No,Nobelium,259,ac;Lr,Lawrencium,266,ac;Rf,Rutherfordium,267,tm;' +
  'Db,Dubnium,268,tm;Sg,Seaborgium,269,tm;Bh,Bohrium,270,tm;Hs,Hassium,269,tm;Mt,Meitnerium,278,tm;Ds,Darmstadtium,281,tm;Rg,Roentgenium,282,tm;Cn,Copernicium,285,tm;' +
  'Nh,Nihonium,286,pt;Fl,Flerovium,289,pt;Mc,Moscovium,290,pt;Lv,Livermorium,293,pt;Ts,Tennessine,294,ha;Og,Oganesson,294,ng').split(';').map((s, i) => {
  const [sym, name, mass, cat] = s.split(','); return { z: i + 1, sym, name, mass, cat };
});
const CATS = { am: ['Alkali metal', '#ffb3a7'], ae: ['Alkaline earth metal', '#ffd8a0'], tm: ['Transition metal', '#ffe9a8'], pt: ['Post-transition metal', '#cfe8c8'],
  ml: ['Metalloid', '#bfe3d9'], nm: ['Nonmetal', '#c9dcff'], ha: ['Halogen', '#d9ccff'], ng: ['Noble gas', '#f2c6ef'], la: ['Lanthanide', '#ffd0e0'], ac: ['Actinide', '#f6c4d4'] };
/* where each element sits: row 0–6 main table, rows 7–8 the lanthanide/actinide rows; col 0–17 */
DATA.forEach(e => {
  const z = e.z; let row, col;
  if (z <= 2) { row = 0; col = z === 1 ? 0 : 17; }
  else if (z <= 18) { row = z <= 10 ? 1 : 2; const k = z - (row === 1 ? 3 : 11); col = k < 2 ? k : k + 10; }
  else if (z <= 54) { row = z <= 36 ? 3 : 4; col = z - (row === 3 ? 19 : 37); }
  else { row = z <= 86 ? 5 : 6; const k = z - (row === 5 ? 55 : 87); if (k < 2) col = k; else if (k < 17) { row += 2; col = k + 1; } else col = k - 14; }
  e.row = row; e.col = col; e.period = row < 7 ? row + 1 : row - 1; e.group = row < 7 ? col + 1 : null;
});
const at = (r, c) => DATA.find(e => e.row === r && e.col === c);

App.periodic = function () {
  let cur = DATA[0];
  const move = (dr, dc) => {
    for (let r = cur.row + dr, c = cur.col + dc, n = 0; n < 20; n++, r += dr, c += dc) {
      if (r < 0 || r > 8 || c < 0 || c > 17) return; const e = at(r, c); if (e) { cur = e; return; }
      if (dr) { const near = DATA.filter(x => x.row === r).sort((a, b) => Math.abs(a.col - c) - Math.abs(b.col - c))[0]; if (near) { cur = near; return; } }
    }
  };
  const table = {
    render() {
      G.clear(); G.status('PERIODIC: [enter] details  [clear] quit'); const c = G.ctx, cw = 17.5, ch = 18, x0 = 2, y0 = SB + 4;
      c.font = '10px ' + App.MONO; c.textAlign = 'center';
      DATA.forEach(e => {
        const x = x0 + e.col * cw, y = y0 + e.row * ch + (e.row >= 7 ? 6 : 0);
        c.fillStyle = CATS[e.cat][1]; c.fillRect(x, y, cw - 1, ch - 1);
        if (e === cur) { c.strokeStyle = '#000'; c.lineWidth = 2; c.strokeRect(x - .5, y - .5, cw, ch); }
        c.fillStyle = '#000'; c.fillText(e.sym, x + cw / 2, y + ch / 2);
      });
      c.textAlign = 'left'; c.font = '13px ' + App.MONO; c.fillStyle = '#000';
      c.fillText(cur.z + '  ' + cur.sym + '  ' + cur.name + '  ' + cur.mass, 6, H - 10);
    },
    key(k) {
      const d = { '#up': [-1, 0], '#down': [1, 0], '#left': [0, -1], '#right': [0, 1] }[k];
      if (d) { move(d[0], d[1]); return true; }
      if (k === '#enter') { App.setScreen(detail(cur, table)); return true; }
      if (k === '#clear') { App.setScreen(App.home); return true; }
      if (App.isTok(k) && /^[A-Z]$/.test(k)) { const e = DATA.find(x => x.sym[0] === k && DATA.indexOf(x) > DATA.indexOf(cur)) || DATA.find(x => x.sym[0] === k); if (e) cur = e; return true; } // a letter jumps to symbols starting with it
      return App.isTok(k);
    }
  };
  return table;
};
function detail(e, back) {
  const lines = [e.name, 'Symbol: ' + e.sym, 'Atomic number: ' + e.z, 'Atomic mass: ' + e.mass, 'Category:', ' ' + CATS[e.cat][0], 'Period: ' + e.period, 'Group: ' + (e.group || (e.cat === 'la' ? 'lanthanide (f)' : 'actinide (f)'))];
  return new App.TextScreen(lines, { titleInv: true, back });
}
App.periodicData = DATA;
})();
