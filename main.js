// main.js — page-specific for main.html
// Desktop: swap hover image on hover/focus (unchanged)
// Mobile: wait for fonts + both images to fully decode, then reveal hub all at once

(() => {
  'use strict';

  const mqHover = window.matchMedia ? window.matchMedia('(hover: hover)') : null;
  const mqFine  = window.matchMedia ? window.matchMedia('(pointer: fine)') : null;
  const supportsDesktopHover = mqHover && mqHover.matches && mqFine && mqFine.matches;

  // --- helpers ---
  function decodeImg(img) {
    if (img.decode) {
      return img.decode().catch(() =>
        new Promise(res => (img.complete ? res() : img.addEventListener('load', res, { once: true })))
      );
    }
    return new Promise(res => (img.complete ? res() : img.addEventListener('load', res, { once: true })));
  }

  async function waitFonts() {
    // Wait for any pending font loads (works across browsers; safe fallback)
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch {}
    }
  }

  // --- desktop path (unchanged behavior) ---
  if (supportsDesktopHover) {
    function wireSwap(img) {
      const normal = img.getAttribute('data-src') || img.getAttribute('src');
      const hover  = img.getAttribute('data-hover-src');
      if (!normal || !hover) return;

      // Preload hover for instant swap
      const pre = new Image();
      pre.src = hover;

      const toHover  = () => { img.src = hover; };
      const toNormal = () => { img.src = normal; };

      img.addEventListener('mouseenter', toHover);
      img.addEventListener('mouseleave', toNormal);

      const link = img.closest('a');
      if (link) {
        link.addEventListener('focus', toHover);
        link.addEventListener('blur',  toNormal);
      }
    }

    function initDesktop() {
      document.querySelectorAll('img.swap-on-hover').forEach(wireSwap);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initDesktop);
    } else {
      initDesktop();
    }
    return;
  }

  // --- mobile path: hold everything until ready, then reveal together ---
  async function initMobile() {
    const hub = document.getElementById('hub');
    if (!hub) return;

    // Hide hub (menu bar still shows above) until we’re ready to reveal
    hub.setAttribute('data-wait', '1');

    // Ensure base (non-hover) sources are set and decode both tiles
    const imgs = Array.from(document.querySelectorAll('img.swap-on-hover'));
    const decodePromises = imgs.map(img => {
      const normal = img.getAttribute('data-src') || img.getAttribute('src');
      if (normal) img.src = normal;       // lock to base art on mobile
      img.loading = 'eager';              // prioritize these two
      img.decoding = 'async';
      return decodeImg(img);
    });

    // Wait for fonts + both images
    await Promise.all([waitFonts(), ...decodePromises]);

    // Reveal hub all at once (labels + images + text together)
    hub.removeAttribute('data-wait');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { initMobile(); });
  } else {
    initMobile();
  }
})();
