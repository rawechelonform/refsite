// menubar.js  (use on every page as: <script src="menubar.js?v=mb23" defer></script>)
(function () {
  const VER = 'mb23';

  async function injectMenu() {
    const slot = document.querySelector('[data-menubar]');
    if (!slot) return;

    try {
      const res = await fetch(`menubar.html?v=${VER}&t=${Date.now()}`, { cache: 'no-cache' });
      if (!res.ok) return;

      const tmp = document.createElement('div');
      tmp.innerHTML = (await res.text()).trim();
      const menuRoot = tmp.querySelector('.top-margin') || tmp.firstElementChild;
      if (menuRoot) slot.replaceWith(menuRoot);

      enforceKnownHrefs();       // <— hard fix: guarantee correct targets
      highlightCurrentNav();
      twoLinePrincipalOnPhones();
    } catch (_) {}
  }

  // Map link text -> file. This wins even if the fragment was stale/wrong.
  function enforceKnownHrefs() {
    const map = new Map([
      ['REF',                   'main.html'],
      ['SAD GIRLS',             'sadgirls.html'],
      ['MACHINES',              'machines.html'],
      ["PRINCIPAL’S OFFICE",    'aboutme.html'],
      ['CAFETERIA',             'shop.html'],
    ]);

    document.querySelectorAll('.menu a.menu-link').forEach(a => {
      const label = (a.textContent || '').trim().toUpperCase();
      // normalize curly apostrophe vs straight
      const key = label.replace(/PRINCIPAL[’']/,'PRINCIPAL’S');
      const file = map.get(key);
      if (file) a.setAttribute('href', file);
      a.setAttribute('target', '_self');
      a.setAttribute('rel', 'noopener');
    });

    // Optional debug: show what the DOM ended up with
    try {
      console.log('[menubar hrefs]',
        [...document.querySelectorAll('.menu a.menu-link')]
          .map(a => [a.textContent.trim(), a.getAttribute('href')]));
    } catch {}
  }

  function highlightCurrentNav() {
    let file = location.pathname.split('/').pop() || 'index.html';
    if (file === 'index.html') file = 'main.html';
    document.querySelectorAll('.menu a.menu-link').forEach(a => {
      const hrefFile = (a.getAttribute('href') || '').split('?')[0].split('#')[0].split('/').pop();
      const isCurrent = hrefFile === file;
      a.classList.toggle('is-current', isCurrent);
      if (isCurrent) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  function twoLinePrincipalOnPhones() {
    if (window.innerWidth > 480) return;
    const a = [...document.querySelectorAll('.menu a.menu-link')]
      .find(x => ((x.getAttribute('href') || '').toLowerCase() === 'aboutme.html'));
    if (!a) return;
    const txt = (a.textContent || '').trim();
    if (!a.innerHTML.includes('<br>')) {
      a.innerHTML = txt.replace(/(PRINCIPAL[’']?S)\s+(OFFICE)/i, '$1<br>$2');
    }
    a.style.textAlign = 'center';
    a.style.justifyItems = 'center';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectMenu);
  } else {
    injectMenu();
  }
})();
