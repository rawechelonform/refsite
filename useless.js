/* ---- DIAG PROBE (top of useless.js) ---- */
(() => {
  const API = 'https://script.google.com/macros/s/AKfycbwiGt_jbEsCugoEL7i5ysxPSISiCcnnM3HptgSp0mv9Hb90aIyIJE9QHdRdQf9P_gbiSQ/exec';

  async function go(){
    try {
      // 1) GET should always return ok:true
      const g = await fetch(API + '?limit=1');
      const gtxt = await g.text();
      console.log('[probe] GET:', g.status, gtxt);

      // 2) POST verify using temp password
      const fd = new FormData();
      fd.append('action','verify');
      fd.append('password','temporary123');
      const p = await fetch(API, { method:'POST', body: fd });
      const ptxt = await p.text();
      console.log('[probe] POST:', p.status, ptxt);

      alert(`GET ${g.status}\n${gtxt.slice(0,120)}...\n\nPOST ${p.status}\n${ptxt.slice(0,120)}...`);
    } catch (err) {
      console.error('[probe] fetch failed:', err);
      alert('probe failed: ' + (err && err.message || err));
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
  else go();
})();




/* useless.js — UTD box (unlock-first, FormData fetches, robust wiring)
   - Wires the unlock button first (so the prompt always appears)
   - Uses FormData for ALL fetch() calls (no JSON headers → avoids CORS preflight)
   - Autosaves draft while typing; restores on reload
   - Stable local storage; survives code updates
   - Server is source of truth; local merges & dedupes
   - Edit/Delete require short-lived token (verify); password never stored
   - Verbose console logs to help you debug quickly
*/

/* ====== CONFIG ====== */
const API = 'https://script.google.com/macros/s/AKfycbwiGt_jbEsCugoEL7i5ysxPSISiCcnnM3HptgSp0mv9Hb90aIyIJE9QHdRdQf9P_gbiSQ/exec';

/* ====== Storage keys (stable) ====== */
const KEY_STORE = 'utd_entries';
const SCHEMA_VER = 1;
const KEY_DRAFT = 'utd_draft_v1';
const KEY_TITLE = 'utd_title_v1';

/* ====== Utilities ====== */
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const pad = n => String(n).padStart(2, '0');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);
const stamp = (d=new Date()) => {
  const DD = pad(d.getDate());
  const MM = pad(d.getMonth()+1);
  const YY = String(d.getFullYear()).slice(-2);
  const HH = pad(d.getHours());
  const MI = pad(d.getMinutes());
  const SS = pad(d.getSeconds());
  return `${DD} ${MM} ${YY} ${HH} : ${MI} : ${SS}`;
};

/* ====== Local store (stable, versioned) ====== */
function getStore(){
  try{
    const parsed = JSON.parse(localStorage.getItem(KEY_STORE));
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.items)) return parsed;
  }catch{}
  return { version: SCHEMA_VER, items: [] };
}
function setStore(items){
  localStorage.setItem(KEY_STORE, JSON.stringify({ version: SCHEMA_VER, items }));
}
function loadLocal(){ return getStore().items; }
function saveLocal(arr){ setStore(arr || []); }

/* ====== Token handling (short-lived, session only) ====== */
let sessionToken = sessionStorage.getItem('utd_token') || null;
let ownerMode = !!sessionToken;
function setToken(tok){
  sessionToken = tok || null;
  sessionStorage.setItem('utd_token', tok || '');
  ownerMode = !!tok;
}

/* ====== Server normalizer ====== */
function normalizeServerPosts(posts){
  return (posts || []).map(p => ({
    id: p.id,
    t: p.body || '',
    ts: new Date(p.ts).toLocaleString('en-GB', { hour12:false }).replace(',', '').replace(/\//g,' ')
  }));
}

/* ====== Draft helpers ====== */
function restoreDraft($text){
  const d = localStorage.getItem(KEY_DRAFT);
  if (d != null && $text) $text.value = d;
}
function saveDraft($text){
  if ($text) localStorage.setItem(KEY_DRAFT, $text.value || '');
}
function clearDraft(){ localStorage.removeItem(KEY_DRAFT); }

/* ====== Rendering ====== */
function renderFeed($feed, items, isOwner){
  if (!$feed) return;
  $feed.innerHTML = '';

  // newest first
  const sorted = items.slice().sort((a,b) => {
    const as = a.ts || '', bs = b.ts || '';
    if (as && bs) return as < bs ? 1 : as > bs ? -1 : 0;
    return String(a.id) < String(b.id) ? 1 : -1;
  });

  for (const { id, t, ts } of sorted){
    const line = document.createElement('div');
    line.className = 'utd-line';
    line.dataset.id = id;

    const tsEl  = document.createElement('span'); tsEl.className = 'ts';  tsEl.textContent = ts || '';
    const sepEl = document.createElement('span'); sepEl.className = 'sep'; sepEl.textContent = '|';
    const msgEl = document.createElement('span'); msgEl.className = 'msg';
    msgEl.textContent = String(t || '').replace(/\s*\n\s*/g, ' ').trim();

    line.append(tsEl, sepEl, msgEl);

    if (isOwner){
      const icons = document.createElement('span');
      icons.className = 'utd-icons';
      icons.innerHTML = `
        <button class="utd-icon" data-act="edit" data-id="${id}" title="edit" aria-label="edit">✎</button>
        <button class="utd-icon" data-act="del"  data-id="${id}" title="delete" aria-label="delete">🗑</button>
      `;
      line.appendChild(icons);
    }
    $feed.appendChild(line);
  }
}

/* ====== Server sync (GET) ====== */
async function syncFromServer($feed, $utd){
  try{
    const r = await fetch(API + '?limit=100');
    const j = await r.json();
    if (j?.ok && Array.isArray(j.posts)){
      const serverItems = normalizeServerPosts(j.posts);
      const map = new Map();
      for (const it of loadLocal()) map.set(String(it.id), it);
      for (const it of serverItems) map.set(String(it.id), it);
      const merged = Array.from(map.values());
      saveLocal(merged);
      renderFeed($feed, merged, ownerMode);
      if ($utd) $utd.classList.toggle('is-owner', ownerMode);
    }
  }catch(err){
    console.warn('[useless] syncFromServer failed:', err);
  }
}

/* ====== Mutations (POST via FormData) ====== */
async function postToServer(val){
  const fd = new FormData();
  fd.append('action','post');
  fd.append('token', sessionToken || '');
  fd.append('title','');
  fd.append('body', val);
  await fetch(API, { method:'POST', body: fd });
}
async function editOnServer(id, body){
  const fd = new FormData();
  fd.append('action','edit');
  fd.append('token', sessionToken || '');
  fd.append('id', id);
  fd.append('body', body);
  await fetch(API, { method:'POST', body: fd });
}
async function deleteOnServer(id){
  const fd = new FormData();
  fd.append('action','delete');
  fd.append('token', sessionToken || '');
  fd.append('id', id);
  await fetch(API, { method:'POST', body: fd });
}

/* ====== Boot ====== */
window.addEventListener('error', e => {
  console.error('[useless] runtime error:', e.error || e.message);
});

document.addEventListener('DOMContentLoaded', () => {
  console.log('[useless] DOM ready');

  const $utd    = $('.utd');
  const $unlock = $('#utdUnlock');
  const $form   = $('#utdForm');
  const $text   = $('#utdText');
  const $feed   = $('#utdFeed');
  const $title  = $('#utdTitle');

  // Initial UI state
  if ($form) $form.hidden = !ownerMode;
  if ($title) $title.textContent = localStorage.getItem(KEY_TITLE) || 'USELESS THOUGHT OF THE DAY';
  restoreDraft($text);

  // Wire unlock FIRST
  if (!$unlock){
    console.warn('[useless] unlock button not found');
  } else {
    console.log('[useless] unlock wired');
    $unlock.addEventListener('click', async () => {
      console.log('[useless] unlock clicked');

      // Lock → clear
      if (ownerMode){
        setToken('');
        $unlock.textContent = 'CREATOR UNLOCK';
        if ($form) $form.hidden = true;
        if ($utd) $utd.classList.remove('is-owner');
        renderFeed($feed, loadLocal(), false);
        return;
      }

      const pass = prompt('Enter passphrase:');
      if (!pass) return;

      // Verify using FormData to avoid preflight
      const fd = new FormData();
      fd.append('action','verify');
      fd.append('password', pass);

      try{
        const r = await fetch(API, { method:'POST', body: fd });
        const j = await r.json();
        console.log('[useless] verify result:', j);
        if (j?.ok && j.token){
          setToken(j.token);
          $unlock.textContent = 'CREATOR LOCK';
          if ($form){ $form.hidden = false; setTimeout(() => $text && $text.focus(), 0); }
          if ($utd) $utd.classList.add('is-owner');
          renderFeed($feed, loadLocal(), true);
        } else {
          alert('Incorrect passphrase');
        }
      }catch(err){
        console.error('[useless] verify fetch failed:', err);
        alert('Network error');
      }
    });
  }

  // Post form
  if ($form){
    $form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const val = ($text?.value || '').trim();
      if (!val) return;

      // optimistic local add
      const items = loadLocal();
      items.push({ id: uid(), t: val, ts: stamp() });
      saveLocal(items);
      renderFeed($feed, items, ownerMode);

      if ($text){ $text.value = ''; saveDraft($text); }

      try{
        await postToServer(val);
        clearDraft();
        await syncFromServer($feed, $utd);
      }catch(err){
        console.warn('[useless] post failed; will remain local until next sync:', err);
      }
    });

    // Autosave draft while typing + Enter=submit
    if ($text){
      $text.addEventListener('input', () => saveDraft($text));
      $text.addEventListener('keydown', (e) => {
        if (e.isComposing) return;
        if (e.key === 'Enter' && !e.shiftKey){
          e.preventDefault();
          if (typeof $form.requestSubmit === 'function') $form.requestSubmit();
          else $form.dispatchEvent(new Event('submit', { bubbles:true, cancelable:true }));
        }
      });
    }
  }

  // Owner edit/delete handlers (delegated)
  $feed?.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('.utd-icon');
    if (!btn || !ownerMode) return;
    const id = btn.dataset.id;
    const act = btn.dataset.act;

    const items = loadLocal();
    const idx = items.findIndex(x => String(x.id) === String(id));
    if (idx < 0) return;

    if (act === 'del'){
      if (!confirm('Delete this entry?')) return;
      try{
        await deleteOnServer(id);
        items.splice(idx,1);
        saveLocal(items);
        renderFeed($feed, items, ownerMode);
      }catch(err){ console.warn('[useless] delete failed:', err); }
      return;
    }

    if (act === 'edit'){
      const line = ev.target.closest('.utd-line');
      if (!line || line.querySelector('.utd-edit-wrap')) return;

      line.classList.add('is-editing');
      const original = items[idx].t;

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

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'utd-edit-del';
      delBtn.textContent = 'delete';

      actions.append(saveBtn, cancelBtn, delBtn);
      wrap.append(ta, actions);

      const msgSpan = line.querySelector('.msg');
      if (msgSpan) msgSpan.replaceWith(wrap);
      ta.focus(); ta.selectionStart = ta.selectionEnd = ta.value.length;

      function cleanup(){ line.classList.remove('is-editing'); renderFeed($feed, loadLocal(), ownerMode); }

      async function doSave(){
        const next = (ta.value || '').trim();
        if (next !== original){
          try{
            await editOnServer(id, next);
            items[idx].t = next; saveLocal(items);
          }catch(err){ console.warn('[useless] edit failed:', err); }
        }
        cleanup();
      }
      function doCancel(){ cleanup(); }
      async function doDelete(){
        if (!confirm('Delete this entry?')) return;
        try{
          await deleteOnServer(id);
          items.splice(idx,1); saveLocal(items);
        }catch(err){ console.warn('[useless] delete failed:', err); }
        cleanup();
      }

      ta.addEventListener('keydown', (e) => {
        if (e.isComposing) return;
        if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); doSave(); }
        else if (e.key === 'Escape'){ e.preventDefault(); doCancel(); }
      });
      saveBtn.addEventListener('click', doSave);
      cancelBtn.addEventListener('click', doCancel);
      delBtn.addEventListener('click', doDelete);
    }
  });

  // Title persistence + small-phone break
  if ($title){
    const getSavedTitle = () => {
      const v = localStorage.getItem(KEY_TITLE);
      return (v == null || v.trim() === '') ? 'USELESS THOUGHT OF THE DAY' : v.trim();
    };
    const mq = window.matchMedia('(max-width: 400px) and (orientation: portrait), (max-width: 600px) and (orientation: landscape)');
    const isStandard = s => /^USELESS\s+THOUGHT\s+OF\s+THE\s+DAY$/i.test(s);
    function renderTitle(){
      const raw = getSavedTitle();
      if (mq.matches && isStandard(raw)){
        $title.innerHTML = 'USELESS THOUGHT<br class="title-br">OF THE DAY';
      } else {
        $title.textContent = raw;
      }
    }
    renderTitle();
    window.addEventListener('resize', renderTitle);
    $title.addEventListener('focus', () => { $title.textContent = getSavedTitle(); });
    $title.addEventListener('input', () => { localStorage.setItem(KEY_TITLE, $title.textContent.trim()); });
    $title.addEventListener('blur', renderTitle);
  }

  // Initial render + sync
  renderFeed($feed, loadLocal(), ownerMode);
  if ($utd) $utd.classList.toggle('is-owner', ownerMode);
  syncFromServer($feed, $utd);
});
