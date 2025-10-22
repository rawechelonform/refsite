// aboutme.js (v11) — UTD with inline edit, right-aligned actions, Enter to post/save
(() => {
  const KEY        = 'utd_entries_v7';
  const TITLE_KEY  = 'utd_title_v2';
  const OWNER_PASSPHRASE = 'ref-only'; // change this

  const $utd    = document.querySelector('.utd');
  const $feed   = document.getElementById('utdFeed');
  const $form   = document.getElementById('utdForm');
  const $text   = document.getElementById('utdText');
  const $unlock = document.getElementById('utdUnlock');
  const $title  = document.getElementById('utdTitle');
  const $avatar = document.querySelector('.avatar-overlay');

  if ($avatar) $avatar.style.pointerEvents = 'none';

  let ownerMode = false;

  // utils
  const pad = n => String(n).padStart(2,'0');
  function stamp(d=new Date()){
    const DD = pad(d.getDate());
    const MM = pad(d.getMonth() + 1);
    const YY = String(d.getFullYear()).slice(-2);
    const HH = pad(d.getHours());
    const MI = pad(d.getMinutes());
    const SS = pad(d.getSeconds());
    return `${DD} ${MM} ${YY} ${HH} : ${MI} : ${SS}`;
  }
  function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

  function load(){ try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } }
  function save(arr){ localStorage.setItem(KEY, JSON.stringify(arr)); }
  function loadTitle(){ return localStorage.getItem(TITLE_KEY) || 'USELESS THOUGHT OF THE DAY'; }
  function saveTitle(v){ localStorage.setItem(TITLE_KEY, v); }

  // render feed
  function render(){
    const items = load();
    $feed.innerHTML = '';
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

      $feed.prepend(line); // newest first
    });

    $utd.classList.toggle('is-owner', ownerMode);

    if (ownerMode){
      $feed.querySelectorAll('.utd-icon').forEach(btn => {
        btn.addEventListener('click', () => {
          const id  = btn.dataset.id;
          const act = btn.dataset.act;
          const items2 = load();
          const idx = items2.findIndex(x => String(x.id) === String(id));
          if (idx < 0) return;

          if (act === 'del'){
            if (confirm('Delete this entry?')){
              items2.splice(idx, 1);
              save(items2);
              render();
            }
            return;
          }

          if (act === 'edit'){
            const line = btn.closest('.utd-line');
            if (!line) return;
            const msgSpan = line.querySelector('.msg');
            if (!msgSpan) return;
            if (line.querySelector('.utd-edit-wrap')) return; // already editing

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

            // Move TRASH into actions row; hide the pencil
            const icons = line.querySelector('.utd-icons');
            const editIcon  = icons?.querySelector('[data-act="edit"]');
            const trashIcon = icons?.querySelector('[data-act="del"]');
            if (editIcon) editIcon.style.display = 'none';
            if (trashIcon) {
              trashIcon.classList.add('utd-edit-del'); // for CSS in actions row
              actions.appendChild(saveBtn);
              actions.appendChild(cancelBtn);
              actions.appendChild(trashIcon); // order: Save, Cancel, Trash (right-aligned via CSS)
            } else {
              actions.appendChild(saveBtn);
              actions.appendChild(cancelBtn);
            }

            wrap.appendChild(ta);
            wrap.appendChild(actions);

            msgSpan.replaceWith(wrap);
            ta.focus();
            ta.selectionStart = ta.selectionEnd = ta.value.length;

            function cleanup(){
              line.classList.remove('is-editing');
            }
            function doSave(){
              const next = (ta.value || '').trim();
              if (next !== original){
                items2[idx].t = next;
                save(items2);
              }
              cleanup();
              render(); // rebuild row/icons
            }
            function doCancel(){
              cleanup();
              render();
            }

            // Enter = SAVE, Shift+Enter = newline, Esc = cancel
            ta.addEventListener('keydown', (e) => {
              if (e.isComposing) return;
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                doSave();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                doCancel();
              }
            });
            saveBtn.addEventListener('click', doSave);
            cancelBtn.addEventListener('click', doCancel);
          }
        });
      });
    }
  }

  // submit new entry
  if ($form) {
    $form.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = ($text.value || '').trim();
      if (!val) return;
      const items = load();
      items.push({ id: uid(), t: val, ts: stamp() });
      save(items);
      $text.value = '';
      render();
    });

    // Enter = POST, Shift+Enter = newline
    if ($text){
      $text.addEventListener('keydown', (e) => {
        if (e.isComposing) return;                   // let IME composition finish
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          if (typeof $form.requestSubmit === 'function') $form.requestSubmit();
          else $form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }
      });
    }
  }

  // unlock / lock toggle
  if ($unlock) {
    $unlock.addEventListener('click', () => {
      if (ownerMode) {
        ownerMode = false;
        $unlock.textContent = 'CREATOR UNLOCK';
        if ($form) $form.hidden = true;
        disableTitleEditing();
        render();
        return;
      }

      const pass = prompt('Enter passphrase:');
      if (pass && pass === OWNER_PASSPHRASE) {
        ownerMode = true;
        $unlock.textContent = 'CREATOR LOCK';
        if ($form) {
          $form.hidden = false;
          setTimeout(() => $text && $text.focus(), 0);
        }
        enableTitleEditing();
        render();
      } else {
        alert('Incorrect passphrase');
      }
    });
  }

  // title editing only in owner mode
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

  // init
  if ($title) $title.textContent = loadTitle();
  render();
})();









// === Small-phone title break helper ===
// Forces "USELESS THOUGHT" (line 1) and "OF THE DAY" (line 2)
// only on very small screens. Does NOT store <br> in localStorage.
(function(){
  if (!$title) return;

  const TITLE_KEY = 'utd_title_v2';

  function getSavedTitle(){
    const v = localStorage.getItem(TITLE_KEY);
    return (v == null || v.trim() === '') ? 'USELESS THOUGHT OF THE DAY' : v.trim();
  }

  // Match tiny portrait OR small landscape
  const mq = window.matchMedia('(max-width: 400px) and (orientation: portrait), (max-width: 600px) and (orientation: landscape)');

  function isStandardPhrase(s){
    return /^USELESS\s+THOUGHT\s+OF\s+THE\s+DAY$/i.test(s);
  }

  function renderTitleForViewport(){
    const raw = getSavedTitle();
    if (mq.matches && isStandardPhrase(raw)) {
      // Inject a controlled break element we can style via CSS
      $title.innerHTML = 'USELESS THOUGHT<br class="title-br">OF THE DAY';
    } else {
      $title.textContent = raw;
    }
  }

  // Re-render on load + resize
  renderTitleForViewport();
  window.addEventListener('resize', renderTitleForViewport);

  // If the title is editable, keep things nice for the editor:
  // when user focuses the title, show raw text (no <br>); on input, save; on blur, re-render.
  $title.addEventListener('focus', () => {
    const raw = getSavedTitle();
    $title.textContent = raw;
  });

  $title.addEventListener('input', () => {
    // Save live edits
    localStorage.setItem(TITLE_KEY, $title.textContent.trim());
  });

  $title.addEventListener('blur', () => {
    renderTitleForViewport();
  });
})();















// syncing for thought box
<script>
(() => {
  const API = 'YOUR_EXEC_URL/exec';              // <-- paste your /exec URL
  const SECRET = 'fHTTj7XPasXkhXqY';             // must be in the URL
  const KEY = 'utd_entries_v7';                  // keep your current local key

  // convert sheet rows to your local shape
  function normalize(serverPosts){
    return serverPosts.map(p => ({
      id: p.id || (p.ts + Math.random()),
      t: p.body || '',
      ts: (p.ts ? new Date(p.ts) : new Date()).toLocaleString('en-GB',{hour12:false}).replace(',', '').replace(/\//g,' ')
    }));
  }

  function loadLocal(){
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  }
  function saveLocal(arr){
    localStorage.setItem(KEY, JSON.stringify(arr));
  }

  // 1) pull from server on load, replace local if server has anything
  async function syncFromServer(){
    try {
      const r = await fetch(`${API}?secret=${encodeURIComponent(SECRET)}&limit=100`);
      const j = await r.json();
      if (j && j.ok && Array.isArray(j.posts) && j.posts.length){
        const merged = normalize(j.posts);
        saveLocal(merged);
        // trigger your existing render
        const evt = new Event('utd:refresh');
        window.dispatchEvent(evt);
      }
    } catch(e){
      // no-op: stay offline
    }
  }

  // 2) hook your existing form submit to also POST to server
  window.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('utdForm');
    const text = document.getElementById('utdText');
    if (!form || !text) return;

    form.addEventListener('submit', async (e) => {
      // your code already pushed to local and re-rendered
      // we add a fire-and-forget POST to keep the sheet in sync
      const body = (text.value || '').trim();
      if (!body) return;

      try {
        await fetch(`${API}?secret=${encodeURIComponent(SECRET)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: '', body })
        });
        // optional: pull back the latest so phone/desktop stay identical
        syncFromServer();
      } catch(e){
        // stay quiet offline
      }
    }, { capture: true }); // capture so we see it before your handler clears the textarea
  });

  // initial sync
  syncFromServer();
})();
</script>
