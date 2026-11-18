/* Viabilidade: simulador de 12 meses e dicas dos gráficos */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  function brl(n, dec) {
    return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 });
  }
  function int(n) { return Math.round(n).toLocaleString('pt-BR'); }

  /* dica do gráfico de preços */
  function tipFor(chart, tip, selector) {
    if (!chart || !tip) return;
    chart.addEventListener('pointermove', function (e) {
      var g = e.target.closest(selector);
      if (!g) { tip.classList.remove('is-on'); return; }
      var r = chart.getBoundingClientRect();
      tip.textContent = g.getAttribute('data-tip');
      tip.style.left = Math.min(Math.max(e.clientX - r.left, 90), r.width - 90) + 'px';
      tip.style.top = (e.clientY - r.top) + 'px';
      tip.classList.add('is-on');
    });
    chart.addEventListener('pointerleave', function () { tip.classList.remove('is-on'); });
  }
  tipFor(document.getElementById('price-chart'), document.getElementById('price-tip'), '.bar');

  /* simulador */
  var ids = ['price', 'dl', 'conv', 'churn', 'cost'];
  var inp = {}; ids.forEach(function (k) { inp[k] = document.getElementById('sim-' + k); });
  if (!inp.price) return;
  var svg = document.getElementById('sim-svg');
  var tip = document.getElementById('sim-tip');
  var STORE = 0.15;

  function el(t, a) { var e = document.createElementNS(NS, t); for (var k in a) e.setAttribute(k, a[k]); return e; }
  function niceMax(v) {
    if (v <= 0) return 10;
    var p = Math.pow(10, Math.floor(Math.log10(v)));
    var m = [1, 2, 2.5, 5, 10].find(function (x) { return x * p >= v; });
    return m * p;
  }

  function run() {
    var price = parseFloat(inp.price.value), dl = parseFloat(inp.dl.value), conv = parseFloat(inp.conv.value) / 100;
    var churn = parseFloat(inp.churn.value) / 100, cost = parseFloat(inp.cost.value);
    document.getElementById('sim-price-o').textContent = brl(price, 2);
    document.getElementById('sim-dl-o').textContent = int(dl);
    document.getElementById('sim-conv-o').textContent = (conv * 100).toFixed(1).replace('.', ',') + '%';
    document.getElementById('sim-churn-o').textContent = Math.round(churn * 100) + '%';
    document.getElementById('sim-cost-o').textContent = brl(cost, 2);

    var subs = 0, net = 0, series = [];
    for (var m = 1; m <= 12; m++) {
      subs = subs * (1 - churn) + dl * conv;
      net += subs * (price * (1 - STORE) - cost);
      series.push(subs);
    }
    var mrr = subs * price;
    document.getElementById('k-subs').textContent = int(subs);
    document.getElementById('k-mrr').textContent = brl(mrr);
    var kn = document.getElementById('k-net');
    kn.textContent = (net < 0 ? '−' : '') + brl(Math.abs(net));
    kn.style.color = net < 0 ? 'var(--rumo-danger)' : '';
    var steady = dl * conv / churn;
    document.getElementById('sim-note').textContent =
      'Com essas hipóteses, a base se estabiliza perto de ' + int(steady) + ' assinantes (' + brl(steady * price) + ' por mês). ' +
      'A margem por assinante, depois da loja e do custo, é de ' + brl(price * (1 - STORE) - cost, 2) + '. Não inclui salários, marketing nem impostos.';

    /* gráfico */
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var W = 640, H = 220, L = 44, R = 10, T = 18, B = 26;
    var max = niceMax(Math.max.apply(null, series) * 1.05);
    var bw = (W - L - R) / 12;
    var y = function (v) { return T + (H - T - B) * (1 - v / max); };
    [0, 0.5, 1].forEach(function (f) {
      var v = max * f;
      svg.appendChild(el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), stroke: '#E6E2EA' }));
      var t = el('text', { x: L - 8, y: y(v) + 4, 'text-anchor': 'end', 'font-size': 11, fill: '#5F586B' });
      t.textContent = int(v); svg.appendChild(t);
    });
    series.forEach(function (v, i) {
      var x = L + i * bw + 3, w = bw - 6, top = y(v), h = Math.max(1, y(0) - top);
      var r = Math.min(4, w / 2, h);
      var g = el('g', { class: 'sbar', 'data-tip': 'Mês ' + (i + 1) + ': ' + int(v) + ' assinantes · ' + brl(v * price) + '/mês' });
      g.appendChild(el('rect', { x: L + i * bw, y: T, width: bw, height: H - T - B, fill: 'transparent' }));
      g.appendChild(el('path', { d: 'M' + x + ' ' + y(0) + 'V' + (top + r) + 'Q' + x + ' ' + top + ' ' + (x + r) + ' ' + top + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + top + ' ' + (x + w) + ' ' + (top + r) + 'V' + y(0) + 'Z', fill: i === 11 ? '#6C4ED9' : '#DCCEF6' }));
      var lbl = el('text', { x: x + w / 2, y: H - 8, 'text-anchor': 'middle', 'font-size': 11, fill: '#5F586B' });
      lbl.textContent = String(i + 1); g.appendChild(lbl);
      if (i === 11) { var vl = el('text', { x: x + w / 2, y: top - 6, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 600, fill: '#2B1E4B' }); vl.textContent = int(v); g.appendChild(vl); }
      svg.appendChild(g);
    });
  }
  ids.forEach(function (k) { inp[k].addEventListener('input', run); });
  tipFor(document.getElementById('sim-chart'), tip, '.sbar');
  run();
})();
