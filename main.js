// main.js — page-specific for main.html
// Only handles hover swapping for the two tiles; does not touch the menubar

(() => {
  'use strict';

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

    // Touch: first tap previews hover; second tap follows link
    let tapped = false;
    img.addEventListener('touchstart', (e) => {
      if (!tapped) {
        tapped = true;
        toHover();
        setTimeout(() => { tapped = false; }, 450);
        e.preventDefault(); // keep first tap from navigating
      }
    }, { passive: false });
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
