(function () {
  async function injectMenu() {
    // Allow pages to opt out with <body data-no-menubar>
    if (document.body.hasAttribute('data-no-menubar')) return;

    const slot = document.querySelector('[data-menubar]');
    if (!slot) return;

    try {
      // Cache-bust so updates to menubar.html show up
      const res = await fetch('menubar.html?v=4', { cache: 'no-cache' });
      if (!res.ok) return;

      // Replace the placeholder with the real menu HTML
      slot.outerHTML = await res.text();

      // Highlight the current page in the menu
      highlightCurrentNav();
    } catch (_) {
      // silently ignore fetch errors
    }
  }

  function highlightCurrentNav() {
    // Get the current filename only (ignore folders, query, hash)
    let path = location.pathname;
    if (path.endsWith('/')) path = 'index.html';
    else path = path.split('/').pop() || 'index.html';

    // Treat index.html as main.html in this site
    if (path === 'index.html') path = 'main.html';

    document.querySelectorAll('.menu a.menu-link').forEach(a => {
      // Compare just the filename part of each link
      const hrefFile = (a.getAttribute('href') || '').split('/').pop();
      const isCurrent = hrefFile === path;

      a.classList.toggle('is-current', isCurrent);

      // Expose current page to assistive tech
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
