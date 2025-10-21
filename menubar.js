// menubar.js (v=mb10)
// Include on every page like:
//   <link rel="stylesheet" href="menubar.css?v=mb9">
//   <script src="menubar.js?v=mb9" defer></script>

(function () {
  const VER = 'mb11';

  async function injectMenu() {
    const slot = document.querySelector('[data-menubar]');
    if (!slot) return;

    try {
      // Only cache-bust the fragment itself
      const res = await fetch(`/menubar.html?v=${VER}&t=${Date.now()}`, { cache: 'no-cache' });
      if (!res.ok) return;

      const tmp = document.createElement('div');
      tmp.innerHTML = (await res.text()).trim();

      const menuRoot = tmp.querySelector('.top-margin') || tmp.firstElementChild;
      if (menuRoot) slot.replaceWith(menuRoot);

      normalizeMenuHrefsRootAbsolute();
      highlightCurrentNav();
      twoLinePrincipalOnPhones();
    } catch (_) { /* ignore */ }
  }


  // Ensure all internal hrefs are root-absolute and contain no query params
  function normalizeMenuHrefsRootAbsolute() {
    document.querySelectorAll('.menu a.menu-link').forEach(a => {
      const raw = (a.getAttribute('href') || '').trim();
      if (!raw) return;

      // External: leave as-is
      if (/^https?:\/\//i.test(raw)) return;

      // Trim any accidental dots or query/hash from old versions
      const clean = raw
        .replace(/\?.*$/, '')     // drop ?mb=...
        .replace(/#.*$/, '')      // drop hashes
        .replace(/\.+$/, '');     // drop trailing dots like "aboutme.."

      // Build root-absolute
      const rootAbs = clean.startsWith('/') ? clean : `/${clean}`;

      a.setAttribute('href', rootAbs);
      a.removeAttribute('target'); // let normal navigation happen
      a.removeAttribute('rel');
      // Important: DO NOT append any cache-busting to page URLs
    });
  }


  // Extra safety: ensure SAD GIRLS points to folder-relative sadgirls.html (no leading slash)
  function pinSadGirlsHref() {
    const link = Array.from(document.querySelectorAll('.menu a.menu-link'))
      .find(a => (a.textContent || '').toUpperCase().includes('SAD GIRLS'));
    if (!link) return;

    // Force its display href (what highlight uses) to be relative (no slash)
    link.setAttribute('href', 'sadgirls.html');

    // Recompute dataset.abs from the current folder
    const ROOT = location.pathname.replace(/[^/]*$/, '');
    const abs = new URL('sadgirls.html', location.origin + ROOT);
    abs.searchParams.set('mb', 'mb10');
    link.dataset.abs = abs.href;
  }

  // One captured click handler → wins over weird touch sequences on iOS
  function forceAbsoluteNavigation() {
    document.querySelectorAll('.menu a.menu-link').forEach(a => {
      a.addEventListener('click', ev => {
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button > 0) return;
        const url = a.dataset.abs || a.href;
        if (!url) return;
        ev.preventDefault();
        ev.stopPropagation();
        window.location.href = url;
      }, { capture: true });
    });
  }

  function highlightCurrentNav() {
    // file part of the current path (treat / or /index.html as /main.html if that's your home)
    let file = location.pathname.split('/').pop() || 'index.html';
    if (file === 'index.html') file = 'main.html';

    document.querySelectorAll('.menu a.menu-link').forEach(a => {
      const hrefPath = (a.getAttribute('href') || '').split('?')[0].split('#')[0];
      const hrefFile = hrefPath.split('/').pop() || '';
      const isCurrent = hrefFile === file;
      a.classList.toggle('is-current', isCurrent);
      if (isCurrent) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

   function twoLinePrincipalOnPhones() {
    if (window.innerWidth > 480) return;
    const a = Array.from(document.querySelectorAll('.menu a.menu-link'))
      .find(x => (x.getAttribute('href') || '').endsWith('/aboutme.html') || (x.getAttribute('href') || '').endsWith('aboutme.html'));
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