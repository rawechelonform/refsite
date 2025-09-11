// ===== CONFIG =====
const TARGET      = "REF CORP";
const NEXT_URL    = "main.html";
const GO_HOLD_MS  = 300;
const SPRITE_PATH = "avatar/avatar_intro.png"; // repo-root/avatar/...

// Zoom frames config
const FRAMES_DIR   = "landing/";
const FRAME_PREFIX = "zoom";   // zoom0.png ... zoom10.png
const FRAME_START  = 0;
const FRAME_END    = 10;       // inclusive
const FPS          = 12;       // adjust speed (12–18 looks good)

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

    // If the front track changed, we could refresh hit mask (not required now,
    // because we sample hover-img, which does not change).
    // if (selector === '.white-set') refreshHitMask();

    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    setTimeout(tick, delay);
  }
  const initial = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  setTimeout(tick, initial);
}
function startRoomBlinkers(){
  makeBlinker('.white-set', 120, 380); // front track (img1 / button1 / button2)
  makeBlinker('.black-set', 220, 520); // back track (img3/4/5)
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
  if (staticEl) staticEl.textContent = STATIC_TEXT;

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

  if(v.length > 0 && start === 0 && end === v.length){
    typedEl.innerHTML = v.split("").map(ch =>
      `<span class="cursor-sel" style="background:rgb(0,255,0);color:#000;-webkit-text-fill-color:#000">${escapeHTML(ch)}</span>`
    ).join("");
    return;
  }

  const idx = Math.min(Math.max(0, start), v.length);
  const ch  = v.slice(idx, idx + 1);
  const before = escapeHTML(v.slice(0, idx));
  const at     = ch ? escapeHTML(ch) : "&nbsp;";
  const after  = escapeHTML(v.slice(idx + (ch ? 1 : 0)));
  typedEl.innerHTML = before + `<span class="cursor-block">${at}</span>` + after;
}

function bindPrompt(){
  if(!inputEl || !typedEl) return;
  typedEl.parentElement.addEventListener("click", () => inputEl.focus());
  ["input","focus","blur","keyup","click"].forEach(evt => inputEl.addEventListener(evt, renderMirror));
  document.addEventListener("selectionchange", () => {
    if(document.activeElement === inputEl) renderMirror();
  });

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

function bindRoomEnter(){
  if(!enterBtn) return;
  enterBtn.addEventListener('click', (e) => {
    e.preventDefault();
    // Preload all zoom frames once, then play, then go to gate
    preload(frameList, () => playZoomSequence(showGateView));
  });
}

// ===== PIXEL-PERFECT HOVER / CLICK (uses hoverbutton.png alpha) =====
const hit = {
  canvas: document.createElement('canvas'),
  ctx: null,
  imgEl: null,   // <img id="hover-img">
  scaleX: 1,
  scaleY: 1,
  threshold: 12, // raise to 16–32 if edge glow triggers too easily
};
hit.ctx = hit.canvas.getContext('2d', { willReadFrequently: true });

function buildHitMaskFrom(el){
  if (!el || !el.complete || !el.naturalWidth) return false;

  // Draw the hover image at natural resolution
  hit.canvas.width  = el.naturalWidth;
  hit.canvas.height = el.naturalHeight;
  hit.ctx.clearRect(0, 0, hit.canvas.width, hit.canvas.height);
  hit.ctx.drawImage(el, 0, 0);

  // Map screen coords -> image coords
  const rect = el.getBoundingClientRect();
  hit.scaleX = hit.canvas.width  / rect.width;
  hit.scaleY = hit.canvas.height / rect.height;

  hit.imgEl = el;
  return true;
}

function refreshHitMask(){
  const el = document.getElementById('hover-img');
  if (!el) return false;
  const ok = buildHitMaskFrom(el);
  if (!ok) {
    el.addEventListener('load', () => buildHitMaskFrom(el), { once:true });
  }
  return ok;
}

function isOpaqueAtClientPoint(clientX, clientY){
  const el = hit.imgEl || document.getElementById('hover-img');
  if (!el) return false;

  const rect = el.getBoundingClientRect();
  const x = (clientX - rect.left) * hit.scaleX;
  const y = (clientY - rect.top)  * hit.scaleY;
  if (x < 0 || y < 0 || x >= hit.canvas.width || y >= hit.canvas.height) return false;

  const alpha = hit.ctx.getImageData(x|0, y|0, 1, 1).data[3];
  return alpha > hit.threshold;
}

function enablePixelPerfectHover(){
  const btn = document.getElementById('enter-computer');
  const hoverImg = document.getElementById('hover-img');
  if (!btn || !hoverImg) return;

  // Build once ready, and rebuild on resize (in case layout changes)
  if (hoverImg.complete && hoverImg.naturalWidth) refreshHitMask();
  else hoverImg.addEventListener('load', refreshHitMask, { once:true });
  window.addEventListener('resize', refreshHitMask);

  let raf = 0;
  function onMove(e){
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const hot = isOpaqueAtClientPoint(e.clientX, e.clientY);
      btn.classList.toggle('hot', !!hot);
    });
  }

  btn.addEventListener('mousemove', onMove);
  btn.addEventListener('mouseleave', () => btn.classList.remove('hot'));

  // Block clicks if not over opaque pixels
  btn.addEventListener('click', (e) => {
    if (!btn.classList.contains('hot')) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  // Optional: log issues
  hoverImg.addEventListener('error', () => console.warn('hoverbutton.png failed to load'));
}

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
  startRoomBlinkers();
  bindRoomEnter();
  bindPrompt();
  enablePixelPerfectHover();   // per-pixel hover/glow

  // Optional: log broken images quickly
  document.querySelectorAll('.stack img, #zoom-frame').forEach(img => {
    img.addEventListener('error', () => {
      console.warn('Image failed:', img.getAttribute('src'));
    });
  });
});
