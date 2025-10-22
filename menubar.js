// Usage on every page:
//   <link rel="stylesheet" href="menubar.css?v=mb21">
//   <script src="menubar.js?v=mb21" defer></script>

(function () {
  const VER = 'mb21';

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

      normalizeMenuHrefsStrict();  // <-- harden every href to a valid path
      highlightCurrentNav();
      twoLinePrincipalOnPhones();
    } catch (_) { /* ignore */ }
  }

  // Rewrite each href to a project-relative absolute URL from *this* directory.
  // This avoids root-absolute mistakes and subfolder traps, and prevents 404 → main.html fallbacks.
  function normalizeMenuHrefsStrict() {
    // Directory of the current page (keeps trailing slash)
    const baseDir = location.pathname.replace(/[^\/]*$/, '');

    document.querySelectorAll('.menu a.menu-link').forEach(a => {
      let raw = (a.getAttribute('href') || '').trim();
      if (!raw) return;

      // External? leave it alone.
      if (/^https?:\/\//i.test(raw)) {
        a.setAttribute('target', '_self');
        a.setAttribute('rel', 'noopener');
        return;
      }

      // Get just the file name (ignore any accidental leading '/')
      const file = raw.replace(/^\/+/, '').split('/').pop();

      // Ensure it ends with .html (if you ever write "sadgirls")
      const safeFile = /\.[a-z0-9]+$/i.test(file) ? file : `${file}.html`;

      // Build a *project-relative absolute* URL resolved from the current page's directory
      const abs = new URL(safeFile, `${location.origin}${baseDir}`).href;

      // Write back a clean relative href (no leading slash) so highlight logic stays simple
      a.setAttribute('href', safeFile);

      // Store the resolved absolute in case you ever want to log/debug
      a.dataset.abs = abs;

      // Make sure navigation happens in-tab
      a.setAttribute('target', '_self');
      a.setAttribute('rel', 'noopener');

      // Debug (optional): uncomment if you want to see where each item points
      // console.log('[menubar]', a.textContent.trim(), '→ href:', a.getAttribute('href'), 'abs:', abs);
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

  // Phone-only: split “PRINCIPAL’S OFFICE” across two lines & keep centered
  function twoLinePrincipalOnPhones() {
    if (window.innerWidth > 480) return;
    const a = Array.from(document.querySelectorAll('.menu a.menu-link'))
      .find(x => {
        const h = (x.getAttribute('href') || '').toLowerCase();
        return h.endsWith('aboutme.html');
      });
    if (!a) return;
    const txt = (a.textContent || '').trim();
    if (!a.innerHTML.includes('<br>')) {
      a.innerHTML = txt.replace(/(PRINCIPAL[’']?S)\s+(OFFICE)/i, '$1<br>$2');
    }
    // Center the two lines (the link is display:grid from CSS)
    a.style.textAlign = 'center';
    a.style.justifyItems = 'center';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectMenu);
  } else {
    injectMenu();
  }
})();
