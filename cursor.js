(() => {
  const cursor = document.getElementById('custom-cursor');
  let shield = document.getElementById('cursor-shield');
  if (!cursor){
    console.warn('[cursor] #custom-cursor missing');
    return;
  }
  if (!shield){
    shield = document.createElement('div');
    shield.id = 'cursor-shield';
    document.body.appendChild(shield);
  }

  const root = document.documentElement;
  const ua = navigator.userAgent;
  const IS_CHROME = /\bChrome\//.test(ua) && !/\bEdg\//.test(ua) && !/\bOPR\//.test(ua);
  const prefersReduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const TRANSPARENT_SVG = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/>\") 0 0, none";
  const MICRO_IDLE_MS   = 150;     // shield dwell after movement (non-Chrome)
  const REASSERT_MS     = 100;     // re-apply transparent cursor while inside

  let raf = 0, idleTimer = null, reassertTimer = null;
  let inside = false, lastMoveTs = 0;
  const now = () => performance.now();
  const rand = (a,b)=>Math.random()*(b-a)+a;
  const inBounds = (x,y)=> x>=0 && y>=0 && x<innerWidth && y<innerHeight;

  /* ---- root kill helpers ---- */
  function applyRootKill(){
    root.style.setProperty('cursor', TRANSPARENT_SVG, 'important');
    document.body?.style?.setProperty('cursor', TRANSPARENT_SVG, 'important');
  }
  function clearRootKill(){
    root.style.removeProperty('cursor');
    document.body?.style?.removeProperty('cursor');
  }
  function startReassert(){
    stopReassert();
    reassertTimer = setInterval(applyRootKill, REASSERT_MS);
  }
  function stopReassert(){
    if (reassertTimer){ clearInterval(reassertTimer); reassertTimer = null; }
  }

  /* ---- shield control ---- */
  let microTimer = null;
  function showShield(){
    if (shield.style.display !== 'block') shield.style.display = 'block';
  }
  function hideShield(){
    shield.style.display = 'none';
  }
  function microShield(){
    // used for Safari/others during movement
    showShield();
    if (microTimer) clearTimeout(microTimer);
    microTimer = setTimeout(hideShield, MICRO_IDLE_MS);
  }

  /* ---- forward events under the shield ---- */
  function forward(type, ev){
    const was = shield.style.display;
    shield.style.display = 'none';
    const target = document.elementFromPoint(ev.clientX, ev.clientY);
    shield.style.display = was;
    if (!target) return;

    const opts = {
      bubbles:true, cancelable:true, composed:true, view:window,
      clientX:ev.clientX, clientY:ev.clientY, screenX:ev.screenX, screenY:ev.screenY,
      button:ev.button, buttons:ev.buttons,
      ctrlKey:ev.ctrlKey, shiftKey:ev.shiftKey, altKey:ev.altKey, metaKey:ev.metaKey,
      pointerId:ev.pointerId, pointerType:ev.pointerType, width:ev.width, height:ev.height, pressure:ev.pressure
    };
    target.dispatchEvent(new PointerEvent(type, opts));
    const map = {pointermove:'mousemove', pointerdown:'mousedown', pointerup:'mouseup'};
    if (map[type]) target.dispatchEvent(new MouseEvent(map[type], opts));
    if (type === 'pointerup') target.dispatchEvent(new MouseEvent('click', opts));
  }

  /* ---- state ---- */
  function showInside(){
    if (inside) return;
    inside = true;
    root.setAttribute('data-cursor', 'off');
    applyRootKill();
    startReassert();
    cursor.style.left = innerWidth/2 + 'px';
    cursor.style.top  = innerHeight/2 + 'px';
    cursor.style.display = 'block';

    if (IS_CHROME){
      // Chrome strict: shield always on while inside to nuke flicker
      showShield();
    }
  }
  function hideInside(){
    if (!inside) return;
    inside = false;
    root.removeAttribute('data-cursor');
    clearRootKill();
    stopReassert();
    cursor.style.display = 'none';
    hideShield();
  }

  function place(x,y){
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      cursor.style.left = x + 'px';
      cursor.style.top  = y + 'px';
    });
  }

  /* ---- pointer handlers ---- */
  function onMove(e){
    if (inBounds(e.clientX, e.clientY)){
      if (!inside) showInside();
      lastMoveTs = now();
      applyRootKill(); // also re-assert inline immediately
      place(e.clientX, e.clientY);

      if (IS_CHROME){
        // always-on shield: just forward
        forward('pointermove', e);
      } else {
        // micro shield during motion to cover start/stop flicker
        microShield();
        forward('pointermove', e);
      }
    } else {
      hideInside();
    }
  }
  function onDown(e){
    if (!inside) return;
    if (!IS_CHROME) microShield();
    forward('pointerdown', e);

    cursor.classList.remove('implode'); void cursor.offsetWidth;
    cursor.classList.add('implode');
    setTimeout(()=>cursor.classList.remove('implode'), 240);
  }
  function onUp(e){
    if (!inside) return;
    if (!IS_CHROME) microShield();
    forward('pointerup', e);
  }
  // optional: suppress flicker around wheel/scroll starts
  function onWheel(e){
    if (!inside) return;
    if (!IS_CHROME) microShield();
    forward('pointermove', e); // keep hovers alive during wheel
  }

  /* ---- random idle spins ---- */
  function scheduleSpin(){
    clearTimeout(idleTimer);
    const delay = Math.max(300, rand(900, 4200) + rand(-350, 350));
    idleTimer = setTimeout(() => {
      const recentMove = now() - lastMoveTs < 250;
      const skip = Math.random() < 0.4;
      if (!prefersReduce && inside && !recentMove && !skip){
        const reverse = Math.random() < 0.5;
        const dur = Math.round(rand(220, 680));
        cursor.style.animation = 'none'; void cursor.offsetWidth;
        cursor.style.animation = `spin ${dur}ms ease-out ${reverse ? 'reverse' : 'normal'}`;
      }
      scheduleSpin();
    }, delay);
  }

  /* ---- enter/leave ---- */
  document.addEventListener('mouseout', (e)=>{ if (e.relatedTarget === null) hideInside(); }, {passive:true});
  window.addEventListener('blur', hideInside);
  document.addEventListener('visibilitychange', ()=>{ if (document.hidden) hideInside(); });

  document.addEventListener('pointermove', onMove, {passive:true});
  document.addEventListener('pointerdown', onDown, {passive:true});
  document.addEventListener('pointerup',   onUp,   {passive:true});
  document.addEventListener('wheel',       onWheel,{passive:true});

  /* ---- boot ---- */
  document.addEventListener('DOMContentLoaded', () => {
    // show immediately so you see it without moving
    showInside();
    lastMoveTs = now();
    scheduleSpin();
  });
})();
