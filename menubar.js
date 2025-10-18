// Usage in each page:
//
// <meta name="viewport" content="width=device-width, initial-scale=1" />
// <link rel="stylesheet" href="/menubar.css?v=routefix">
// <div data-menubar class="menubar-slot"></div>
// <script src="/menubar-inject.js?v=routefix" defer></script>

(function () {
  async function injectMenu() {
    if (document.body.hasAttribute('data-no-menubar')) return;

    const slot = document.querySelector('[data-menubar]');
    if (!slot) return;

    try {
      // cache-bust so phones don’t serve the old HTML
      const res = await fetch(`/menubar.html?v=routefix&t=${Date.now()}`, { cache: 'no-cache' });
      if (!res.ok) return;

      const tmp = document.createElement('div');
      tmp.innerHTML = (await res.text()).trim();

      const menuRoot = tmp.querySelector('.top-margin') || tmp.firstElementChild;
      if (menuRoot) slot.replaceWith(menuRoot);

      normalizeMenuHrefs();
      highlightCurrentNav();
      forceAbsoluteNavigation();   // <- key fix
      twoLinePrincipalOnPhones();  // keep your 2-line label on mobile
    } catch (_) { /* ignore */ }
  }

  // Make internal hrefs root-absolute and store the absolute target
  function normalizeMenuHrefs() {
    document.querySelectorAll('.menu a.menu-link').forEach(a => {
      const raw = (a.getAttribute('href') || '').trim();
      if (!raw) return;
      if (/^https?:\/\//i.test(raw)) return; // external

      const clean = '/' + raw.replace(/^\/+/, '');
      a.setAttribute('href', clean);
      a.dataset.abs = new URL(clean, location.origin).href;
      a.setAttribute('rel', 'noopener');
    });
  }

  // On mobile, explicitly navigate to the absolute URL on pointerdown/click
  function forceAbsoluteNavigation() {
    const links = document.querySelectorAll('.menu a.menu-link');
    links.forEach(a => {
      const go = ev => {
        // allow modifier/middle clicks to behave on desktop
        if (ev.type === 'click' && (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button > 0)) return;

        const url = a.dataset.abs || a.href;
        if (!url) return;

        ev.preventDefault();
        ev.stopPropagation();
        window.location.assign(url);  // no chance to fall back to main.html
      };

      // capture phase ensures we win against stray overlays
      a.addEventListener('pointerdown', go, { capture: true });
      a.addEventListener('touchend', go, { passive: false, capture: true });
      a.addEventListener('click', go, { capture: true });
    });
  }

  // Keep highlight logic
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

  // Force PRINCIPAL’S OFFICE to wrap on phones
  function twoLinePrincipalOnPhones() {
    if (window.innerWidth > 480) return;
    const a = document.querySelector('.menu a[href="/aboutme.html"]');
    if (!a) return;
    const txt = (a.textContent || '').trim();
    if (a.innerHTML.includes('<br>')) return;
    a.innerHTML = txt.replace(/(PRINCIPAL[’']?S)\s+(OFFICE)/i, '$1<br>$2');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectMenu);
  } else {
    injectMenu();
  }
})();
