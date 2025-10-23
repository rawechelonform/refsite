// main.js — page-specific for main.html
// Desktop: swap hover image on hover/focus (unchanged)
// Mobile: wait for fonts + both images to fully decode, then reveal hub all at once
//         plus: on tap, show the hover image for ~1s before navigating

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
    wireTapHold(imgs);
  }

  function wireTapHold(imgs) {
    const HOLD_MS = 10000; // 1s
    const links = Array.from(document.querySelectorAll('a.tile'));

    // map images by their containing link for quick lookup
    const imgByLink = new Map();
    links.forEach(link => {
      const img = link.querySelector('img.swap-on-hover');
      if (img) imgByLink.set(link, img);
    });

    links.forEach(link => {
      link.addEventListener('click', e => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

        const img = imgByLink.get(link);
        if (!img) return;

        const hover = img.getAttribute('data-hover-src');
        const normal = img.getAttribute('data-src') || img.getAttribute('src');
        if (!hover) return;

        if (link.dataset.busy === '1') { e.preventDefault(); return; }

        e.preventDefault();
        link.dataset.busy = '1';

        // swap to hover and ensure it paints before starting the hold
        img.src = hover;
        requestAnimationFrame(() => {
          setTimeout(() => {
            // optional tidy-up before nav on very slow connections
            // img.src = normal;

            const href = link.getAttribute('href');
            const target = (link.getAttribute('target') || '_self').toLowerCase();
            if (target === '_self') {
              window.location.href = href;
            } else {
              window.open(href, target);
            }
          }, HOLD_MS);
        });
      }, { passive: false });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { initMobile(); });
  } else {
    initMobile();
  }
})();
