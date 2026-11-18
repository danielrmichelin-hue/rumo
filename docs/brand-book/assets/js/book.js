/* Brand & Product Book: sub-seções, telas, persona, módulos, onboarding, Rota e regra de produto */
(function () {
  'use strict';
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function $(s, r) { return (r || document).querySelector(s); }
  function ic(n) { return '<svg class="i" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- sub-seções ---------- */
  function showSub(group, j, focus) {
    if (!group) return;
    var tabs = $$(':scope > .sub-tabs > .sub-tab', group), subs = $$(':scope > .sub-panels > .sub', group);
    j = Math.max(0, Math.min(j, subs.length - 1));
    subs.forEach(function (s, k) { s.hidden = k !== j; });
    tabs.forEach(function (t, k) {
      var on = k === j;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      if (on) {
        if (focus) t.focus();
        var list = t.parentNode;
        if (list.scrollWidth > list.clientWidth + 2 && getComputedStyle(list).flexDirection !== 'column') list.scrollTo({ left: t.offsetLeft - list.clientWidth / 2 + t.offsetWidth / 2, behavior: reduce ? 'auto' : 'smooth' });
      }
    });
    var view = group.closest('[data-view]');
    document.dispatchEvent(new CustomEvent('rumo:section', { detail: { view: view && view.id, sub: j } }));
  }
  function subGroupOf(view, sec) {
    var panel = $$('.sec', view)[sec];
    return panel ? $(':scope > .subs', panel) : null;
  }
  window.RumoBook = {
    showSub: function (view, sec, j) { showSub(subGroupOf(view, sec), j); },
    showSubOf: function (el) {
      var sub = el.closest('.sub');
      if (!sub) return;
      showSub(sub.closest('.subs'), parseInt(sub.getAttribute('data-sub'), 10));
    }
  };
  document.addEventListener('click', function (e) {
    var t = e.target.closest('.sub-tab');
    if (!t) return;
    var g = t.closest('.subs');
    showSub(g, parseInt(t.getAttribute('data-sub'), 10));
    var top = t.parentNode.getBoundingClientRect().top;
    if (top < 60) window.scrollTo({ top: window.scrollY + top - 140, behavior: reduce ? 'auto' : 'smooth' });
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-sub-go]');
    if (!b) return;
    var g = b.closest('.subs');
    showSub(g, parseInt(b.getAttribute('data-sub-go'), 10));
    var tabs = g.querySelector('.sub-tabs');
    window.scrollTo({ top: window.scrollY + tabs.getBoundingClientRect().top - 150, behavior: reduce ? 'auto' : 'smooth' });
  });
  document.addEventListener('keydown', function (e) {
    var t = e.target.closest && e.target.closest('.sub-tab');
    if (!t) return;
    var tabs = $$('.sub-tab', t.parentNode), i = tabs.indexOf(t);
    var vertical = getComputedStyle(t.parentNode).flexDirection === 'column';
    var nextK = vertical ? 'ArrowDown' : 'ArrowRight', prevK = vertical ? 'ArrowUp' : 'ArrowLeft';
    var n = null;
    if (e.key === nextK) n = (i + 1) % tabs.length;
    if (e.key === prevK) n = (i - 1 + tabs.length) % tabs.length;
    if (e.key === 'Home') n = 0;
    if (e.key === 'End') n = tabs.length - 1;
    if (n !== null) { e.preventDefault(); e.stopPropagation(); showSub(t.closest('.subs'), n, true); }
  }, true);

  /* ---------- telas: tema e dispositivo ---------- */
  function press(group, btn) { $$('button', group).forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); }); }
  function setTheme(shot, theme) {
    $$('.px', shot).forEach(function (p) { p.setAttribute('data-theme', theme); });
    $$('.px-stage', shot).forEach(function (s) { s.classList.toggle('is-dark', theme === 'dark'); });
    $$('[data-px-theme]', shot).forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-px-theme') === theme ? 'true' : 'false'); });
  }
  function setDevice(shot, dev) {
    $$('[data-px-view]', shot).forEach(function (v) { v.hidden = v.getAttribute('data-px-view') !== dev; });
    $$('[data-px-device]', shot).forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-px-device') === dev ? 'true' : 'false'); });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-px-theme]');
    if (b) { setTheme(b.closest('[data-px]'), b.getAttribute('data-px-theme')); return; }
    var d = e.target.closest('[data-px-device]');
    if (d) setDevice(d.closest('[data-px]'), d.getAttribute('data-px-device'));
  });
  if (window.innerWidth < 640) $$('[data-px]').forEach(function (s) { if ($('[data-px-device]', s)) setDevice(s, 'mobile'); });

  /* ---------- persona ---------- */
  $$('[data-persona]').forEach(function (root) {
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-persona-btn]');
      if (!b) return;
      press(b.parentNode, b);
      var k = b.getAttribute('data-persona-btn');
      $$('[data-persona-view]', root).forEach(function (v) {
        var on = v.getAttribute('data-persona-view') === k;
        v.hidden = !on;
        if (on && !reduce) { v.classList.remove('px-in'); void v.offsetWidth; v.classList.add('px-in'); }
      });
    });
  });

  /* ---------- barra lateral montada por dados ---------- */
  var CORE = [['hoje', 'Hoje', '3', 'hot'], ['inbox', 'Inbox', '5'], ['calendar-days', 'Calendário', ''], ['list-checks', 'Responsabilidades', '12'], ['projetos', 'Projetos', '3']];
  function navItem(icon, label, count, cls, isNew) {
    return '<div class="px-nav' + (cls === 'on' ? ' is-on' : '') + (isNew ? ' px-in' : '') + '">' + icon + '<span>' + esc(label) + '</span><em' + (cls === 'hot' ? ' class="hot"' : '') + '>' + (count || '') + '</em></div>';
  }
  function dot(c) { return '<i class="px-dot" style="background:var(--c-' + c + ')"></i>'; }
  function sideHtml(groups, fresh) {
    var h = '<div class="px-search">' + ic('search') + 'Buscar<span class="px-kbd">⌘ K</span></div>';
    CORE.forEach(function (c, i) { h += navItem(ic(c[0]), c[1], c[2], i === 0 ? 'on' : c[3]); });
    groups.forEach(function (g) {
      var isNew = fresh && fresh.indexOf(g.k) > -1;
      h += '<div class="px-group' + (isNew ? ' px-in' : '') + '">' + esc(g.t) + '</div>';
      g.items.forEach(function (it) { h += navItem(it[0], it[1], it[2], '', isNew); });
    });
    return h;
  }

  /* ---------- módulos ---------- */
  var MODS = {
    negocios: { t: 'Negócios', items: [[dot('iter'), 'Iter Mídia', '4'], [dot('escola'), 'Rumo', '2']],
      today: ['Aprovar o orçamento de novembro', '<span>' + dot('iter') + 'Iter Mídia</span><span class="late">Venceu ontem</span>'] },
    estudos: { t: 'Estudos', items: [[dot('pos'), 'Pós em Marketing', '']],
      today: ['Sessão de revisão · Branding', '<span>' + dot('pos') + 'Pós em Marketing</span><span>19:00 · 50 min</span>'] },
    rotinas: { t: 'Rotinas', items: [[ic('repeat'), 'Academia', '3/4'], [ic('repeat'), 'Leitura', '']],
      today: ['Academia', '<span>' + ic('repeat') + 'Rotina · 3 de 4 nesta semana</span><span>07:00</span>'] },
    notas: { t: 'Notas', items: [[ic('scale'), 'Decisões', '6'], [ic('bookmark'), 'Referências', '']],
      today: ['Reunião com o sócio', '<span>' + dot('iter') + 'Iter Mídia</span><span>' + ic('sticky-note') + '1 nota vinculada</span><span>14:00</span>'] },
    rotas: { t: 'Rotas', items: [['<span class="px-ring" style="--p:62"></span>', 'Reserva de R$ 5.000', '62%']],
      today: ['Transferir R$ 380 para a reserva', '<span><span class="px-ring" style="--p:62"></span>Rota · Reserva de R$ 5.000</span>'] }
  };
  var ORDER = ['negocios', 'estudos', 'rotinas', 'notas', 'rotas'];
  function row(t, props, isNew) {
    return '<div class="px-row' + (isNew ? ' px-in' : '') + '"><span class="px-chk"></span><div><div class="px-row__t">' + esc(t) + '</div><div class="px-props">' + props + '</div></div><span></span></div>';
  }
  $$('[data-modviz]').forEach(function (root) {
    var nav = $('[data-modviz-nav]', root), today = $('[data-modviz-today]', root);
    var prev = [];
    function render(changed) {
      var on = $$('[data-mod]', root).filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; }).map(function (b) { return b.getAttribute('data-mod'); });
      var groups = ORDER.filter(function (k) { return on.indexOf(k) > -1; }).map(function (k) { return { k: k, t: MODS[k].t, items: MODS[k].items }; });
      nav.innerHTML = sideHtml(groups, changed ? [changed] : null);
      var h = '<div class="px-sec__h">Hoje <em>' + (on.length + 1) + '</em></div>';
      h += row('Ligar para o contador', '<span>' + ic('inbox') + 'Capturado na Inbox</span><span class="warn">' + ic('hourglass') + 'Aguardando retorno</span>');
      ORDER.forEach(function (k) { if (on.indexOf(k) > -1) h += row(MODS[k].today[0], MODS[k].today[1], k === changed); });
      today.innerHTML = h;
      prev = on;
    }
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-mod]');
      if (!b) return;
      var was = b.getAttribute('aria-pressed') === 'true';
      b.setAttribute('aria-pressed', was ? 'false' : 'true');
      render(was ? null : b.getAttribute('data-mod'));
    });
    render(null);
  });

  /* ---------- onboarding ---------- */
  var ONB = {
    trabalho: { g: 'Áreas', items: [[ic('briefcase'), 'Trabalho']], q: 'De onde chegam as suas demandas de trabalho?', c: ['E-mail', 'WhatsApp', 'Sistemas da empresa', 'Reuniões'], empty: ['Trabalho', 'Capture a primeira demanda. Ela entra na Inbox e você decide depois onde fica.'] },
    negocios: { g: 'Negócios', items: [[dot('iter'), 'Empresa A'], [dot('burger'), 'Empresa B']], q: 'Quais empresas você quer acompanhar?', c: ['Empresa A', 'Empresa B', '+ Adicionar'], empty: ['Empresa A', 'Comece pelo que depende de você: uma decisão, um retorno, uma reunião.'] },
    estudos: { g: 'Estudos', items: [[ic('materias'), 'Matérias'], [ic('leituras'), 'Leituras']], q: 'O que você estuda agora?', c: ['Graduação', 'Pós', 'Idiomas', 'Concurso', 'Curso livre'], empty: ['Matérias', 'Adicione a primeira matéria. As sessões aparecem no Hoje no horário escolhido.'] },
    vida: { g: 'Áreas', items: [[dot('casa'), 'Casa'], [ic('heart-pulse'), 'Saúde']], q: 'Quais áreas da vida pessoal você quer organizar?', c: ['Casa', 'Saúde', 'Finanças', 'Família'], empty: ['Casa', 'Contas, consertos, compras: o que depende de você em casa.'] },
    rotinas: { g: 'Rotinas', items: [[ic('repeat'), 'Esta semana']], q: 'Alguma rotina que você já tenta manter?', c: ['Academia', 'Leitura', 'Meditação', 'Revisar a semana'], empty: ['Rotinas', 'Diga a frequência real. Quatro vezes por semana também conta.'] },
    objetivos: { g: 'Rotas', items: [[ic('route'), 'Primeira Rota']], q: 'Qual é o primeiro destino?', c: ['Guardar dinheiro', 'Terminar um livro', 'Concluir um curso', 'Abrir um negócio'], empty: ['Primeira Rota', 'Defina onde quer chegar. O Rumo calcula o ritmo e traz o próximo passo para o Hoje.'] },
    projetos: { g: 'Áreas', items: [[ic('projetos'), 'Projetos pessoais']], q: 'Algum projeto pessoal em andamento?', c: ['Reforma', 'Viagem', 'Mudança', 'Casamento'], empty: ['Projetos pessoais', 'Um projeto tem começo e fim. Comece pelo próximo passo dele.'] }
  };
  var ONB_ORDER = ['trabalho', 'vida', 'projetos', 'negocios', 'estudos', 'rotinas', 'objetivos'];
  $$('[data-onb-root]').forEach(function (root) {
    var nav = $('[data-onb-nav]', root), follow = $('[data-onb-follow]', root), empty = $('[data-onb-empty]', root);
    var last = 'objetivos';
    function render(changed) {
      var on = $$('[data-onb]', root).filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; }).map(function (b) { return b.getAttribute('data-onb'); });
      var groups = [], byName = {};
      ONB_ORDER.forEach(function (k) {
        if (on.indexOf(k) < 0) return;
        var d = ONB[k];
        if (!byName[d.g]) { byName[d.g] = { k: d.g, t: d.g, items: [] }; groups.push(byName[d.g]); }
        byName[d.g].items = byName[d.g].items.concat(d.items.map(function (it) { return [it[0], it[1], '']; }));
      });
      var gOrder = ['Áreas', 'Negócios', 'Estudos', 'Rotinas', 'Rotas'];
      groups.sort(function (a, b) { return gOrder.indexOf(a.t) - gOrder.indexOf(b.t); });
      nav.innerHTML = sideHtml(groups, changed ? [ONB[changed].g] : null);
      var k = (changed && on.indexOf(changed) > -1) ? changed : (on.indexOf(last) > -1 ? last : on[on.length - 1]);
      if (k) {
        last = k;
        var d = ONB[k];
        follow.hidden = false;
        follow.innerHTML = '<b>' + esc(d.q) + '</b><div class="px-chips">' + d.c.map(function (c, i) { return '<span class="px-chip"' + (i === 0 ? ' style="box-shadow:inset 0 0 0 1.5px var(--px-accent);color:var(--px-accent-text)"' : '') + '>' + esc(c) + '</span>'; }).join('') + '</div>';
        empty.innerHTML = '<b>' + esc(d.empty[0]) + '</b>' + esc(d.empty[1]);
        if (!reduce) { [follow, empty].forEach(function (el) { el.classList.remove('px-in'); void el.offsetWidth; el.classList.add('px-in'); }); }
      } else {
        follow.hidden = true;
        empty.innerHTML = '<b>Só o Core</b>Hoje, Inbox, Calendário, Responsabilidades e Projetos. Módulos podem ser ativados depois.';
      }
    }
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-onb]');
      if (!b) return;
      var was = b.getAttribute('aria-pressed') === 'true';
      b.setAttribute('aria-pressed', was ? 'false' : 'true');
      render(was ? null : b.getAttribute('data-onb'));
    });
    render(null);
  });

  /* ---------- simulador de Rota ---------- */
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var NOW = new Date(2026, 9, 21);
  function brl(n) { return 'R$ ' + Math.round(n).toLocaleString('pt-BR'); }
  function addMonths(m) { var d = new Date(NOW.getFullYear(), NOW.getMonth() + m, 1); return MESES[d.getMonth()] + ' de ' + d.getFullYear(); }
  function addDays(n) { var d = new Date(NOW.getTime() + n * 864e5); return d.getDate() + ' de ' + MESES[d.getMonth()]; }
  var RT = {
    fin: {
      f: [['meta', 'Destino', 1000, 20000, 500, 5000, brl], ['tem', 'Já possui', 0, 20000, 100, 1200, brl], ['t', 'Prazo', 2, 24, 1, 8, function (v) { return v + ' meses'; }]],
      dev: 'Um mês sem depósito',
      calc: function (s) {
        var tem = Math.min(s.tem, s.meta), rest = s.meta - tem, pace = rest / s.t;
        var o = s.off || 0;
        return { title: 'Reserva de ' + brl(s.meta), meta: 'Destino · ' + addMonths(o + s.t), pct: tem / s.meta, now: brl(tem) + ' de ' + brl(s.meta), pace: brl(pace) + ' por mês', eta: addMonths(o + s.t),
          next: 'Transferir ' + brl(pace) + ' até o dia 5', nextMeta: 'Vai para o Hoje no dia 4', paceN: pace, unit: function (v) { return brl(v) + ' por mês'; } };
      },
      deviate: function (s) { if (s.t <= 1) return false; s.t -= 1; s.off = (s.off || 0) + 1; return true; },
      msg: function (o, n, s) { return 'Um mês passou sem depósito. A Rota foi recalculada: <b>' + n.pace + '</b>, mesmo destino em ' + n.eta + '. Se preferir manter ' + o.pace.replace(' por mês', '') + ', a chegada vai para ' + addMonths(s.off + s.t + 1) + '.'; }
    },
    read: {
      f: [['tot', 'Páginas do livro', 80, 800, 10, 320, function (v) { return v + ' páginas'; }], ['tem', 'Já leu', 0, 800, 5, 80, function (v) { return v + ' páginas'; }], ['t', 'Terminar em', 7, 90, 1, 30, function (v) { return v + ' dias'; }]],
      dev: 'Fiquei 5 dias sem ler',
      calc: function (s) {
        var tem = Math.min(s.tem, s.tot), rest = s.tot - tem, pace = Math.ceil(rest / s.t);
        var o = s.off || 0;
        return { title: 'Terminar o livro', meta: 'Destino · ' + addDays(o + s.t), pct: tem / s.tot, now: tem + ' de ' + s.tot + ' páginas', pace: pace + ' páginas por dia', eta: addDays(o + s.t),
          next: 'Ler ' + pace + ' páginas hoje', nextMeta: 'Sugestão: 21:00, junto com a rotina de leitura' };
      },
      deviate: function (s) { if (s.t <= 5) return false; s.t -= 5; s.off = (s.off || 0) + 5; return true; },
      msg: function (o, n) { return 'Cinco dias sem leitura. A Rota foi recalculada: <b>' + n.pace + '</b> para terminar em ' + n.eta + '. Antes eram ' + o.pace + '.'; }
    },
    course: {
      f: [['tot', 'Aulas do curso', 10, 120, 1, 60, function (v) { return v + ' aulas'; }], ['tem', 'Concluídas', 0, 120, 1, 18, function (v) { return v + ' aulas'; }], ['t', 'Terminar em', 2, 30, 1, 10, function (v) { return v + ' semanas'; }]],
      dev: 'Pulei uma semana',
      calc: function (s) {
        var tem = Math.min(s.tem, s.tot), rest = s.tot - tem, pace = Math.ceil(rest / s.t * 10) / 10;
        var per = String(pace).replace('.', ',');
        var o = s.off || 0;
        return { title: 'Concluir o curso de ' + s.tot + ' aulas', meta: 'Destino · ' + addDays((o + s.t) * 7), pct: tem / s.tot, now: rest + ' aulas restantes', pace: per + ' aulas por semana', eta: addDays((o + s.t) * 7),
          next: 'Assistir ' + Math.ceil(pace) + ' aulas esta semana', nextMeta: 'Sessões de 40 min aparecem no Hoje' };
      },
      deviate: function (s) { if (s.t <= 1) return false; s.t -= 1; s.off = (s.off || 0) + 1; return true; },
      msg: function (o, n) { return 'Uma semana sem aulas. A Rota foi recalculada: <b>' + n.pace + '</b>, mesma previsão de conclusão. Antes eram ' + o.pace + '.'; }
    }
  };
  $$('[data-rsim]').forEach(function (root) {
    var type = 'fin', state = {}, base = null;
    var fields = $('[data-rsim-fields]', root), devBtn = $('[data-rsim-dev]', root), devLabel = $('[data-rsim-dev-label]', root), resetBtn = $('[data-rsim-reset]', root), msg = $('[data-rsim-msg]', root);
    function q(k) { return $('[data-rsim-' + k + ']', root); }
    function build() {
      var cfg = RT[type];
      state = {};
      fields.innerHTML = cfg.f.map(function (f) {
        state[f[0]] = f[5]; state.off = 0;
        return '<div class="rsim__f"><label for="rs-' + f[0] + '">' + f[1] + '<output id="rs-' + f[0] + '-o">' + f[6](f[5]) + '</output></label><input type="range" id="rs-' + f[0] + '" data-k="' + f[0] + '" min="' + f[2] + '" max="' + f[3] + '" step="' + f[4] + '" value="' + f[5] + '"></div>';
      }).join('');
      devLabel.textContent = cfg.dev;
      base = null; msg.innerHTML = '';
      draw();
    }
    function sync() {
      RT[type].f.forEach(function (f) {
        var inp = $('#rs-' + f[0], root);
        inp.value = state[f[0]];
        $('#rs-' + f[0] + '-o', root).textContent = f[6](state[f[0]]);
      });
    }
    function draw() {
      var o = RT[type].calc(state);
      q('title').textContent = o.title;
      q('meta').innerHTML = '<span>' + ic('route') + esc(o.meta) + '</span>';
      q('pct').textContent = Math.round(o.pct * 100) + '%';
      q('now').textContent = o.now;
      q('pace').textContent = o.pace;
      q('eta').textContent = o.eta;
      q('next').textContent = o.next;
      q('next-meta').innerHTML = '<span>' + esc(o.nextMeta) + '</span>';
      var done = Math.min(5, Math.floor(o.pct * 5 + 1e-9)), dots = '';
      for (var i = 0; i < 6; i++) dots += '<i class="' + (i < done ? 'done' : i === done && i < 5 ? 'now' : i === 5 ? 'end' : '') + '"></i>';
      var path = q('path'); path.innerHTML = dots; path.style.setProperty('--done', (o.pct * 100) + '%');
      resetBtn.disabled = !base;
      return o;
    }
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-rsim-type]');
      if (b) { press(b.parentNode, b); type = b.getAttribute('data-rsim-type'); build(); }
    });
    root.addEventListener('input', function (e) {
      var k = e.target.getAttribute('data-k');
      if (!k) return;
      state[k] = parseFloat(e.target.value);
      if (k === 'meta' || k === 'tot') { if (state.tem > state[k]) state.tem = state[k]; }
      if (k === 'tem') { var cap = state.meta || state.tot; if (state.tem > cap) state.tem = cap; }
      base = null; msg.innerHTML = '';
      sync(); draw();
    });
    devBtn.addEventListener('click', function () {
      var before = RT[type].calc(state);
      if (!base) base = JSON.parse(JSON.stringify(state));
      if (!RT[type].deviate(state)) { msg.innerHTML = 'O prazo já está no mínimo. Aqui o Rumo sugeriria mover a data de chegada, sem marcar a Rota como perdida.'; return; }
      sync();
      var after = draw();
      msg.innerHTML = RT[type].msg(before, after, state);
    });
    resetBtn.addEventListener('click', function () {
      if (!base) return;
      state = base; base = null; msg.innerHTML = '';
      sync(); draw();
    });
    build();
  });

  /* ---------- regra de produto ---------- */
  $$('[data-rule5]').forEach(function (root) {
    var out = $('[data-rule5-out]', root), touched = false;
    root.addEventListener('click', function (e) {
      var b = e.target.closest('.rule5__qs button');
      if (!b) return;
      touched = true;
      b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      var n = $$('.rule5__qs button[aria-pressed="true"]', root).length;
      out.classList.toggle('is-in', n > 0);
      out.textContent = n === 0
        ? 'Nenhum “sim”. Provavelmente não pertence ao Rumo.'
        : 'Responde “sim” a ' + n + ' de 5. Pode pertencer ao Rumo. Próxima pergunta: em qual camada ela aparece, sem pesar no Hoje?';
    });
  });
})();
