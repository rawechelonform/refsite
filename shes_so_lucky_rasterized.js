// --- canvas: portrait-ish ---
const CANVAS_W = 350;
const CANVAS_H = 450;

// --- grid detail ---
const TILES_X = 60;
let TILES_Y, tileSize;

// --- beat/pulse controls ---
const BPM = 95;
const INTENSITY = 0.5;

// --- theme color (RGB) ---
const DOT_COLOR = { r: 100, g: 150, b: 250 };

let img;
let amps = [], phases = [], speeds = [];
let invertMode = false; // toggled by mouse movement
let lastMouseX = 0;
let lastMouseY = 0;

function preload() {
  img = loadImage("/images/shes_so_lucky_color.jpeg");
}

function setup() {
  const cnv = createCanvas(CANVAS_W, CANVAS_H);  // was: createCanvas(...)
  cnv.parent('raster-wrap');                      // add this line

  noStroke();
  colorMode(RGB, 255);

  tileSize = CANVAS_W / TILES_X;
  TILES_Y = floor(CANVAS_H / tileSize);

  img.resize(TILES_X, TILES_Y);
  img.loadPixels();

  randomSeed(1234);
  for (let i = 0; i < TILES_X * TILES_Y; i++) {
    amps[i]   = random(0.3, 1.0);
    phases[i] = random(TWO_PI);
    speeds[i] = random(0.8, 1.2);
  }
}


function draw() {
  background(0);

  const t = millis() / 1000;
  const beatHz = BPM / 60;
  const beatPhase = (sin(TAU * beatHz * t) + 1) * 0.5;
  const beat = pow(beatPhase, 3);

  for (let y = 0; y < TILES_Y; y++) {
    for (let x = 0; x < TILES_X; x++) {
      const i = y * TILES_X + x;

      // base brightness → size
      const idx = 4 * i;
      const r = img.pixels[idx + 0];
      const g = img.pixels[idx + 1];
      const b = img.pixels[idx + 2];
      const lum = 0.2126*r + 0.7152*g + 0.0722*b;
      let base = tileSize * (lum / 255);

      // pulse
      const local = (sin(phases[i] + t * 2.0 * speeds[i]) + 1) * 0.5;
      const mod = mix(beat, local, 0.5) * amps[i] * INTENSITY;
      let size = base * (0.7 + 0.6 * mod);

      // if inverted, flip size: big↔small
      if (invertMode) {
        const maxDot = tileSize * 0.9;
        size = map(size, 0, maxDot, maxDot, 0, true);
      }

      // draw dot in RGB (same numbers as CSS rgb(...))
      fill(DOT_COLOR.r, DOT_COLOR.g, DOT_COLOR.b);
      const cx = x * tileSize + tileSize / 2;
      const cy = y * tileSize + tileSize / 2;
      ellipse(cx, cy, size, size);
    }
  }

  // detect mouse movement → toggle invert
  if (mouseX !== lastMouseX || mouseY !== lastMouseY) {
    invertMode = !invertMode;
    lastMouseX = mouseX;
    lastMouseY = mouseY;
  }
}

// helper
function mix(a, b, t) { return a*(1-t) + b*t; }
