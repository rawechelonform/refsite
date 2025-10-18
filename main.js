// main.js — page-specific for main.html
// Desktop: swap to hover image on hover/focus.
// Mobile (no hover / coarse pointer): disable swapping entirely so taps scroll/click cleanly.

(() => {
  'use strict';

  // Only enable swapping on devices that *actually* support hover + fine pointer (desktops)
  const supportsHoverFine =
    window.matchMedia &&
    window.matchMedia('(hover: hover)').matches &&
    window.matchMedia('(pointer: fine)').matches;

  if (!supportsHoverFine) {
    // On mobile/touch: ensure base images are shown and no touch handlers interfere
    // If a previous script added hover src into `src`, restore data-src if present
    document.querySelectorAll('img.swap-on-hover').forEach(img => {
      const normal = img.getAttribute('data-src');
      if (normal) img.src = normal;
    });
    return; // no listeners; tapping will follow links, and scrolling works
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

    // Mouse
    img.addEventListener('mouseenter', toHover);
    img.addEventListener('mouseleave', toNormal);

    // Keyboard focus parity when tabbing to the link
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
