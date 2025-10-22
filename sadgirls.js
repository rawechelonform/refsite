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


(() => {
  const overlay = document.getElementById('sky-overlay');
  if (!overlay) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused = document.hidden;

  // Tweakables
  const MIN_INTERVAL_MS = 3000;   // min gap between stars
  const MAX_INTERVAL_MS = 12000;  // max gap between stars
  const MIN_DURATION_MS = 900;    // shortest streak
  const MAX_DURATION_MS = 1800;   // longest streak
  const ANGLE_DEG_MIN = 24;       // shallow diagonal
  const ANGLE_DEG_MAX = 36;

  function scheduleNext() {
    const wait = rand(MIN_INTERVAL_MS, MAX_INTERVAL_MS);
    setTimeout(() => {
      if (!paused && !reduceMotion.matches) spawnStar();
      scheduleNext();
    }, wait);
  }

  function spawnStar() {
    const star = document.createElement('div');
    star.className = 'shooting-star';

    const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

    const startX = rand(-0.15 * vw, 0.35 * vw);
    const startY = rand(-0.10 * vh, 0.35 * vh);

    const path = rand(1.1, 1.5) * Math.hypot(vw, vh);

    const angleDeg = rand(ANGLE_DEG_MIN, ANGLE_DEG_MAX);
    const angleRad = angleDeg * Math.PI / 180;

    const dx = Math.cos(angleRad) * path;
    const dy = Math.sin(angleRad) * path;

    star.style.left = `${startX}px`;
    star.style.top  = `${startY}px`;
    star.style.setProperty('--sg-angle', `${angleDeg}deg`);
    star.style.setProperty('--sg-dx', `${dx}px`);
    star.style.setProperty('--sg-dy', `${dy}px`);

    const duration = rand(MIN_DURATION_MS, MAX_DURATION_MS);
    const delay = rand(0, 250);
    star.style.animation = `sg_streak ${duration}ms ease-out ${delay}ms forwards`;

    star.addEventListener('animationend', () => star.remove());
    overlay.appendChild(star);
  }

  function rand(min, max) {
    if (Number.isInteger(min) && Number.isInteger(max)) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    return Math.random() * (max - min) + min;
  }

  document.addEventListener('visibilitychange', () => { paused = document.hidden; });

  if (!reduceMotion.matches) {
    setTimeout(() => spawnStar(), rand(800, 2500));
    scheduleNext();
  }
})();
