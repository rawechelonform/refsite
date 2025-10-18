// menubar.js (v=mb10)
// Include on every page like:
//   <link rel="stylesheet" href="menubar.css?v=mb9">
//   <script src="menubar.js?v=mb9" defer></script>

(function () {
  async function injectMenu() {
    const slot = document.querySelector('[data-menubar]');
    if (!slot) return;

    try {
      // Hard cache-bust the fragment itself
      const res = await fetch(`menubar.html?v=mb9&t=${Date.now()}`, { cache: 'no-cache' });

      if (!res.ok) return;

      const tmp = document.createElement('div');
      tmp.innerHTML = (await res.text()).trim();

      const menuRoot = tmp.querySelector('.top-margin') || tmp.firstElementChild;
      if (menuRoot) slot.replaceWith(menuRoot);

      normalizeMenuHrefs();
      pinSadGirlsHref();          // ensure no accidental leading slash persists
      forceAbsoluteNavigation();  // robust on mobile (one captured click)
      highlightCurrentNav();
      twoLinePrincipalOnPhones();
    } catch (_) { /* ignore */ }
  }

  // Resolve all internal links relative to the *current folder* (…/refsite/)
  function normalizeMenuHrefs() {
    const ROOT = location.pathname.replace(/[^/]*$/, ''); // drop file part

    document.querySelectorAll('.menu a.menu-link').forEach(a => {
      const raw = (a.getAttribute('href') || '').trim();
      if (!raw) return;

      // external as-is; internal: resolve against current folder
      const abs = /^https?:\/\//i.test(raw)
        ? raw
        : new URL(raw, location.origin + ROOT).href;

      // add a tiny cache-bust so stubborn mobile caches re-resolve the target
      const u = new URL(abs);
      if (!/^https?:\/\//i.test(raw)) u.searchParams.set('mb', 'mb10');

      a.dataset.abs = u.href;
      a.setAttribute('target', '_self');
      a.setAttribute('rel', 'noopener');
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

  function twoLinePrincipalOnPhones() {
    if (window.innerWidth > 480) return;
    const a = Array.from(document.querySelectorAll('.menu a.menu-link'))
      .find(x => (x.getAttribute('href') || '').endsWith('aboutme.html'));
    if (!a) return;
    const txt = (a.textContent || '').trim();
    if (!a.innerHTML.includes('<br>')) {
      // add a tiny 1px spacer row via ::after (CSS below)
      a.innerHTML = txt.replace(/(PRINCIPAL[’']?S)\s+(OFFICE)/i, '$1<br>$2');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectMenu);
  } else {
    injectMenu();
  }
})();
