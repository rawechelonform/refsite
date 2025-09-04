// SINGLE CURSOR
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

// BIND A “TERMINAL” FIELD
function bindTermField(field){
  const line  = document.querySelector(`.line[data-field="${field}"]`);
  if (!line) return;
  const typed = line.querySelector('.typed');
  const input = document.getElementById(`hid-${field}`);
  const ph    = line.getAttribute('data-ph') || '';

  // Click anywhere on the row to focus hidden input
  line.addEventListener('click', ()=> input.focus());

  function render(showPh=true){
    const v = input.value || '';
    if (!v && showPh){
      typed.textContent = ph;
      typed.classList.add('ph');
    } else {
      typed.textContent = v.toUpperCase();
      typed.classList.remove('ph');
    }
  }

  input.addEventListener('focus', ()=>{
    render(false);
    attachCursorTo(typed);
  });

  input.addEventListener('input', ()=>{
    input.value = (input.value || '').toLowerCase().slice(0, 30);
    render(false);
    attachCursorTo(typed);
  });

  input.addEventListener('blur', ()=>{
    hideCursor();
    if (!input.value) render(true);
  });

  // initial paint
  render(true);
}

// INIT
['title','city','country'].forEach(bindTermField);

// VALIDATION + SUBMIT
const form = document.getElementById('tags_form');
const btn  = document.getElementById('submitBtn');
const status = document.getElementById('status');
const fileInput = document.getElementById('sticker');

function setStatus(msg){ status.className = 'status'; status.textContent = msg; }
function clearStatus(){ status.className = 'status'; status.textContent = ''; }

// prevent Apps Script call when missing file (keeps you on page and shows message)
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
  if (file.size > 10*1024*1024){
    event.preventDefault();
    setStatus('file too large (max 10mb)');
    return;
  }

  // normalize text
  ['hid-title','hid-city','hid-country'].forEach(id=>{
    const el = document.getElementById(id);
    if (el) el.value = (el.value||'').toLowerCase().slice(0,30);
  });

  btn.disabled = true;
  btn.textContent = '<GO>';
});

// Stay on page for success (Apps Script responds in hidden iframe)
document.querySelector('iframe[name="hidden_iframe"]').addEventListener('load', ()=>{
  btn.disabled = false;
  btn.textContent = '<GO>';
  setStatus('tag submitted. it may take a few days for tag to appear on wall.');
  // (optional) reset:
  // form.reset();
  // hideCursor();
});
