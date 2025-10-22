(() => {
  // ==== CONFIG ==============================================================
  const SHEET_CSV_URL = "homeroom/REFsiteartdescriptions.csv";
  const PAGE_SLUG = "sadgirls";
  const IMG_ROOT = "homeroom";
  const DEFAULT_EXT = "png";

  // ==== DOM ================================================================
  const stageImg  = document.getElementById("stageImg");
  const thumbBar  = document.getElementById("thumbBar");
  const captionEl = document.getElementById("caption");
  const stage     = document.getElementById("stage");

  // Ensure caption lives inside stage-inner (so visibility control is easy)
  const stageInner = document.querySelector('#stage .stage-inner');
  if (stageInner && captionEl && !stageInner.contains(captionEl)) {
    stageInner.appendChild(captionEl);
  }

  // ==== STATE ==============================================================
  let IMAGES = [];
  let current = 0;

  // ==== Helpers: mobile detection & safe decode ============================
  const isPortraitMobile = () =>
    window.matchMedia("(max-width: 720px) and (orientation: portrait)").matches;

  function decodeImg(img) {
    if (img.decode) {
      // Safari can throw on decode() before load; fall back
      return img.decode().catch(() =>
        new Promise(res => (img.complete ? res() : img.addEventListener("load", res, { once: true })))
      );
    }
    return new Promise(res => (img.complete ? res() : img.addEventListener("load", res, { once: true })));
  }

  // ==== Boot ===============================================================
  (async () => {
    try {
      const res = await fetch(`${SHEET_CSV_URL}?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`CSV HTTP ${res.status}`);
      const text = await res.text();

      const rows = parseCSV(text);
      IMAGES = rowsToImages(rows, PAGE_SLUG);
      if (!IMAGES.length) throw new Error("No matching rows");

      // Mobile portrait: special zero-jank loading; Desktop/Landscape: original render
      if (isPortraitMobile()) {
        await renderMobilePortraitNoShift();
      } else {
        render();
      }
    } catch (e) {
      console.error("Failed to load sheet:", e);
      IMAGES = [
        { src: "homeroom/sadgirls/girl1.png", thumb: null, title: "Girl 1",
          meta: { title: "Girl 1", year: "", medium: "", size: "" } }
      ];
      if (isPortraitMobile()) {
        await renderMobilePortraitNoShift();
      } else {
        render();
      }
    }
  })();

  // ==== CSV → IMAGES =======================================================
  function rowsToImages(rows, pageSlug) {
    if (!rows.length) return [];
    const header = rows[0].map(h => h.trim().toLowerCase());
    const idx = name => header.indexOf(name);

    const iSite   = idx("site page");
    const iFile   = idx("file");
    const iTitle  = idx("title");
    const iYear   = idx("year");
    const iMedium = idx("medium");
    const iSize   = idx("size");
    const iOrder  = idx("order");  // optional

    const data = rows.slice(1)
      .filter(r => r[iSite] && r[iSite].trim().toLowerCase() === pageSlug)
      .map(r => {
        const fileRaw = (r[iFile] || "").trim();
        const hasExt = /\.[a-z0-9]+$/i.test(fileRaw);
        const file = hasExt ? fileRaw : `${fileRaw}.${DEFAULT_EXT}`;
        const src = `${IMG_ROOT}/${pageSlug}/${file}`;

        return {
          src,
          thumb: null, // if you add thumbs later, wire here
          title: r[iTitle] || "",
          meta: {
            title:  r[iTitle]  || "",
            year:   r[iYear]   || "",
            medium: r[iMedium] || "",
            size:   r[iSize]   || ""
          },
          order: Number.parseInt(r[iOrder] || "0", 10) || 9999
        };
      })
      .sort((a,b) => a.order - b.order);

    return data;
  }

  // ==== Original carousel wiring (desktop / landscape) =====================
  function setStage(i) {
    const item = IMAGES[i]; if (!item) return;
    const img = new Image();
    img.alt = item.title || "";

    img.onload = () => {
      stageImg.style.opacity = 0;
      requestAnimationFrame(() => {
        stageImg.src = img.src;
        stageImg.alt = img.alt;
        stageImg.style.opacity = 1;
      });
    };

    img.onerror = () => {
      stageImg.removeAttribute("src");
      stageImg.alt = "Image failed to load";
    };

    img.src = item.src;

    captionEl.innerHTML = formatMeta(item.meta);
    [...thumbBar.children].forEach((el, ix) => el.classList.toggle("active", ix === i));
  }

  function formatMeta(m) {
    if (!m) return "";
    const line1 = [ m.title ? `<em>${m.title}</em>` : "", m.year ].filter(Boolean).join(", ");
    const line2 = (m.medium || "");
    const line3 = (m.size || "");
    return [line1, line2, line3].filter(Boolean).join("<br>");
  }

  function makeThumb(item, i) {
    const t = document.createElement("button");
    t.className = "thumb" + (i === 0 ? " active" : "");
    t.type = "button";
    t.setAttribute("aria-label", `Go to image ${i + 1}`);
    t.addEventListener("click", () => go(i));

    const img = document.createElement("img");
    img.alt = item.title ? `${item.title} thumbnail` : `Thumbnail ${i + 1}`;
    img.loading = "lazy";
    img.src = item.thumb || item.src;

    t.appendChild(img);
    return t;
  }

  function render() {
    // Desktop / mobile landscape: original order
    thumbBar.innerHTML = "";
    IMAGES.forEach((it, i) => thumbBar.appendChild(makeThumb(it, i)));
    setStage(0);
    preloadAround(0);
  }

  function go(n) {
    const len = IMAGES.length;
    current = ((n % len) + len) % len;
    setStage(current);
    preloadAround(current);
  }

  function preload(src) { const i = new Image(); i.src = src; }
  function preloadAround(i) {
    if (!IMAGES.length) return;
    const nextI = (i + 1) % IMAGES.length;
    const prevI = (i - 1 + IMAGES.length) % IMAGES.length;
    preload(IMAGES[nextI].src);
    preload(IMAGES[prevI].src);
  }

  stage.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { go(current + 1); e.preventDefault(); }
    else if (e.key === "ArrowLeft") { go(current - 1); e.preventDefault(); }
  });

  // ==== Mobile portrait: zero-shift loader ================================
  async function renderMobilePortraitNoShift() {
    // 1) Prepare initial (index 0) stage image fully off-DOM
    const first = IMAGES[0];
    if (!first) return;

    // Hide caption & thumbs until stage is ready (prevents text-first flash)
    captionEl.style.visibility = "hidden";
    thumbBar.style.visibility = "hidden";

    // Preload and decode the stage image
    const temp = new Image();
    temp.src = first.src;
    temp.alt = first.title || "";
    temp.loading = "eager";
    temp.decoding = "async";
    await decodeImg(temp);

    // 2) Atomically show stage image
    stageImg.style.opacity = "0";
    stageImg.src = temp.src;
    stageImg.alt = temp.alt;
    // Optional: reserve space exactly (further reduces any micro-shift)
    if (temp.naturalWidth && temp.naturalHeight) {
      stageImg.style.aspectRatio = `${temp.naturalWidth} / ${temp.naturalHeight}`;
    }
    // Fade in now that pixels are ready
    requestAnimationFrame(() => { stageImg.style.opacity = "1"; });

    // 3) Only now build thumbnails and caption, and reveal together
    thumbBar.innerHTML = "";
    IMAGES.forEach((it, i) => thumbBar.appendChild(makeThumb(it, i)));
    captionEl.innerHTML = formatMeta(first.meta);

    captionEl.style.visibility = "visible";
    thumbBar.style.visibility = "visible";

    // 4) Preload neighbors for snappy next/prev
    current = 0;
    preloadAround(current);
  }

  // ==== Tiny CSV parser ====================================================
  function parseCSV(text) {
    const rows = [];
    let row = [], cell = "", inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i], n = text[i + 1];
      if (inQuotes) {
        if (c === '"' && n === '"') { cell += '"'; i++; }
        else if (c === '"') { inQuotes = false; }
        else { cell += c; }
      } else {
        if (c === '"') inQuotes = true;
        else if (c === ',') { row.push(cell); cell = ""; }
        else if (c === '\n' || c === '\r') {
          if (cell !== "" || row.length) { row.push(cell); rows.push(row); row = []; cell = ""; }
          if (c === '\r' && n === '\n') i++;
        } else { cell += c; }
      }
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  // ==== Orientation change: keep desktop untouched, re-apply mobile logic ==
  window.addEventListener("resize", () => {
    clearTimeout(window.__sadgirls_resize);
    window.__sadgirls_resize = setTimeout(async () => {
      if (isPortraitMobile()) {
        // Re-apply mobile no-shift flow on rotate into portrait
        await renderMobilePortraitNoShift();
      } else {
        // Restore desktop/landscape original behavior
        render();
      }
    }, 120);
  });
})();











// === Vertical shooting stars with random x, distance>=2/3VH, old speed (duration),
// randomized thickness, random timing, and up to 3 concurrent ===
(() => {
  const overlay = document.getElementById('sky-overlay');
  if (!overlay) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused = document.hidden;

  // Spawn timing window
  const MIN_INTERVAL_MS = 2200;
  const MAX_INTERVAL_MS = 12000;

  // "Old speed" → randomized duration range (ms)
  const MIN_DURATION_MS = 900;
  const MAX_DURATION_MS = 2200;

  // Tail length and thickness windows
  const MIN_TAIL = 120;   // px
  const MAX_TAIL = 210;   // px
  const MIN_THICK = 2;    // px
  const MAX_THICK = 4;    // px

  // Distance as a fraction of viewport height
  // min 2/3 page, sometimes full page and a bit beyond
  const MIN_DIST_FRAC = 0.67;
  const MAX_DIST_FRAC = 1.12;

  // Concurrency
  const MAX_CONCURRENT = 3;
  let activeStars = 0;

  function scheduleNext() {
    const wait = rand(MIN_INTERVAL_MS, MAX_INTERVAL_MS);
    setTimeout(() => {
      if (!paused && !reduceMotion.matches) spawnCluster();
      scheduleNext();
    }, wait);
  }

  // Sometimes spawn more than 1 at the same time, but never exceed MAX_CONCURRENT
  function spawnCluster() {
    const available = Math.max(0, MAX_CONCURRENT - activeStars);
    if (available === 0) return;

    // Weighted pick: mostly 1, sometimes 2, rarely 3
    const r = Math.random();
    let desired = r < 0.65 ? 1 : r < 0.92 ? 2 : 3;
    const count = Math.min(desired, available);

    for (let i = 0; i < count; i++) {
      // small per-star stagger (0–220ms) so they don't perfectly overlap
      setTimeout(spawnStar, i === 0 ? 0 : rand(40, 220));
    }
  }

  function spawnStar() {
    const star = document.createElement('div');
    star.className = 'shooting-star';

    const vw = Math.max(document.documentElement.clientWidth,  window.innerWidth  || 0);
    const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

    // Random x across the viewport with tiny margins
    const startX = rand(0.02 * vw, 0.98 * vw);
    star.style.left = `${startX}px`;

    // Random thickness for head and tail
    const thick = randInt(MIN_THICK, MAX_THICK);
    star.style.width = `${thick}px`;
    star.style.height = `${thick}px`;
    star.style.setProperty('--thick', `${thick}px`);

    // Random tail length
    const tail = randInt(MIN_TAIL, MAX_TAIL);
    star.style.setProperty('--tail', `${tail}px`);

    // Start just above the screen so the tail isn't visible at spawn
    const startTop = -tail - 20;
    star.style.top = `${startTop}px`;

    // Random travel distance: at least 2/3 page, maybe beyond the bottom
    const distFrac = rand(MIN_DIST_FRAC, MAX_DIST_FRAC);
    const distance = distFrac * vh + (distFrac >= 1 ? 60 : 0); // little extra if crossing bottom
    star.style.setProperty('--sg-distance', `${distance}px`);

    // Old-speed style: randomized duration window
    const durationMs = randInt(MIN_DURATION_MS, MAX_DURATION_MS);
    const delayMs = randInt(0, 200);

    star.style.animation = `sg_fall ${durationMs}ms linear ${delayMs}ms forwards`;

    // Track concurrency
    activeStars++;
    star.addEventListener('animationend', () => {
      star.remove();
      activeStars = Math.max(0, activeStars - 1);
    });

    overlay.appendChild(star);
  }

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }
  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  document.addEventListener('visibilitychange', () => { paused = document.hidden; });

  if (!reduceMotion.matches) {
    // first one at a random moment
    setTimeout(() => spawnCluster(), randInt(300, 1500));
    scheduleNext();
  }
})();
