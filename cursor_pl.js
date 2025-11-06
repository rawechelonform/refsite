// pointer-lock crosshair with: idle random spins, click-implode,
// off-page OS cursor, and no jump-to-button on unlock.
(() => {
  const cursor = document.getElementById('custom-cursor');
  const btn    = document.getElementById('lockBtn');
  const status = document.getElementById('status');
  if (!cursor) return;

  const prefersReduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Config ---------- */
  const EDGE_HIDE_PX = 3;
  const EDGE_ESCAPE_FRAMES = 10;
  const IDLE_MIN_MS = 1200;
  const IDLE_MAX_MS = 2800;

  /* ---------- State ---------- */
  let raf = 0;
  let last = { x: innerWidth / 2, y: innerHeight / 2 }; // unlocked
  let pos  = { x: innerWidth / 2, y: innerHeight / 2 }; // locked
  let edgeHold = 0;
  let showAfterMove = true;      // keep hidden until first move after enter
  let idleTimer = null;

  /* ---------- Helpers ---------- */
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const showCursor = () => { cursor.style.display = 'block'; };
  const hideCursor = () => { cursor.style.display = 'none'; };
  const isLeavingDoc = (e) => (e.relatedTarget || e.toElement) === null;
  const rand = (min, max) => Math.random() * (max - min) + min;

  function maybeEdgeHide(x, y){
    const nearEdge =
      x <= EDGE_HIDE_PX || y <= EDGE_HIDE_PX ||
      x >= innerWidth - EDGE_HIDE_PX || y >= innerHeight - EDGE_HIDE_PX;
    if (nearEdge) hideCursor();
    else if (!showAfterMove) showCursor();
  }

  /* ---------- Follow (unlocked) ---------- */
  function moveAbsolute(x, y){
    last.x = x; last.y = y;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      cursor.style.left = last.x + 'px';
      cursor.style.top  = last.y + 'px';
      if (showAfterMove){ showAfterMove = false; showCursor(); }
      maybeEdgeHide(last.x, last.y);
    });
  }
  addEventListener('pointermove', (e) => {
    if (!document.pointerLockElement) moveAbsolute(e.clientX, e.clientY);
  }, { passive: true });

  /* ---------- Idle spin ---------- */
  function spinOnce(){
    if (prefersReduce) return;
    const reverse = Math.random() < 0.5;
    const dur = Math.round(rand(260, 560)); // ms
    cursor.style.animation = 'none';
    void cursor.offsetWidth;
    cursor.style.animation =
      `cursor-spin ${dur}ms ease-out ${reverse ? 'reverse' : 'normal'}`;
  }
  function scheduleIdle(){
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!document.hidden) spinOnce();
      scheduleIdle();
    }, Math.round(rand(IDLE_MIN_MS, IDLE_MAX_MS)));
  }
  scheduleIdle();
  document.addEventListener('visibilitychange', () => {
    document.hidden ? clearTimeout(idleTimer) : scheduleIdle();
  });
  addEventListener('blur',  () => clearTimeout(idleTimer));
  addEventListener('focus', () => scheduleIdle());

  /* ---------- Click: implode animation ---------- */
  addEventListener('pointerdown', () => {
    cursor.classList.remove('implode');
    void cursor.offsetWidth;          // restart
    cursor.classList.add('implode');
    setTimeout(() => cursor.classList.remove('implode'), 240);
  }, { passive: true });

  /* ---------- Off-page behavior ---------- */
  function exitLock(){ (document.exitPointerLock || document.webkitExitPointerLock)?.call(document); }
  function onLeaveLike(){
    hideCursor();
    showAfterMove = true;                 // show only after next pointermove
    if (document.pointerLockElement) exitLock();  // ensure OS cursor off-page
  }
  addEventListener('pointerout',   (e) => { if (isLeavingDoc(e)) onLeaveLike(); }, { passive:true });
  addEventListener('mouseleave',   onLeaveLike, { passive:true });
  addEventListener('blur',         onLeaveLike);
  document.addEventListener('visibilitychange', () => { if (document.hidden) onLeaveLike(); });
  addEventListener('mouseenter', () => { showAfterMove = true; }, { passive: true });

  /* ---------- Locked (relative) ---------- */
  function applyPos(){
    cursor.style.left = pos.x + 'px';
    cursor.style.top  = pos.y + 'px';
    maybeEdgeHide(pos.x, pos.y);
  }
  function onMouseMoveLocked(e){
    pos.x += e.movementX;
    pos.y += e.movementY;

    // pushing outward -> escape lock
    let pushingOut = false;
    if (pos.x <= 0 && e.movementX < 0) pushingOut = true;
    if (pos.x >= innerWidth && e.movementX > 0) pushingOut = true;
    if (pos.y <= 0 && e.movementY < 0) pushingOut = true;
    if (pos.y >= innerHeight && e.movementY > 0) pushingOut = true;

    pos.x = clamp(pos.x, 0, innerWidth);
    pos.y = clamp(pos.y, 0, innerHeight);
    applyPos();

    if (pushingOut){
      edgeHold++;
      if (edgeHold >= EDGE_ESCAPE_FRAMES){ exitLock(); edgeHold = 0; }
    } else edgeHold = 0;
  }
  addEventListener('resize', () => {
    pos.x = clamp(pos.x, 0, innerWidth);
    pos.y = clamp(pos.y, 0, innerHeight);
    if (document.pointerLockElement) applyPos();
  });

  /* ---------- Pointer lock plumbing (no jump-to-button) ---------- */
  function requestLock(){
    const el = document.documentElement;
    const req = el.requestPointerLock || el.webkitRequestPointerLock;
    if (!req){
      status && (status.textContent = 'Pointer Lock not supported in this browser.');
      return;
    }
    btn?.blur();                 // don't leave focus on the button
    req.call(el);
  }
  // Prevent the button from ever taking focus
  btn?.addEventListener('mousedown', (e) => { e.preventDefault(); }, { passive:false });
  btn?.addEventListener('click', (e) => { e.preventDefault(); requestLock(); });

  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === document.documentElement;
    document.documentElement.classList.toggle('pointer-locked', locked);
    status && (status.textContent = locked ? 'Locked (Esc to exit)' : 'Unlocked');

    if (locked){
      const r = cursor.getBoundingClientRect();
      pos.x = r.left + r.width  / 2;
      pos.y = r.top  + r.height / 2;
      showAfterMove = false;
      showCursor();
      applyPos();
      document.addEventListener('mousemove', onMouseMoveLocked);
      edgeHold = 0;
    } else {
      document.removeEventListener('mousemove', onMouseMoveLocked);

      // Move focus away from the button so no jump/scroll occurs
      if (!document.body.hasAttribute('tabindex')) document.body.setAttribute('tabindex', '-1');
      document.body.focus({ preventScroll: true });

      hideCursor();
      showAfterMove = true;
      edgeHold = 0;

      // stop residual spin + reset baseline
      cursor.style.animation = 'none';
      cursor.style.transform = 'translate(-50%, -50%)';
    }
  });

  document.addEventListener('pointerlockerror', () => {
    if (!document.body.hasAttribute('tabindex')) document.body.setAttribute('tabindex', '-1');
    document.body.focus({ preventScroll: true });
    hideCursor();
    showAfterMove = true;
  });

  // Start hidden; show after first move
  hideCursor();
  showAfterMove = true;
})();
