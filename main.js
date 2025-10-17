(() => {
  // ==== CONFIG ==============================================================
  // Live CSV served by your Google Apps Script Web App (Option 2)
  // Replace with your actual /exec URL
  const SHEET_CSV_URL = "https://script.google.com/macros/s/AKfycbzZVJUApwBRK1Cbi92aPM0ZW6h00t92R7YjoHyrl9wa6PujA7kgjI78w5B0H6TD6hShag/exec";

  // Which page to pull rows for
  const PAGE_SLUG = "sadgirls";           // main page = "sadgirls"; machines page would be "machines"
  const IMG_ROOT  = "homeroom";           // your site’s image root folder
  const DEFAULT_EXT = "png";              // used when File column has no extension

  // ==== DOM ================================================================
  const stageImg  = document.getElementById("stageImg");
  const thumbBar  = document.getElementById("thumbBar");
  const captionEl = document.getElementById("caption");
  const stage     = document.getElementById("stage");

  // Move caption inside the image wrapper BEFORE any rendering happens
  const stageInner = document.querySelector('#stage .stage-inner');
  if (stageInner && captionEl && !stageInner.contains(captionEl)) {
    stageInner.appendChild(captionEl);
  }

  let IMAGES = [];
  let current = 0;

  // ==== Boot ===============================================================
  (async () => {
    try {
      // Cache-bust to avoid any intermediary caching
      const url = `${SHEET_CSV_URL}?t=${Date.now()}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`CSV HTTP ${res.status}`);
      const text = await res.text();

      const rows = parseCSV(text);
      IMAGES = rowsToImages(rows, PAGE_SLUG);
      if (!IMAGES.length) throw new Error("No matching rows");

      render();
    } catch (e) {
      console.error("Failed to load sheet:", e);
      // Fallback to a minimal local list if sheet not ready
      IMAGES = [
        { src: "homeroom/sadgirls/girl1.png", thumb: null, title: "Girl 1",
          meta: { title: "Girl 1", year: "", medium: "", size: "" } }
      ];
      render();
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
        // allow File column to be either "girl1" or "girl1.png"
        const hasExt = /\.[a-z0-9]+$/i.test(fileRaw);
        const file = hasExt ? fileRaw : `${fileRaw}.${DEFAULT_EXT}`;
        const src = `${IMG_ROOT}/${pageSlug}/${file}`;

        return {
          src,
          thumb: null,
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

  // ==== Carousel wiring ====================================================
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
      // Make failures visible instead of leaving the previous image up
      stageImg.removeAttribute("src");
      stageImg.alt = "Image failed to load";
    };

    img.src = item.src;

    captionEl.innerHTML = formatMeta(item.meta);
    [...thumbBar.children].forEach((el, ix) => el.classList.toggle("active", ix === i));
  }

  function formatMeta(m){
    if (!m) return "";
    const line1 = [ m.title ? `<em>${m.title}</em>` : "", m.year ].filter(Boolean).join(", ");
    const line2 = (m.medium || ""); // no quotes
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

  // ==== Tiny CSV parser (quotes + commas) ==================================
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
})();
