// ===== CONFIG =====
const NEXT_URL   = "artist.html?registration=complete";
const GO_HOLD_MS = 600;
const SPRITE_PATH = "avatar/avatar_intro.png";

// Diagnostics: add ?diag=1 to disable auto-continue + log
const params = new URLSearchParams(location.search);
const DIAG = params.get("diag") === "1";
function log(...a){ if (DIAG) console.log("[gate]", ...a); }

// ===== ELEMENTS =====
const staticEl = document.getElementById("static-part");
const typeEl   = document.getElementById("typed-part");
const inputEl  = document.getElementById("cmd");
const typedEl  = document.getElementById("typed");
const hintEl   = document.getElementById("hint");
const figureEl = document.querySelector(".figure");
const promptEl = document.getElementById("prompt");
const mlForm   = document.getElementById("ml-form");
const mlEmail  = document.getElementById("ml-email");
const mlIframe = document.getElementById("ml_iframe");

// ===== UA =====
const UA = navigator.userAgent || "";
const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
const isIOS = /iPhone|iPad|iPod/i.test(UA);
const isIOSChrome = /CriOS/i.test(UA);                 // iOS Chrome
const isIOSSafari  = isIOS && !isIOSChrome;            // includes Mobile Safari
const isAndroid = /Android/i.test(UA);
const isDesktop = !isTouch;

// ===== UTIL =====
function escapeHTML(s){
  return String(s).replace(/[&<>\"']/g, c =>
    c === '&' ? '&amp;' :
    c === '<' ? '&lt;' :
    c === '>' ? '&gt;' :
    c === '\"' ? '&quot;' : '&#39;'
  );
}
function isValidEmail(e){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}
function typeWriter(text, el, speed = 40, done){
  let i = 0;
  if (!el) { done && done(); return; }
  el.textContent = "";
  (function step(){
    if(i <= text.length){
      el.textContent = text.slice(0, i++);
      setTimeout(step, speed);
    } else { done && done(); }
  })();
}

// ===== MIRROR (desktop only) =====
let dragging = false;
function renderMirror(){
  if (!typedEl || !inputEl || !isDesktop) return;
  const raw = inputEl.value || "";
  const start = inputEl.selectionStart ?? raw.length;
  const end   = inputEl.selectionEnd   ?? raw.length;
  const selMin = Math.min(start, end);
  const selMax = Math.max(start, end);

  let html = "";
  for (let i = 0; i < raw.length; i++){
    const ch = escapeHTML(raw[i]);
    const cls = (i >= selMin && i < selMax) ? "ch cursor-sel" : "ch";
    html += `<span class="${cls}" data-i="${i}">${ch}</span>`;
  }

  if (selMin === selMax) {
    const idx = selMin;
    typedEl.innerHTML =
      htmlAtRange(0, idx, raw) +
      `<span class="cursor-block">${raw[idx] ? escapeHTML(raw[idx]) : "&nbsp;"}</span>` +
      htmlAtRange(idx + (raw[idx] ? 1 : 0), raw.length, raw);
  } else {
    typedEl.innerHTML = html;
  }
}
function htmlAtRange(a, b, raw){
  let out = "";
  for (let i = a; i < b; i++){
    out += `<span class="ch" data-i="${i}">${escapeHTML(raw[i])}</span>`;
  }
  return out;
}
function indexFromPoint(clientX){
  if (!typedEl) return 0;
  const boxes = typedEl.querySelectorAll('.ch');
  if (!boxes.length) return 0;
  let bestI = 0, bestDist = Infinity;
  boxes.forEach((el) => {
    const rect = el.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const d = Math.abs(clientX - midX);
    if (d < bestDist) { bestDist = d; bestI = Number(el.getAttribute('data-i')) || 0; }
  });
  return bestI;
}

// RAF (desktop only)
let _v = null, _s = -1, _e = -1;
function caretRAF(){
  if (!inputEl || !isDesktop) { requestAnimationFrame(caretRAF); return; }
  const v = inputEl.value || "";
  const s = inputEl.selectionStart ?? v.length;
  const e = inputEl.selectionEnd   ?? v.length;
  if (v !== _v || s !== _s || e !== _e) {
    _v = v; _s = s; _e = e;
    renderMirror();
  }
  requestAnimationFrame(caretRAF);
}

// ===== MOBILE MODES (Chrome-good baseline) =====
function setupIOSChrome(){
  // Use a real in-place input (mirror hidden)
  if (typedEl) typedEl.style.display = 'none';

  // absolutely overlay input over the typed line
  const cs = getComputedStyle(promptEl);
  Object.assign(inputEl.style, {
    position: 'absolute',
    left: 'calc(1.3ch)',
    right: '0',
    top: '0',
    height: cs.lineHeight || '1.8rem',
    outline: 'none',
    background: 'transparent',
    border: '0',
    padding: '0',
    margin: '0',
    color: 'var(--crt)',
    caretColor: 'var(--crt)',
    letterSpacing: '0.08em',
    fontFamily: `'DotGothic16', system-ui, monospace`,
    fontSize: cs.fontSize || '16px',
    zIndex: '2'
  });
  if (getComputedStyle(promptEl).position === 'static') {
    promptEl.style.position = 'relative';
  }

  try { inputEl.type = 'email'; } catch(_) {}
  inputEl.setAttribute('inputmode','email');
  inputEl.setAttribute('autocomplete','email');
  inputEl.setAttribute('autocapitalize','off');
  inputEl.setAttribute('enterkeyhint','go');

  // focus on explicit tap only (prevents flicker)
  promptEl.addEventListener('touchstart', () => {
    requestAnimationFrame(() => { try { inputEl.focus(); } catch(_) {} });
  }, { passive: true });
}

// Minimal iOS Safari path (doesn’t fight Chrome behavior)
// Tiny fixed input; focus only on tap
function setupIOSSafari(){
  try { inputEl.type = 'text'; } catch(_) {}
  inputEl.setAttribute('inputmode','email');
  inputEl.setAttribute('autocomplete','email');
  inputEl.setAttribute('autocapitalize','off');
  inputEl.setAttribute('enterkeyhint','go');

  // keep CSS as you had it; only focus on tap
  promptEl.addEventListener('touchstart', () => {
    requestAnimationFrame(() => { try { inputEl.focus(); } catch(_) {} });
  }, { passive: true });
}

function setupAndroid(){
  try { inputEl.type = 'email'; } catch(_) {}
  inputEl.setAttribute('inputmode','email');
  inputEl.setAttribute('autocomplete','email');
  inputEl.setAttribute('autocapitalize','off');
  inputEl.setAttribute('enterkeyhint','go');
}

// ===== TERMINAL =====
function startTerminalSequence(){
  if (staticEl) staticEl.textContent = "REGISTRATION TERMINAL //";
  setTimeout(() => {
    typeWriter(" ENTER EMAIL FOR QUARTERLY GLITCH REPORT", typeEl, 50, () => {
      if (promptEl) promptEl.classList.add("show");

      if (isDesktop) {
        inputEl && inputEl.focus();
      } else if (isIOSChrome) {
        setupIOSChrome();
      } else if (isIOSSafari) {
        setupIOSSafari();
      } else if (isAndroid) {
        setupAndroid();
      }
      if (isDesktop) renderMirror();
    });
  }, 300);
}

// ===== PROMPT BINDINGS =====
function bindPrompt(){
  if (!inputEl || !typedEl) return;

  if (isDesktop) {
    // Click places caret BEFORE character, typing inserts (not replace)
    typedEl.addEventListener("mousedown", (e) => {
      dragging = true;
      const i = indexFromPoint(e.clientX);
      try {
        if (document.activeElement !== inputEl) inputEl.focus();
        inputEl.setSelectionRange(i, i);
      } catch(_) {}
      renderMirror();
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const j = indexFromPoint(e.clientX);
      const pos = Math.max(0, Math.min(j, (inputEl.value||"").length));
      try { inputEl.setSelectionRange(pos, pos); } catch(_) {}
      renderMirror();
    });
    window.addEventListener("mouseup", () => { dragging = false; });

    // keep mirror synced
    ["input","focus","blur","keyup","select","click"].forEach(evt =>
      inputEl.addEventListener(evt, renderMirror)
    );
    inputEl.addEventListener("keydown", () => setTimeout(renderMirror, 0));
  }

  // Enter/Go submits everywhere
  const enterLike = (e) => e.key === "Enter" || e.key === "Go" || e.keyCode === 13;
  inputEl.addEventListener("keydown", (e) => { if (enterLike(e)) trySubmitEmail(); });
  inputEl.addEventListener("keyup",   (e) => { if (enterLike(e)) trySubmitEmail(); });
}

// ===== SUBMIT =====
function trySubmitEmail() {
  const email = (inputEl.value || "").trim();
  if (!isValidEmail(email)){
    hintEl && (hintEl.textContent = "invalid email.");
    return;
  }

  const honeypot = mlForm?.querySelector('input[name="website"]');
  if (honeypot && honeypot.value) {
    hintEl && (hintEl.textContent = "hmm… couldn’t reach mail server. try again?");
    return;
  }
  if (!(mlForm && mlEmail && mlIframe)) {
    hintEl && (hintEl.textContent = "form not ready");
    return;
  }

  inputEl.setAttribute("disabled", "disabled");

  // Desktop only (mirror path): show <GO>
  if (isDesktop && typedEl) {
    typedEl.innerHTML = `${escapeHTML(email)} <span class="go-pill">&lt;GO&gt;</span>`;
  }
  hintEl && (hintEl.textContent = "");
  mlEmail.value = email.toLowerCase();

  // onload before submit
  const onLoad = () => {
    setTimeout(() => { window.location.href = NEXT_URL; }, GO_HOLD_MS);
  };
  mlIframe.addEventListener("load", onLoad, { once: true });

  try {
    if (typeof mlForm.requestSubmit === "function") {
      mlForm.requestSubmit();
    } else {
      mlForm.submit();
    }
  } catch(err) {
    log("submit error:", err);
    inputEl.removeAttribute("disabled");
    hintEl && (hintEl.textContent = "hmm… couldn’t reach mail server. try again?");
    try { mlIframe.removeEventListener("load", onLoad); } catch(_) {}
  }
}

// ===== AVATAR =====
function startAvatar(){
  if(!figureEl){ startTerminalSequence(); return; }
  const img = new Image();
  img.onload = () => {
    figureEl.style.backgroundImage = `url("${SPRITE_PATH}")`;
    figureEl.classList.add("walking");
    figureEl.addEventListener("animationend", (e) => {
      if(e.animationName !== "walk-in") return;
      figureEl.classList.add("forward");
      figureEl.classList.remove("walking");
      startTerminalSequence();
    }, { once:true });
  };
  img.onerror = () => { hintEl && (hintEl.textContent = "sprite not found"); startTerminalSequence(); };
  img.src = SPRITE_PATH + "?" + Date.now();
}

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
  bindPrompt();
  startAvatar();
  if (isDesktop) requestAnimationFrame(caretRAF);  // mirror loop desktop only
  if (DIAG) console.info("[gate] diagnostics mode ON");
});
