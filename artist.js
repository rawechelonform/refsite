/* artist.js — UTD + custom crosshair cursor + glitch badge message
   • Aggressively hides the native cursor (CSS + runtime enforcement)
   • Custom crosshair follows pointer; spins on click with random direction
   • Rest of page logic preserved (UTD, server sync, title edit, glitch badge)
*/

/* ========= 0) Custom crosshair + aggressive OS-cursor killer ========= */
(() => {
  // Enable CSS gate for any stylesheet rules you added
  document.documentElement.setAttribute('data-cursor', 'off');

  // Inject a LAST <style> tag with high-specificity rules, keep it last
  function installCursorKiller(){
    const css = `
/* global hide (high specificity, no :where) */
html[data-cursor="off"] body,
html[data-cursor="off"] body *,
html[data-cursor="off"] body *::before,
html[data-cursor="off"] body *::after{
  cursor: none !important;
}
/* common interactive elements */
html[data-cursor="off"] a,
html[data-cursor="off"] button,
html[data-cursor="off"] input,
html[data-cursor="off"] textarea,
html[data-cursor="off"] select,
html[data-cursor="off"] summary,
html[data-cursor="off"] label,
html[data-cursor="off"] [role="button"],
html[data-cursor="off"] [contenteditable]{
  cursor: none !important;
}
/* optional: hide caret, too */
html[data-cursor="off"] input,
html[data-cursor="off"] textarea,
html[data-cursor="off"] [contenteditable]{ caret-color: transparent !important; }
`;
    let tag = document.getElementById('cursor-killer-style');
    if (!tag){
      tag = document.createElement('style');
      tag.id = 'cursor-killer-style';
      tag.textContent = css;
      (document.head || document.body || document.documentElement).appendChild(tag);
    }else{
      tag.textContent = css;
      tag.parentNode.appendChild(tag); // move to end again
    }
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', installCursorKiller);
  } else {
    installCursorKiller();
  }

  // Inline overrides beat most CSS. Ensure inline becomes none!important.
  function forceInlineNone(el){
    try { el.style && el.style.setProperty('cursor','none','important'); } catch(_) {}
  }

  // Remove/override inline cursor styles across the DOM (initial pass)
  function stripInlineCursorStyles(root=document){
    root.querySelectorAll('[style*="cursor"]').forEach(forceInlineNone);
  }
  stripInlineCursorStyles();

  // Watch for late-loaded styles/nodes and re-assert our style as last
  const mo = new MutationObserver((muts) => {
    let needReassert = false;
    for (const m of muts){
      if (m.type === 'childList'){
        m.addedNodes && m.addedNodes.forEach(n => {
          if (n.nodeType === 1){
            if (n.tagName === 'STYLE' || n.tagName === 'LINK') needReassert = true;
            if (n.hasAttribute && n.hasAttribute('style') && /cursor/i.test(n.getAttribute('style')||'')){
              forceInlineNone(n);
            }
            stripInlineCursorStyles(n);
          }
        });
      } else if (m.type === 'attributes' && m.attributeName === 'style'){
        const el = m.target;
        if (el && el.style && el.style.cursor) forceInlineNone(el);
      }
    }
    if (needReassert) installCursorKiller();
  });
  mo.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['style']
  });

  // Ensure the custom cursor element exists
  let cursor = document.getElementById('custom-cursor');
  if (!cursor) {
    cursor = document.createElement('div');
    cursor.id = 'custom-cursor';
    cursor.setAttribute('aria-hidden', 'true');
    cursor.innerHTML = `
      <span class="arm arm-a"></span>
      <span class="arm arm-b"></span>
      <span class="dot"></span>
    `;
    const appendCursor = () => document.body && document.body.appendChild(cursor);
    if (document.body) appendCursor(); else document.addEventListener('DOMContentLoaded', appendCursor);
  }

  // Follow pointer
  let rafId = null;
  const move = (x, y) => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      cursor.style.left = x + 'px';
      cursor.style.top  = y + 'px';
    });
  };

  // Random spin direction on click (respects reduced motion)
  const prefersReduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const spin = () => {
    if (prefersReduce) return;
    const reverse = Math.random() < 0.5; // true => CCW
    cursor.style.animation = 'none';
    void cursor.offsetWidth; // reflow to restart
    cursor.style.animation = `cursor-spin 360ms ease-out ${reverse ? 'reverse' : 'normal'}`;
  };

  document.addEventListener('pointermove', (e) => move(e.clientX, e.clientY), { passive: true });
  document.addEventListener('pointerdown', (e) => { move(e.clientX, e.clientY); spin(); }, { passive: true });
  document.addEventListener('mouseleave', () => { cursor.style.display = 'none'; });
  document.addEventListener('mouseenter', () => { cursor.style.display = 'block'; });
})();

/* ========= 1) UTD + server sync ========= */

/* ======= CONFIG ======= */
const API = 'https://script.google.com/macros/s/AKfycbzExL0U0srFXrAkkjJHNT0oCamBSjEUk4F1Dc7MyNwxi9mvleuwd9vdtnJoJlMHCKpl6A/exec';

/* ======= Helpers ======= */
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

/* ======= DOM refs ======= */
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

/* ======= Rendering ======= */
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

    line.appendChild(tsEl);
    line.appendChild(sepEl);
    line.appendChild(msgEl);

    if (ownerMode){
      const icons = document.createElement('span');
      icons.className = 'utd-icons';
      icons.innerHTML = `
        <button class="utd-icon" data-act="edit" data-id="${id}" title="edit" aria-label="edit">✎</button>
        <button class="utd-icon" data-act="del"  data-id="${id}" title="delete" aria-label="delete">🗑</button>
      `;
      line.appendChild(icons);
    }
    $feed.prepend(line);
  });

  if ($utd) $utd.classList.toggle('is-owner', ownerMode);

  if (ownerMode){
    $$('.utd-icon').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id  = btn.dataset.id;
        const act = btn.dataset.act;
        const items2 = loadLocal();
        const idx = items2.findIndex(x => String(x.id) === String(id));
        if (idx < 0) return;

        if (act === 'del'){
          if (!confirm('Delete this entry?')) return;
          try {
            await fetch(API, {
              method:'POST',
              headers:{'Content-Type':'application/json'},
              body: JSON.stringify({ action:'delete', token: sessionToken, id })
            });
            items2.splice(idx, 1);
            saveLocal(items2);
            render();
          } catch(_){}
          return;
        }

        if (act === 'edit'){
          const line = btn.closest('.utd-line');
          const msgSpan = line?.querySelector('.msg');
          if (!line || !msgSpan) return;
          if (line.querySelector('.utd-edit-wrap')) return;

          line.classList.add('is-editing');
          const original = items2[idx].t;

          const wrap = document.createElement('div');
          wrap.className = 'utd-edit-wrap';

          const ta = document.createElement('textarea');
          ta.className = 'utd-edit'; ta.value = original;

          const actions = document.createElement('div');
          actions.className = 'utd-edit-actions';

          const saveBtn = document.createElement('button');
          saveBtn.type = 'button'; saveBtn.className = 'utd-edit-save'; saveBtn.textContent = 'save';

          const cancelBtn = document.createElement('button');
          cancelBtn.type = 'button'; cancelBtn.className = 'utd-edit-cancel'; cancelBtn.textContent = 'cancel';

          const icons = line.querySelector('.utd-icons');
          const editIcon  = icons?.querySelector('[data-act="edit"]');
          const trashIcon = icons?.querySelector('[data-act="del"]');
          if (editIcon) editIcon.style.display = 'none';
          if (trashIcon) trashIcon.classList.add('utd-edit-del');

          actions.appendChild(saveBtn);
          actions.appendChild(cancelBtn);
          if (trashIcon) actions.appendChild(trashIcon);

          wrap.appendChild(ta);
          wrap.appendChild(actions);
          msgSpan.replaceWith(wrap);
          ta.focus(); ta.selectionStart = ta.selectionEnd = ta.value.length;

          function cleanup(){ line.classList.remove('is-editing'); }
          async function doSave(){
            const next = (ta.value || '').trim();
            if (next !== original){
              try {
                await fetch(API, {
                  method:'POST',
                  headers:{'Content-Type':'application/json'},
                  body: JSON.stringify({ action:'edit', token: sessionToken, id, body: next })
                });
                items2[idx].t = next; saveLocal(items2);
              } catch(_){}
            }
            cleanup(); render();
          }
          function doCancel(){ cleanup(); render(); }

          ta.addEventListener('keydown', (e) => {
            if (e.isComposing) return;
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSave(); }
            else if (e.key === 'Escape') { e.preventDefault(); doCancel(); }
          });
          saveBtn.addEventListener('click', doSave);
          cancelBtn.addEventListener('click', doCancel);
        }
      });
    });
  }
}

/* ======= Posting ======= */
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
      await fetch(API, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'post', token: sessionToken, body: val })
      });
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

/* ======= Unlock / lock (server-verified) ======= */
function enableTitleEditing() {
  if (!$title) return;
  $title.setAttribute('contenteditable', 'true');
  $title.addEventListener('input', onTitleInput);
  $title.addEventListener('keydown', onTitleKeydown);
  $title.style.outline = '2px dashed rgb(143,143,143)';
  $title.style.outlineOffset = '2px';
}
function disableTitleEditing() {
  if (!$title) return;
  $title.removeAttribute('contenteditable');
  $title.removeEventListener('input', onTitleInput);
  $title.removeEventListener('keydown', onTitleKeydown);
  $title.style.outline = '';
  $title.style.outlineOffset = '';
}
function onTitleInput() { saveTitle($title.textContent.trim()); }
function onTitleKeydown(e) { if (e.key === 'Enter') { e.preventDefault(); $title.blur(); } }

if ($unlock) {
  $unlock.addEventListener('click', async () => {
    if (ownerMode) {
      ownerMode = false;
      sessionToken = null;
      $unlock.textContent = 'CREATOR UNLOCK';
      if ($form) $form.hidden = true;
      disableTitleEditing();
      render();
      return;
    }

    const pass = prompt('Enter passphrase:');
    if (!pass) return;
    try {
      const r = await fetch(API, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'verify', password: pass })
      });
      const j = await r.json();
      if (j?.ok && j.token) {
        ownerMode = true;
        sessionToken = j.token;
        $unlock.textContent = 'CREATOR LOCK';
        if ($form) { $form.hidden = false; setTimeout(() => $text && $text.focus(), 0); }
        enableTitleEditing();
        render();
      } else {
        alert('Incorrect passphrase');
      }
    } catch(_) {
      alert('Network error');
    }
  });
}

/* ======= Server sync (read-only) ======= */
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

/* ======= Small-phone title break helper ======= */
(function () {
  const titleEl = document.getElementById('utdTitle');
  if (!titleEl) return;

  function getSavedTitle() {
    const v = localStorage.getItem(KEY_TITLE);
    return (v == null || v.trim() === '') ? 'USELESS THOUGHT OF THE DAY' : v.trim();
  }
  const mq = window.matchMedia('(max-width: 400px) and (orientation: portrait), (max-width: 600px) and (orientation: landscape)');
  function isStandardPhrase(s) { return /^USELESS\s+THOUGHT\s+OF\s+THE\s+DAY$/i.test(s); }
  function renderTitleForViewport() {
    const raw = getSavedTitle();
    if (mq.matches && isStandardPhrase(raw)) {
      titleEl.innerHTML = 'USELESS THOUGHT<br class="title-br">OF THE DAY';
    } else {
      titleEl.textContent = raw;
    }
  }
  renderTitleForViewport();
  window.addEventListener('resize', renderTitleForViewport);
  titleEl.addEventListener('focus', () => { titleEl.textContent = getSavedTitle(); });
  titleEl.addEventListener('input', () => { localStorage.setItem(KEY_TITLE, titleEl.textContent.trim()); });
  titleEl.addEventListener('blur', renderTitleForViewport);
})();

/* ======= Init ======= */
if ($title) $title.textContent = loadTitle();
render();
syncFromServer();

/* ======= Cursor auditor & enforcer (logs & kills any element showing a cursor) ======= */
(() => {
  const isEditable = (el) =>
    el.matches?.('input, textarea, [contenteditable], select') ||
    el.closest?.('[contenteditable="true"]');

  const forceNone = (el) => {
    try { el.style.setProperty('cursor', 'none', 'important'); } catch(_) {}
  };

  // Initial sweep
  document.querySelectorAll('[style*="cursor"]').forEach(forceNone);

  const seen = new WeakSet();
  const audit = (el) => {
    if (!el || el.nodeType !== 1) return;
    const cur = getComputedStyle(el).cursor;
    if (cur && cur !== 'none') {
      forceNone(el);
      if (!seen.has(el)) {
        seen.add(el);
        console.warn('[cursor-audit] forcing none on:', el, 'computed:', cur);
      }
    }
  };

  document.addEventListener('pointermove', (e) => {
    const path = (e.composedPath && e.composedPath()) || [];
    for (let i = 0; i < Math.min(8, path.length); i++) {
      const el = path[i];
      if (el && el.nodeType === 1) audit(el);
    }
  }, { capture: true, passive: true });

  document.addEventListener('pointerover', (e) => {
    const t = e.target;
    if (t && t.nodeType === 1 && isEditable(t)) {
      forceNone(t);
      t.style.setProperty('caret-color', 'transparent', 'important');
    }
    if (t && t.nodeType === 1 && t.matches?.('a,button,[role="button"],summary,label')) {
      forceNone(t);
    }
  }, { capture: true, passive: true });

  const reinstall = () => {
    document.querySelectorAll('[style*="cursor"]').forEach(forceNone);
  };
  const mo2 = new MutationObserver((muts) => {
    let need = false;
    for (const m of muts) {
      if (m.type === 'childList') {
        m.addedNodes && m.addedNodes.forEach(n => {
          if (n.nodeType !== 1) return;
          if (n.tagName === 'STYLE' || n.tagName === 'LINK') need = true;
          if (n.hasAttribute?.('style') && /cursor/i.test(n.getAttribute('style')||'')) forceNone(n);
          n.querySelectorAll?.('[style*="cursor"]').forEach(forceNone);
        });
      } else if (m.type === 'attributes' && m.attributeName === 'style') {
        const el = m.target;
        if (el && /cursor/i.test(el.getAttribute('style') || '')) forceNone(el);
      }
    }
    if (need) reinstall();
  });
  mo2.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });

  forceNone(document.body);
  forceNone(document.documentElement);
})();

/* ======= Glitch badge success message ======= */
(() => {
  const q  = new URLSearchParams(location.search);
  const ok = q.get('registration') === 'complete' ||
             q.get('registered') === '1' ||
             location.hash === '#registered';
  if (!ok) return;

  const el = document.getElementById('glitchMsg');
  if (!el) return;

  const DISPLAY_MS   = 2000;
  const FADE_MS      = 300;

  el.hidden = false;
  void el.offsetWidth;
  el.classList.add('show');

  setTimeout(() => {
    el.classList.remove('show');
    el.classList.add('hide');
    setTimeout(() => {
      el.hidden = true;
      el.classList.remove('hide');
    }, FADE_MS);
  }, DISPLAY_MS);
})();
