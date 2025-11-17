// main.js — page-specific for main.html
// Desktop: swap hover image on hover/focus (unchanged)
// Mobile: reveal hub after fonts+images, and on tap show hover image for ~1s before navigating

(() => {
  'use strict';

  // robust touch detection (iPadOS etc.)
  const isTouchLike =
    (window.matchMedia && (
      window.matchMedia('(any-hover: none)').matches ||
      window.matchMedia('(hover: none), (pointer: coarse)').matches
    )) ||
    ('ontouchstart' in window);

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
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch {}
    }
  }

  // --- desktop path (unchanged behavior) ---
  if (!isTouchLike) {
    function wireSwap(img) {
      const normal = img.getAttribute('data-src') || img.getAttribute('src');
      const hover  = img.getAttribute('data-hover-src');
      if (!normal || !hover) return;

      // preload hover for instant swap
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

  // --- mobile path ---
  async function initMobile() {
    const hub = document.getElementById('hub');
    if (!hub) return;

    hub.setAttribute('data-wait', '1');

    const imgs = Array.from(document.querySelectorAll('img.swap-on-hover'));

    // lock to base art, decode
    const decodePromises = imgs.map(img => {
      const normal = img.getAttribute('data-src') || img.getAttribute('src');
      if (normal) img.src = normal;
      img.loading = 'eager';
      img.decoding = 'async';
      return decodeImg(img);
    });

    // preload hover art so the tap swap is instant
    imgs.forEach(img => {
      const hover = img.getAttribute('data-hover-src');
      if (hover) {
        const pre = new Image();
        pre.decoding = 'async';
        pre.src = hover;
      }
    });

    await Promise.all([waitFonts(), ...decodePromises]);

    hub.removeAttribute('data-wait');

    // tap → show hover for ~1s → navigate
    wireTapHold();
  }

  function wireTapHold() {
    const HOLD_MS = 100; // time holding before switching to new page
    const links = Array.from(document.querySelectorAll('a.tile'));

    links.forEach(link => {
      // use pointerup for immediacy on touch, with click as a fallback
      const handler = (e) => {
        // let modified clicks do their thing
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

        const img = link.querySelector('img.swap-on-hover');
        if (!img) return;

        const hover  = img.getAttribute('data-hover-src');
        const normal = img.getAttribute('data-src') || img.getAttribute('src');
        if (!hover) return;

        // prevent default nav and double-activation
        e.preventDefault();
        if (link.dataset.busy === '1') return;
        link.dataset.busy = '1';

        // swap to hover and make sure it paints before starting the hold
        img.src = hover;
        requestAnimationFrame(() => {
          setTimeout(() => {
            // optional tidy-up
            // img.src = normal;

            const href = link.getAttribute('href');
            const target = (link.getAttribute('target') || '_self').toLowerCase();
            if (target === '_self') {
              // iOS Safari friendly
              window.location.assign(href);
            } else {
              window.open(href, target);
            }
          }, HOLD_MS);
        });
      };

      link.addEventListener('pointerup', handler, { passive: false });
      link.addEventListener('click',     handler, { passive: false }); // backup
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { initMobile(); });
  } else {
    initMobile();
  }
})();
