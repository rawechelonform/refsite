// icon.js — inject favicon links from icon.html
(function () {
  const VER = 'ic1'; // bump this if icon.html changes to bust caching

  async function injectIcons() {
    try {
      const res = await fetch(`icon.html?v=${VER}`, { cache: 'no-cache' });
      if (!res.ok) return;

      const wrapper = document.createElement('div');
      wrapper.innerHTML = await res.text();

      // Insert only the <link rel="icon"> tags
      wrapper.querySelectorAll('link[rel*="icon"]').forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;

        // Prevent duplicate entries
        const exists = document.head.querySelector(`link[rel*="icon"][href="${href}"]`);
        if (!exists) document.head.appendChild(link);
      });

    } catch (err) {
      console.warn('[favicon injector failed]', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectIcons);
  } else {
    injectIcons();
  }
})();
