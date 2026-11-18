/* Matriz de contraste: mostra o par escolhido aplicado a um trecho real */
(function () {
  'use strict';
  var cells = document.querySelectorAll('.mcell[data-fg]');
  var prev = document.getElementById('pair-preview');
  if (!cells.length || !prev) return;
  function verdict(r) {
    if (r >= 7) return 'AAA: serve para qualquer texto.';
    if (r >= 4.5) return 'AA: serve para texto normal.';
    if (r >= 3) return 'Só para texto grande (24 px, ou 19 px semibold), ícones e bordas de controles.';
    return 'Não serve para texto nem para elementos de interface. Uso decorativo apenas.';
  }
  function show(c) {
    cells.forEach(function (x) { x.setAttribute('aria-pressed', x === c ? 'true' : 'false'); });
    var r = parseFloat(c.getAttribute('data-ratio'));
    prev.style.background = c.getAttribute('data-bg');
    prev.style.color = c.getAttribute('data-fg');
    prev.innerHTML = '<p class="pair-preview__meta">' + c.getAttribute('data-fgn') + ' sobre ' + c.getAttribute('data-bgn') + ' · ' + r.toFixed(2).replace('.', ',') + ' : 1</p>' +
      '<p class="h3">2 acompanhamentos precisam de atenção.</p>' +
      '<p class="small">O cliente da hamburgueria ainda não enviou as fotos do cardápio, e a aprovação dos posts vence hoje.</p>' +
      '<p class="pair-preview__meta"><b>' + verdict(r) + '</b></p>';
  }
  cells.forEach(function (c) { c.addEventListener('click', function () { show(c); }); });
  var first = document.querySelector('.mcell[aria-pressed="true"]') || cells[0];
  show(first);
})();
