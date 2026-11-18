/* Laboratório do logo: fundo, versão, formato, grid, área de proteção e tamanho */
(function () {
  'use strict';
  var stage = document.getElementById('lab-stage');
  if (!stage) return;
  var art = document.getElementById('lab-art');
  var readout = document.getElementById('lab-readout');
  var sel = document.getElementById('lab-version');
  var gridCb = document.getElementById('lab-grid');
  var clearCb = document.getElementById('lab-clear');
  var size = document.getElementById('lab-size');
  var sizeOut = document.getElementById('lab-size-out');
  var NS = 'http://www.w3.org/2000/svg';

  var C = { deep: '#2B1E4B', purple: '#6C4ED9', lavender: '#DCCEF6', warm: '#F8F7F4', charcoal: '#1F1F1F', white: '#FFFFFF' };
  var BG = { warm: C.warm, white: C.white, lavender: C.lavender, purple: C.purple, deep: C.deep, charcoal: C.charcoal };
  var BG_NAME = { warm: 'Warm', white: 'Branco', lavender: 'Lavanda', purple: 'Purple', deep: 'Deep', charcoal: 'Charcoal' };
  /* cores de referência para o contraste: o tom mais claro e o mais escuro de cada parte */
  var V = {
    'principal': { parts: { s: ['#6C4ED9', '#2B1E4B'], l: ['#332254', '#211732'], w: ['#1F1F1F'] }, name: 'Principal' },
    'negativo': { parts: { s: ['#DCCEF6', '#B9A6EE'], l: ['#B9A6EE', '#F8F7F4'], w: ['#F8F7F4'] }, name: 'Clara' },
    'mono-escura': { parts: { s: ['#1F1F1F'], l: ['#1F1F1F'], w: ['#1F1F1F'] }, name: 'Monocromática escura', mono: true },
    'mono-clara': { parts: { s: ['#F8F7F4'], l: ['#F8F7F4'], w: ['#F8F7F4'] }, name: 'Monocromática clara', mono: true }
  };
  var REC = { warm: 'principal', white: 'principal', lavender: 'principal', purple: 'mono-clara', deep: 'negativo', charcoal: 'negativo' };
  var PART = { s: 'O traço superior tem', l: 'A perna tem', w: 'O wordmark tem' };

  var GEO = window.RUMO_LOGO_GEO;
  var SB = GEO.symBox;                       /* x0, y0, x1, y1 do símbolo */
  var SIG = { vb: GEO.sigVB, cap: GEO.capTop, base: GEO.base, symR: SB[2], wmL: GEO.wmLeft, wmR: GEO.wmRight };
  var SYMV = GEO.symVB;
  var X = GEO.X;

  var state = { bg: 'warm', form: 'sig', version: 'auto', grid: false, clear: false, width: 360 };

  function lum(h) {
    var c = [1, 3, 5].map(function (i) { var v = parseInt(h.substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function cr(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function fmt(n) { return n.toFixed(1).replace('.', ','); }
  function icon(id) { return '<svg class="i" aria-hidden="true"><use href="#i-' + id + '"/></svg>'; }
  function el(tag, attrs) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }

  function maxWidth() {
    var avail = stage.clientWidth - 48;
    var box = state.form === 'sig' ? SIG.vb : SYMV;
    var extra = state.clear ? 2 * X / box[2] : 0;
    return Math.max(40, Math.floor(avail / (1 + extra)));
  }

  function render() {
    var vkey = state.version === 'auto' ? REC[state.bg] : state.version;
    var v = V[vkey];
    stage.setAttribute('data-bg', state.bg);
    var isSig = state.form === 'sig';
    var box = isSig ? SIG.vb : SYMV;          /* x, y, w, h */
    var cap = maxWidth();
    var w = Math.min(state.width, cap);
    var k = w / box[2];
    art.innerHTML = '';
    var svg = el('svg', { viewBox: box.join(' '), class: 'logo', role: 'img', 'aria-label': 'Rumo, versão ' + v.name });
    svg.style.width = w + 'px';
    svg.appendChild(el('use', { href: '#logo-' + (isSig ? 'sig' : 'sym') + '-' + vkey, x: box[0], y: box[1], width: box[2], height: box[3] }));
    art.appendChild(svg);
    art.style.margin = state.clear ? (X * k) + 'px' : '0';

    if (state.grid || state.clear) {
      var ov = el('svg', { viewBox: (box[0] - X) + ' ' + (box[1] - X) + ' ' + (box[2] + 2 * X) + ' ' + (box[3] + 2 * X), class: 'lab__overlay', 'aria-hidden': 'true' });
      ov.style.left = (-X * k) + 'px'; ov.style.top = (-X * k) + 'px';
      ov.style.width = ((box[2] + 2 * X) * k) + 'px'; ov.style.height = ((box[3] + 2 * X) * k) + 'px';
      var dark = /deep|purple|charcoal/.test(state.bg);
      var col = dark ? '#DCCEF6' : '#6C4ED9';
      var sw = 1 / k, dash = (4 * sw) + ' ' + (3 * sw);
      if (state.clear) {
        ov.appendChild(el('rect', { x: box[0] - X, y: box[1] - X, width: box[2] + 2 * X, height: box[3] + 2 * X, fill: col, 'fill-opacity': '0.10', stroke: col, 'stroke-width': sw, 'stroke-dasharray': dash }));
        ov.appendChild(el('rect', { x: box[0], y: box[1], width: box[2], height: box[3], fill: 'none', stroke: col, 'stroke-width': sw, 'stroke-opacity': '0.6' }));
        var lbl = el('text', { x: box[0] - X / 2, y: box[1] + box[3] / 2, fill: col, 'font-size': Math.max(12 / k, X * 0.3), 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-family': 'Inter, sans-serif', 'font-weight': '600' });
        lbl.textContent = 'X'; ov.appendChild(lbl);
      }
      if (state.grid) {
        var g = el('g', { stroke: col, 'stroke-width': sw, fill: 'none' });
        var xr = isSig ? SIG.wmR + 6 : SB[2] + 8;
        [19, 68, 117].forEach(function (y) { g.appendChild(el('line', { x1: SB[0] - 8, y1: y, x2: xr, y2: y, 'stroke-opacity': 0.55 })); });
        [20, 46.8].forEach(function (x) { g.appendChild(el('line', { x1: x, y1: SB[1] - 8, x2: x, y2: SB[3] + 8, 'stroke-opacity': 0.55 })); });
        g.appendChild(el('circle', { cx: 76.5, cy: 44.5, r: 25.5, 'stroke-dasharray': dash }));
        g.appendChild(el('line', { x1: 11, y1: 8.5, x2: 62, y2: 85, 'stroke-dasharray': dash }));
        g.appendChild(el('line', { x1: 62, y1: 58.5, x2: 116, y2: 126, 'stroke-dasharray': dash }));
        if (isSig) {
          [SIG.cap, SIG.base].forEach(function (y) { g.appendChild(el('line', { x1: SIG.symR, y1: y, x2: SIG.wmR + 6, y2: y, 'stroke-opacity': 0.9 })); });
          [SIG.symR, SIG.wmL].forEach(function (x) { g.appendChild(el('line', { x1: x, y1: box[1] - 6, x2: x, y2: box[1] + box[3] + 6, 'stroke-opacity': 0.9 })); });
        }
        ov.appendChild(g);
      }
      art.appendChild(ov);
    }

    /* leitura */
    var worst = null;
    Object.keys(v.parts).forEach(function (p) {
      if (!isSig && p === 'w') return;
      /* uma parte some quando o tom dela mais próximo do fundo fica abaixo de 3:1 */
      var r = Math.min.apply(null, v.parts[p].map(function (c) { return cr(c, BG[state.bg]); }));
      var best = Math.max.apply(null, v.parts[p].map(function (c) { return cr(c, BG[state.bg]); }));
      var eff = p === 'w' ? r : best;
      if (!worst || eff < worst.r) worst = { p: p, r: eff };
    });
    var rec = REC[state.bg];
    var msgs = [];
    if (worst.r < 3) msgs.push('<span class="status status--bad">' + icon('error') + 'Contraste insuficiente</span><span>' + PART[worst.p] + ' ' + fmt(worst.r) + ':1 sobre ' + BG_NAME[state.bg] + '. Use a versão ' + V[rec].name.toLowerCase() + '.</span>');
    else if (vkey === rec) msgs.push('<span class="status status--ok">' + icon('check') + 'Versão recomendada</span><span>' + v.name + ' sobre ' + BG_NAME[state.bg] + '.</span>');
    else msgs.push('<span class="status status--warn">' + icon('warning') + 'Legível, fora da regra</span><span>A versão indicada para ' + BG_NAME[state.bg] + ' é a ' + V[rec].name.toLowerCase() + '.</span>');
    if (isSig && w < 96) msgs.push('<span class="status status--bad">' + icon('error') + 'Pequena demais</span><span>Abaixo de 96 px, use só o símbolo.</span>');
    else if (!isSig && w < 16) msgs.push('<span class="status status--bad">' + icon('error') + 'Pequeno demais</span><span>O símbolo não deve ficar abaixo de 16 px.</span>');
    else if (!isSig && w < 24 && !v.mono) msgs.push('<span class="status status--warn">' + icon('warning') + 'Use uma cor</span><span>Entre 16 e 24 px, use uma versão monocromática.</span>');
    readout.innerHTML = msgs.map(function (m) { return '<span class="lab__msg">' + m + '</span>'; }).join('');
    sizeOut.textContent = w + ' px';
    size.max = String(Math.min(560, Math.max(cap, 120)));
    if (w !== state.width && state.width > cap) size.value = String(w);
  }

  function bindSeg(name, key) {
    var g = document.querySelector('[data-lab="' + name + '"]');
    g.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      g.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      state[key] = b.getAttribute('data-v');
      if (key === 'form') { state.width = state.form === 'sig' ? 360 : 140; size.value = String(state.width); }
      render();
    });
  }
  bindSeg('bg', 'bg'); bindSeg('form', 'form');
  sel.addEventListener('change', function () { state.version = sel.value; render(); });
  gridCb.addEventListener('change', function () { state.grid = gridCb.checked; render(); });
  clearCb.addEventListener('change', function () { state.clear = clearCb.checked; render(); });
  size.addEventListener('input', function () { state.width = parseInt(size.value, 10); render(); });
  window.addEventListener('resize', render);
  document.addEventListener('rumo:section', function () { if (stage.offsetParent) render(); });
  document.addEventListener('rumo:view', function () { if (stage.offsetParent) render(); });
  render();
})();
