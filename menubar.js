// menubar.js  

(function () {
  const VER = 'mb27';

  async function injectMenu() {
    const slot = document.querySelector('[data-menubar]');
    if (!slot) return;

    try {
      const res = await fetch(`menubar_x.html?v=${VER}&t=${Date.now()}`, { cache: 'no-cache' });
      if (!res.ok) return;

      const tmp = document.createElement('div');
      tmp.innerHTML = (await res.text()).trim();
      const menuRoot = tmp.querySelector('.top-margin') || tmp.firstElementChild;
      if (menuRoot) slot.replaceWith(menuRoot);

      normalizeMenuLinkAttrs();
      highlightCurrentNav();

      // 🔔 Tell other scripts (like cart.js) that the menubar is ready
      window.dispatchEvent(new Event('ref-menubar-ready'));
    } catch (_) {}
  }

  function normalizeMenuLinkAttrs() {
    document.querySelectorAll('.menu a.menu-link').forEach(a => {
      a.setAttribute('target', '_self');
      a.setAttribute('rel', 'noopener');
    });

    // Optional debug
    try {
      console.log('[menubar links]',
        [...document.querySelectorAll('.menu a.menu-link')]
          .map(a => [a.textContent.trim(), a.getAttribute('href')]));
    } catch {}
  }

  function highlightCurrentNav() {
    let file = location.pathname.split('/').pop() || 'index.html';
    if (file === 'index.html') file = 'main.html'; // your home alias
    document.querySelectorAll('.menu a.menu-link').forEach(a => {
      const hrefFile = (a.getAttribute('href') || '')
        .split('?')[0].split('#')[0].split('/').pop();
      const isCurrent = hrefFile === file;
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
})();
