/* Copiar valores (HEX, RGB, tokens, SVG) com confirmação discreta */
(function () {
  'use strict';
  var toast = document.getElementById('doc-toast');
  var timer;
  function show(msg) {
    if (!toast) return;
    toast.querySelector('span').textContent = msg;
    toast.classList.add('is-on');
    clearTimeout(timer);
    timer = setTimeout(function () { toast.classList.remove('is-on'); }, 1800);
  }
  window.RumoToast = show;

  function fallback(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.opacity = '0'; ta.style.left = '-9999px';
    document.body.appendChild(ta); ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function done(btn, label) {
    btn.classList.add('is-done');
    show(label);
    setTimeout(function () { btn.classList.remove('is-done'); }, 1400);
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copy], [data-copy-target], [data-copy-tpl]');
    if (!btn) return;
    var text = btn.getAttribute('data-copy');
    if (text == null && btn.hasAttribute('data-copy-target')) {
      var el = document.getElementById(btn.getAttribute('data-copy-target'));
      text = el ? el.textContent : '';
    }
    if (text == null && btn.hasAttribute('data-copy-tpl')) {
      var tpl = document.getElementById(btn.getAttribute('data-copy-tpl'));
      text = tpl ? tpl.textContent : '';
    }
    if (!text) return;
    var short = text.length > 40 ? 'Copiado' : 'Copiado: ' + text;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(btn, short); }, function () {
        if (fallback(text)) done(btn, short); else show('Não foi possível copiar. Selecione o texto e use Ctrl+C.');
      });
    } else if (fallback(text)) done(btn, short);
    else show('Não foi possível copiar. Selecione o texto e use Ctrl+C.');
  });
})();
