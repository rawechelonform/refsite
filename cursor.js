// Always-on crosshair (on page), OS cursor off-page.
// No pointer lock. No observers.

(() => {
  const cursor = document.getElementById('custom-cursor');
  if (!cursor) return;

  const prefersReduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let raf = 0;
  let idleTimer = null;

  const IDLE_MIN_MS = 1200;
  const IDLE_MAX_MS = 2800;

  function move(x, y){
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      cursor.style.left = x + 'px';
      cursor.style.top  = y + 'px';
    });
  }

  // Follow pointer
  addEventListener('pointermove', (e) => move(e.clientX, e.clientY), { passive:true });

  // Idle spin
  function spinOnce(){
    if (prefersReduce) return;
    const reverse = Math.random() < 0.5;
    const dur = Math.round(Math.random() * (560 - 260) + 260);
    cursor.style.animation = 'none';
    void cursor.offsetWidth;
    cursor.style.animation = `cursor-spin ${dur}ms ease-out ${reverse ? 'reverse' : 'normal'}`;
  }
  function scheduleIdle(){
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (!document.hidden) spinOnce(); scheduleIdle(); },
                           Math.round(Math.random() * (IDLE_MAX_MS - IDLE_MIN_MS) + IDLE_MIN_MS));
  }

  // Click = implode
  addEventListener('pointerdown', () => {
    cursor.classList.remove('implode');
    void cursor.offsetWidth;
    cursor.classList.add('implode');
    setTimeout(() => cursor.classList.remove('implode'), 240);
  }, { passive:true });

  // Start centered
  addEventListener('DOMContentLoaded', () => {
    move(innerWidth/2, innerHeight/2);
    scheduleIdle();
  });

  // Keep centered on resize bounds
  addEventListener('resize', () => {
    const rect = cursor.getBoundingClientRect();
    const x = Math.max(0, Math.min(innerWidth, rect.left + rect.width/2));
    const y = Math.max(0, Math.min(innerHeight, rect.top  + rect.height/2));
    move(x, y);
  });
})();
