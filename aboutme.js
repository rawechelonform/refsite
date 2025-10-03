(() => {
  const KEY = 'utd_entries_v7';
  const TITLE_KEY = 'utd_title_v2';
  const OWNER_PASSPHRASE = 'ref-only'; // change this

  const $utd    = document.querySelector('.utd');
  const $feed   = document.getElementById('utdFeed');
  const $form   = document.getElementById('utdForm');
  const $text   = document.getElementById('utdText');
  const $unlock = document.getElementById('utdUnlock');
  const $title  = document.getElementById('utdTitle');

  let ownerMode = false;

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

  function load(){ try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } }
  function save(arr){ localStorage.setItem(KEY, JSON.stringify(arr)); }
  function loadTitle(){ return localStorage.getItem(TITLE_KEY) || 'USELESS THOUGHT OF THE DAY'; }
  function saveTitle(v){ localStorage.setItem(TITLE_KEY, v); }

  function render(){
    const items = load();
    $feed.innerHTML = '';
    items.forEach(({id, t, ts, edited}) => {
      const line = document.createElement('div');
      line.className = 'utd-line';

      const tsEl = document.createElement('span');
      tsEl.className = 'ts';
      tsEl.textContent = ts;

      const sepEl = document.createElement('span');
      sepEl.className = 'sep';
      sepEl.textContent = '|';

      const msgEl = document.createElement('span');
      msgEl.className = 'msg';
      const oneLine = (t || '').replace(/\s*\n\s*/g, ' ').trim();
      msgEl.textContent = `${oneLine}${edited ? ' (edited)' : ''}`;

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

    $utd.classList.toggle('is-owner', ownerMode);

    if (ownerMode){
      $feed.querySelectorAll('.utd-icon').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          const act = btn.dataset.act;
          let items2 = load();
          const idx = items2.findIndex(x => String(x.id) === String(id));
          if (idx < 0) return;

          if (act === 'del'){
            if (confirm('Delete this entry?')){
              items2.splice(idx, 1);
              save(items2);
              render();
            }
          } else if (act === 'edit'){
            const current = items2[idx].t;
            const next = prompt('Edit entry:', current);
            if (next !== null){
              items2[idx].t = next.trim();
             
