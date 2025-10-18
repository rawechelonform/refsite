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
  let ACTIVE_LOAD = 0; // bump this for every image load to cancel stale onloads


  // Helper: portrait-only mobile matches CSS
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

  // ===== Lightbox scaffold + controls (desktop) =====
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

    // touch swipe
    let startX = null;
    root.addEventListener("touchstart", (e) => {
      if (!root.classList.contains("open")) return;
      startX = e.touches?.[0]?.clientX ?? null;
    }, { passive: true });
    root.addEventListener("touchend", (e) => {
      if (startX == null) return;
      const endX = e.changedTouches?.[0]?.clientX ?? null;
      if (endX == null) return;
      const dx = endX - startX;
      if (dx > 40)  showRelative(-1);
      if (dx < -40) showRelative(+1);
      startX = null;
    }, { passive: true });

    return root;
  }

  function setLightboxImage(idx) {
  const lb  = ensureLightbox();
  const img = lb.querySelector(".img-wrap > img");
  const cap = lb.querySelector("#lbCaption");
  const item = IMAGES[idx];

  const token = ++ACTIVE_LOAD; // invalidate any prior pending loads

  const temp = new Image();
  temp.onload = () => {
    // If another image started loading after this one, bail
    if (token !== ACTIVE_LOAD) return;

    const { targetW } = computeFit(temp.naturalWidth, temp.naturalHeight);
    img.style.width = `${targetW}px`;
    img.style.height = "auto";
    img.src = temp.src;
    img.alt = item.title || "";

    cap.innerHTML = formatMeta(item.meta);

    if (lb.classList.contains("open")) updateCaptionWidth(lb);
  };
  temp.src = item.src;
}


  function openLightboxFromThumb(idx, thumbEl) {
    currentIndex = idx;

    const lb = ensureLightbox();
    lb.classList.add("open");

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
      setLightboxImage(currentIndex);
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

  // ===== Caption width logic (desktop lightbox) =====
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

    // Bind desktop interactions only if not portrait mobile at creation time
    if (!isPortraitMobile()) {
      enableDesktopInteractions(card);
    } else {
      // reduce keyboard activation in portrait
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

  // ======== MOBILE-ONLY ENHANCER (portrait only; restores on rotate) ========
  function enhanceMobileStream() {
    const portrait = isPortraitMobile();

    if (portrait) {
      const col1 = document.getElementById('col1');
      if (!col1) return;

      // move all cards into col1 to create a single vertical stream
      const cards = Array.from(document.querySelectorAll('.col .card'));
      cards.forEach(c => {
        col1.appendChild(c);
        // insert a mobile caption under each image once
        if (!c.querySelector('.mobile-caption')) {
          const img  = c.querySelector('img');
          const key  = img ? base(img.src) : null;
          const meta = (key && (META_BY_KEY[key] || fuzzyFindMeta(key, META_BY_KEY))) || {
            title: img?.alt || "", year: "", medium: "", size: ""
          };
          const cap = document.createElement('div');
          cap.className = 'mobile-caption';
          cap.innerHTML = formatMeta(meta);
          c.appendChild(cap);
        }
        // reduce keyboard activation in portrait
        c.tabIndex = -1;
      });

      // hide other columns to remove gaps
      if (colEls[1]) colEls[1].style.display = 'none';
      if (colEls[2]) colEls[2].style.display = 'none';
    } else {
      // restore desktop columns and interactions (used on rotate to landscape)
      if (colEls[1]) colEls[1].style.removeProperty('display');
      if (colEls[2]) colEls[2].style.removeProperty('display');

      // gather all cards in DOM order, then redistribute round-robin
      const cards = Array.from(document.querySelectorAll('#col1 .card, #col2 .card, #col3 .card'));
      colEls.forEach(c => c.innerHTML = '');
      cards.forEach((card, i) => {
        colEls[i % 3].appendChild(card);
        enableDesktopInteractions(card);   // ensure clicks/keyboard are live again
        card.tabIndex = 0;
      });
    }
  }

  // resize + rotate handling
  window.addEventListener("resize", () => {
    clearTimeout(window.__machines_rerender);
    window.__machines_rerender = setTimeout(() => {
      enhanceMobileStream();
      // keep lightbox caption width correct if open
      const lb = document.querySelector('.lightbox.open');
      if (lb) updateCaptionWidth(lb);
    }, 120);
  });
})();
