// ===== CONFIG =====
const FRAMES_DIR   = "landing/";
const LANDING_SRC  = FRAMES_DIR + "img1_white.png";
const FRAME_PREFIX = "zoom";   // zoom0.png ... zoom10.png
const FRAME_START  = 0;
const FRAME_END    = 10;       // inclusive
const FPS          = 12;       // adjust speed
const AFTER_ACTION = () => {
  console.log("Zoom sequence complete.");
  // e.g. window.location.href = "index.html";
};

// ===== ELEMENTS =====
const startBtn   = document.getElementById("start-zoom");
const landingImg = document.getElementById("landing-frame");
const zoomImg    = document.getElementById("zoom-frame");

// ===== PRELOAD =====
function preload(srcs, cb){
  let loaded = 0;
  const total = srcs.length;
  if (total === 0) { cb && cb(); return; }
  srcs.forEach(src => {
    const img = new Image();
    img.onload = img.onerror = () => {
      loaded++;
      if (loaded >= total) cb && cb();
    };
    img.src = src;
  });
}

const frameList = [];
for(let i = FRAME_START; i <= FRAME_END; i++){
  frameList.push(`${FRAMES_DIR}${FRAME_PREFIX}${i}.png`);
}

preload([LANDING_SRC, ...frameList]);

// ===== ANIMATION =====
let playing = false;
function playZoom(){
  if (playing) return;
  playing = true;

  startBtn.classList.add("hidden");
  zoomImg.classList.remove("hidden");

  let i = FRAME_START;
  zoomImg.src = frameList[i];

  const interval = Math.max(1, Math.round(1000 / FPS));
  const timer = setInterval(() => {
    i++;
    if (i > FRAME_END) {
      clearInterval(timer);
      AFTER_ACTION();
      return;
    }
    zoomImg.src = frameList[i];
  }, interval);
}

// ===== BINDINGS =====
startBtn.addEventListener("click", (e) => {
  e.preventDefault();
  playZoom();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.code === "Space") playZoom();
});

[landingImg, zoomImg].forEach(el => {
  el.addEventListener("error", () => {
    console.warn("Image failed to load:", el.getAttribute("src"));
  });
});
