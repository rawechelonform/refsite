// /menubar.js (v=mb15)
// Usage on every page:
//   <link rel="stylesheet" href="/menubar.css?v=mb15">
//   <script src="/menubar.js?v=mb16" defer></script>

(function () {
  const VER = 'mb16';

  async function injectMenu() {
    const slot = document.querySelector('[data-menubar]');
    if (!slot) return;

    try {
      // Fetch the fragment root-absolute; cache-bust the fragment only
      const res = await fetch(`/menubar.html?v=${VER}&t=${Date.now()}`, { cache: 'no-cache' });
      if (!res.ok) return;

      const tmp = document.createElement('div');
      tmp.innerHTML = (await res.text()).trim();

      const menuRoot = tmp.querySelector('.top-margin') || tmp.firstElementChild;
      if (menuRoot) slot.replaceWith(menuRoot);

      normalizeMenuHrefsRootAbsolute();
      highlightCurrentNav();
      twoLinePrincipalOnPhones();
    } catch (_) {}
  }

  // Ensure internal hrefs are root-absolute and clean (no queries, no trailing dots)
  function normalizeMenuHrefsRootAbsolute() {
    document.querySelectorAll('.menu a.menu-link').forEach(a => {
      const raw = (a.getAttribute('href') || '').trim();
      if (!raw) return;

      // External links untouched
      if (/^https?:\/\//i.test(raw)) return;

      const clean = raw
        .replace(/\?.*$/, '')   // remove query params
        .replace(/#.*$/, '')    // remove hash
        .replace(/\.+$/, '');   // remove trailing dots like "aboutme.."

      const rootAbs = clean.startsWith('/') ? clean : `/${clean}`;
      a.setAttribute('href', rootAbs);

      // Keep anchors plain; no dataset.abs, no forced navigation
      a.removeAttribute('target');
      a.removeAttribute('rel');
    });
  }

  // Mark the current page in the menu (treat / or /index.html as /main.html)
  function highlightCurrentNav() {
    let file = location.pathname.split('/').pop() || 'index.html';
    if (file === 'index.html') file = 'main.html';

    document.querySelectorAll('.menu a.menu-link').forEach(a => {
      const href = (a.getAttribute('href') || '').split('?')[0].split('#')[0];
      const hrefFile = href.split('/').pop() || '';
      const isCurrent = hrefFile === file;
      a.classList.toggle('is-current', isCurrent);
      if (isCurrent) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  // On phones, split "PRINCIPAL’S OFFICE" across two lines for readability
  function twoLinePrincipalOnPhones() {
    if (window.innerWidth > 480) return;
    const a = Array.from(document.querySelectorAll('.menu a.menu-link'))
      .find(x => {
        const h = x.getAttribute('href') || '';
        return h.endsWith('/aboutme.html') || h.endsWith('aboutme.html');
      });
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
