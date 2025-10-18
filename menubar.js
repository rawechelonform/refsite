// Usage in each page:
//
// <meta name="viewport" content="width=device-width, initial-scale=1" />
// <link rel="stylesheet" href="/menubar.css?v=force-nav-1">
// <div data-menubar class="menubar-slot"></div>
// <script src="/menubar-inject.js?v=force-nav-1" defer></script>

(function () {
  async function injectMenu() {
    if (document.body.hasAttribute('data-no-menubar')) return;

    const slot = document.querySelector('[data-menubar]');
    if (!slot) return;

    try {
      const res = await fetch(`/menubar.html?v=force-nav-1&t=${Date.now()}`, { cache: 'no-cache' });
      if (!res.ok) return;

      const html = await res.text();
      const tmp = document.createElement('div');
      tmp.innerHTML = html.trim();

      const menuRoot = tmp.querySelector('.top-margin') || tmp.firstElementChild;
      if (menuRoot) slot.replaceWith(menuRoot);

      normalizeMenuHrefs();
      highlightCurrentNav();
      forceAbsoluteNavigation();  // fixes "SAD GIRLS → main.html" on mobile
      untrapOverlaps();           // disable any overlapping hero/header at the very top
    } catch (_) {
      /* ignore */
    }
  }

  // normalize every href to root-absolute and cache absolute URL
  function normalizeMenuHrefs() {
    document.querySelectorAll('.menu a.menu-link').forEach(a => {
      const raw = (a.getAttribute('href') || '').trim();
      if (!raw) return;
      if (/^https?:\/\//i.test(raw)) return;
      const clean = '/' + raw.replace(/^\/+/, '');
      a.setAttribute('href', clean);
      a.dataset.abs = new URL(clean, location.origin).href;
    });
  }

  // explicitly navigate to each link's absolute URL on tap/click
  function forceAbsoluteNavigation() {
    const links = document.querySelectorAll('.menu a.menu-link');
    links.forEach(a => {
      const go = ev => {
        // let modifier-clicks behave normally on desktop
        if (ev.type === 'click' && (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button > 0)) return;
        const url = a.dataset.abs || a.href;
        if (!url) return;
        ev.preventDefault();
        ev.stopPropagation();
        window.location.href = url;   // hard navigate to exact target
      };
      a.addEventListener('touchend', go, { passive: false, capture: true }); // beats ghost overlays
      a.addEventListener('click', go, { capture: true });
    });
  }

  // if a hero image or sticky header overlaps the top 1–2 rows of pixels, disable its hit-test
  function untrapOverlaps() {
    const pts = [[8, 8], [window.innerWidth - 8, 8], [window.innerWidth / 2, 8]];
    pts.forEach(([x, y]) => {
      const stack = document.elementsFromPoint(x, y);
      for (const el of stack) {
        if (el.closest('.top-margin')) break; // our bar is visible here
        if (el === document.documentElement || el === document.body) continue;
        // if it's above us, turn off hit testing
        const z = parseInt(getComputedStyle(el).zIndex) || 0;
        if (z >= 4) el.style.pointerEvents = 'none';
      }
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
