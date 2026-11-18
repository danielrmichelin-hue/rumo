/* Demonstrações de movimento (capítulo 13) */
(function () {
  'use strict';
  var STD = 'cubic-bezier(0.2, 0, 0, 1)', ENTER = 'cubic-bezier(0, 0, 0, 1)';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function anim(el, frames, opts) {
    if (!el.animate) return;
    if (reduce) opts.duration = 1;
    return el.animate(frames, Object.assign({ fill: 'forwards' }, opts));
  }
  var demos = {
    hover: function (el) {
      anim(el, [{ background: '#FFFFFF', color: '#2B1E4B' }, { background: '#F3EEFC', color: '#2B1E4B' }], { duration: 120, easing: STD });
      setTimeout(function () { anim(el, [{ background: '#F3EEFC' }, { background: '#FFFFFF' }], { duration: 120, easing: STD }); }, 900);
    },
    select: function (el) {
      anim(el, [{ background: '#FFFFFF', borderColor: '#E6E2EA', color: '#2B1E4B' }, { background: '#EBE3FA', borderColor: '#DCCEF6', color: '#4B31AE' }], { duration: 180, easing: STD });
      setTimeout(function () { anim(el, [{ background: '#EBE3FA', borderColor: '#DCCEF6', color: '#4B31AE' }, { background: '#FFFFFF', borderColor: '#E6E2EA', color: '#2B1E4B' }], { duration: 180, easing: STD }); }, 1200);
    },
    expand: function (el) {
      var extra = el.querySelector('.mdemo__extra');
      if (!extra) {
        extra = document.createElement('span');
        extra.className = 'mdemo__extra'; extra.style.cssText = 'font-size:11px;color:#5F586B;display:block';
        extra.textContent = 'Projeto · Prazo · Origem';
        el.appendChild(extra);
      }
      extra.hidden = false;
      anim(extra, [{ opacity: 0, transform: 'translateY(-4px)', maxHeight: '0px' }, { opacity: 1, transform: 'none', maxHeight: '20px' }], { duration: 180, easing: STD });
      setTimeout(function () {
        var a = anim(extra, [{ opacity: 1, maxHeight: '20px' }, { opacity: 0, maxHeight: '0px' }], { duration: 180, easing: STD });
        if (a) a.onfinish = function () { extra.hidden = true; };
      }, 1400);
    },
    panel: function (el) {
      anim(el, [{ transform: 'translateX(12px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 240, easing: ENTER });
    },
    done: function (el) {
      var chk = el.querySelector('[data-chk]'), txt = el.querySelector('[data-txt]');
      anim(chk, [{ background: '#FFFFFF', borderColor: '#BDB4CC' }, { background: '#6C4ED9', borderColor: '#6C4ED9' }], { duration: 180, easing: STD });
      anim(txt, [{ color: '#2B1E4B', textDecorationColor: 'transparent' }, { color: '#8C8597', textDecorationColor: '#BDB4CC' }], { duration: 180, easing: STD });
      txt.style.textDecoration = 'line-through';
      setTimeout(function () {
        anim(chk, [{ background: '#6C4ED9' }, { background: '#FFFFFF', borderColor: '#BDB4CC' }], { duration: 120, easing: STD });
        anim(txt, [{ color: '#8C8597' }, { color: '#2B1E4B', textDecorationColor: 'transparent' }], { duration: 120, easing: STD });
      }, 1400);
    },
    state: function (el) {
      var b = el.querySelector('[data-badge]');
      var a = anim(b, [{ opacity: 1 }, { opacity: 0 }], { duration: 60, easing: STD });
      setTimeout(function () {
        b.className = 'ui-badge ui-badge--success'; b.textContent = 'Concluída';
        anim(b, [{ opacity: 0 }, { opacity: 1 }], { duration: 60, easing: STD });
      }, reduce ? 0 : 60);
      setTimeout(function () { b.className = 'ui-badge ui-badge--warning'; b.textContent = 'Pendente'; }, 1600);
    }
  };
  document.addEventListener('click', function (e) {
    var p = e.target.closest('[data-motion]'); if (!p) return;
    var k = p.getAttribute('data-motion');
    var el = document.querySelector('[data-motion-el="' + k + '"]');
    if (el && demos[k]) demos[k](el);
  });

  var cmp = document.getElementById('compare-play');
  if (cmp) cmp.addEventListener('click', function () {
    var tracks = document.querySelectorAll('[data-compare]');
    tracks.forEach(function (t) { t.classList.remove('run'); void t.offsetWidth; });
    requestAnimationFrame(function () { tracks.forEach(function (t) { t.classList.add('run'); }); });
    setTimeout(function () { tracks.forEach(function (t) { t.classList.remove('run'); }); }, 2600);
  });
})();
