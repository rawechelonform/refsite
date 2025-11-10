/* artist.js — UTD + custom cursor + glitch button sizing (robust, never disappears) */

/* ========= 0) Custom crosshair + aggressive OS-cursor killer ========= */
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

/* ========= 1) UTD logic (unchanged except for refs used by glitch sizing) ========= */
const API = 'https://script.google.com/macros/s/AKfycbzExL0U0srFXrAkkjJHNT0oCamBSjEUk4F1Dc7MyNwxi9mvleuwd9vdtnJoJlMHCKpl6A/exec';

const KEY_ENTRIES = 'utd_entries_v7';
const KEY_TITLE   = 'utd_title_v2';

const $  = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const pad = n => String(n).padStart(2, '0');

function stamp(d = new Date()){
  const DD = pad(d.getDate());
  const MM = pad(d.getMonth() + 1);
  const YY = String(d.getFullYear()).slice(-2);
  const HH = pad(d.getHours());
  const MI = pad(d.getMinutes());
  const SS = pad(d.getSeconds());
  return `${DD} ${MM} ${YY} ${HH} : ${MI} : ${SS}`;
}
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

function loadLocal(){ try { return JSON.parse(localStorage.getItem(KEY_ENTRIES)) || []; } catch { return []; } }
function saveLocal(arr){ localStorage.setItem(KEY_ENTRIES, JSON.stringify(arr || [])); }
function loadTitle(){ return localStorage.getItem(KEY_TITLE) || 'USELESS THOUGHT OF THE DAY'; }
function saveTitle(v){ localStorage.setItem(KEY_TITLE, v); }

function normalizeServerPosts(posts){
  return (posts || []).map(p => ({
    id: p.id,
    t: p.body || '',
    ts: new Date(p.ts).toLocaleString('en-GB', { hour12:false }).replace(',', '').replace(/\//g,' ')
  }));
}

const $utd    = $('.utd');
const $feed   = $('#utdFeed');
const $form   = $('#utdForm');
const $text   = $('#utdText');
const $unlock = $('#utdUnlock');
const $title  = $('#utdTitle');
const $avatar = $('.avatar-overlay');
if ($avatar) $avatar.style.pointerEvents = 'none';

let ownerMode = false;
let sessionToken = null;

function render(){
  const items = loadLocal();
  if ($feed) $feed.innerHTML = '';
  items.forEach(({id, t, ts}) => {
    const line = document.createElement('div');
    line.className = 'utd-line';
    line.dataset.id = id;

    const tsEl  = document.createElement('span'); tsEl.className = 'ts';  tsEl.textContent = ts;
    const sepEl = document.createElement('span'); sepEl.className = 'sep'; sepEl.textContent = '|';

    const msgEl = document.createElement('span'); msgEl.className = 'msg';
    const oneLine = String(t || '').replace(/\s*\n\s*/g, ' ').trim();
    msgEl.textContent = oneLine;

    line.appendChild(tsEl); line.appendChild(sepEl); line.appendChild(msgEl);

    if (ownerMode){
      const icons = document.createElement('span');
      icons.className = 'utd-icons';
      icons.innerHTML = `
        <button class="utd-icon" data-act="edit" data-id="${id}" title="edit" aria-label="edit">✎</button>
        <button class="utd-icon" data-act="del"  data-id="${id}" title="delete" aria-label="delete">🗑</button>`;
      line.appendChild(icons);
    }
    $feed.prepend(line);
  });

  if ($utd) $utd.classList.toggle('is-owner', ownerMode);
}

if ($form) {
  $form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = ($text.value || '').trim();
    if (!val) return;
    const items = loadLocal();
    items.push({ id: uid(), t: val, ts: stamp() });
    saveLocal(items);
    $text.value = '';
    render();
    try {
      await fetch(API, { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'post', token: sessionToken, body: val }) });
      syncFromServer();
    } catch(_){}
  });

  if ($text){
    $text.addEventListener('keydown', (e) => {
      if (e.isComposing) return;
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (typeof $form.requestSubmit === 'function') $form.requestSubmit();
        else $form.dispatchEvent(new Event('submit', { bubbles:true, cancelable:true }));
      }
    });
  }
}

function enableTitleEditing() {
  if (!$title) return;
  $title.setAttribute('contenteditable', 'true');
  $title.addEventListener('input', () => saveTitle($title.textContent.trim()));
  $title.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $title.blur(); } });
  $title.style.outline = '2px dashed rgb(143,143,143)';
  $title.style.outlineOffset = '2px';
}
function disableTitleEditing() {
  if (!$title) return;
  $title.removeAttribute('contenteditable');
  $title.style.outline = ''; $title.style.outlineOffset = '';
}

if ($unlock) {
  $unlock.addEventListener('click', async () => {
    if (ownerMode) {
      ownerMode = false; sessionToken = null; $unlock.textContent = 'CREATOR UNLOCK';
      if ($form) $form.hidden = true; disableTitleEditing(); render(); return;
    }
    const pass = prompt('Enter passphrase:'); if (!pass) return;
    try {
      const r = await fetch(API, { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'verify', password: pass }) });
      const j = await r.json();
      if (j?.ok && j.token) {
        ownerMode = true; sessionToken = j.token; $unlock.textContent = 'CREATOR LOCK';
        if ($form) { $form.hidden = false; setTimeout(() => $text && $text.focus(), 0); }
        enableTitleEditing(); render();
      } else { alert('Incorrect passphrase'); }
    } catch(_) { alert('Network error'); }
  });
}

async function syncFromServer(){
  try{
    const r = await fetch(API + '?limit=100');
    const j = await r.json();
    if (j?.ok && Array.isArray(j.posts)){
      saveLocal(normalizeServerPosts(j.posts));
      window.dispatchEvent(new Event('utd:refresh'));
    }
  }catch(_){}
}
window.addEventListener('utd:refresh', render);
if ($title) $title.textContent = loadTitle(); render(); syncFromServer();

/* ========= 2) Glitch button sizing — match UTD width, never disappear ========= */
(function syncGlitchToUTD(){
  const wrap = document.getElementById('glitchWrap');
  const media = wrap ? wrap.querySelector('.gc-single') : null;
  if (!wrap || !media) return;

  let lastW = 360; // fallback

  function setAspect(){
    const w = media.videoWidth || media.naturalWidth || 0;
    const h = media.videoHeight || media.naturalHeight || 0;
    if (w && h) wrap.style.setProperty('--glitch-ar', (w / h));
  }

  function applySize(){
    const utd = document.querySelector('.utd');
    if (!utd) return;
    const r = utd.getBoundingClientRect();
    const w = Math.max(Math.round(r.width), 200);   // guard against 0
    lastW = w || lastW;
    wrap.style.setProperty('--glitch-w', lastW + 'px');
  }

  const init = () => { setAspect(); applySize(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  // Update AR when media metadata is ready
  media.addEventListener('loadedmetadata', setAspect, { once:true });
  media.addEventListener('load', setAspect, { once:true }); // for <img> fallback

  window.addEventListener('resize', applySize);
  window.addEventListener('utd:refresh', applySize);

  const utdEl = document.querySelector('.utd');
  if (utdEl){
    new ResizeObserver(applySize).observe(utdEl);
    new MutationObserver(applySize).observe(utdEl, { childList:true, subtree:true, characterData:true });
  }
})();
