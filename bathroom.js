/* ---------- config ---------- */
const TAGS_JSON_URL = "bathroom/tags/tags.json";
const STICKER_COUNT = 100;          // you control this
const AVOID_OVERLAP = true;        // you control this
const BASE_STICKER_DELAY = 100;    // first sticker delay (ms) — your latest choice
const STAGGER_MS = 130;             // gap between stickers (ms)

const BACKGROUNDS = [
  "bathroom/bathroom_orangegreen.png",
  "bathroom/bathroom_redblack.png",
  "bathroom/bathroom_reddarkblue.png",
  "bathroom/bathroom_redgrey.png",
  "bathroom/bathroom_redlightblue.png"
];

/* ---------- element refs ---------- */
const wall      = document.getElementById("wall");
const layer     = document.getElementById("tags-layer");
const ovalDebug = document.getElementById("mirror-oval");

/* ---------- helpers ---------- */
const rand = (min, max) => Math.random() * (max - min) + min;

function shuffle(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function unitToPixels(v, vw, vh) {
  if (!v) return 0;
  v = v.trim();
  if (v.endsWith("px")) return parseFloat(v);
  if (v.endsWith("vw")) return (parseFloat(v) * vw) / 100;
  if (v.endsWith("vh")) return (parseFloat(v) * vh) / 100;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function readOval(w, h) {
  const cs = getComputedStyle(document.documentElement);
  const cx = (parseFloat(cs.getPropertyValue("--oval-cx"))/100 || .5) * w;
  const cy = (parseFloat(cs.getPropertyValue("--oval-cy"))/100 || .5) * h;
  const rx = unitToPixels(cs.getPropertyValue("--oval-rx"), w, h);
  const ry = unitToPixels(cs.getPropertyValue("--oval-ry"), w, h);
  return { cx, cy, rx, ry };
}

function pointInEllipse(x, y, o) {
  const nx = (x - o.cx) / o.rx;
  const ny = (y - o.cy) / o.ry;
  return nx * nx + ny * ny <= 1;
}

function rectIntersectsOval(r, o) {
  const pts = [
    [r.x + r.w / 2, r.y + r.h / 2],
    [r.x, r.y],
    [r.x + r.w, r.y],
    [r.x, r.y + r.h],
    [r.x + r.w, r.y + r.h],
  ];
  return pts.some(([px, py]) => pointInEllipse(px, py, o));
}

function rectsOverlap(a, b) {
  return !(
    a.x + a.w < b.x ||
    b.x + b.w < a.x ||
    a.y + a.h < b.y ||
    b.y + b.h < a.y
  );
}

function getSizeRange() {
  const cs = getComputedStyle(document.documentElement);
  const min = parseFloat(cs.getPropertyValue("--tag-min")) || 70;
  const max = parseFloat(cs.getPropertyValue("--tag-max")) || 180;
  return { min, max };
}

function preloadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(src);
    img.onerror = reject;
    img.src = src;
  });
}

/* ---------- tags.json loader ---------- */
async function loadTagList() {
  try {
    const res = await fetch(TAGS_JSON_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error(`Failed to fetch ${TAGS_JSON_URL}`);
    const data = await res.json();

    // Support array of strings OR array of objects with {file: "..."}
    if (Array.isArray(data) && typeof data[0] === "string") {
      return data.map(file => ({
        file,
        path: file.startsWith("bathroom/tags/") ? file : `bathroom/tags/${file}`
      }));
    }
    if (Array.isArray(data) && typeof data[0] === "object") {
      return data.map(item => {
        const file = item.file || "";
        const path = file.startsWith("bathroom/tags/") ? file : `bathroom/tags/${file}`;
        return { ...item, file, path };
      });
    }
    return [];
  } catch (err) {
    console.error("Error loading tag list:", err);
    return [];
  }
}

/* ---------- tooltip helpers (floating overlay) ---------- */
// Build tooltip text from filename:
// - strip extension
// - remove trailing -<number>
// - underscores -> spaces
// - dashes -> new lines
function titleFromSimpleFilename(src) {
  let base = src.split("/").pop().replace(/\.[a-z0-9]+$/i, "");
  base = base.replace(/-\d+$/, "");
  return base.replace(/_/g, " ").replace(/-/g, "\n");
}

// Create one global tooltip div (added when DOM is ready)
const TIP = document.createElement("div");
TIP.className = "hover-tip";
document.addEventListener("DOMContentLoaded", () => {
  document.body.appendChild(TIP);
});

function showTip(text) {
  TIP.textContent = text;
  TIP.style.opacity = "1";
}
function moveTip(e) {
  const offsetX = 14, offsetY = 12;
  TIP.style.transform = `translate(${e.clientX + offsetX}px, ${e.clientY - offsetY}px)`;
}
function hideTip() {
  TIP.style.opacity = "0";
  TIP.style.transform = "translate(-9999px, -9999px)";
}

/* ---------- main ---------- */
async function generateTags() {
  layer.innerHTML = "";

  const tags = await loadTagList();
  if (!tags.length) {
    console.warn("No tag images found. Ensure bathroom/tags/tags.json exists and lists files.");
    return;
  }

  const unique = shuffle(tags).slice(0, Math.min(STICKER_COUNT, tags.length));
  const { width: W, height: H } = layer.getBoundingClientRect();
  const oval = readOval(W, H);
  const { min, max } = getSizeRange();
  const placed = [];

  let index = 0;
  for (const item of unique) {
    const src = item.path || item; // supports both formats
    const img = document.createElement("img");
    img.className = "tag";
    img.decoding = "async";
    img.loading  = "lazy";
    img.src = src;

    // Tooltip wiring
    const tip = titleFromSimpleFilename(src);
    img.alt = tip;
    img.setAttribute("aria-label", tip);
    img.addEventListener("mouseenter", (e) => { showTip(tip); moveTip(e); });
    img.addEventListener("mousemove",  moveTip);
    img.addEventListener("mouseleave",  hideTip);

    // Random size/rotation
    const targetW = rand(min, max);
    const rot = rand(-22, 22);

    // Find a non-overlapping, non-oval spot
    let ok = false, rect;
    for (let attempt = 0; attempt < 100 && !ok; attempt++) {
      const approxH = targetW * rand(0.75, 1.25);
      const rx = rand(0, W - targetW);
      const ry = rand(0, H - approxH);
      rect = { x: rx, y: ry, w: targetW, h: approxH };

      if (rectIntersectsOval(rect, oval)) continue;
      if (AVOID_OVERLAP && placed.some(p => rectsOverlap(p, rect))) continue;

      ok = true;
    }
    if (!ok) continue;

    placed.push(rect);
    img.style.left = `${rect.x}px`;
    img.style.top  = `${rect.y}px`;
    img.style.width = `${rect.w}px`;
    img.style.transform = `rotate(${rot}deg)`;

    // One-by-one appearance (no CSS animation)
    const delayMs = BASE_STICKER_DELAY + index * STAGGER_MS;
    setTimeout(() => layer.appendChild(img), delayMs);

    index++;
  }
}

/* ---------- boot ---------- */
window.addEventListener("load", async () => {
  // Use data-bg if present, else fallback
  const bg = wall.getAttribute("data-bg") || BACKGROUNDS[0];

  // Preload bg, apply, then reveal headline
  try { await preloadImage(bg); } catch {}
  wall.style.setProperty("--wall-image", `url("${bg}")`);

  requestAnimationFrame(() => {
    document.documentElement.classList.add("bg-ready");
  });

  // Start stickers
  generateTags();
});

/* Optional: toggle oval with “O” */
document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "o") {
    ovalDebug.classList.toggle("hidden");
  }
});
