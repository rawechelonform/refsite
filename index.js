// ===== CONFIG =====
const TARGET      = "REF CORP";
const NEXT_URL    = "main.html";
const GO_HOLD_MS  = 300;
const SPRITE_PATH = "avatar/avatar_intro.png";

// Zoom frames
const FRAMES_DIR   = "landing/";
const FRAME_PREFIX = "zoom";   // zoom0.png ... zoom10.png
const FRAME_START  = 0;
const FRAME_END    = 10;       // inclusive
const FPS          = 12;

// ===== ELEMENTS =====
const staticEl  = document.getElementById("static-part");
const typeEl    = document.getElementById("typed-part");
const inputEl   = document.getElementById("cmd");
const typedEl   = document.getElementById("typed");
const hintEl    = document.getElementById("hint");
const figureEl  = document.querySelector(".figure");
const promptEl  = document.querySelector(".prompt");

const roomView  = document.getElementById('room');
const gateView  = document.getElementById('gate-view');
const enterBtn  = document.getElementById('enter-computer');
const zoomImg   = document.getElementById('zoom-frame');

// ===== COPY =====
const STATIC_TEXT = "ACCESS GATE //";
const TYPE_TEXT   = ' TYPE "REF CORP" + PRESS ENTER';

// ===== STATE =====
let terminalStarted = false;
let lockedOutput    = false;
let zoomPlaying     = false;

// ===== HELPERS =====
function typeWriter(text, el, speed = 40, done){
  let i = 0;
  if (!el) { done && done(); return; }
  el.textContent = "";
  (function step(){
    if(i <= text.length){
      el.textContent = text.slice(0, i++);
      setTimeout(step, speed);
    } else { done && done(); }
  })();
}

function escapeHTML(s){
  return String(s).replace(/[&<>\"']/g, c =>
    c === '&' ? '&amp;' :
    c === '<' ? '&lt;' :
    c === '>' ? '&gt;' :
    c === '\"' ? '&quot;' : '&#39;'
  );
}

// ===== ROOM BLINKERS =====
function makeBlinker(selector, minMs, maxMs){
  const nodes = Array.from(document.querySelectorAll(selector));
  if (nodes.length < 2) return;
  let current = nodes.findIndex(n => n.classList.contains('show'));
  if (current < 0) { current = 0; nodes[0].classList.add('show'); }

  function tick(){
    const choices = nodes.map((_, i) => i).filter(i => i !== current);
    const next = choices[Math.floor(Math.random() * choices.length)];
    nodes[current].classList.remove('show');
    nodes[next].classList.add('show');
    current = next;

    // refresh hit mask when FRONT track swaps (screen changes)
    if (selector === '.white-set') refreshHitMask();

    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    setTimeout(tick, delay);
  }
  const initial = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  setTimeout(tick, initial);
}
function startRoomBlinkers(){
  makeBlinker('.white-set', 120, 380); // front track
  makeBlinker('.black-set', 220, 520); // back track
}

// ===== ZOOM SEQUENCE =====
const frameList = [];
for(let i = FRAME_START; i <= FRAME_END; i++){
  frameList.push(`${FRAMES_DIR}${FRAME_PREFIX}${i}.png`);
}

function preload(srcs, cb){
  let loaded = 0;
  if (!srcs.length) { cb && cb(); return; }
  srcs.forEach(src => {
    const im = new Image();
    im.onload = im.onerror = () => { if(++loaded >= srcs.length) cb && cb(); };
    im.src = src;
  });
}

function playZoomSequence(after){
  if (zoomPlaying) return;
  zoomPlaying = true;

  // Hide the clickable stack; show zoom player
  enterBtn.classList.add('hidden');
  zoomImg.classList.remove('hidden');

  let i = FRAME_START;
  zoomImg.src = frameList[i];

  const interval = Math.max(1, Math.round(1000 / FPS));
  const timer = setInterval(() => {
    i++;
    if (i > FRAME_END) {
      clearInterval(timer);
      after && after();
      return;
    }
    zoomImg.src = frameList[i];
  }, interval);
}

// ===== TERMINAL =====
function startTerminalSequence(){
  if(terminalStarted) return;
  terminalStarted = true;
  staticEl && (staticEl.textContent = STATIC_TEXT);

  setTimeout(() => {
    typeWriter(TYPE_TEXT, typeEl, 50, () => {
      if (promptEl) {
        promptEl.classList.add("show");
        inputEl && inputEl.focus();
        renderMirror();
      }
    });
  }, 300);
}

function renderMirror(){
  if(lockedOutput) return;
  if(!typedEl || !inputEl) return;

  const raw = inputEl.value || "";
  const v   = raw.toUpperCase();
  let start = inputEl.selectionStart ?? v.length;
  let end   = inputEl.selectionEnd   ?? v.length;

  // Full-selection (Cmd/Ctrl-A): render spans with inline BLACK text
  if (v.length > 0 && start === 0 && end === v.length){
    typedEl.innerHTML = v.split("").map(ch =>
      `<span class="cursor-sel" style="color:#000;-webkit-text-fill-color:#000">${escapeHTML(ch)}</span>`
    ).join("");
    return;
  }

  // Single caret block
  const idx = Math.min(Math.max(0, start), v.length);
  const ch  = v.slice(idx, idx + 1);
  const before = escapeHTML(v.slice(0, idx));
  const at     = ch ? escapeHTML(ch) : "&nbsp;";
  const after  = escapeHTML(v.slice(idx + (ch ? 1 : 0)));
  typedEl.innerHTML = before + `<span class="cursor-block">${at}</span>` + after;
}

function bindPrompt(){
  if(!inputEl || !typedEl) return;

  // Click mirror to focus hidden input
  typedEl.parentElement.addEventListener("click", () => inputEl.focus());

  ["input","focus","blur","keyup","click"].forEach(evt =>
    inputEl.addEventListener(evt, renderMirror)
  );

  document.addEventListener("selectionchange", () => {
    if(document.activeElement === inputEl) renderMirror();
  });

  // Take full control of ⌘/Ctrl-A: prevent default, set range, render black
  document.addEventListener("keydown", (e) => {
    const isA = (e.key === 'a' || e.key === 'A');
    const withMeta = (e.metaKey || e.ctrlKey);
    if (!isA || !withMeta) return;

    // Prevent browser's default selection
    e.preventDefault();

    // Programmatically select entire input
    inputEl.focus();
    const len = (inputEl.value || "").length;
    try { inputEl.setSelectionRange(0, len); } catch(_) {}

    // Render mirror as full-selection (black text on green)
    renderMirror();
  }, true);

  inputEl.addEventListener("keydown", (e) => {
    if(e.key !== "Enter") return;
    const value = (inputEl.value || "").trim().toUpperCase();
    if(value === TARGET){
      lockedOutput = true;
      typedEl.innerHTML = `REF CORP <span class="go-pill">&lt;GO&gt;</span>`;
      hintEl && (hintEl.textContent = "");
      setTimeout(() => { window.location.href = NEXT_URL; }, GO_HOLD_MS);
    } else {
      hintEl && (hintEl.innerHTML = "<em>denied.</em>");
    }
  });
}

// ===== AVATAR =====
function startAvatar(){
  if(!figureEl){ startTerminalSequence(); return; }
  const img = new Image();
  img.onload = () => {
    figureEl.style.backgroundImage = `url("${SPRITE_PATH}")`;
    figureEl.classList.add("walking");
    figureEl.addEventListener("animationend", (e) => {
      if(e.animationName !== "walk-in") return;
      figureEl.classList.add("forward");
      figureEl.classList.remove("walking");
      startTerminalSequence();
    }, { once:true });
  };
  img.onerror = () => { hintEl && (hintEl.textContent = "sprite not found"); startTerminalSequence(); };
  img.src = SPRITE_PATH + "?" + Date.now();
}

// ===== VIEW SWITCH =====
function showGateView(){
  roomView.classList.add('hidden');
  gateView.classList.remove('hidden');
  startAvatar();
}

// ===== PIXEL-PERFECT HOVER / CLICK =====
// - Glow ON if cursor is over opaque pixels of hoverbutton.png OR screenmask.png
// - Click ON if cursor is over (hoverbutton.png OR screenmask.png OR current front image)
const hit = {
  // hover (chair)
  canvasHover: document.createElement('canvas'),
  ctxHover: null,
  hoverEl: null,
  scaleXHover: 1,
  scaleYHover: 1,

  // screen mask (monitor face)
  canvasScreen: document.createElement('canvas'),
  ctxScreen: null,
  screenImg: null,         // off-DOM Image()
  scaleXScreen: 1,
  scaleYScreen: 1,
  screenMaskReady: false,

  // front track
  canvasFront: document.createElement('canvas'),
  ctxFront: null,
  frontEl: null,
  scaleXFront: 1,
  scaleYFront: 1,

  threshold: 1,  // permissive so soft edges count
};
hit.ctxHover  = hit.canvasHover.getContext('2d',  { willReadFrequently: true });
hit.ctxScreen = hit.canvasScreen.getContext('2d', { willReadFrequently: true });
hit.ctxFront  = hit.canvasFront.getContext('2d',  { willReadFrequently: true });

function getCurrentFrontImageEl(){
  return document.querySelector('.white-set.show');
}

function buildHoverMask(el){
  if (!el || !el.complete || !el.naturalWidth) return false;
  hit.canvasHover.width  = el.naturalWidth;
  hit.canvasHover.height = el.naturalHeight;
  hit.ctxHover.clearRect(0, 0, hit.canvasHover.width, hit.canvasHover.height);
  hit.ctxHover.drawImage(el, 0, 0);
  const rect = el.getBoundingClientRect();
  hit.scaleXHover = hit.canvasHover.width  / rect.width;
  hit.scaleYHover = hit.canvasHover.height / rect.height;
  hit.hoverEl = el;
  return true;
}

function buildScreenMask(imgElOrImage){
  const el = imgElOrImage;
  if (!el || !el.complete || !el.naturalWidth) return false;
  hit.canvasScreen.width  = el.naturalWidth;
  hit.canvasScreen.height = el.naturalHeight;
  hit.ctxScreen.clearRect(0, 0, hit.canvasScreen.width, hit.canvasScreen.height);
  hit.ctxScreen.drawImage(el, 0, 0);
  // screenmask must align to the stack size; use hover image's rect for scale
  const ref = document.getElementById('hover-img') || getCurrentFrontImageEl();
  if (ref) {
    const rect = ref.getBoundingClientRect();
    hit.scaleXScreen = hit.canvasScreen.width  / rect.width;
    hit.scaleYScreen = hit.canvasScreen.height / rect.height;
  }
  hit.screenMaskReady = true;
  return true;
}

function buildFrontMask(el){
  if (!el || !el.complete || !el.naturalWidth) return false;
  hit.canvasFront.width  = el.naturalWidth;
  hit.canvasFront.height = el.naturalHeight;
  hit.ctxFront.clearRect(0, 0, hit.canvasFront.width, hit.canvasFront.height);
  hit.ctxFront.drawImage(el, 0, 0);
  const rect = el.getBoundingClientRect();
  hit.scaleXFront = hit.canvasFront.width  / rect.width;
  hit.scaleYFront = hit.canvasFront.height / rect.height;
  hit.frontEl = el;
  return true;
}

function refreshHitMask(){
  const hoverEl = document.getElementById('hover-img');
  const frontEl = getCurrentFrontImageEl();

  if (hoverEl) {
    if (!buildHoverMask(hoverEl)) {
      hoverEl.addEventListener('load', () => buildHoverMask(hoverEl), { once:true });
    }
  }
  if (frontEl) {
    if (!buildFrontMask(frontEl)) {
      frontEl.addEventListener('load', () => buildFrontMask(frontEl), { once:true });
    }
  }

  // screenmask.png (optional but recommended)
  if (!hit.screenImg) {
    const img = new Image();
    img.onload  = () => buildScreenMask(img);
    img.onerror = () => { hit.screenMaskReady = false; }; // file may be absent
    img.src = FRAMES_DIR + "screenmask.png";
    hit.screenImg = img;
  } else if (hit.screenImg.complete && hit.screenImg.naturalWidth) {
    buildScreenMask(hit.screenImg);
  }
}

function alphaHot(ctx, canvasW, canvasH, scaleX, scaleY, clientX, clientY, rect, threshold){
  const x = (clientX - rect.left) * scaleX;
  const y = (clientY - rect.top)  * scaleY;
  if (x < 0 || y < 0 || x >= canvasW || y >= canvasH) return false;
  const a = ctx.getImageData(x|0, y|0, 1, 1).data[3];
  return a >= threshold;
}

function pointState(clientX, clientY){
  // Hover glow: hoverbutton.png OR screenmask.png
  let hotGlow = false;
  const refRect = (hit.hoverEl || hit.frontEl)?.getBoundingClientRect();

  if (hit.hoverEl && refRect) {
    hotGlow = alphaHot(
      hit.ctxHover, hit.canvasHover.width, hit.canvasHover.height,
      hit.scaleXHover, hit.scaleYHover, clientX, clientY, refRect, hit.threshold
    );
  }
  if (!hotGlow && hit.screenMaskReady && refRect) {
    hotGlow = alphaHot(
      hit.ctxScreen, hit.canvasScreen.width, hit.canvasScreen.height,
      hit.scaleXScreen, hit.scaleYScreen, clientX, clientY, refRect, hit.threshold
    );
  }

  // Click: union of (hotGlow OR front image alpha)
  let hotClick = hotGlow;
  if (!hotClick && hit.frontEl) {
    const rect = hit.frontEl.getBoundingClientRect();
    hotClick = alphaHot(
      hit.ctxFront, hit.canvasFront.width, hit.canvasFront.height,
      hit.scaleXFront, hit.scaleYFront, clientX, clientY, rect, hit.threshold
    );
  }

  return { hotGlow, hotClick };
}

function enablePixelPerfectHover(){
  const btn = document.getElementById('enter-computer');
  const hoverImg = document.getElementById('hover-img');
  if (!btn || !hoverImg) return;

  // Build initial masks and keep them fresh
  const rebuild = () => refreshHitMask();
  if (hoverImg.complete && hoverImg.naturalWidth) rebuild();
  else hoverImg.addEventListener('load', rebuild, { once:true });
  window.addEventListener('resize', rebuild);

  let raf = 0;
  function updateHot(e){
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const { hotGlow, hotClick } = pointState(e.clientX, e.clientY);
      // Glow ONLY where hoverbutton/screenmask have pixels
      btn.classList.toggle('glow', !!hotGlow);
      // Pointer/click where union is hot
      btn.classList.toggle('hot',  !!hotClick);
    });
  }

  btn.addEventListener('mousemove', updateHot);
  btn.addEventListener('mouseenter', updateHot);
  btn.addEventListener('mouseleave', () => {
    btn.classList.remove('glow');
    btn.classList.remove('hot');
  });

  // Re-check right before click so a still cursor works
  btn.addEventListener('click', (e) => {
    const { hotGlow, hotClick } = pointState(e.clientX, e.clientY);
    btn.classList.toggle('glow', !!hotGlow);
    btn.classList.toggle('hot',  !!hotClick);
    if (!hotClick) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    e.preventDefault();
    preload(frameList, () => playZoomSequence(showGateView));
  }, true);
}

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
  startRoomBlinkers();
  bindPrompt();
  enablePixelPerfectHover();

  // quick log for broken images
  document.querySelectorAll('.stack img, #zoom-frame').forEach(img => {
    img.addEventListener('error', () => {
      console.warn('Image failed:', img.getAttribute('src'));
    });
  });
});
