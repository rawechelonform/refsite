console.log('[tags_form] script loaded');

// ------- DOM refs -------
const form       = document.getElementById('tags_form');
const btn        = document.getElementById('submitBtn');
const statusEl   = document.getElementById('status');
const fileInput  = document.getElementById('sticker');
const fileStatus = document.getElementById('fileStatus');

// optional cursor helpers if present in your HTML
const cursorEl = document.getElementById('cursor');
function hideCursor(){
  if (!cursorEl) return;
  cursorEl.style.display = 'none';
  document.body.appendChild(cursorEl);
}

// ------- utils -------
function setStatus(msg){
  if (statusEl){ statusEl.className = 'status'; statusEl.textContent = msg; }
  console.log('[status]', msg);
}
function clearStatus(){
  if (statusEl){ statusEl.className = 'status'; statusEl.textContent = ''; }
}
function prettyBytes(n){
  if (n == null) return '';
  const u = ['B','KB','MB','GB']; let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1){ v /= 1024; i++; }
  return (i ? v.toFixed(1) : v.toFixed(0)) + ' ' + u[i];
}

// show file name + size
if (fileInput && fileStatus){
  fileInput.addEventListener('change', ()=>{
    const f = fileInput.files && fileInput.files[0];
    fileStatus.textContent = f ? ('selected: ' + f.name + ' (' + prettyBytes(f.size) + ')') : '';
  });
}

// ------- CSP-safe submit: validate, then let native POST go into the hidden iframe -------
form.addEventListener('submit', (e)=>{
  clearStatus();

  const f = fileInput.files && fileInput.files[0];
  if (!f){ e.preventDefault(); setStatus('no image uploaded.'); return; }
  if (!['image/png','image/jpeg','image/webp'].includes(f.type)){
    e.preventDefault(); setStatus('png/jpeg/webp only'); return;
  }
  if (f.size > 10 * 1024 * 1024){
    e.preventDefault(); setStatus('file size limit: 10mb.'); return;
  }

  // honeypot
  const hp = document.querySelector('input[name="website"]');
  if (hp && hp.value){ e.preventDefault(); setStatus('spam blocked.'); return; }

  // normalize text before upload
  ['hid-title','hid-city','hid-country'].forEach(id=>{
    const el = document.getElementById(id);
    if (el) el.value = (el.value || '').toLowerCase().slice(0, 30);
  });

  // UI while uploading
  if (btn){ btn.disabled = true; btn.textContent = '<GO>'; }
  setStatus('uploading...');
  // do NOT preventDefault here on success path → let the browser submit to the hidden iframe
});

// ------- receive postMessage from Apps Script (_sendToParent) -------
const ALLOWED_ORIGINS = [
  'https://script.google.com',
  'https://script.googleusercontent.com'
];

window.addEventListener('message', (e)=>{
  if (!ALLOWED_ORIGINS.includes(e.origin)) {
    console.warn('[postMessage] ignored origin:', e.origin);
    return;
  }
  const data = e.data || {};
  if (data.source !== 'tags-webapp') return;

  // reset UI
  if (btn){ btn.disabled = false; btn.textContent = '<GO>'; }

  if (data.ok) {
    setStatus('tag submitted. it may take a few days to see tag added to the wall.');
    form.reset();
    if (fileStatus) fileStatus.textContent = '';
    hideCursor();

    // reset placeholders if you use .typed elements
    ['title','city','country'].forEach((f)=>{
      const line = document.querySelector('.line[data-field="'+f+'"]');
      const typed = line && line.querySelector('.typed');
      const ph = line && line.getAttribute('data-ph');
      if (typed && ph){ typed.textContent = ph; typed.classList.add('ph'); }
    });

    console.log('[upload ok]', data);
  } else {
    const err = (data && data.error) ? String(data.error).toLowerCase() : 'upload failed.';
    setStatus(err);
    console.error('[upload error]', data);
  }
});
