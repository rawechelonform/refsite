/* useless.js — full, standalone UTD logic (desktop + mobile)
   - Autosaves drafts while typing; restores on reload
   - Stable local storage key w/ one-time migration from old keys
   - Offline-first posting; resyncs from server
   - Edit/Delete gated behind short-lived token (verify); password never stored
   - Mobile title break preserved
*/

/* ======= CONFIG ======= */
const API = 'https://script.google.com/macros/s/AKfycbz2yA7fBINXYykqRPr47Zo2rIMPtlx0P9UAjoyOpe4YwM6Ts4k_W44fBnYyJuenRLKQXQ/exec';

/* ======= Storage keys (stable) ======= */
const KEY_STORE = 'utd_entries';         // stable; do NOT change
const SCHEMA_VER = 1;                    // bump if structure changes (keep key name)
const KEY_DRAFT = 'utd_draft_v1';        // textarea autosave
const KEY_TITLE = 'utd_title_v1';        // custom title text

/* ======= Old keys to migrate from (one-time) ======= */
const OLD_KEYS = [
  'utd_entries_v7',
  'utd_entries_debug_v1'
];

/* ======= Utilities ======= */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
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

/* ======= Local Store (stable schema wrapper) ======= */
function getStore(){
  try{
    const parsed = JSON.parse(localStorage.getItem(KEY_STORE));
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.items)){
      return parsed;
    }
  }catch{}
  return { version: SCHEMA_VER, items: [] };
}
function setStore(items){
  localStorage.setItem(KEY_STORE, JSON.stringify({ version: SCHEMA_VER, items }));
}
function loadLocal(){ return getStore().items; }
function saveLocal(arr){ setStore(arr || []); }

/* ======= One-time migration from old keys ======= */
(function migrateOld(){
  const current = new Map(loadLocal().map(x => [String(x.id), x]));
  for (const k of OLD_KEYS){
    try{
      const v = JSON.parse(localStorage.getItem(k));
      const arr = Array.isArray(v?.items) ? v.items : Array.isArray(v) ? v : [];
      for (const it of arr){
        const id = String(it.id);
        if (!current.has(id)) current.set(id, it);
      }
      localStorage.removeItem(k);
    }catch{}
  }
  setStore(Array.from(current.values()));
})();

/* ======= Draft autosave ======= */
const $text = $('#utdText');
function restoreDraft(){
  const d = localStorage.getItem(KEY_DRAFT);
  if (d != null && $text) $text.value = d;
}
function saveDraft(){
  if ($text) localStorage.setItem(KEY_DRAFT, $text.value || '');
}
function clearDraft(){ localStorage.removeItem(KEY_DRAFT); }
$text?.addEventListener('input', saveDraft);

/* ======= Title persistence ======= */
const $title = $('#utdTitle');
function loadTitle(){ return localStorage.getItem(KEY_TITLE) || 'USELESS THOUGHT OF THE DAY'; }
function saveTitle(v){ localStorage.setItem(KEY_TITLE, v || ''); }

/* ======= Token handling (short-lived; never store password) ======= */
function setToken(tok){ sessionStorage.setItem('utd_token', tok); }
function getToken(){ return sessionStorage.getItem('utd_token'); }
let sessionToken = getToken();
let ownerMode = Boolean(sessionToken);

/* ======= Server normalization ======= */
function normalizeServerPosts(posts){
  return (posts || []).map(p => ({
    id: p.id,
    t: p.body || '',
    ts: new Date(p.ts).toLocaleString('en-GB', { hour12:false })
         .replace(',', '')
         .replace(/\//g,' ')
  }));
}

/* ======= DOM refs ======= */
const $utd    = $('.utd');
const $feed   = $('#utdFeed');
const $form   = $('#utdForm');
const $unlock = $('#utdUnlock');
const $avatar = $('.avatar-overlay');
if ($avatar) $avatar.style.pointerEvents = 'none';

/* ======= Rendering ======= */
function render(){
  const items = loadLocal();
  if ($feed) $feed.innerHTML = '';

  // newest first
  const sorted = items.slice().sort((a,b) => {
    // try to sort by timestamp string (DD MM YY HH : MI : SS) — fallback to id
    const as = a.ts || '', bs = b.ts || '';
    if (as && bs){ return as < bs ? 1 : as > bs ? -1 : 0; }
    return String(a.id) < String(b.id) ? 1 : -1;
  });

  for (const { id, t, ts } of sorted){
    const line = document.createElement('div');
    line.className = 'utd-line';
    line.dataset.id = id;

    const tsEl  = document.createElement('span'); tsEl.className = 'ts';  tsEl.textContent = ts || '';
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

    $feed?.appendChild(line);
  }

  if ($utd) $utd.classList.toggle('is-owner', ownerMode);

  // bind owner editor handlers
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
          try{
            await fetch(API, {
              method:'POST',
              headers:{'Content-Type':'application/json'},
              body: JSON.stringify({ action:'delete', token: sessionToken, id })
            });
            items2.splice(idx, 1);
            saveLocal(items2);
            render();
          }catch{}
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
          ta.className = 'utd-edit';
          ta.value = original;

          const actions = document.createElement('div');
          actions.className = 'utd-edit-actions';

          const saveBtn = document.createElement('button');
          saveBtn.type = 'button';
          saveBtn.className = 'utd-edit-save';
          saveBtn.textContent = 'save';

          const cancelBtn = document.createElement('button');
          cancelBtn.type = 'button';
          cancelBtn.className = 'utd-edit-cancel';
          cancelBtn.textContent = 'cancel';

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
              try{
                await fetch(API, {
                  method:'POST',
                  headers:{'Content-Type':'application/json'},
                  body: JSON.stringify({ action:'edit', token: sessionToken, id, body: next })
                });
                items2[idx].t = next; saveLocal(items2);
              }catch{}
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
async function postToServer(val){
  await fetch(API, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ action:'post', token: sessionToken, body: val })
  });
}
async function safeSyncPost(val){
  try{
    await postToServer(val);
    clearDraft();
    await syncFromServer(); // server = source of truth
  }catch{
    // keep local; will retry after reload or manual refresh
  }
}

if ($form){
  $form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = ($text?.value || '').trim();
    if (!val) return;

    const items = loadLocal();
    items.push({ id: uid(), t: val, ts: stamp() });
    saveLocal(items);
    render();

    if ($text){ $text.value = ''; saveDraft(); } // clear visible field but keep draft copy until server confirms
    await safeSyncPost(val);
  });

  // Enter to submit (Shift+Enter for newline)
  $text?.addEventListener('keydown', (e) => {
    if (e.isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (typeof $form.requestSubmit === 'function') $form.requestSubmit();
      else $form.dispatchEvent(new Event('submit', { bubbles:true, cancelable:true }));
    }
  });
}

/* ======= Unlock / lock (token via verify; password never stored) ======= */
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

if ($unlock){
  $unlock.addEventListener('click', async () => {
    if (ownerMode){
      ownerMode = false;
      sessionToken = null;
      setToken('');
      $unlock.textContent = 'CREATOR UNLOCK';
      if ($form) $form.hidden = true;
      disableTitleEditing();
      render();
      return;
    }

    const pass = prompt('Enter passphrase:');
    if (!pass) return;
    try{
      const r = await fetch(API, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'verify', password: pass })
      });
      const j = await r.json();
      if (j?.ok && j.token){
        ownerMode = true;
        sessionToken = j.token;
        setToken(j.token);
        $unlock.textContent = 'CREATOR LOCK';
        if ($form){ $form.hidden = false; setTimeout(() => $text && $text.focus(), 0); }
        enableTitleEditing();
        render();
      }else{
        alert('Incorrect passphrase');
      }
    }catch{
      alert('Network error');
    }
  });
}

/* ======= Server sync (merge + dedupe) ======= */
async function syncFromServer(){
  try{
    const r = await fetch(API + '?limit=100');
    const j = await r.json();
    if (j?.ok && Array.isArray(j.posts)){
      const serverItems = normalizeServerPosts(j.posts);
      // Merge with local; prefer server text if id clashes
      const map = new Map();
      for (const it of loadLocal()) map.set(String(it.id), it);
      for (const it of serverItems) map.set(String(it.id), it);
      saveLocal(Array.from(map.values()));
      window.dispatchEvent(new Event('utd:refresh'));
    }
  }catch{}
}
window.addEventListener('utd:refresh', render);

/* ======= Small-phone title break helper ======= */
(function titleBreakHelper () {
  if (!$title) return;

  function getSavedTitle() {
    const v = localStorage.getItem(KEY_TITLE);
    return (v == null || v.trim() === '') ? 'USELESS THOUGHT OF THE DAY' : v.trim();
  }
  const mq = window.matchMedia('(max-width: 400px) and (orientation: portrait), (max-width: 600px) and (orientation: landscape)');
  function isStandardPhrase(s) { return /^USELESS\s+THOUGHT\s+OF\s+THE\s+DAY$/i.test(s); }
  function renderTitleForViewport() {
    const raw = getSavedTitle();
    if (mq.matches && isStandardPhrase(raw)) {
      $title.innerHTML = 'USELESS THOUGHT<br class="title-br">OF THE DAY';
    } else {
      $title.textContent = raw;
    }
  }
  renderTitleForViewport();
  window.addEventListener('resize', renderTitleForViewport);
  $title.addEventListener('focus', () => { $title.textContent = getSavedTitle(); });
  $title.addEventListener('input', () => { localStorage.setItem(KEY_TITLE, $title.textContent.trim()); });
  $title.addEventListener('blur', renderTitleForViewport);
})();

/* ======= Init ======= */
(function init(){
  if ($title) $title.textContent = loadTitle();
  if ($form)  $form.hidden = !ownerMode;      // keep form hidden unless unlocked
  restoreDraft();
  render();
  syncFromServer();
})();
