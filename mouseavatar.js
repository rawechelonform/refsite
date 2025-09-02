// Follow with live side-offset while mouse moves; stand at same offset when idle.
// Center-anchored sprite; uses standing sheet for sizing.

const SHEETS = {
  up:    'avatar/avatar_walkingbackward.png',
  right: 'avatar/avatar_walkingright.png',
  down:  'avatar/avatar_walkingforward.png',
  left:  'avatar/avatar_walkingleft.png',
  stand: 'avatar/avatar_standing.png' // two frames side-by-side
};

const AVATAR = document.getElementById('avatar');

/* ===== Tunables ===== */
let SCALE = 0.125;               // current size (half of 0.25)
const BASE_SPEED = 360;          // px/sec
const STEP_INTERVAL_MS = 180;    // walk cadence
const ARRIVAL_EPS = 3;           // movement arrival threshold
const ARRIVAL_EPS_IDLE = 5;      // idle arrival threshold
const MOUSE_IDLE_MS = 200;       // ms since last mousemove = idle

// internal crop to remove padding bars
const CROP_TOP_PX = 24;
const CROP_BOTTOM_PX = 12;

// exact horizontal offset from cursor center while moving/idle
const SIDE_OFFSET_X = 40;

// distance-based speed boost
const BOOST_PER_PX = 1.2;
const MAX_BOOST = 900;
/* ==================== */

/* Metrics (center-anchored; from standing sheet) */
let FRAME_W = 64, FRAME_H = 64;
let VISIBLE_H = 64;

/* State (CENTER positions) */
let pos = { x: innerWidth / 2, y: innerHeight / 2 }; // avatar center
let cursor = { x: pos.x, y: pos.y };                 // mouse center
let frozenTarget = null;                              // frozen center target when idle

let currentSheet = 'stand';
let stepIndex = 0;
let lastT = performance.now();
let animAcc = 0;

// track last horizontal direction of MOUSE movement to decide side
let lastMouseT = performance.now();
let prevMouseX = pos.x;
let sidePreference = null; // 'left' or 'right' relative to cursor (where avatar should be)

/* Helpers */
function setScale() {
  AVATAR.style.transform = `translate(-50%, -50%) scale(${SCALE})`;
}
function setSheet(which) {
  if (currentSheet === which) return;
  currentSheet = which;
  AVATAR.style.backgroundImage = `url(${SHEETS[which]})`;
  setFrame(stepIndex);
}
function setFrame(col) {
  stepIndex = col & 1;
  const offsetX = stepIndex * FRAME_W;
  AVATAR.style.backgroundPosition = `-${offsetX}px -${CROP_TOP_PX}px`;
}
function chooseDirection(dx, dy) {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}
function layoutAvatar() {
  AVATAR.style.left = `${pos.x}px`;
  AVATAR.style.top  = `${pos.y}px`;
  AVATAR.style.width  = `${FRAME_W}px`;
  AVATAR.style.height = `${VISIBLE_H}px`;
}
function applyMetricsFrom(img) {
  FRAME_W = Math.max(1, Math.floor(img.width / 2)); // two frames across
  FRAME_H = img.height;
  VISIBLE_H = Math.max(1, FRAME_H - CROP_TOP_PX - CROP_BOTTOM_PX);
}
function preload(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load ' + src));
    img.src = src + '?v=' + Date.now(); // cache-bust
  });
}
// clamp using **scaled** size so she can reach edges
function clampCenter(x, y) {
  const halfWScaled = (FRAME_W * SCALE) * 0.5;
  const halfHScaled = (VISIBLE_H * SCALE) * 0.5;
  const minX = halfWScaled;
  const maxX = innerWidth - halfWScaled;
  const minY = halfHScaled;
  const maxY = innerHeight - halfHScaled;
  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y))
  };
}

// Compute the live target WHILE MOVING: always ±SIDE_OFFSET_X from cursor horizontally, same Y
function liveSideOffsetTarget() {
  // Decide side if unknown: choose where the avatar currently is relative to cursor
  if (!sidePreference) {
    sidePreference = (pos.x <= cursor.x) ? 'left' : 'right';
  }
  const tx = cursor.x + (sidePreference === 'left' ? -SIDE_OFFSET_X : SIDE_OFFSET_X);
  const ty = cursor.y;
  return clampCenter(tx, ty);
}

// Build ONE frozen target on idle (keeps same side and offset)
function buildFrozenTarget() {
  return liveSideOffsetTarget(); // same logic; just freeze the result
}

/* Inputs */
addEventListener('mousemove', e => {
  cursor.x = e.clientX;
  cursor.y = e.clientY;

  // Update sidePreference from mouse movement direction (only if a clear horizontal move)
  const dxMouse = e.clientX - prevMouseX;
  if (dxMouse > 1) sidePreference = 'left';   // mouse moving right → avatar stays to its left
  else if (dxMouse < -1) sidePreference = 'right'; // mouse moving left → avatar stays to its right
  prevMouseX = e.clientX;

  lastMouseT = performance.now();
  frozenTarget = null; // unfreeze while mouse moves
});
addEventListener('click', e => {
  cursor.x = e.clientX;
  cursor.y = e.clientY;
  lastMouseT = performance.now();
  frozenTarget = null;
});

/* Main loop */
function tick(now) {
  const dt = Math.min(now - lastT, 1000 / 30);
  lastT = now;

  const mouseIdle = (now - lastMouseT) > MOUSE_IDLE_MS;

  // Target selection:
  // - Moving: live side-offset target (prevents ever landing on the cursor and backtracking)
  // - Idle start: freeze once at the same side-offset
  let target;
  if (!mouseIdle) {
    target = liveSideOffsetTarget();
  } else {
    if (!frozenTarget) frozenTarget = buildFrozenTarget();
    target = frozenTarget;
  }

  const dx = target.x - pos.x;
  const dy = target.y - pos.y;
  const dist = Math.hypot(dx, dy);

  // Idle & arrived → standing
  if (mouseIdle && dist <= ARRIVAL_EPS_IDLE) {
    setSheet('stand');
    setFrame(0);
    layoutAvatar();
    requestAnimationFrame(tick);
    return;
  }

  // Face where we're going (tiny deadband to avoid flicker)
  const DIR_DEADBAND = 2;
  let faceDir;
  if (Math.abs(dx) < DIR_DEADBAND && Math.abs(dy) < DIR_DEADBAND) {
    // keep current facing
  } else {
    faceDir = chooseDirection(dx, dy);
    setSheet(faceDir);
  }

  // Move toward target without overshoot
  if (dist > ARRIVAL_EPS) {
    const speed = Math.min(BASE_SPEED + Math.min(dist * BOOST_PER_PX, MAX_BOOST), BASE_SPEED + MAX_BOOST);
    const stepLen = Math.min((speed * dt) / 1000, dist);
    if (dist > 0) {
      const inv = 1 / dist;
      pos.x += dx * inv * stepLen;
      pos.y += dy * inv * stepLen;
    }

    // Walk cadence while moving
    animAcc += dt;
    while (animAcc >= STEP_INTERVAL_MS) {
      setFrame(stepIndex ^ 1);
      animAcc -= STEP_INTERVAL_MS;
    }
  } else {
    setFrame(0);
  }

  layoutAvatar();
  requestAnimationFrame(tick);
}

/* Init */
(async function init() {
  AVATAR.style.backgroundRepeat = 'no-repeat';
  AVATAR.style.imageRendering   = 'pixelated';
  AVATAR.style.pointerEvents    = 'none';
  AVATAR.style.transformOrigin  = '50% 50%'; // center anchor
  setScale();

  try {
    const img = await preload(SHEETS.stand);
    applyMetricsFrom(img);
  } catch {
    const img2 = await preload(SHEETS.down);
    applyMetricsFrom(img2);
  }

  setSheet('stand');
  setFrame(0);
  layoutAvatar();
  requestAnimationFrame(tick);
})();

/* Keep center within window on resize */
addEventListener('resize', () => {
  const c = clampCenter(pos.x, pos.y);
  pos.x = c.x;
  pos.y = c.y;
});
