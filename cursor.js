// ===== cursor.js — follow + click spin (no pointerlock, no beams) =====
(() => {
  const cursor = document.getElementById('custom-cursor');
  if (!cursor) return;

  const prefersReduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf = 0, last = { x: innerWidth / 2, y: innerHeight / 2 };

  function move(x, y){
    last.x = x; last.y = y;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      cursor.style.left = last.x + 'px';
      cursor.style.top  = last.y + 'px';
    });
  }

  // Follow pointer
  addEventListener('pointermove', (e) => move(e.clientX, e.clientY), { passive: true });

  // Spin on click (ease-out, random direction)
  addEventListener('pointerdown', () => {
    if (prefersReduce) return;
    const reverse = Math.random() < 0.5;
    cursor.style.animation = 'none';
    void cursor.offsetWidth; // restart animation
    cursor.style.animation = `cursor-spin 360ms ease-out ${reverse ? 'reverse' : 'normal'}`;
  }, { passive: true });

  // Hide while outside window; show on re-enter
  addEventListener('mouseleave', () => { cursor.style.display = 'none'; }, { passive: true });
  addEventListener('mouseenter', () => { cursor.style.display = 'block'; }, { passive: true });

  // Initial position
  move(last.x, last.y);
})();
