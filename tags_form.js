// ----------------------------
// TAGS FORM — client script
// ----------------------------

// SINGLE MOVING BLOCK CURSOR
const cursorEl = document.getElementById('cursor');
function attachCursorTo(typedEl){
  if (!typedEl) return;
  typedEl.appendChild(cursorEl);
  cursorEl.style.display = '';
}
function hideCursor(){
  cursorEl.style.display = 'none';
  document.body.appendChild(cursorEl);
}

// Bind a "terminal" field (title / city / country)
function bindTermField(field){
  const line  = document.querySelector(`.line[data-field="${field}"]`);
  if (!line) return;

  const typed = line.querySelector('.typed');
  const input = document.getElementById(`hid-${field}`);
  const ph    = line.getAttribute('data-ph') || '';

  // Click anywhere on the row to focus hidden input
  line.addEventListener('click', ()=> input.focus());

  function render(showPh = true){
    const v = input.value || '';
    if (!v && showPh){
      typed.textContent = ph;       // placeholder text
      typed.classList.add('ph');    // faded style
    } else {
      typed.textContent = v.toUpperCase();
      typed.classList.remove('ph');
    }
  }

  input.addEventListener('focus', ()=>{
    render(false);                  // clear placeholder on focus
    attachCursorTo(typed);
  });

  input.addEventListener('input', ()=>{
    input.value = (input.value || '').toLowerCase().slice(0, 30); // lowercase, 30 chars
    render(false);
    attachCursorTo(typed);
  });

  input.addEventListener('blur', ()=>{
    hideCursor();
    if (!input.value) render(true); // restore placeholder if empty
  });

  // initial paint
  render(true);
}

// INIT terminal-like inputs
['title','city','country'].forEach(bindTermField);

// ----------------------------
// VALIDATION + SUBMISSION
// ----------------------------
const form        = document.getElementById('tags_form');
const btn         = document.getElementById('submitBtn');
const statusEl    = document.getElementById('status');
const fileInput   = document.getElementById('sticker');
const fileStatus  = document.getElementById('fileStatus'); // optional span next to upload

function setStatus(msg){
  statusEl.className = 'status';
  statusEl.textContent = msg;
}
function clearStatus(){
  statusEl.className = 'status';
  statusEl.textContent = '';
}

// Pretty-print file size
function prettyBytes(n){
  if (n == null) return '';
  const units = ['B','KB','MB','GB','TB'];
  let i = 0, v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i ? 1 : 0)} ${units[i]}`;
}

// Show file chosen (name + size)
if (fileInput && fileStatus){
  fileInput.addEventListener('change', ()=>{
    const f = fileInput.files && fileInput.files[0];
    if(!f){ fileStatus.textContent = ''; return; }
    fileStatus.textContent = `selected: ${f.name} (${prettyBytes(f.size)})`;
  });
}

// Flag so we only listen for server replies after a submit
let awaitingServer = false;

// Intercept submit to validate before posting to Apps Script
form.addEventListener('submit', (event)=>{
  clearStatus();

  const file = fileInput.files && fileInput.files[0];
  if (!file){
    event.preventDefault();
    setStatus('no image uploaded.');
    return;
  }

  const okType = ['image/png','image/jpeg','image/webp'].includes(file.type);
  if (!okType){
    event.preventDefault();
    setStatus('png/jpeg/webp only');
    return;
  }

  if (file.size > 10 * 1024 * 1024){
    event.preventDefault();
    setStatus('file size limit: 10mb.');
    return;
  }

  // normalize text fields right before submit
  ['hid-title','hid-city','hid-country'].forEach(id=>{
    const el = document.getElementById(id);
    if (el) el.value = (el.value || '').toLowerCase().slice(0, 30);
  });

  btn.disabled = true;
  btn.textContent = '<GO>';
  awaitingServer = true; // we now expect a postMessage from the iframe
});

// ----------------------------
// RECEIVE SERVER RESULT (postMessage from Apps Script)
// ----------------------------
window.addEventListener('message', (evt)=>{
  // Optional: verify origin — uncomment and tighten if you want
  // if (!evt.origin.includes('script.google.com')) return;

  const data = evt.data;
  if (!data || data.source !== 'tags-webapp') return;
  if (!awaitingServer) return; // ignore stray messages not triggered by our submit
  awaitingServer = false;

  btn.disabled = false;
  btn.textContent = '<GO>';

  if (data.ok){
    setStatus('tag submitted. it may take a few days to see tag added to the wall.');
    // Optional cleanup:
    // form.reset();
    // fileStatus && (fileStatus.textContent = '');
    // hideCursor();
    // ['title','city','country'].forEach(f=>{
    //   const input = document.getElementById(`hid-${f}`);
    //   if (input) input.dispatchEvent(new Event('blur'));
    // });
  } else {
    // Show server-side error (already lowercase in our UI style)
    setStatus((data.error || 'upload failed.').toLowerCase());
  }
});
