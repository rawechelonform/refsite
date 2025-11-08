// Pointer-lock crosshair: idle spins, click-implode
// Keep X visible at edges while LOCKED (no disappear), OS cursor shows on real leave/unlock
(() => {
  const cursor = document.getElementById('custom-cursor');
  const btn    = document.getElementById('lockBtn');
  const status = document.getElementById('status');
  if (!cursor || !btn) return;

  const prefersReduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Config */
  const EDGE_HIDE_PX  = 3;          // only used when UNLOCKED
  const IDLE_MIN_MS   = 1200;
  const IDLE_MAX_MS   = 2800;

  /* State */
  let raf = 0;
  let pos = { x: innerWidth/2, y: innerHeight/2 };  // visual crosshair position
  let idleTimer = null;

  /* Focus park to avoid focus jump on unlock */
  const focusPark = document.createElement('div');
  focusPark.tabIndex = -1;
  Object.assign(focusPark.style, { position:'fixed', top:'0', left:'0', width:'0', height:'0', outline:'none' });
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(focusPark));

  /* Helpers */
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const showCursor = () => { cursor.style.display = 'block'; };
  const hideCursor = () => { cursor.style.display = 'none'; };
  const rand = (min,max) => Math.random()*(max-min)+min;
  const isLocked = () => document.pointerLockElement === document.documentElement;
  const isLeavingDoc = (e) => (e.relatedTarget || e.toElement) === null;

  // only hide near edges when UNLOCKED
  function applyVisibility(x, y){
    if (isLocked()) { showCursor(); return; }
    const nearEdge =
      x <= EDGE_HIDE_PX || y <= EDGE_HIDE_PX ||
      x >= innerWidth-EDGE_HIDE_PX || y >= innerHeight-EDGE_HIDE_PX;
    if (nearEdge) hideCursor(); else showCursor();
  }

  function applyPos(){
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      cursor.style.left = pos.x + 'px';
      cursor.style.top  = pos.y + 'px';
      applyVisibility(pos.x, pos.y);
    });
  }

  /* Idle spin (only while locked so you never see OS cursor + spin together) */
  function spinOnce(){
    if (prefersReduce) return;
    const reverse = Math.random() < 0.5;
    const dur = Math.round(rand(260, 560));
    cursor.style.animation = 'none';
    void cursor.offsetWidth;
    cursor.style.animation = `cursor-spin ${dur}ms ease-out ${reverse ? 'reverse' : 'normal'}`;
  }
  function scheduleIdle(){
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!document.hidden && isLocked()) spinOnce();
      scheduleIdle();
    }, Math.round(rand(IDLE_MIN_MS, IDLE_MAX_MS)));
  }
  scheduleIdle();
  document.addEventListener('visibilitychange', () => {
    document.hidden ? clearTimeout(idleTimer) : scheduleIdle();
  });

  /* Click implode (locked only) */
  addEventListener('pointerdown', () => {
    if (!isLocked()) return;
    cursor.classList.remove('implode');
    void cursor.offsetWidth;
    cursor.classList.add('implode');
    setTimeout(() => cursor.classList.remove('implode'), 240);
  }, { passive:true });

  /* Movement (locked only) — keep visible at edges */
  function onMouseMoveLocked(e){
    pos.x = clamp(pos.x + e.movementX, 0, innerWidth);
    pos.y = clamp(pos.y + e.movementY, 0, innerHeight);
    applyPos(); // no edge-hide while locked
  }
  addEventListener('resize', () => {
    pos.x = clamp(pos.x, 0, innerWidth);
    pos.y = clamp(pos.y, 0, innerHeight);
    if (isLocked()) applyPos();
  });

  /* Lock via overlay (button just opens overlay) */
  btn.setAttribute('tabindex', '-1');
  btn.addEventListener('mousedown', (e) => { e.preventDefault(); }, { passive:false });
  btn.addEventListener('click', (e) => { e.preventDefault(); showOverlay(); });

  function showOverlay(){
    const ov = document.createElement('div');
    ov.className = 'lock-overlay';
    ov.innerHTML = `
      <div class="card">
        <h2>Click anywhere to lock pointer</h2>
        <p>Press Esc to exit. OS cursor appears when you leave the window.</p>
      </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const el = document.documentElement;
      (el.requestPointerLock || el.webkitRequestPointerLock)?.call(el);
    }, { once:true });
  }

  /* Pointer lock change */
  document.addEventListener('pointerlockchange', () => {
    const locked = isLocked();
    document.documentElement.classList.toggle('pointer-locked', locked);
    status && (status.textContent = locked ? 'Locked (Esc to exit)' : 'Unlocked');

    if (locked){
      document.querySelectorAll('.lock-overlay').forEach(n => n.remove());
      // start from current visual position (no recenter)
      const r = cursor.getBoundingClientRect();
      pos.x = (r.left || innerWidth/2) + (r.width/2 || 0);
      pos.y = (r.top  || innerHeight/2) + (r.height/2 || 0);
      showCursor();           // ensure visible even at edges
      applyPos();
      addEventListener('mousemove', onMouseMoveLocked);
    } else {
      removeEventListener('mousemove', onMouseMoveLocked);
      cursor.style.animation = 'none';
      hideCursor();           // hide custom X when unlocked
      focusPark.focus({ preventScroll:true });
    }
  });

  document.addEventListener('pointerlockerror', () => {
    document.querySelectorAll('.lock-overlay').forEach(n => n.remove());
    hideCursor();
    focusPark.focus({ preventScroll:true });
  });

  /* Real leave/blur → unlock so OS cursor appears outside */
  function exitLock(){ (document.exitPointerLock || document.webkitExitPointerLock)?.call(document); }
  function onLeaveLike(){
    if (isLocked()) exitLock();
  }
  // conservative set of signals that indicate an actual leave
  addEventListener('pointerout',   (e) => { if ((e.relatedTarget || e.toElement) == null) onLeaveLike(); }, { passive:true });
  addEventListener('mouseleave',   onLeaveLike, { passive:true });
  window.addEventListener('blur',  onLeaveLike);
  document.addEventListener('visibilitychange', () => { if (document.hidden) onLeaveLike(); });

  /* Init: hidden until locked */
  hideCursor();
})();
