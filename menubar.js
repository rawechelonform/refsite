// menubar.js
(function () {
  const VER = 'mb22';

  async function injectMenu() {
    const slot = document.querySelector('[data-menubar]');
    if (!slot) return;

    try {
      const res = await fetch(`menubar.html?v=${VER}&t=${Date.now()}`, { cache: 'no-cache' });
      if (!res.ok) return;

      const tmp = document.createElement('div');
      tmp.innerHTML = (await res.text()).trim();
      const menuRoot = tmp.querySelector('.top-margin') || tmp.firstElementChild;
      if (menuRoot) slot.replaceWith(menuRoot);

      normalizeMenuHrefsStrict();
      highlightCurrentNav();
      twoLinePrincipalOnPhones();
    } catch (_) {}
  }

  // Make every href a clean, project-relative file path (e.g. "sadgirls.html")
  function normalizeMenuHrefsStrict() {
    const baseDir = location.pathname.replace(/[^/]*$/, ''); // current dir with trailing slash
    document.querySelectorAll('.menu a.menu-link').forEach(a => {
      let raw = (a.getAttribute('href') || '').trim();
      if (!raw) return;
      if (/^https?:\/\//i.test(raw)) return; // external

      const file = raw.replace(/^\/+/, '').split('/').pop();
      const safeFile = /\.[a-z0-9]+$/i.test(file) ? file : `${file}.html`;
      a.setAttribute('href', safeFile);
      a.dataset.abs = new URL(safeFile, `${location.origin}${baseDir}`).href;
      a.setAttribute('target', '_self');
      a.setAttribute('rel', 'noopener');
    });
  }

  function highlightCurrentNav() {
    let file = location.pathname.split('/').pop() || 'index.html';
    if (file === 'index.html') file = 'main.html';
    document.querySelectorAll('.menu a.menu-link').forEach(a => {
      const hrefFile = (a.getAttribute('href') || '').split('?')[0].split('#')[0].split('/').pop();
      const isCurrent = hrefFile === file;
      a.classList.toggle('is-current', isCurrent);
      if (isCurrent) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  function twoLinePrincipalOnPhones() {
    if (window.innerWidth > 480) return;
    const a = Array.from(document.querySelectorAll('.menu a.menu-link'))
      .find(x => (x.getAttribute('href') || '').toLowerCase().endsWith('aboutme.html'));
    if (!a) return;
    const txt = (a.textContent || '').trim();
    if (!a.innerHTML.includes('<br>')) {
      a.innerHTML = txt.replace(/(PRINCIPAL[’']?S)\s+(OFFICE)/i, '$1<br>$2');
    }
    a.style.textAlign = 'center';
    a.style.justifyItems = 'center';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectMenu);
  } else {
    injectMenu();
  }
})();
