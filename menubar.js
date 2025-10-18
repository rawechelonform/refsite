// Usage in each page:
//
// <meta name="viewport" content="width=device-width, initial-scale=1" />
// <link rel="stylesheet" href="menubar.css?v=mb8">
// <div data-menubar class="menubar-slot"></div>
// <script src="menubar.js?v=mb8" defer></script>

(function () {
  async function injectMenu() {
    const slot = document.querySelector('[data-menubar]');
    if (!slot) return;

    try {
      // Cache-bust so phones pull the latest HTML
      const res = await fetch(`menubar.html?v=mb8&t=${Date.now()}`, { cache: 'no-cache' });
      if (!res.ok) return;

      const tmp = document.createElement('div');
      tmp.innerHTML = (await res.text()).trim();

      const menuRoot = tmp.querySelector('.top-margin') || tmp.firstElementChild;
      if (menuRoot) slot.replaceWith(menuRoot);

      normalizeMenuHrefs();       // compute safe absolute targets per current folder
      highlightCurrentNav();      // add .is-current + aria-current
      forceAbsoluteNavigation();  // single captured click handler (robust on mobile)
      twoLinePrincipalOnPhones(); // wrap the long label on phones
    } catch (_) { /* ignore */ }
  }

  // Compute absolute targets relative to the *current folder* (prevents root-bounce on GH Pages)
  function normalizeMenuHrefs() {
    // Project folder of the current page (e.g. /refsite/)
    const ROOT = location.pathname.replace(/[^/]+$/, '');

    document.querySelectorAll('.menu a.menu-link').forEach(a => {
      const raw = (a.getAttribute('href') || '').trim();
      if (!raw) return;

      // External stays as-is; internal is resolved against the current folder
      const abs = /^https?:\/\//i.test(raw)
        ? raw
        : new URL(raw, location.origin + ROOT).href;

      // Optional tiny cache-bust so stubborn mobile caches re-resolve
      const u = new URL(abs);
      if (!/^https?:\/\//i.test(raw)) u.searchParams.set('mb', 'sgfix2');

      a.dataset.abs = u.href;
      a.setAttribute('target', '_self');
      a.setAttribute('rel', 'noopener');
    });
  }

  // Use ONE captured click; avoid pointerdown/touchend races on iOS
  function forceAbsoluteNavigation() {
    document.querySelectorAll('.menu a.menu-link').forEach(a => {
      a.addEventListener('click', ev => {
        // allow modifier/middle clicks on desktop
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button > 0) return;

        const url = a.dataset.abs || a.href;
        if (!url) return;

        ev.preventDefault();
        ev.stopPropagation();

        // single reliable path
        window.location.href = url;
      }, { capture: true });
    });
  }

  // Highlight the current page in the menu
  function highlightCurrentNav() {
    let path = location.pathname;
    if (path.endsWith('/')) path = 'index.html';
    else path = path.split('/').pop() || 'index.html';
    if (path === 'index.html') path = 'main.html'; // treat index as main

    document.querySelectorAll('.menu a.menu-link').forEach(a => {
      const hrefFile = (a.getAttribute('href') || '').split('/').pop();
      const isCurrent = hrefFile === path;
      a.classList.toggle('is-current', isCurrent);
      if (isCurrent) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  // Force “PRINCIPAL’S OFFICE” to wrap on phones
  function twoLinePrincipalOnPhones() {
    if (window.innerWidth > 480) return;
    const a = Array.from(document.querySelectorAll('.menu a.menu-link'))
      .find(x => (x.getAttribute('href') || '').endsWith('aboutme.html'));
    if (!a) return;
    const txt = (a.textContent || '').trim();
    if (!a.innerHTML.includes('<br>')) {
      a.innerHTML = txt.replace(/(PRINCIPAL[’']?S)\s+(OFFICE)/i, '$1<br>$2');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectMenu);
  } else {
    injectMenu();
  }
})();
