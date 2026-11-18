/* Componentes, divulgação progressiva, módulos, tipografia e aplicações */
(function () {
  'use strict';
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function pressGroup(group, btn, attr) {
    $$('button', group).forEach(function (b) { b.setAttribute(attr || 'aria-pressed', b === btn ? 'true' : 'false'); });
  }

  /* Seletor de estado (capítulo 14) */
  var sw = document.getElementById('state-switch');
  if (sw) {
    var STATES = ['hover', 'focus', 'disabled', 'loading'];
    sw.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      pressGroup(sw, b);
      var st = b.getAttribute('data-state');
      $$('[data-st]').forEach(function (el) {
        STATES.forEach(function (s) { el.classList.remove('is-' + s); });
        var ok = el.getAttribute('data-st').split(' ').indexOf(st) > -1;
        if (ok) el.classList.add('is-' + st);
        if (el.matches('input, select')) {
          el.disabled = ok && st === 'disabled';
        }
      });
    });
  }

  /* Filtros do header */
  $$('[data-filter]').forEach(function (f) {
    f.addEventListener('click', function () {
      $$('[data-filter]', f.parentNode).forEach(function (x) { x.setAttribute('aria-pressed', x === f ? 'true' : 'false'); });
    });
  });

  /* Concluir itens de lista nos exemplos */
  document.addEventListener('change', function (e) {
    var cb = e.target;
    if (!cb.classList || !cb.classList.contains('ui-check')) return;
    var item = cb.closest('.ui-item');
    if (item) item.classList.toggle('is-done', cb.checked);
    var choice = cb.closest('.onb__choice');
    if (choice) choice.classList.toggle('is-on', cb.checked);
  });

  /* Divulgação progressiva (capítulo 03) */
  var dctl = document.querySelector('[data-disclosure-ctl]');
  var dbox = document.querySelector('[data-disclosure]');
  function applyLevel(lv) {
    $$('[data-lv]', dbox).forEach(function (el) { el.hidden = parseInt(el.getAttribute('data-lv'), 10) > lv; });
  }
  if (dctl && dbox) {
    dctl.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      pressGroup(dctl, b); applyLevel(parseInt(b.getAttribute('data-level'), 10));
    });
    applyLevel(1);
  }

  /* Montagem de módulos (capítulo 15) */
  var summary = document.getElementById('mod-summary');
  function updateMods() {
    var on = 1;
    $$('[data-mod-toggle]').forEach(function (cb) {
      var k = cb.getAttribute('data-mod-toggle');
      var nav = document.querySelector('[data-mod-nav="' + k + '"]');
      if (nav) nav.hidden = !cb.checked;
      var card = document.querySelector('[data-mod="' + k + '"]');
      if (card) card.classList.toggle('is-on', cb.checked);
      if (cb.checked) on++;
    });
    var ai = document.querySelector('[data-mod-toggle="inteligencia"]');
    var cap = document.querySelector('[data-capture-label]');
    if (cap) cap.textContent = ai && ai.checked ? 'Capturar com IA' : 'Capturar';
    var preview = document.querySelector('.modbuilder__preview .ui-sidebar');
    var dest = preview ? $$('.ui-nav', preview).filter(function (n) { return !n.closest('[hidden]'); }).length : 0;
    if (summary) summary.textContent = on + (on === 1 ? ' módulo ativo' : ' módulos ativos') + ' · ' + dest + ' destinos na navegação';
  }
  $$('[data-mod-toggle]').forEach(function (cb) { cb.addEventListener('change', updateMods); });
  updateMods();

  /* Texto de teste da tipografia (capítulo 09) */
  var ts = document.getElementById('type-sample');
  if (ts) {
    var targets = $$('[data-type-sample]');
    ts.addEventListener('input', function () {
      var v = ts.value.trim() || 'Clareza para o seu próximo passo.';
      targets.forEach(function (t) { t.textContent = v; });
    });
  }

  /* Aplicações: abas e dispositivo (capítulo 18) */
  var tabs = document.getElementById('apps-tabs');
  var dev = document.getElementById('device-switch');
  var device = window.innerWidth < 640 ? 'mobile' : 'desktop';
  function applyDevice() {
    $$('[data-device-view]').forEach(function (v) { v.hidden = v.getAttribute('data-device-view') !== device; });
  }
  function activePanel() {
    var t = tabs.querySelector('[aria-selected="true"]');
    return document.getElementById(t.getAttribute('aria-controls'));
  }
  function syncDevice() {
    var has = activePanel().hasAttribute('data-has-device');
    $$('button', dev).forEach(function (b) { b.disabled = !has; });
    dev.style.opacity = has ? '1' : '.45';
    dev.title = has ? '' : 'Esta aplicação tem uma única versão';
  }
  if (tabs) {
    var tlist = $$('[role="tab"]', tabs);
    function select(t, focus) {
      tlist.forEach(function (x) {
        var on = x === t;
        x.setAttribute('aria-selected', on ? 'true' : 'false');
        x.tabIndex = on ? 0 : -1;
        document.getElementById(x.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) t.focus();
      t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      syncDevice();
    }
    tabs.addEventListener('click', function (e) { var t = e.target.closest('[role="tab"]'); if (t) select(t); });
    tabs.addEventListener('keydown', function (e) {
      var i = tlist.indexOf(document.activeElement); if (i < 0) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); select(tlist[(i + 1) % tlist.length], true); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); select(tlist[(i - 1 + tlist.length) % tlist.length], true); }
      if (e.key === 'Home') { e.preventDefault(); select(tlist[0], true); }
      if (e.key === 'End') { e.preventDefault(); select(tlist[tlist.length - 1], true); }
    });
    dev.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || b.disabled) return;
      pressGroup(dev, b); device = b.getAttribute('data-device'); applyDevice();
    });
    $$('button', dev).forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-device') === device ? 'true' : 'false'); });
    applyDevice(); syncDevice();
  }
})();
