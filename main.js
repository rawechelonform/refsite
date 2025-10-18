// main.js — page-specific for main.html
// Desktop: swap hover image on hover/focus
// Mobile/tablets: DO NOTHING so taps scroll/click cleanly and labels are shown by CSS

(() => {
  'use strict';

  const mqHover = window.matchMedia ? window.matchMedia('(hover: hover)') : null;
  const mqFine  = window.matchMedia ? window.matchMedia('(pointer: fine)') : null;
  const supportsDesktopHover = mqHover && mqHover.matches && mqFine && mqFine.matches;

  if (!supportsDesktopHover) {
    // Mobile: ensure base (non-hover) src is used
    document.querySelectorAll('img.swap-on-hover').forEach(img => {
      const normal = img.getAttribute('data-src');
      if (normal) img.src = normal;
    });
    return; // no listeners attached
  }

  // Desktop hover wiring
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

  function init() {
    document.querySelectorAll('img.swap-on-hover').forEach(wireSwap);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
