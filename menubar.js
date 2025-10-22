// Usage on every page:
//   <link rel="stylesheet" href="menubar.css?v=mb20">
//   <script src="menubar.js?v=mb20" defer></script>

(function () {
  const VER = 'mb20';

  async function injectMenu() {
    const slot = document.querySelector('[data-menubar]');
    if (!slot) return;

    try {
      // Fetch the fragment with cache-buster
      const res = await fetch(`menubar.html?v=${VER}&t=${Date.now()}`, { cache: 'no-cache' });
      if (!res.ok) return;

      const tmp = document.createElement('div');
      tmp.innerHTML = (await res.text()).trim();

      const menuRoot = tmp.querySelector('.top-margin') || tmp.firstElementChild;
      if (menuRoot) slot.replaceWith(menuRoot);

      normalizeMenuHrefs();       // <-- fixed name
      forceAbsoluteNavigation();  // <-- robust mobile nav
      highlightCurrentNav();
      twoLinePrincipalOnPhones();
    } catch (_) { /* ignore */ }
  }

  // Make internal hrefs project-relative and compute safe absolute URLs
  function normalizeMenuHrefs() {
    document.querySelectorAll('.menu a.menu-link').forEach(a => {
      const raw = (a.getAttribute('href') || '').trim();
      if (!raw) return;

      if (/^https?:\/\//i.test(raw)) {
        a.dataset.abs = raw;                        // external as-is
      } else {
        const rel = raw.replace(/^\/+/, '');        // strip any leading slashes
        a.setAttribute('href', rel);                // normalize DOM
        a.dataset.abs = new URL(rel, document.baseURI).href;  // compute absolute
      }

      a.setAttribute('target', '_self');
      a.setAttribute('rel', 'noopener');

      // (Optional) debug to verify targets
      try { console.log('[menubar] link', a.textContent.trim(), '→', a.getAttribute('href'), 'abs:', a.dataset.abs); } catch(_) {}
    });
  }

  // Single captured click handler to avoid iOS pointer/touch races
  function forceAbsoluteNavigation() {
    document.querySelectorAll('.menu a.menu-link').forEach(a => {
      a.addEventListener('click', ev => {
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button > 0) return; // allow new-tab etc.
        const url = a.dataset.abs || a.href;
        if (!url) return;
        ev.preventDefault();
        ev.stopPropagation();
        try { console.log('[menubar] nav ->', url); } catch(_) {}
        window.location.href = url;
      }, { capture: true });
    });
  }

  // Current-page highlight (treat index.html as main.html)
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

  // Phone-only: split “PRINCIPAL’S OFFICE” into two lines & keep centered
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
