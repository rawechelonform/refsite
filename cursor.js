/* Chrome pointer-lock: listen to mousemove + pointermove + pointerrawupdate */
(() => {
  const c = document.getElementById('custom-cursor');

  let locked = false;
  let x = innerWidth / 2, y = innerHeight / 2;

  const clamp = (v,min,max)=> v<min?min : v>max?max : v;
  const now   = ()=> performance.now();
  const rand  = (a,b)=> Math.random()*(b-a)+a;
  const prefersReduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function place(){ c.style.left = x+'px'; c.style.top = y+'px'; }

  // --- Pre-lock: follow OS cursor so crosshair is visible and aligned ---
  function preMove(e){ if (!locked){ x = e.clientX; y = e.clientY; place(); } }
  addEventListener('pointermove', preMove, { passive:true });

  // --- Locked deltas: handle ALL possible sources robustly ---
  let lastMoveTs = 0;

  function applyDelta(ev){
    // movementX/Y exist on MouseEvent and PointerEvent; webkitMovementX/Y on some builds
    const dx = (ev.movementX ?? ev.webkitMovementX ?? 0);
    const dy = (ev.movementY ?? ev.webkitMovementY ?? 0);
    if (!dx && !dy) return; // ignore zero-noise frames

    x = clamp(x + dx, 0, innerWidth  - 1);
    y = clamp(y + dy, 0, innerHeight - 1);
    place();
    lastMoveTs = now();
  }

  function addLockedListeners(){
    // Use capture to get events even if something else stops propagation
    addEventListener('mousemove',        applyDelta, true);
    addEventListener('pointermove',      applyDelta, true);
    addEventListener('pointerrawupdate', applyDelta, true); // high-freq on Chrome
  }
  function removeLockedListeners(){
    removeEventListener('mousemove',        applyDelta, true);
    removeEventListener('pointermove',      applyDelta, true);
    removeEventListener('pointerrawupdate', applyDelta, true);
  }

  // --- Random idle spins (not on click) ---
  let spinTimer = null;
  function scheduleSpin(){
    clearTimeout(spinTimer);
    const delay = Math.round(rand(1200, 4200));
    spinTimer = setTimeout(() => {
      const quiet = now() - lastMoveTs > 220;
      if (!prefersReduce && locked && quiet){
        const rev = Math.random() < 0.5;
        const dur = Math.round(rand(260, 680));
        c.style.animation = 'none'; void c.offsetWidth;
        c.style.animation = `cursor-spin ${dur}ms ease-out ${rev ? 'reverse':'normal'}`;
      }
      scheduleSpin();
    }, delay);
  }

  // --- Pointer-lock lifecycle (no edge auto-unlock, no recenter) ---
  function onLockChange(){
    locked = (document.pointerLockElement === document.body);
    if (locked){
      // Stop pre-lock follower; start delta listeners
      removeEventListener('pointermove', preMove, true);
      addLockedListeners();
      // Crosshair stays visible; positioned at last click (we set x/y on click below)
      place();
    } else {
      // Stop delta listeners; resume pre-lock follower
      removeLockedListeners();
      addEventListener('pointermove', preMove, { passive:true });
    }
  }
  addEventListener('pointerlockchange', onLockChange);
  addEventListener('pointerlockerror',  onLockChange);

  // --- Click: lock at click point; while locked, click = squeeze ---
  addEventListener('pointerdown', (e) => {
    if (!locked){
      x = clamp(e.clientX, 0, innerWidth-1);
      y = clamp(e.clientY, 0, innerHeight-1);
      place();
      // Request lock on body; Chrome hides OS cursor on success
      document.body.requestPointerLock?.();
    } else {
      c.classList.remove('implode'); void c.offsetWidth;
      c.classList.add('implode');
      setTimeout(() => c.classList.remove('implode'), 240);
    }
  }, true);

  // Only Esc unlocks (no edge unlocks)
  addEventListener('keydown', (e) => { if (e.key === 'Escape') document.exitPointerLock?.(); });

  // Keep inside bounds on resize
  addEventListener('resize', () => {
    x = clamp(x, 0, innerWidth-1);
    y = clamp(y, 0, innerHeight-1);
    place();
  });

  // Boot
  place();
  scheduleSpin();
})();
