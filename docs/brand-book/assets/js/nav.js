/* Navegação: uma tela por capítulo, seções em abas, busca ⌘K, atalhos ← → */
(function () {
  'use strict';
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  var views = $$('[data-view]');
  var order = views.map(function (v) { return v.id; });
  var links = $$('.toc__link');
  var toc = document.getElementById('toc');
  var scrim = document.getElementById('scrim');
  var openBtn = document.getElementById('toc-open');
  var count = document.getElementById('toc-count');
  var bar = document.getElementById('toc-bar');
  var current = document.getElementById('topbar-current');
  var main = document.getElementById('main');
  var total = views.filter(function (v) { return parseInt(v.getAttribute('data-chapter'), 10) > 0; }).length;
  var active = null;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function showSection(view, i, focusTab) {
    var tabs = $$('.sec-tab', view), secs = $$('.sec', view);
    if (!secs.length) { view.setAttribute('data-last', 'true'); return; }
    i = Math.max(0, Math.min(i, secs.length - 1));
    secs.forEach(function (s, k) { s.hidden = k !== i; });
    tabs.forEach(function (t, k) {
      var on = k === i;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      if (on) {
        if (focusTab) t.focus();
        var list = t.parentNode;
        if (list.scrollWidth > list.clientWidth) list.scrollTo({ left: t.offsetLeft - list.clientWidth / 2 + t.offsetWidth / 2, behavior: reduce ? 'auto' : 'smooth' });
      }
    });
    view.setAttribute('data-sec', String(i));
    view.setAttribute('data-last', i === secs.length - 1 ? 'true' : 'false');
    document.dispatchEvent(new CustomEvent('rumo:section', { detail: { view: view.id, sec: i } }));
  }

  function show(id, sec, opts) {
    opts = opts || {};
    var view = document.getElementById(id);
    if (!view || !view.hasAttribute('data-view')) { view = views[0]; id = view.id; }
    if (active !== view) {
      views.forEach(function (v) { v.hidden = v !== view; });
      active = view;
      window.scrollTo(0, 0);
      if (main) main.scrollTop = 0;
    }
    if (typeof sec === 'number') {
      showSection(view, sec);
      if (opts.scrollToSec) {
        var tabs = view.querySelector('.sec-tabs');
        if (tabs) window.scrollTo({ top: Math.max(0, view.querySelector('.ch-head').offsetHeight), behavior: 'auto' });
      }
    }
    links.forEach(function (a) {
      if (a.getAttribute('data-target') === id) {
        a.setAttribute('aria-current', 'true');
        var sc = a.closest('.toc__scroll');
        if (sc) {
          var r = a.getBoundingClientRect(), s = sc.getBoundingClientRect();
          if (r.top < s.top + 8 || r.bottom > s.bottom - 8) sc.scrollTop += r.top - s.top - s.height / 2;
        }
      } else a.removeAttribute('aria-current');
    });
    var raw = view.getAttribute('data-chapter'), num = parseInt(raw, 10), annex = raw === 'A';
    if (count) count.textContent = annex ? 'Anexo' : num ? pad(num) + ' / ' + pad(total) : 'Início';
    if (bar) bar.style.width = (annex ? 100 : num / total * 100) + '%';
    if (current) current.textContent = annex ? 'Anexo  ' + view.getAttribute('data-title') : num ? pad(num) + '  ' + view.getAttribute('data-title') : 'Início';
    document.dispatchEvent(new CustomEvent('rumo:view', { detail: { view: id } }));
  }

  function route() {
    var h = decodeURIComponent((location.hash || '').slice(1));
    if (!h) { show('inicio', 0); return; }
    var el = document.getElementById(h);
    if (!el) { show('inicio', 0); return; }
    var view = el.closest('[data-view]');
    if (!view) { show('inicio', 0); return; }
    var sec = el.closest('.sec');
    if (sec && sec !== el) {
      show(view.id, parseInt(sec.getAttribute('data-sec'), 10));
      if (window.RumoBook) RumoBook.showSubOf(el);
      setTimeout(function () { el.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' }); }, 30);
    } else show(view.id, el === view ? 0 : undefined);
  }
  window.addEventListener('hashchange', route);
  window.RumoNav = { show: show, showSection: showSection };

  /* links de demonstração não navegam */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('.ui a[href^="#"], .app a[href^="#"]');
    if (a) e.preventDefault();
  });

  /* botão de próxima seção */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-sec-go]');
    if (!b) return;
    var view = b.closest('[data-view]');
    showSection(view, parseInt(b.getAttribute('data-sec-go'), 10));
    var tabs = view.querySelector('.sec-tabs');
    if (tabs) window.scrollTo({ top: window.scrollY + tabs.getBoundingClientRect().top - 70, behavior: reduce ? 'auto' : 'smooth' });
  });

  /* abas */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('.sec-tab');
    if (!t) return;
    var view = t.closest('[data-view]');
    showSection(view, parseInt(t.getAttribute('data-sec'), 10));
    var tabs = view.querySelector('.sec-tabs');
    var top = tabs.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.6) window.scrollTo({ top: window.scrollY + top - 70, behavior: reduce ? 'auto' : 'smooth' });
  });
  document.addEventListener('keydown', function (e) {
    var t = e.target.closest && e.target.closest('.sec-tab');
    if (!t) return;
    var tabs = $$('.sec-tab', t.parentNode), i = tabs.indexOf(t);
    var vertical = t.parentNode.classList.contains('sec-tabs--list') && getComputedStyle(t.parentNode).flexDirection === 'column';
    var nextK = vertical ? 'ArrowDown' : 'ArrowRight', prevK = vertical ? 'ArrowUp' : 'ArrowLeft';
    var n = null;
    if (e.key === nextK) n = (i + 1) % tabs.length;
    if (e.key === prevK) n = (i - 1 + tabs.length) % tabs.length;
    if (e.key === 'Home') n = 0;
    if (e.key === 'End') n = tabs.length - 1;
    if (n !== null) { e.preventDefault(); e.stopPropagation(); showSection(t.closest('[data-view]'), n, true); }
  }, true);

  /* índice em telas menores */
  function setOpen(open) {
    if (!toc) return;
    toc.classList.toggle('is-open', open);
    if (scrim) scrim.classList.toggle('is-open', open);
    if (openBtn) openBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) { var a = toc.querySelector('[aria-current="true"]') || toc.querySelector('a'); if (a) a.focus(); }
    else if (openBtn && toc.contains(document.activeElement)) openBtn.focus();
  }
  if (openBtn) openBtn.addEventListener('click', function () { setOpen(!toc.classList.contains('is-open')); });
  if (scrim) scrim.addEventListener('click', function () { setOpen(false); });
  links.forEach(function (a) { a.addEventListener('click', function () { if (toc.classList.contains('is-open')) setOpen(false); }); });

  /* ← → entre seções e capítulos */
  function step(dir) {
    if (!active) return;
    var secs = $$('.sec', active);
    var cur = parseInt(active.getAttribute('data-sec') || '0', 10);
    var g = secs[cur] && secs[cur].querySelector(':scope > .subs');
    if (g && window.RumoBook) {
      var sp = $$(':scope > .sub-panels > .sub', g), j = sp.findIndex(function (x) { return !x.hidden; });
      if (j + dir >= 0 && j + dir < sp.length) { RumoBook.showSub(active, cur, j + dir); return; }
    }
    if (secs.length > 1 && cur + dir >= 0 && cur + dir < secs.length) { showSection(active, cur + dir); return; }
    var idx = order.indexOf(active.id) + dir;
    if (idx < 0 || idx >= order.length) return;
    var target = order[idx];
    var nsecs = $$('.sec', document.getElementById(target));
    location.hash = target;
    if (dir < 0 && nsecs.length > 1) setTimeout(function () { showSection(document.getElementById(target), nsecs.length - 1); }, 0);
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && toc && toc.classList.contains('is-open')) { setOpen(false); return; }
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    var t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (t && t.closest && t.closest('[role="tablist"], .seg, [role="menu"], .palette')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  });

  /* busca ⌘K */
  var pal = document.getElementById('palette');
  var q = document.getElementById('palette-q');
  var list = document.getElementById('palette-list');
  var index = [];
  try { index = JSON.parse(document.getElementById('search-index').textContent); } catch (err) { index = []; }
  var results = [], sel = 0, lastFocus = null;
  function norm(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function render() {
    var term = norm(q.value.trim());
    results = index.filter(function (r) { return !term || norm(r.t + ' ' + r.p).indexOf(term) > -1; }).slice(0, 40);
    if (!term) results = index.filter(function (r) { return r.t.indexOf('›') < 0; });
    sel = 0;
    list.innerHTML = results.length ? results.map(function (r, i) {
      return '<li class="palette__item" role="option" id="pal-' + i + '" aria-selected="' + (i === 0) + '" data-i="' + i + '"><span class="n">' + r.n + '</span><span>' + r.t.replace('›', '<span style="color:var(--rumo-gray)">›</span>') + '<small>' + r.p + '</small></span><svg class="i" aria-hidden="true"><use href="#i-corner-down-left"/></svg></li>';
    }).join('') : '<li class="palette__empty">Nada encontrado. Tente “Rotas”, “onboarding” ou “logo”.</li>';
    q.setAttribute('aria-activedescendant', results.length ? 'pal-0' : '');
  }
  function mark() {
    $$('.palette__item', list).forEach(function (li, i) { li.setAttribute('aria-selected', i === sel ? 'true' : 'false'); if (i === sel) li.scrollIntoView({ block: 'nearest' }); });
    q.setAttribute('aria-activedescendant', 'pal-' + sel);
  }
  function go(i) {
    var r = results[i]; if (!r) return;
    closePal();
    if (location.hash.slice(1) !== r.h) location.hash = r.h;
    setTimeout(function () {
      var v = document.getElementById(r.h);
      if (v && r.s) showSection(v, r.s);
      if (v && r.u != null && window.RumoBook) RumoBook.showSub(v, r.s, r.u);
    }, 0);
  }
  function openPal() { lastFocus = document.activeElement; pal.hidden = false; q.value = ''; render(); setTimeout(function () { q.focus(); }, 10); setOpen(false); }
  function closePal() { pal.hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  if (pal) {
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-palette-open]')) { e.preventDefault(); openPal(); }
      if (e.target.closest('[data-palette-close]')) closePal();
      var it = e.target.closest('.palette__item'); if (it) go(parseInt(it.getAttribute('data-i'), 10));
    });
    q.addEventListener('input', render);
    q.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, results.length - 1); mark(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); mark(); }
      if (e.key === 'Enter') { e.preventDefault(); go(sel); }
    });
    document.addEventListener('keydown', function (e) {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); pal.hidden ? openPal() : closePal(); }
      else if (e.key === '/' && pal.hidden && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) { e.preventDefault(); openPal(); }
      else if (e.key === 'Escape' && !pal.hidden) closePal();
    });
  }

  route();
})();
