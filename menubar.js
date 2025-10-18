// Usage in each page:
//
// <meta name="viewport" content="width=device-width, initial-scale=1" />
// <link rel="stylesheet" href="/menubar.css?v=routefix2">
// <div data-menubar class="menubar-slot"></div>
// <script src="/menubar.js?v=routefix2" defer></script>

(function () {
  async function injectMenu() {
    const slot = document.querySelector('[data-menubar]');
    if (!slot) return;

    try {
      // cache-bust so phones pull the latest HTML
      const res = await fetch(`/menubar.html?v=routefix2&t=${Date.now()}`, { cache: 'no-cache' });
      if (!res.ok) return;

      const tmp = document.createElement('div');
      tmp.innerHTML = (await res.text()).trim();

      const menuRoot = tmp.querySelector('.top-margin') || tmp.firstElementChild;
      if (menuRoot) slot.replaceWith(menuRoot);

      normalizeMenuHrefs();
      highlightCurrentNav();
      forceAbsoluteNavigation();   // ← fixes "SAD GIRLS → main.html" on mobile
      twoLinePrincipalOnPhones();  // keep the two-line label on phones
    } catch (_) { /* ignore */ }
  }

// Make internal hrefs consistent and store a safe absolute target
function normalizeMenuHrefs() {
  document.querySelectorAll('.menu a.menu-link').forEach(a => {
    const raw = (a.getAttribute('href') || '').trim();
    if (!raw) return;

    if (/^https?:\/\//i.test(raw)) {
      // external stays as-is
      a.dataset.abs = raw;
    } else {
      // keep relative path; compute absolute safely from the current page
      a.dataset.abs = new URL(raw, document.baseURI).href;
    }

    // ensure normal in-tab nav
    a.setAttribute('target', '_self');
    a.setAttribute('rel', 'noopener');
  });
}

// Explicitly navigate to the absolute URL on click (capture to beat stray overlays)
function forceAbsoluteNavigation() {
  const links = document.querySelectorAll('.menu a.menu-link');

  links.forEach(a => {
    a.addEventListener('click', ev => {
      // allow modifier/middle clicks on desktop 
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button > 0) return;

      const url = a.dataset.abs || a.href;
      if (!url) return;

      ev.preventDefault();
      ev.stopPropagation();

      // tiny one-time debug log; comment out if you prefer
      try { console.log('[menubar] nav ->', url); } catch {}

      // single, reliable navigation path (prevents falling back to wrong page)
      window.location.href = url;
    }, { capture: true });
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
