// Usage in each page:
//
// <meta name="viewport" content="width=device-width, initial-scale=1" />
// <link rel="stylesheet" href="/menubar.css?v=mobilefix1">
// <div data-menubar class="menubar-slot"></div>
// <script src="/menubar-inject.js?v=mobilefix1" defer></script>

(function () {
  async function injectMenu() {
    if (document.body.hasAttribute('data-no-menubar')) return;

    const slot = document.querySelector('[data-menubar]');
    if (!slot) return;

    try {
      // hard cache-bust
      const res = await fetch(`/menubar.html?v=mobilefix1&t=${Date.now()}`, { cache: 'no-cache' });
      if (!res.ok) return;

      const html = await res.text();
      const tmp = document.createElement('div');
      tmp.innerHTML = html.trim();

      const menuRoot = tmp.querySelector('.top-margin') || tmp.firstElementChild;
      if (menuRoot) slot.replaceWith(menuRoot);

      normalizeMenuHrefs();
      highlightCurrentNav();
      hardenClicks();          // force correct navigation on mobile taps
      neutralizeOverlaps();    // stop top-of-page images/headers from stealing taps
    } catch (_) {
      /* ignore */
    }
  }

  // make all menu hrefs root-absolute and store absolute targets
  function normalizeMenuHrefs() {
    document.querySelectorAll('.menu a.menu-link').forEach(a => {
      const raw = (a.getAttribute('href') || '').trim();
      if (!raw) return;
      if (/^https?:\/\//i.test(raw)) return; // external

      const clean = '/' + raw.replace(/^\/+/, '');
      a.setAttribute('href', clean);
      a.dataset.abs = new URL(clean, location.origin).href;
    });
  }

  // on mobile, explicitly navigate to absolute URL so nothing reroutes to main.html
  function hardenClicks() {
    const links = document.querySelectorAll('.menu a.menu-link');
    links.forEach(a => {
      const go = ev => {
        if (ev.type === 'click' && (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button > 0)) return;
        const targetHref = a.dataset.abs || a.href;
        if (!targetHref) return;
        ev.preventDefault();
        ev.stopPropagation();
        location.href = targetHref;
      };
      a.addEventListener('touchend', go, { passive: false, capture: true });
      a.addEventListener('click', go, { capture: true });
    });
  }

  // if a big hero image or header overlaps the bar, disable its hit-testing
  function neutralizeOverlaps() {
    // Any element that visually covers the very top 40px should not intercept taps
    const topElements = document.elementsFromPoint(10, 10);
    topElements.forEach(el => {
      if (!el.closest('.top-margin') && el !== document.documentElement && el !== document.body) {
        // apply only if it sits above the bar
        const z = parseInt(getComputedStyle(el).zIndex) || 0;
        if (z >= 2147483647 - 1) {
          el.style.pointerEvents = 'none';
        }
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
