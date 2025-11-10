/* Hard-lock crosshair
   • Random idle spins
   • Click to lock at click point (Chrome hides OS cursor)
   • While locked: click = squeeze/implode
   • No edge unlocks, no blur/mouseout unlocks, no recenter
   • Esc is the only unlock
*/
(() => {
  const cursor = document.getElementById('custom-cursor');

  // State
  let locked = false;
  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;

  const clamp = (v, min, max) => v < min ? min : (v > max ? max : v);
  const now   = () => performance.now();
  const rand  = (a, b) => Math.random() * (b - a) + a;
  const prefersReduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function paint(){
    cursor.style.left = x + 'px';
    cursor.style.top  = y + 'px';
  }

  // PRE-LOCK: follow OS cursor so crosshair is always visible before locking
  function preMove(e){
    if (locked) return;
    x = e.clientX;
    y = e.clientY;
    paint();
  }
  document.addEventListener('pointermove', preMove, { passive: true });

  // POST-LOCK: integrate movement deltas; clamp to viewport; do NOT unlock at edges
  let lastMoveTs = 0;
  function onLockedMove(e){
    x = clamp(x + e.movementX, 0, window.innerWidth  - 1);
    y = clamp(y + e.movementY, 0, window.innerHeight - 1);
    paint();
    lastMoveTs = now();
  }

  // Random idle spins (not on click)
  let spinTimer = null;
  function scheduleSpin(){
    clearTimeout(spinTimer);
    const delay = Math.round(rand(1200, 4200));
    spinTimer = setTimeout(() => {
      const quiet = now() - lastMoveTs > 220;
      if (!prefersReduce && locked && quiet){
        const reverse = Math.random() < 0.5;
        const dur = Math.round(rand(260, 680));
        cursor.style.animation = 'none'; void cursor.offsetWidth;
        cursor.style.animation = `cursor-spin ${dur}ms ease-out ${reverse ? 'reverse':'normal'}`;
      }
      scheduleSpin();
    }, delay);
  }

  // Lock lifecycle — no edge/blur/mouseout unlocks; no recenter
  function onLockChange(){
    locked = (document.pointerLockElement === document.body);
    if (locked){
      // Stop pre-lock follower; start delta handling
      document.removeEventListener('pointermove', preMove, true);
      document.addEventListener('mousemove', onLockedMove, true);
    } else {
      // Back to pre-lock follower
      document.removeEventListener('mousemove', onLockedMove, true);
      document.addEventListener('pointermove', preMove, { passive: true });
    }
    paint();
  }
  document.addEventListener('pointerlockchange', onLockChange, false);
  document.addEventListener('pointerlockerror',  onLockChange, false);

  // Click:
  //  • If unlocked: set x/y to click point (prevents any jump) and request lock
  //  • If locked: play the squeeze/implode animation
  window.addEventListener('pointerdown', (e) => {
    if (!locked){
      x = clamp(e.clientX, 0, window.innerWidth  - 1);
      y = clamp(e.clientY, 0, window.innerHeight - 1);
      paint();
      document.body.requestPointerLock?.(); // Chrome hides OS cursor when lock succeeds
    } else {
      cursor.classList.remove('implode'); void cursor.offsetWidth;
      cursor.classList.add('implode');
      setTimeout(() => cursor.classList.remove('implode'), 240);
    }
  }, true);

  // ONLY Esc unlocks (no edge/blur/mouseout unlocks)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.exitPointerLock?.();
  });

  // Keep position valid on resize; never recenter
  window.addEventListener('resize', () => {
    x = clamp(x, 0, window.innerWidth  - 1);
    y = clamp(y, 0, window.innerHeight - 1);
    paint();
  });

  // Boot
  paint();
  scheduleSpin();
})();
