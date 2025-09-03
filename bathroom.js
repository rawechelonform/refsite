/* ---------- config ---------- */
const TAGS_JSON_URL = "bathroom/tags/tags.json";
const STICKER_COUNT = 20;          // you control this
const AVOID_OVERLAP = true;        // you control this
const BASE_STICKER_DELAY = 500;    // wait after headline shows before 1st sticker (ms)
const STAGGER_MS = 60;             // gap between stickers (ms)

const BACKGROUNDS = [
  "bathroom/bathroom_orangegreen.png",
  "bathroom/bathroom_redblack.png",
  "bathroom/bathroom_reddarkblue.png",
  "bathroom/bathroom_redgrey.png",
  "bathroom/bathroom_redlightblue.png"
];

/* ---------- elements ---------- */
const wall      = document.getElementById("wall");
const layer     = document.getElementById("tags-layer");
const ovalDebug = document.getElementById("mirror-oval");

/* ---------- helpers ---------- */
const rand = (min, max) => Math.random() * (max - min) + min;
function shuffle(a){ const x=a.slice(); for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [x[i],x[j]]=[x[j],x[i]];} return x; }
function unitToPixels(v, vw, vh) {
  if (!v) return 0; v = v.trim();
  if (v.endsWith("px")) return parseFloat(v);
  if (v.endsWith("vw")) return (parseFloat(v) * vw) / 100;
  if (v.endsWith("vh")) return (parseFloat(v) * vh) / 100;
  const n = parseFloat(v); return isNaN(n) ? 0 : n;
}
function readOval(w, h) {
  const cs = getComputedStyle(document.documentElement);
  const cx = (parseFloat(cs.getPropertyValue("--oval-cx"))/100 || .5) * w;
  const cy = (parseFloat(cs.getPropertyValue("--oval-cy"))/100 || .5) * h;
  const rx = unitToPixels(cs.getPropertyValue("--oval-rx"), w, h);
  const ry = unitToPixels(cs.getPropertyValue("--oval-ry"), w, h);
  return { cx, cy, rx, ry };
}
function pointInEllipse(x,y,o){ const nx=(x-o.cx)/o.rx, ny=(y-o.cy)/o.ry; return nx*nx+ny*ny<=1; }
function rectIntersectsOval(r,o){
  const pts=[[r.x+r.w/2,r.y+r.h/2],[r.x,r.y],[r.x+r.w,r.y],[r.x,r.y+r.h],[r.x+r.w,r.y+r.h]];
  return pts.some(([px,py])=>pointInEllipse(px,py,o));
}
function rectsOverlap(a,b){
  return !(a.x+a.w<b.x || b.x+b.w<a.x || a.y+a.h<b.y || b.y+b.h<a.y);
}
function getSizeRange(){
  const cs = getComputedStyle(document.documentElement);
  return {
    min: parseFloat(cs.getPropertyValue("--tag-min")) || 70,
    max: parseFloat(cs.getPropertyValue("--tag-max")) || 180
  };
}
function preloadImage(src){
  return new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(src); i.onerror=rej; i.src=src; });
}
async function loadTagList(){
  try{
    const r = await fetch(TAGS_JSON_URL, { cache: "no-cache" });
    if(!r.ok) throw new Error("fetch failed");
    const list = await r.json();
    if(!Array.isArray(list)) throw new Error("tags.json is not an array");
    return list.map(n => n.startsWith("bathroom/tags/") ? n : `bathroom/tags/${n}`);
  }catch(err){
    console.error("Error loading tag list:", err);
    return [];
  }
}

/* ---------- stickers ---------- */
async function generateTags(){
  layer.innerHTML = "";

  const tags = await loadTagList();
  if (!tags.length) {
    console.warn("No tag images found. Ensure bathroom/tags/tags.json exists and lists files.");
    return;
  }
  const uniqueTags = shuffle(tags).slice(0, Math.min(STICKER_COUNT, tags.length));

  const { width: W, height: H } = layer.getBoundingClientRect();
  const oval = readOval(W, H);
  const { min, max } = getSizeRange();
  const placed = [];

  let index = 0;
  for (const src of uniqueTags) {
    const img = document.createElement("img");
    img.className = "tag";
    img.decoding = "async";
    img.loading  = "lazy";
    img.src = src;

    const targetW = rand(min, max);
    const rot = rand(-22, 22);

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

    // Append one-by-one (no CSS animation)
    const delayMs = BASE_STICKER_DELAY + index * STAGGER_MS;
    setTimeout(() => layer.appendChild(img), delayMs);

    index++;
  }
}

/* ---------- boot ---------- */
window.addEventListener("load", async () => {
  // 1) Choose background (data-bg wins)
  const bg = wall.getAttribute("data-bg") || BACKGROUNDS[0];

  // 2) Preload bg; only then apply and reveal headline
  try { await preloadImage(bg); } catch {}
  wall.style.setProperty("--wall-image", `url("${bg}")`);

  // Flip the CSS switch on the next frame so the headline fades in after bg is set
  requestAnimationFrame(() => {
    document.documentElement.classList.add("bg-ready");
  });

  // 3) Start sticker placement (their own BASE_STICKER_DELAY controls the pause)
  generateTags();
});

/* Optional: toggle oval with “O” */
document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "o") {
    ovalDebug.classList.toggle("hidden");
  }
});
