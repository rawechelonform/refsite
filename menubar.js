// Usage in each page:
//
// <link rel="stylesheet" href="/menubar.css">
// <div data-menubar class="menubar-slot"></div>
// <script src="/menubar-inject.js" defer></script>

(function () {
  async function injectMenu() {
    if (document.body.hasAttribute('data-no-menubar')) return;

    const slot = document.querySelector('[data-menubar]');
    if (!slot) return;

    try {
      const res = await fetch('/menubar.html?v=7', { cache: 'no-cache' });
      if (!res.ok) return;

      const html = await res.text();

      const tmp = document.createElement('div');
      tmp.innerHTML = html.trim();

      const menuRoot = tmp.querySelector('.top-margin') || tmp.firstElementChild;
      if (menuRoot) slot.replaceWith(menuRoot);

      normalizeMenuHrefs();
      highlightCurrentNav();
    } catch (_) {
      /* ignore */
    }
  }

  function normalizeMenuHrefs() {
    document.querySelectorAll('.menu a.menu-link').forEach(a => {
      const href = a.getAttribute('href') || '';
      if (!href) return;
      if (/^https?:\/\//i.test(href)) return;
      if (!href.startsWith('/')) a.setAttribute('href', '/' + href.replace(/^\/+/, ''));
    });
  }

  function highlightCurrentNav() {
    let path = location.pathname;
    if (path.endsWith('/')) path = 'index.html';
    else path = path.split('/').pop() || 'index.html';

    if (path === 'index.html') path = 'main.html';

    document.querySelectorAll('.menu a.menu-link').forEach(a => {
      const hrefFile = (a.getAttribute('href') || '').split('/').pop();
      const isCurrent = hrefFile === path;

      a.classList.toggle('is-current', isCurrent);
      if (isCurrent) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectMenu);
  } else {
    injectMenu();
  }
})();
