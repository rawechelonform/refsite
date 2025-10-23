// main.js — page-specific for main.html
// Desktop: swap hover image on hover/focus (unchanged)
// Mobile: reveal hub after fonts+images, preload hover art, and on tap:
//         flash hover image briefly before following the link

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

  // --- mobile path ---
  async function initMobile() {
    const hub = document.getElementById('hub');
    if (!hub) return;

    // Hide hub until fonts + base images are ready
    hub.setAttribute('data-wait', '1');

    const imgs = Array.from(document.querySelectorAll('img.swap-on-hover'));

    // Ensure base sources + decode
    const decodePromises = imgs.map(img => {
      const normal = img.getAttribute('data-src') || img.getAttribute('src');
      if (normal) img.src = normal;
      img.loading = 'eager';
      img.decoding = 'async';
      return decodeImg(img);
    });

    // Preload hover variants for instant tap-flash
    imgs.forEach(img => {
      const hover = img.getAttribute('data-hover-src');
      if (hover) {
        const pre = new Image();
        pre.decoding = 'async';
        pre.src = hover;
      }
    });

    await Promise.all([waitFonts(), ...decodePromises]);

    // Reveal hub all at once
    hub.removeAttribute('data-wait');

    // Wire tap-to-flash-then-navigate behavior
    wireTapFlash();
  }

  function wireTapFlash() {
    const links = Array.from(document.querySelectorAll('a.tile'));
    links.forEach(link => {
      link.addEventListener('click', e => {
        // allow modifier clicks to behave normally (rare on mobile, but safe)
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (link.dataset.busy === '1') { e.preventDefault(); return; }

        const img   = link.querySelector('img.swap-on-hover');
        if (!img) return;

        const normal = img.getAttribute('data-src') || img.getAttribute('src');
        const hover  = img.getAttribute('data-hover-src');
        if (!hover) return;

        // prevent immediate navigation, flash hover, then follow
        e.preventDefault();
        link.dataset.busy = '1';

        // swap to hover immediately
        img.src = hover;

        // small delay for the user to perceive the change
        // use rAF to ensure the swap paints before timing
        requestAnimationFrame(() => {
          setTimeout(() => {
            // navigate respecting target if present
            const href = link.getAttribute('href');
            const target = (link.getAttribute('target') || '_self').toLowerCase();

            // optional: restore image to normal after starting nav
            // not strictly needed, but keeps state tidy on slow connections
            img.src = normal;

            if (target === '_self') {
              window.location.href = href;
            } else {
              window.open(href, target);
            }
          }, 180); // ~1–2 frames of "flash" at 60Hz
        });
      }, { passive: false }); // we call preventDefault()
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { initMobile(); });
  } else {
    initMobile();
  }
})();
