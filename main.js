// main.js — page-specific for main.html
// Handles hover swapping on desktop only.
// On mobile (no-hover devices), we do nothing so the base image stays put
// and the label is always visible via CSS.

(() => {
  'use strict';

  // Skip all swap wiring on devices that don't support hover (phones/tablets)
  const isNoHover = window.matchMedia && window.matchMedia('(hover: none)').matches;
  if (isNoHover) return;

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

    // Keyboard focus parity when tabbing to the link (desktop)
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
