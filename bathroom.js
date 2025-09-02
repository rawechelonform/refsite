/* Config
   Place your tags inside: bathroom/tags/
   Also create bathroom/tags/tags.json that lists the filenames, e.g.:
   ["sticker1.png","sticker2.webp","logo.svg"]
*/
const TAGS_JSON_URL = "bathroom/tags/tags.json";

/* If fetching JSON fails (e.g., local file preview without a server), fallback here */
const FALLBACK_TAGS = [
  // "bathroom/tags/example1.png",
  // "bathroom/tags/example2.png",
];

/* Backgrounds you can rotate if you want */
const BACKGROUNDS = [
  "bathroom/bathroom_orangegreen.png",
  "bathroom/bathroom_redblack.png",
  "bathroom/bathroom_reddarkblue.png",
  "bathroom/bathroom_redgrey.png",
  "bathroom/bathroom_redlightblue.png"
];

const wall = document.getElementById("wall");
const layer = document.getElementById("tags-layer");
const btnRegen = document.getElementById("regen");
const inputCount = document.getElementById("count");
const inputAvoid = document.getElementById("avoid");
const ovalDebug = document.getElementById("mirror-oval");

/* Oval geometry pulled from CSS custom properties */
function readOval(w, h) {
  const style = getComputedStyle(document.documentElement);
  const cxPerc = parseFloat(style.getPropertyValue("--oval-cx")) / 100 || 0.5;
  const cyPerc = parseFloat(style.getPropertyValue("--oval-cy")) / 100 || 0.5;

  const rxStr = style.getPropertyValue("--oval-rx").trim();
  const ryStr = style.getPropertyValue("--oval-ry").trim();

  const rx = unitToPixels(rxStr, w, h);
  const ry = unitToPixels(ryStr, w, h);

  return {
    cx: cxPerc * w,
    cy: cyPerc * h,
    rx,
    ry
  };
}

/* Convert a CSS length string (px, vw, vh) into pixels */
function unitToPixels(v, vw, vh) {
  if (v.endsWith("px")) return parseFloat(v);
  if (v.endsWith("vw")) return parseFloat(v) * vw / 100;
  if (v.endsWith("vh")) return parseFloat(v) * vh / 100;
  // fallback: try number
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

/* ellipse test: is a point inside the oval? */
function pointInEllipse(x, y, oval) {
  const nx = (x - oval.cx) / oval.rx;
  const ny = (y - oval.cy) / oval.ry;
  return (nx*nx + ny*ny) <= 1;
}

/* quick rect vs ellipse intersection by sampling rect center + corners */
function rectIntersectsOval(rect, oval) {
  const pts = [
    [rect.x + rect.w/2, rect.y + rect.h/2],    // center
    [rect.x, rect.y],                          // tl
    [rect.x + rect.w, rect.y],                 // tr
    [rect.x, rect.y + rect.h],                 // bl
    [rect.x + rect.w, rect.y + rect.h]         // br
  ];
  return pts.some(([px, py]) => pointInEllipse(px, py, oval));
}

/* simple axis-aligned rect intersection */
function rectsOverlap(a, b) {
  return !(a.x + a.w < b.x ||
           b.x + b.w < a.x ||
           a.y + a.h < b.y ||
           b.y + b.h < a.y);
}

/* random helpers */
const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));

/* get CSS sizing variables */
function getSizeRange() {
  const cs = getComputedStyle(document.documentElement);
  const min = parseFloat(cs.getPropertyValue("--tag-min")) || 70;
  const max = parseFloat(cs.getPropertyValue("--tag-max")) || 180;
  return {min, max};
}

/* pick a random background image if desired */
function setRandomBackground() {
  const bg = BACKGROUNDS[randInt(0, BACKGROUNDS.length - 1)];
  wall.style.setProperty("--wall-image", `url("${bg}")`);
}

/* load tag list from JSON, else fallback */
async function loadTagList() {
  try {
    const res = await fetch(TAGS_JSON_URL, {cache: "no-cache"});
    if (!res.ok) throw new Error("tags.json not found");
    const list = await res.json();
    return list.map(name => {
      // Normalize to full path under bathroom/tags
      return name.startsWith("bathroom/tags/")
        ? name
        : `bathroom/tags/${name}`;
    });
  } catch {
    return FALLBACK_TAGS;
  }
}

/* main generator */
async function generateTags() {
  const count = Math.max(1, Math.min(200, parseInt(inputCount.value || "18", 10)));
  const avoidOverlap = !!inputAvoid.checked;

  // clear previous
  layer.innerHTML = "";

  // optional: randomize background each time
  // setRandomBackground();

  const tags = await loadTagList();
  if (!tags || tags.length === 0) {
    console.warn("No tag images found. Add filenames to bathroom/tags/tags.json or FALLBACK_TAGS.");
    return;
  }

  const {width: W, height: H} = layer.getBoundingClientRect();
  const oval = readOval(W, H);
  const {min, max} = getSizeRange();

  const placed = []; // keep rects for overlap avoidance

  for (let i = 0; i < count; i++) {
    const src = tags[randInt(0, tags.length - 1)];
    const img = document.createElement("img");
    img.className = "tag";
    img.alt = "";
    img.decoding = "async";
    img.loading = "lazy";
    img.src = src;

    // Decide desired width and rotation
    const targetW = rand(min, max);
    const rot = rand(-22, 22); // fun tilt

    // Try multiple times to place a valid spot
    const MAX_TRIES = 100;
    let attempt = 0, ok = false, rx = 0, ry = 0, rect;

    while (attempt++ < MAX_TRIES && !ok) {
      rx = rand(0, W - targetW);
      // approximate height from width before image loads (square-ish stickers look fine)
      const approxH = targetW * rand(0.75, 1.25);
      ry = rand(0, H - approxH);

      rect = {x: rx, y: ry, w: targetW, h: approxH};

      // keep away from the oval
      if (rectIntersectsOval(rect, oval)) continue;

      // avoid overlap with previously placed tags if enabled
      if (avoidOverlap && placed.some(p => rectsOverlap(p, rect))) continue;

      ok = true;
    }

    if (!ok) {
      // give up on this sticker
      continue;
    }

    // record placement rect
    placed.push(rect);

    // position the element
    img.style.left = `${rect.x}px`;
    img.style.top = `${rect.y}px`;
    img.style.width = `${rect.w}px`;
    img.style.transform = `rotate(${rot}deg)`;

    layer.appendChild(img);
  }
}

/* UI actions */
btnRegen.addEventListener("click", generateTags);
document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "o") {
    ovalDebug.classList.toggle("hidden");
  }
});

/* kickoff */
window.addEventListener("load", () => {
  // ensure the wall background respects the data attribute
  const bg = wall.getAttribute("data-bg");
  if (bg) wall.style.setProperty("--wall-image", `url("${bg}")`);
  generateTags();
});
