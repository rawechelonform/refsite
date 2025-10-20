// aboutme.js (v5) — local-only UTD with unlock/lock toggle + edit/delete + title edit
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
    items.forEach(({id, t, ts, edited}) => {
      const line = document.createElement('div');
      line.className = 'utd-line';

      const tsEl = document.createElement('span'); tsEl.className = 'ts'; tsEl.textContent = ts;
      const sepEl = document.createElement('span'); sepEl.className = 'sep'; sepEl.textContent = '|';

      const msgEl = document.createElement('span'); msgEl.className = 'msg';
      const oneLine = String(t || '').replace(/\s*\n\s*/g, ' ').trim();
      msgEl.textContent = `${oneLine}${edited ? ' (edited)' : ''}`;

      line.appendChild(tsEl); line.appendChild(sepEl); line.appendChild(msgEl);

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
              save(items2); render();
            }
          } else if (act === 'edit'){
            const current = items2[idx].t;
            const next = prompt('Edit entry:', current);
            if (next !== null){
              items2[idx].t = next.trim();
              items2[idx].edited = true;
              save(items2); render();
            }
          }
        });
      });
    }
  }

  // submit
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

    // Ctrl/Cmd + Enter to post
    $text.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        $form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
    });
  }

  // unlock / lock toggle
  if ($unlock) {
    $unlock.addEventListener('click', () => {
      if (ownerMode) {
        // LOCK: hide form and disable title editing
        ownerMode = false;
        $unlock.textContent = 'CREATOR UNLOCK';
        if ($form) $form.hidden = true;
        disableTitleEditing();
        render();
        return;
      }

      // UNLOCK: prompt passphrase
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


/* ==== MOBILE (PORTRAIT) ONLY: reorder, fix avatar perch, smaller photo ==== */
@media (max-width:900px) and (orientation:portrait){

  /* Turn the overall grid into a simple vertical flow */
  .about-grid{
    display: flex;
    flex-direction: column;
    margin-top: 20px;   /* a bit tighter than the default 40px */
    row-gap: 12px;
    column-gap: 0;
  }

  /* Let right-col's children participate as top-level items for ordering */
  .right-col{ display: contents; }

  /* Desired order:
     1) text description (bio), 2) IG, 3) photo, 4) UTD */
  .bio{ order: 1; }

  /* Preferred selector if you added class="ig" */
  .right-col .ig{ order: 2; }

  /* Fallback if you didn't add .ig:
     target a block that contains the .ext-link */
  @supports(selector(p:has(a.ext-link))){
    .right-col p:has(a.ext-link){ order: 2; }
  }

  /* Photo comes third */
  .about-blurb{ order: 3; }

  /* Useless Thought of the Day box last */
  .utd{
    order: 4;

    /* Make space so the perched avatar doesn't overlap the text */
    padding-top: clamp(40px, 14vw, 72px);
  }

  /* Avatar: perch above the UTD top border without covering content */
  .avatar-overlay{
    /* Pull it upward so it sits on the box edge */
    top: calc(-1 * clamp(40px, 14vw, 72px) + 6px);
    right: -4px;

    /* Reasonable mobile size */
    width: clamp(60px, 18vw, 92px);
    height: auto;

    z-index: 4;              /* ensure it stays above the box frame */
    pointer-events: none;    /* keep taps from hitting it */
  }

  /* Make the portrait a bit smaller on mobile and center it */
  .about-photo{
    max-width: clamp(220px, 68vw, 340px);
    margin: 6px auto 0;
  }
  .about-photo img{
    width: 100%;
    height: auto;
  }
}




   document.documentElement.toggleAttribute('data-debug');
