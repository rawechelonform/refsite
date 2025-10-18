(() => {
  // ===== Thumbnails on the grid =====
  const IMAGES = [
    { src: "homeroom/machines/bbgterminal.png", title: "The Terminal" },
    { src: "homeroom/machines/tonic.png",       title: "Tonic Operator" },
    { src: "homeroom/machines/commodore.png",   title: "How to Produce Sound Effects" }
  ];

  // ===== CSV config (same format as Sad Girls) =====
  const SHEET_CSV_URL = "homeroom/REFsiteartdescriptions.csv";
  const PAGE_SLUG     = "machines";
  const DEFAULT_EXT   = "png";

  const colEls = [
    document.getElementById("col1"),
    document.getElementById("col2"),
    document.getElementById("col3"),
  ];

  let currentIndex = 0;
  let META_BY_KEY = {};
  let ACTIVE_LOAD = 0; // cancels stale image loads in the lightbox

  // Helpers to match CSS breakpoints/orientation
  const isPortraitMobile = () =>
    window.matchMedia("(max-width: 720px) and (orientation: portrait)").matches;

  // ===== Boot: load CSV, map metadata, then render grid =====
  (async () => {
    try {
      const res = await fetch(`${SHEET_CSV_URL}?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`CSV HTTP ${res.status}`);
      const rows = parseCSV(await res.text());
      META_BY_KEY = buildMetaMap(rows, PAGE_SLUG);

      // attach meta to IMAGES by fuzzy filename key
      IMAGES.forEach(img => {
        const key = base(img.src);
        img.meta =
          META_BY_KEY[key] ||
          fuzzyFindMeta(key, META_BY_KEY) ||
          { title: img.title || "", year: "", medium: "", size: "" };
      });
    } catch (e) {
      console.warn("Machines: CSV load failed; continuing without metadata.", e);
      IMAGES.forEach(img => { img.meta = { title: img.title || "", year: "", medium: "", size: "" }; });
    } finally {
      render();              // desktop layout by default
      enhanceMobileStream(); // adjust if portrait mobile
    }
  })();

  // ===== Helpers: filenames, CSV → meta map =====
  function base(path) {
    return path.split("/").pop().replace(/\.[a-z0-9]+$/i, "").toLowerCase();
  }

  function buildMetaMap(rows, pageSlug) {
    if (!rows.length) return {};
    const header = rows[0].map(h => h.trim().toLowerCase());
    const idx = (n) => header.indexOf(n);

    const iSite   = idx("site page");
    const iFile   = idx("file");
    const iTitle  = idx("title");
    const iYear   = idx("year");
    const iMedium = idx("medium");
    const iSize   = idx("size");

    const map = {};
    rows.slice(1).forEach(r => {
      if (!r[iSite] || r[iSite].trim().toLowerCase() !== pageSlug) return;

      const fileRaw = (r[iFile] || "").trim();
      const file = /\.[a-z0-9]+$/i.test(fileRaw) ? fileRaw : `${fileRaw}.${DEFAULT_EXT}`;
      const key = file.replace(/\.[a-z0-9]+$/i, "").toLowerCase();

      map[key] = {
        title:  r[iTitle]  || "",
        year:   r[iYear]   || "",
        medium: r[iMedium] || "",
        size:   r[iSize]   || ""
      };
    });
    return map;
  }

  function fuzzyFindMeta(key, map) {
    if (map[key]) return map[key];
    const keys = Object.keys(map);
    const k1 = keys.find(k => key.includes(k));
    if (k1) return map[k1];
    const k2 = keys.find(k => k.includes(key));
    if (k2) return map[k2];
    return null;
  }

  // ===== Fit math used by both the grow animation and final size =====
  function computeFit(natW, natH) {
    const vw = window.innerWidth, vh = window.innerHeight;
    const maxW = Math.floor(vw * 0.92);
    const maxH = Math.floor(vh * 0.92);
    const scale = Math.min(maxW / natW, maxH / natH);
    const targetW = Math.round(natW * scale);
    const targetH = Math.round(natH * scale);
    const targetLeft = Math.round((vw - targetW) / 2);
    const targetTop  = Math.round((vh - targetH) / 2);
    return { targetW, targetH, targetLeft, targetTop };
  }

  // ===== Caption (Sad Girls style: 3 lines) =====
  function formatMeta(meta) {
    if (!meta) return "";
    const l1 = [ meta.title ? `<em>${meta.title}</em>` : "", meta.year ].filter(Boolean).join(", ");
    const l2 = (meta.medium || "");
    const l3 = (meta.size || "");
    return [l1, l2, l3].filter(Boolean).join("<br>");
  }

  // ===== Lightbox scaffold + controls (desktop + mobile landscape) =====
  function ensureLightbox() {
    let root = document.querySelector(".lightbox");
    if (root) return root;

    root = document.createElement("div");
    root.className = "lightbox";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.innerHTML = `
      <div class="backdrop" data-close></div>
      <div class="frame" aria-live="polite">
        <div class="edge left"  data-prev></div>
        <div class="img-wrap">
          <img alt="" />
          <div class="lb-caption" id="lbCaption"></div>
        </div>
        <div class="edge right" data-next></div>
      </div>
    `;
    document.body.appendChild(root);

    // clicks
    root.addEventListener("click", (e) => {
      if (e.target.matches("[data-close]")) closeLightbox();
      if (e.target.matches("[data-prev]"))  showRelative(-1);
      if (e.target.matches("[data-next]"))  showRelative(+1);
    });

    // keyboard
    window.addEventListener("keydown", (e) => {
      if (!root.classList.contains("open")) return;
      if (e.key === "Escape")     closeLightbox();
      if (e.key === "ArrowLeft")  showRelative(-1);
      if (e.key === "ArrowRight") showRelative(+1);
    });

    // touch swipe (works in mobile landscape; safe elsewhere)
    let startX = null, startY = null;
    const THRESH_X = 40, THRESH_Y = 30;

    root.addEventListener("touchstart", (e) => {
      if (!root.classList.contains("open")) return;
      const t = e.touches?.[0]; if (!t) return;
      startX = t.clientX; startY = t.clientY;
    }, { passive: true });

    root.addEventListener("touchend", (e) => {
      if (!root.classList.contains("open")) return;
      const t = e.changedTouches?.[0]; if (!t || startX == null) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (Math.abs(dx) > THRESH_X && Math.abs(dy) < THRESH_Y) {
        if (dx > 0) showRelative(-1); else showRelative(+1);
      }
      startX = startY = null;
    }, { passive: true });

    return root;
  }

  // Core: load an image into the lightbox WITHOUT ever showing an old image first
  function setLightboxImage(idx) {
    const lb  = ensureLightbox();
    const img = lb.querySelector(".img-wrap > img");
    const cap = lb.querySelector("#lbCaption");
    const item = IMAGES[idx];

    // Hide the currently-displayed image immediately to prevent any flash
    img.style.opacity = "0";

    const token = ++ACTIVE_LOAD; // cancel any stale loads that complete later

    const temp = new Image();
    temp.onload = () => {
      if (token !== ACTIVE_LOAD) return; // a newer request started → ignore this one

      // Compute target size from natural dimensions
      const { targetW } = computeFit(temp.naturalWidth, temp.naturalHeight);

      // Swap pixels atomically
      img.style.width = `${targetW}px`;
      img.style.height = "auto";
      img.src = temp.src;
      img.alt = item.title || "";

      // Update caption and geometry
      cap.innerHTML = formatMeta(item.meta);
      const isOpen = lb.classList.contains("open");
      if (isOpen) updateCaptionWidth(lb);

      // Reveal the new image now that it's ready
      requestAnimationFrame(() => { img.style.opacity = "1"; });
    };
    temp.src = item.src;
  }

  function openLightboxFromThumb(idx, thumbEl) {
    const lb = ensureLightbox();
    const wasOpen = lb.classList.contains("open");

    currentIndex = idx;

    // Start loading the correct image first; image is hidden until ready
    setLightboxImage(currentIndex);

    if (wasOpen) {
      // Already open (mobile landscape or desktop switching) → no grow animation
      return;
    }

    // Not open yet → run the grow-from-thumb animation, then reveal
    const rect = thumbEl.getBoundingClientRect();
    const clone = thumbEl.cloneNode();
    Object.assign(clone.style, {
      position: "fixed",
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      zIndex: "10000",
      margin: "0",
      transform: "translateZ(0)",
      willChange: "left, top, width, height, transform",
      cursor: "zoom-out",
      transition: "left 260ms ease, top 260ms ease, width 260ms ease, height 260ms ease"
    });
    document.body.appendChild(clone);

    const natW = thumbEl.naturalWidth || rect.width;
    const natH = thumbEl.naturalHeight || rect.height;
    const { targetW, targetH, targetLeft, targetTop } = computeFit(natW, natH);

    requestAnimationFrame(() => {
      clone.style.left   = `${targetLeft}px`;
      clone.style.top    = `${targetTop}px`;
      clone.style.width  = `${targetW}px`;
      clone.style.height = `${targetH}px`;
    });

    clone.addEventListener("transitionend", () => {
      clone.remove();
      lb.classList.add("open");
      updateCaptionWidth(lb);
    }, { once: true });
  }

  function closeLightbox() {
    const lb = ensureLightbox();
    lb.classList.remove("open");
  }

  function showRelative(delta) {
    currentIndex = (currentIndex + delta + IMAGES.length) % IMAGES.length;
    setLightboxImage(currentIndex);
  }

  // ===== Caption width logic (desktop/lightbox visible states) =====
  function cssPx(varName, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function updateCaptionWidth(lb) {
    const img = lb.querySelector('.img-wrap > img');
    const cap = lb.querySelector('#lbCaption');
    if (!img || !cap) return;

    const imgRect     = img.getBoundingClientRect();
    if (!imgRect.width) return; // avoid 0-width while hidden

    const edgeMargin  = cssPx('--lb-edge-margin', 32);
    const available   = Math.max(0, imgRect.left - edgeMargin);
    const usable      = Math.floor(available * 0.98);
    const minReadable = 220;
    const finalW      = Math.max(minReadable, usable);

    cap.style.setProperty('width', `${finalW}px`, 'important');
    cap.style.removeProperty('max-width');
  }

  // ===== Cards (grid) =====
  function makeCard(item, index) {
    const card = document.createElement("article");
    card.className = "card";
    card.dataset.index = String(index); // used to re-bind on rotate
    card.tabIndex = 0;

    const img = document.createElement("img");
    img.alt = item.title || "";
    img.loading = "lazy";
    img.decoding = "async";
    img.src = item.src;
    img.addEventListener("error", () => { card.remove(); }, { once: true });

    const overlay = document.createElement("div");
    overlay.className = "overlay";
    const label = document.createElement("div");
    label.className = "label";
    label.textContent = item.title || "";
    overlay.appendChild(label);

    // Bind desktop/lightbox interactions unless portrait mobile
    if (!isPortraitMobile()) {
      enableDesktopInteractions(card);
    } else {
      card.tabIndex = -1;
    }

    card.appendChild(img);
    card.appendChild(overlay);
    return card;
  }

  function enableDesktopInteractions(card) {
    if (card.dataset.bound === "1") return;
    const idx = Number(card.dataset.index);
    const img = card.querySelector("img");
    if (!img || Number.isNaN(idx)) return;

    const open = () => openLightboxFromThumb(idx, img);
    img.addEventListener("click", open);
    card.addEventListener("keypress", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });

    card.tabIndex = 0;
    card.dataset.bound = "1";
  }

  function render() {
    if (!colEls.every(Boolean)) return;
    IMAGES.forEach((it, i) => {
      const col = colEls[i % 3];
      col.appendChild(makeCard(it, i));
    });
  }

  // ===== Tiny CSV parser =====
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

  // ---------- Helper: image decode with Safari-safe fallback ----------
  function decodeImg(img) {
    if (img.decode) {
      return img.decode().catch(() =>
        new Promise(res => (img.complete ? res() : img.addEventListener('load', res, { once: true })))
      );
    }
    return new Promise(res => (img.complete ? res() : img.addEventListener('load', res, { once: true })));
  }

  // ======== MOBILE-ONLY ENHANCER (portrait only; restores on rotate) ========
  async function enhanceMobileStream() {
    const portrait = isPortraitMobile();

    if (portrait) {
      const col1 = document.getElementById('col1');
      if (!col1) return;

      // move all cards into a list and remove from DOM to avoid layout shifts
      const cards = Array.from(document.querySelectorAll('.col .card'));
      cards.forEach(c => c.remove());

      // hide other columns (CSS also handles this)
      if (colEls[1]) colEls[1].style.display = 'none';
      if (colEls[2]) colEls[2].style.display = 'none';

      // Preload + decode images, then add captions, then attach in order
      const prepared = await Promise.all(cards.map(async (card) => {
        const img = card.querySelector('img');
        if (img) {
          img.loading = 'eager';
          img.decoding = 'async';
          await decodeImg(img); // ensure pixels are ready; prevents text-first stacking & pushes
        }

        // Add mobile caption only after image is ready (so image shows before/with text)
        if (!card.querySelector('.mobile-caption')) {
          const key  = img ? base(img.src) : null;
          const meta = (key && (META_BY_KEY[key] || fuzzyFindMeta(key, META_BY_KEY))) || {
            title: img?.alt || "", year: "", medium: "", size: ""
          };
          const cap = document.createElement('div');
          cap.className = 'mobile-caption';
          cap.innerHTML = formatMeta(meta);
          card.appendChild(cap);
        }

        // portrait disables keyboard/lightbox
        card.tabIndex = -1;
        return card;
      }));

      // Insert all finished cards at once → no in-flow movement during load
      const frag = document.createDocumentFragment();
      prepared.forEach(c => frag.appendChild(c));

      col1.innerHTML = '';
      col1.appendChild(frag);

    } else {
      // restore desktop columns and interactions (used on rotate to landscape)
      if (colEls[1]) colEls[1].style.removeProperty('display');
      if (colEls[2]) colEls[2].style.removeProperty('display');

      const cards = Array.from(document.querySelectorAll('#col1 .card, #col2 .card, #col3 .card'));
      colEls.forEach(c => c.innerHTML = '');
      cards.forEach((card, i) => {
        colEls[i % 3].appendChild(card);
        enableDesktopInteractions(card);
        card.tabIndex = 0;
      });
    }
  }

  // resize + rotate handling
  window.addEventListener("resize", () => {
    clearTimeout(window.__machines_rerender);
    window.__machines_rerender = setTimeout(() => {
      enhanceMobileStream();
      const lb = document.querySelector('.lightbox.open');
      if (lb) updateCaptionWidth(lb);
    }, 120);
  });
})();


  // ===== Crosshair (desktop only) ==========================================
  (function initCrosshair() {
    // Respect device capabilities: only run where hover + fine pointer exists
    const showCrosshair = window.matchMedia &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!showCrosshair) return;

    // Build overlay
    const root = document.createElement('div');
    root.className = 'crosshair';
    root.innerHTML = `
      <div class="crosshair__h"></div>
      <div class="crosshair__v"></div>
      <div class="crosshair__dot"></div>
    `;
    document.body.appendChild(root);

    const h   = root.querySelector('.crosshair__h');
    const v   = root.querySelector('.crosshair__v');
    const dot = root.querySelector('.crosshair__dot');

    // Smoothed follower (simple exponential smoothing / lerp)
    let targetX = window.innerWidth  / 2;
    let targetY = window.innerHeight / 2;
    let curX = targetX, curY = targetY;
    const ease = 0.15; // lower = more lag

    let rafId = null;
    function loop() {
      curX += (targetX - curX) * ease;
      curY += (targetY - curY) * ease;

      // Position lines and center square
      h.style.top   = `${curY}px`;
      v.style.left  = `${curX}px`;
      dot.style.left = `${curX}px`;
      dot.style.top  = `${curY}px`;

      rafId = requestAnimationFrame(loop);
    }

    // Kick off after the first mouse move (so it jumps to pointer)
    function onMove(e) {
      targetX = e.clientX;
      targetY = e.clientY;
      if (rafId == null) rafId = requestAnimationFrame(loop);
    }
    window.addEventListener('mousemove', onMove, { passive: true });

    // "Explosion" on click anywhere
    function boom() {
      const b = document.createElement('div');
      b.className = 'crosshair__boom';
      b.style.left = `${curX}px`;
      b.style.top  = `${curY}px`;
      root.appendChild(b);
      b.addEventListener('animationend', () => b.remove(), { once: true });
    }
    window.addEventListener('click', boom, { passive: true });

    // Keep centered if window is resized before mouse moves again
    window.addEventListener('resize', () => {
      if (rafId == null) {
        curX = targetX = window.innerWidth  / 2;
        curY = targetY = window.innerHeight / 2;
        h.style.top   = `${curY}px`;
        v.style.left  = `${curX}px`;
        dot.style.left = `${curX}px`;
        dot.style.top  = `${curY}px`;
      }
    });
  })();
