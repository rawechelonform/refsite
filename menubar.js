(function () {
  async function injectMenu() {
    if (document.body.hasAttribute('data-no-menubar')) return;

    const slot = document.querySelector('[data-menubar]');
    if (!slot) return;

    // cache-busting query is fine
    const res = await fetch('menubar.html?v=3', { cache: 'no-cache' });
    if (!res.ok) return;

    slot.outerHTML = await res.text();
    highlightCurrentNav();
  }

  function highlightCurrentNav() {
    // get filename only (ignores query/hash), handles trailing slash
    let path = location.pathname;
    if (path.endsWith('/')) path = 'index.html';
    else path = path.split('/').pop() || 'index.html';

    // map aliases
    if (path === 'index.html') path = 'main.html';

    document.querySelectorAll('.menu a.menu-link').forEach(a => {
      // compare only the filename part of href
      const hrefFile = (a.getAttribute('href') || '').split('/').pop();
      a.classList.toggle('is-current', hrefFile === path);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectMenu);
  } else {
    injectMenu();
  }
})();
