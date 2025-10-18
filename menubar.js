// Usage in each page:
//
// <meta name="viewport" content="width=device-width, initial-scale=1" />
// <link rel="stylesheet" href="/menubar.css">
// <div data-menubar class="menubar-slot"></div>
// <script src="/menubar-inject.js" defer></script>

(function () {
  async function injectMenu() {
    if (document.body.hasAttribute('data-no-menubar')) return;

    const slot = document.querySelector('[data-menubar]');
    if (!slot) return;

    try {
      // Stronger cache-bust: version + timestamp
      const res = await fetch(`/menubar.html?v=10&t=${Date.now()}`, { cache: 'no-cache' });
      if (!res.ok) return;

      const html = await res.text();
      const tmp = document.createElement('div');
      tmp.innerHTML = html.trim();

      const menuRoot = tmp.querySelector('.top-margin') || tmp.firstElementChild;
      if (menuRoot) slot.replaceWith(menuRoot);

      normalizeMenuHrefs();
      highlightCurrentNav();
      hardenClicks();
    } catch (_) {
      /* ignore */
    }
  }

  function normalizeMenuHrefs() {
    document.querySelectorAll('.menu a.menu-link').forEach(a => {
      const raw = (a.getAttribute('href') || '').trim();
      if (!raw) return;

      // leave external links alone
      if (/^https?:\/\//i.test(raw)) return;

      // normalize to root-absolute path
      const clean = '/' + raw.replace(/^\/+/, '');
      a.setAttribute('href', clean);

      // also store the absolute URL we want to navigate to
      a.dataset.abs = new URL(clean, location.origin).href;
    });
  }

  function hardenClicks() {
    const links = document.querySelectorAll('.menu a.menu-link');
    links.forEach(a => {
      const go = ev => {
        // if keyboard activated or right/middle click, let default happen
        if (ev.type === 'click' && (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button > 0)) return;

        const targetHref = a.dataset.abs || a.href;
        if (!targetHref) return;

        ev.preventDefault();
        ev.stopPropagation();
        // Navigate explicitly to the absolute URL
        location.assign(targetHref);
      };

      // Prefer touchend on mobile to avoid ghost clicks
      a.addEventListener('touchend', go, { passive: false });
      a.addEventListener('click', go);
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
