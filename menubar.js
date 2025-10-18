// Usage in each page:
//
// <meta name="viewport" content="width=device-width, initial-scale=1" />
// <link rel="stylesheet" href="/menubar.css?v=fixwrap2">
// <div data-menubar class="menubar-slot"></div>
// <script src="/menubar-inject.js?v=fixwrap2" defer></script>

(function () {
  async function injectMenu() {
    if (document.body.hasAttribute('data-no-menubar')) return;

    const slot = document.querySelector('[data-menubar]');
    if (!slot) return;

    try {
      // hard cache-bust so you actually see the edit on mobile
      const res = await fetch(`/menubar.html?v=fixwrap2&t=${Date.now()}`, { cache: 'no-cache' });
      if (!res.ok) return;

      const tmp = document.createElement('div');
      tmp.innerHTML = (await res.text()).trim();

      const menuRoot = tmp.querySelector('.top-margin') || tmp.firstElementChild;
      if (menuRoot) slot.replaceWith(menuRoot);

      normalizeMenuHrefs();
      highlightCurrentNav();
      forceAbsoluteNavigation();  // fix "SAD GIRLS → main.html" on mobile
      freeTopOverlaps();          // disable any overlapping hero/header at the very top
      wrapPrincipalsOffice();     // force 2-line label on phones
    } catch (_) {
      /* ignore */
    }
  }

  /* normalize every href to root-absolute and cache absolute URL */
  function normalizeMenuHrefs() {
    document.querySelectorAll('.menu a.menu-link').forEach(a => {
      const raw = (a.getAttribute('href') || '').trim();
      if (!raw) return;
      if (/^https?:\/\//i.test(raw)) return; // external
      const clean = '/' + raw.replace(/^\/+/, '');
      a.setAttribute('href', clean);
      a.dataset.abs = new URL(clean, location.origin).href;
      a.setAttribute('rel', 'noopener');
    });
  }

  /* explicitly navigate to each link's absolute URL on tap/click — runs earliest */
  function forceAbsoluteNavigation() {
    const links = document.querySelectorAll('.menu a.menu-link');
    links.forEach(a => {
      const go = ev => {
        // let modifier/middle clicks behave normally on desktop
        if (ev.type === 'click' && (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button > 0)) return;
        const url = a.dataset.abs || a.href;
        if (!url) return;
        ev.preventDefault();
        ev.stopPropagation();
        window.location.assign(url);  // hard navigate
      };
      // use pointerdown in capture phase so nothing else can hijack the tap
      a.addEventListener('pointerdown', go, { capture: true });
      a.addEventListener('click', go, { capture: true });
      a.addEventListener('touchend', go, { passive: false, capture: true });
    });
  }

  /* if any element overlaps the menu at the very top, disable its hit-testing */
  function freeTopOverlaps() {
    const bar = document.querySelector('.top-margin');
    if (!bar) return;

    const r = bar.getBoundingClientRect();
    const sampleY = Math.max(r.top + 2, 2);
    const xs = [r.left + 8, r.left + r.width / 2, r.right - 8];

    xs.forEach(x => {
      const stack = document.elementsFromPoint(x, sampleY);
      for (const el of stack) {
        if (el.closest('.top-margin')) break; // we've reached the menu
        if (el === document.documentElement || el === document.body) continue;
        // turn off hit testing for anything above the menu at this strip
        el.style.pointerEvents = 'none';
      }
    });
  }

  /* make "PRINCIPAL’S OFFICE" two rows on phones only, without changing your HTML files */
  function wrapPrincipalsOffice() {
    if (window.innerWidth > 480) return; // desktop/tablet keep one line
    const a = document.querySelector('.menu a[href="/aboutme.html"]');
    if (!a) return;

    // preserve original for when user rotates or resizes back up
    if (!a.dataset.origHtml) a.dataset.origHtml = a.innerHTML;

    const text = (a.textContent || '').trim();
    // If already wrapped, skip
    if (text.includes('\n') || a.innerHTML.includes('<br')) return;

    // Replace the single space before OFFICE with a <br> to force two lines
    const twoLine = text.replace(/(PRINCIPAL[’']?S)\s+(OFFICE)/i, '$1<br>$2');
    a.innerHTML = twoLine;
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

  // Re-apply wrapping after orientation changes
  window.addEventListener('orientationchange', () => {
    wrapPrincipalsOffice();
    freeTopOverlaps();
  }, { passive: true });
})();
