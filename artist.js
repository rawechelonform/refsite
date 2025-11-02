/* artist.js — UTD + custom crosshair cursor + glitch badge message */

/* ========= 0) Custom crosshair + hide OS cursor via attribute gate ========= */
(() => {
  // Enable the CSS gate that hides the OS cursor
  document.documentElement.setAttribute('data-cursor', 'off');

  // Ensure custom cursor element exists
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

  // Move + spin
  let rafId = null;
  const move = (x, y) => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      cursor.style.left = x + 'px';
      cursor.style.top  = y + 'px';
    });
  };
  const spin = () => { cursor.classList.remove('spin'); void cursor.offsetWidth; cursor.classList.add('spin'); };

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
