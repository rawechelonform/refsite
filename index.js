// ===== CONFIG =====
const NEXT_PAGE    = "main.html";
const FRAMES_DIR   = "assets/landing/";  // moved assets
const FRAME_PREFIX = "zoom";             // zoom0.png ... zoom10.png
const FRAME_START  = 0;
const FRAME_END    = 10;                 // inclusive
const FPS          = 12;
const FRAME_VER    = "v=200";            // bump when you change frames

// ===== ELEMENTS =====
const enterBtn = document.getElementById('enter-computer');
const zoomImg  = document.getElementById('zoom-frame');

// ===== STATE =====
let zoomPlaying = false;

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
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    setTimeout(tick, delay);
  }
  const initial = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  setTimeout(tick, initial);
}
function startRoomBlinkers(){
  makeBlinker('.white-set', 120, 380);
  makeBlinker('.black-set', 220, 520);
}

// ===== ZOOM SEQUENCE =====
const frameList = [];
for(let i=FRAME_START;i<=FRAME_END;i++){
  frameList.push(`${FRAMES_DIR}${FRAME_PREFIX}${i}.png?${FRAME_VER}`);
}

// Preload and DECODE frames so swaps don't “skip”
function preload(srcs, cb){
  if (!srcs.length) { cb && cb(); return; }
  Promise.all(srcs.map(src => {
    const im = new Image();
    im.decoding = 'sync';
    im.loading = 'eager';
    im.src = src;
    if (im.decode) {
      return im.decode().catch(()=>{}); // fall through on decode error
    }
    return new Promise(res => { im.onload = res; im.onerror = res; });
  })).finally(() => cb && cb());
}

function playZoomSequence(after){
  if (zoomPlaying) return;
  zoomPlaying = true;
  enterBtn.classList.add('hidden');
  zoomImg.classList.remove('hidden');

  let i = FRAME_START;
  zoomImg.src = frameList[i];
  // console.log('show frame', i, frameList[i]); // uncomment to debug order

  const interval = Math.max(1, Math.round(1000 / FPS));
  const timer = setInterval(() => {
    i++;
    if (i > FRAME_END){
      clearInterval(timer);
      after && after();
      return;
    }
    zoomImg.src = frameList[i];
    // console.log('show frame', i, frameList[i]); // uncomment to debug order
  }, interval);
}

// ===== PIXEL-PERFECT HOVER / CLICK =====
const hit = {
  canvasHover: document.createElement('canvas'),
  ctxHover: null,
  hoverEl: null,
  scaleXHover: 1,
  scaleYHover: 1,

  canvasScreen: document.createElement('canvas'),
  ctxScreen: null,
  screenImg: null,
  scaleXScreen: 1,
  scaleYScreen: 1,
  screenMaskReady: false,

  canvasFront: document.createElement('canvas'),
  ctxFront: null,
  frontEl: null,
  scaleXFront: 1,
  scaleYFront: 1,

  threshold: 1,
};
hit.ctxHover  = hit.canvasHover.getContext('2d',  { willReadFrequently:true });
hit.ctxScreen = hit.canvasScreen.getContext('2d', { willReadFrequently:true });
hit.ctxFront  = hit.canvasFront.getContext('2d',  { willReadFrequently:true });

function getCurrentFrontImageEl(){ return document.querySelector('.white-set.show'); }
function buildHoverMask(el){
  if (!el || !el.complete || !el.naturalWidth) return false;
  hit.canvasHover.width  = el.naturalWidth;
  hit.canvasHover.height = el.naturalHeight;
  hit.ctxHover.clearRect(0,0,hit.canvasHover.width,hit.canvasHover.height);
  hit.ctxHover.drawImage(el,0,0);
  const rect = el.getBoundingClientRect();
  hit.scaleXHover = hit.canvasHover.width / rect.width;
  hit.scaleYHover = hit.canvasHover.height/ rect.height;
  hit.hoverEl = el;
  return true;
}
function buildScreenMask(img){
  if (!img || !img.complete || !img.naturalWidth) return false;
  hit.canvasScreen.width  = img.naturalWidth;
  hit.canvasScreen.height = img.naturalHeight;
  hit.ctxScreen.clearRect(0,0,hit.canvasScreen.width,hit.canvasScreen.height);
  hit.ctxScreen.drawImage(img,0,0);
  const ref = document.getElementById('hover-img') || getCurrentFrontImageEl();
  if (ref){
    const rect = ref.getBoundingClientRect();
    hit.scaleXScreen = hit.canvasScreen.width / rect.width;
    hit.scaleYScreen = hit.canvasScreen.height/ rect.height;
  }
  hit.screenMaskReady = true;
  return true;
}
function buildFrontMask(el){
  if (!el || !el.complete || !el.naturalWidth) return false;
  hit.canvasFront.width  = el.naturalWidth;
  hit.canvasFront.height = el.naturalHeight;
  hit.ctxFront.clearRect(0,0,hit.canvasFront.width,hit.canvasFront.height);
  hit.ctxFront.drawImage(el,0,0);
  const rect = el.getBoundingClientRect();
  hit.scaleXFront = hit.canvasFront.width / rect.width;
  hit.scaleYFront = hit.canvasFront.height/ rect.height;
  hit.frontEl = el;
  return true;
}
function refreshHitMask(){
  const hoverEl = document.getElementById('hover-img');
  const frontEl = getCurrentFrontImageEl();
  if (hoverEl){
    if (!buildHoverMask(hoverEl)){
      hoverEl.addEventListener('load', ()=>buildHoverMask(hoverEl), { once:true });
    }
  }
  if (frontEl){
    if (!buildFrontMask(frontEl)){
      frontEl.addEventListener('load', ()=>buildFrontMask(frontEl), { once:true });
    }
  }
  if (!hit.screenImg){
    const img = new Image();
    img.onload  = ()=>buildScreenMask(img);
    img.onerror = ()=>{ hit.screenMaskReady = false; };
    img.src = FRAMES_DIR + "screenmask.png?" + FRAME_VER;
    hit.screenImg = img;
  } else if (hit.screenImg.complete && hit.screenImg.naturalWidth){
    buildScreenMask(hit.screenImg);
  }
}
function pointState(clientX, clientY){
  let hotGlow = false;
  const refRect = (hit.hoverEl || hit.frontEl)?.getBoundingClientRect();
  if (hit.hoverEl && refRect){
    hotGlow = alphaHot(hit.ctxHover, hit.canvasHover.width, hit.canvasHover.height,
      hit.scaleXHover, hit.scaleYHover, clientX, clientY, refRect, hit.threshold);
  }
  if (!hotGlow && hit.screenMaskReady && refRect){
    hotGlow = alphaHot(hit.ctxScreen, hit.canvasScreen.width, hit.canvasScreen.height,
      hit.scaleXScreen, hit.scaleYScreen, clientX, clientY, refRect, hit.threshold);
  }
  let hotClick = hotGlow;
  if (!hotClick && hit.frontEl){
    const rect = hit.frontEl.getBoundingClientRect();
    hotClick = alphaHot(hit.ctxFront, hit.canvasFront.width, hit.canvasFront.height,
      hit.scaleXFront, hit.scaleYFront, clientX, clientY, rect, hit.threshold);
  }
  return { hotGlow, hotClick };
}
function alphaHot(ctx, w, h, sx, sy, clientX, clientY, rect, threshold){
  const x = (clientX - rect.left) * sx;
  const y = (clientY - rect.top)  * sy;
  if (x < 0 || y < 0 || x >= w || y >= h) return false;
  const a = ctx.getImageData(x|0, y|0, 1, 1).data[3];
  return a >= threshold;
}
function enablePixelPerfectHover(){
  const btn = document.getElementById('enter-computer');
  const hoverImg = document.getElementById('hover-img');
  if (!btn || !hoverImg) return;

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
      btn.classList.toggle('glow', !!hotGlow);
      btn.classList.toggle('hot',  !!hotClick);
    });
  }

  btn.addEventListener('mousemove', updateHot);
  btn.addEventListener('mouseenter', updateHot);
  btn.addEventListener('mouseleave', () => {
    btn.classList.remove('glow');
    btn.classList.remove('hot');
  });

  btn.addEventListener('click', (e) => {
    const { hotGlow, hotClick } = pointState(e.clientX, e.clientY);
    btn.classList.toggle('glow', !!hotGlow);
    btn.classList.toggle('hot',  !!hotClick);
    if (!hotClick){
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    e.preventDefault();
    preload(frameList, () => playZoomSequence(() => {
      window.location.href = NEXT_PAGE;
    }));
  }, true);
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  startRoomBlinkers();
  enablePixelPerfectHover();
  document.querySelectorAll('.stack img, #zoom-frame').forEach(img => {
    img.addEventListener('error', () => {
      console.warn('Image failed:', img.getAttribute('src'));
    });
  });
});
