/* artist.js — custom cursor only */

(() => {
  document.documentElement.setAttribute('data-cursor', 'off');

  function installCursorKiller(){
    const css = `
html[data-cursor="off"] body,
html[data-cursor="off"] body *,
html[data-cursor="off"] body *::before,
html[data-cursor="off"] body *::after{ cursor: none !important; }
html[data-cursor="off"] input, html[data-cursor="off"] textarea, html[data-cursor="off"] [contenteditable]{ caret-color: transparent !important; }
`;
    let tag = document.getElementById('cursor-killer-style');
    if (!tag){
      tag = document.createElement('style'); tag.id = 'cursor-killer-style'; tag.textContent = css;
      (document.head || document.body || document.documentElement).appendChild(tag);
    } else {
      tag.textContent = css; tag.parentNode.appendChild(tag);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installCursorKiller);
  else installCursorKiller();

  function forceInlineNone(el){ try { el.style && el.style.setProperty('cursor','none','important'); } catch(_) {} }
  function stripInlineCursorStyles(root=document){ root.querySelectorAll('[style*="cursor"]').forEach(forceInlineNone); }
  stripInlineCursorStyles();

  const mo = new MutationObserver((muts) => {
    let needReassert = false;
    for (const m of muts){
      if (m.type === 'childList'){
        m.addedNodes && m.addedNodes.forEach(n => {
          if (n.nodeType === 1){
            if (n.tagName === 'STYLE' || n.tagName === 'LINK') needReassert = true;
            if (n.hasAttribute?.('style') && /cursor/i.test(n.getAttribute('style')||'')) forceInlineNone(n);
            stripInlineCursorStyles(n);
          }
        });
      } else if (m.type === 'attributes' && m.attributeName === 'style'){
        const el = m.target; if (el && el.style && el.style.cursor) forceInlineNone(el);
      }
    }
    if (needReassert) installCursorKiller();
  });
  mo.observe(document.documentElement, { subtree:true, childList:true, attributes:true, attributeFilter:['style'] });

  // Ensure custom cursor exists
  let cursor = document.getElementById('custom-cursor');
  if (!cursor) {
    cursor = document.createElement('div');
    cursor.id = 'custom-cursor';
    cursor.setAttribute('aria-hidden', 'true');
    cursor.innerHTML = `
      <span class="arm arm-a"></span>
      <span class="arm arm-b"></span>
      <span class="dot"></span>`;
    const appendCursor = () => document.body && document.body.appendChild(cursor);
    if (document.body) appendCursor(); else document.addEventListener('DOMContentLoaded', appendCursor);
  }

  let rafId = null;
  const move = (x, y) => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => { cursor.style.left = x + 'px'; cursor.style.top = y + 'px'; });
  };
  const prefersReduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const spin = () => {
    if (prefersReduce) return;
    const reverse = Math.random() < 0.5;
    cursor.style.animation = 'none'; void cursor.offsetWidth;
    cursor.style.animation = `cursor-spin 360ms ease-out ${reverse ? 'reverse' : 'normal'}`;
  };
  document.addEventListener('pointermove', (e) => move(e.clientX, e.clientY), { passive:true });
  document.addEventListener('pointerdown', (e) => { move(e.clientX, e.clientY); spin(); }, { passive:true });
  document.addEventListener('mouseleave', () => { cursor.style.display = 'none'; });
  document.addEventListener('mouseenter', () => { cursor.style.display = 'block'; });
})();
