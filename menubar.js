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
      const res = await fetch('/menubar.html?v=8', { cache: 'no-cache' });
      if (!res.ok) return;

      const html = await res.text();
      const tmp = document.createElement('div');
      tmp.innerHTML = html.trim();

      const menuRoot = tmp.querySelector('.top-margin') || tmp.firstElementChild;
      if (menuRoot) slot.replaceWith(menuRoot);

      normalizeMenuHrefs();
      highlightCurrentNav();

      // After fonts load & on resize, autoshrink labels so they never spill
      setupAutoShrink();
    } catch (_) {
      /* ignore */
    }
  }

  function normalizeMenuHrefs() {
    document.querySelectorAll('.menu a.menu-link').forEach(a => {
      const href = a.getAttribute('href') || '';
      if (!href) return;
      if (/^https?:\/\//i.test(href)) return;
      if (!href.startsWith('/')) a.setAttribute('href', '/' + href.replace(/^\/+/, ''));
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

  /* ===== Auto-shrink labels to fit their buttons ===== */
  function setupAutoShrink() {
    const links = Array.from(document.querySelectorAll('.menu a.menu-link'));
    if (!links.length) return;

    // Capture base sizes once (the CSS "ideal" before shrinking)
    links.forEach(a => {
      if (!a.dataset.baseSizePx) {
        const cs = getComputedStyle(a);
        a.dataset.baseSizePx = parseFloat(cs.fontSize) || 10;
        a.dataset.baseLetter = parseFloat(cs.letterSpacing) || 0;
      }
    });

    const applyAll = () => {
      // Run after layout settles
      requestAnimationFrame(() => {
        links.forEach(shrinkToFit);
      });
    };

    // Recalc on load, on font availability, and when layout changes
    applyAll();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(applyAll).catch(() => {});
    }

    // ResizeObserver to react to viewport changes
    const ro = new ResizeObserver(applyAll);
    ro.observe(document.querySelector('.menu'));

    // Also listen to orientation/zoom-ish changes
    window.addEventListener('resize', applyAll, { passive: true });
    window.addEventListener('orientationchange', applyAll, { passive: true });
  }

  function shrinkToFit(a) {
    // Reset to base each pass so labels can grow back if space increases
    const base = parseFloat(a.dataset.baseSizePx) || 10;
    const baseLetter = parseFloat(a.dataset.baseLetter) || 0;
    a.style.fontSize = base + 'px';
    a.style.letterSpacing = baseLetter ? baseLetter + 'px' : '';

    const isBrand = a.classList.contains('brand-link');
    const minPx = parseFloat(getComputedStyle(document.documentElement)
                   .getPropertyValue(isBrand ? '--minfs-brand' : '--minfs-link')) || (isBrand ? 11 : 7);

    // Safety: if empty or has plenty of room, stop
    if (!a.textContent.trim()) return;
    if (a.scrollWidth <= a.clientWidth) return;

    // Compute a single-step scale factor, with a tiny buffer
    const ratio = a.clientWidth / Math.max(1, a.scrollWidth);
    let target = Math.max(minPx, Math.floor(base * (ratio * 0.985) * 100) / 100);

    // If still too big because of rounding/letter-spacing, iterate down a few times
    let guard = 6;
    while (guard-- > 0 && (a.scrollWidth > a.clientWidth) && target > minPx) {
      a.style.fontSize = target + 'px';
      // Nudge letter-spacing down a hair as we shrink to avoid clipping
      if (baseLetter) a.style.letterSpacing = (baseLetter * (target / base)) + 'px';
      if (a.scrollWidth <= a.clientWidth) break;
      target = Math.max(minPx, Math.floor((target - 0.5) * 100) / 100);
    }

    // Apply final size
    a.style.fontSize = target + 'px';
    if (baseLetter) a.style.letterSpacing = (baseLetter * (target / base)) + 'px';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectMenu);
  } else {
    injectMenu();
  }
})();
