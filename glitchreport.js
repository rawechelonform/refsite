// ===== CONFIG =====
const NEXT_URL   = "artist.html?registration=complete";
const GO_HOLD_MS = 600;
const SPRITE_PATH = "avatar/avatar_intro.png";

// Diagnostics: add ?diag=1 to disable auto-continue + log
const params = new URLSearchParams(location.search);
const DIAG = params.get("diag") === "1";

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

// ===== PLATFORM DETECTION =====
const UA = navigator.userAgent || "";
const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
const isIOS = /iPhone|iPad|iPod/i.test(UA);
const isIOSChrome = /CriOS/i.test(UA); // Chrome on iOS user agent contains "CriOS"
const isAndroid = /Android/i.test(UA);
const isDesktop = !isTouch;

// ===== UTIL =====
function log(...a){ if (DIAG) console.log("[gate]", ...a); }
function escapeHTML(s){
  return String(s).replace(/[&<>\"']/g, c =>
    c === '&' ? '&amp;' :
    c === '<' ? '&lt;' :
    c === '>' ? '&gt;' :
    c === '\"' ? '&quot;' : '&#39;'
  );
}
function isValidEmail(e){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

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

// ===== MIRROR (desktop + iOS only; Android uses real input) =====
let dragActive = false, dragAnchorIdx = null;
function renderMirror(){
  if (!typedEl || !inputEl || isAndroid) return;
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
    const before = htmlAtRange(0, idx, raw);
    const atChar = raw[idx] ? escapeHTML(raw[idx]) : "&nbsp;";
    const after  = htmlAtRange(idx + (raw[idx] ? 1 : 0), raw.length, raw);
    typedEl.innerHTML = before + `<span class="cursor-block">${atChar}</span>` + after;
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

// RAF mirror loop (only where mirror is used)
let _v = null, _s = -1, _e = -1;
function caretRAF(){
  if (!inputEl || isAndroid) { requestAnimationFrame(caretRAF); return; }
  const v = inputEl.value || "";
  const s = inputEl.selectionStart ?? v.length;
  const e = inputEl.selectionEnd   ?? v.length;
  if (v !== _v || s !== _s || e !== _e) {
    _v = v; _s = s; _e = e;
    renderMirror();
  }
  requestAnimationFrame(caretRAF);
}

// ===== MOBILE INPUT MODES =====
let shim = null; // contenteditable fallback (iOS Chrome only)

function setupIOS_Safari_Mode(){
  // Tiny fixed input at bottom, mirror shows text. Tap to focus.
  try { inputEl.type = 'text'; } catch(_) {}
  inputEl.setAttribute('inputmode','email');
  inputEl.setAttribute('autocomplete','email');
  inputEl.setAttribute('autocapitalize','off');
  inputEl.setAttribute('enterkeyhint','go');

  // Focus ONLY on explicit tap; do not auto-focus to avoid Safari blocking IME
  promptEl.addEventListener('touchstart', () => {
    // Use rAF to run focus in the same tick as user gesture
    requestAnimationFrame(() => { try { inputEl.focus(); } catch(_) {} });
  }, { passive: true });
}

function setupIOS_Chrome_Mode(){
  // First try focusing the real input; if keyboard doesn’t fully open, use a shim
  try { inputEl.type = 'text'; } catch(_) {}
  inputEl.setAttribute('inputmode','email');
  inputEl.setAttribute('autocomplete','email');
  inputEl.setAttribute('autocapitalize','off');
  inputEl.setAttribute('enterkeyhint','go');

  let triedShim = false;

  function ensureKeyboard() {
    // Attempt 1: direct focus
    inputEl.focus();

    // If keyboard collapses, after short delay swap to contenteditable shim
    setTimeout(() => {
      if (document.activeElement !== inputEl && !triedShim) {
        triedShim = true;
        if (!shim) {
          shim = document.createElement('div');
          shim.setAttribute('role','textbox');
          shim.setAttribute('aria-label','email');
          shim.contentEditable = 'true';
          shim.style.position = 'absolute';
          shim.style.left = '1.3ch';
          shim.style.right = '0';
          shim.style.top = '0';
          shim.style.height = '1.8rem';
          shim.style.outline = 'none';
          shim.style.caretColor = 'var(--crt)';
          shim.style.letterSpacing = '0.08em';
          shim.style.fontFamily = `DotGothic16, system-ui, monospace`;
          shim.style.fontSize = getComputedStyle(typedEl).fontSize || '16px';
          promptEl.appendChild(shim);

          // Mirror shim text into the real input
          shim.addEventListener('input', () => {
            inputEl.value = (shim.textContent || '').trimStart();
            renderMirror();
          });
          shim.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              // sync and submit
              inputEl.value = (shim.textContent || '').trim();
              trySubmitEmail();
              e.preventDefault();
            }
          });
        }
        // Hide the mirror text because the shim is visible
        typedEl.style.display = 'none';
        shim.focus();
      }
    }, 200);
  }

  promptEl.addEventListener('touchstart', () => {
    requestAnimationFrame(ensureKeyboard);
  }, { passive: true });
}

function setupAndroid_Mode(){
  // Uses your CSS android overrides (if any); just ensure attributes
  try { inputEl.type = 'email'; } catch(_) {}
  inputEl.setAttribute('inputmode','email');
  inputEl.setAttribute('autocomplete','email');
  inputEl.setAttribute('autocapitalize','off');
  inputEl.setAttribute('enterkeyhint','go');
}

// ===== TERMINAL SEQUENCE =====
function startTerminalSequence(){
  if (staticEl) staticEl.textContent = "REGISTRATION TERMINAL //";
  setTimeout(() => {
    typeWriter(" ENTER EMAIL FOR QUARTERLY GLITCH REPORT", typeEl, 50, () => {
      if (promptEl) promptEl.classList.add("show");
      if (isDesktop) { inputEl && inputEl.focus(); }
      if (isIOS && !isIOSChrome) setupIOS_Safari_Mode();
      else if (isIOSChrome) setupIOS_Chrome_Mode();
      else if (isAndroid) setupAndroid_Mode();
      renderMirror();
    });
  }, 300);
}

// ===== PROMPT BINDINGS =====
function bindPrompt(){
  if (!inputEl) return;

  // Desktop mirror interactions
  if (isDesktop) {
    typedEl.addEventListener("mousedown", (e) => {
      dragActive = true;
      const i = indexFromPoint(e.clientX);
      try {
        if (document.activeElement !== inputEl) inputEl.focus();
        inputEl.setSelectionRange(i, i); // insert BEFORE char
      } catch(_) {}
      renderMirror();
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!dragActive) return;
      const j = indexFromPoint(e.clientX);
      const pos = Math.max(0, Math.min(j, (inputEl.value||"").length));
      try { inputEl.setSelectionRange(pos, pos); } catch(_) {}
      renderMirror();
    });
    window.addEventListener("mouseup", () => { dragActive = false; });

    // Keep mirror in sync on edits
    ["input","focus","blur","keyup","select","click"].forEach(evt =>
      inputEl.addEventListener(evt, renderMirror)
    );
    inputEl.addEventListener("keydown", () => setTimeout(renderMirror, 0));
  }

  // Submit with Enter / Go
  const enterLike = (e) => (e.key === "Enter" || e.key === "Go" || e.keyCode === 13);
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

  // Lock UI
  inputEl.setAttribute("disabled", "disabled");
  if (!isAndroid && typedEl) {
    typedEl.innerHTML = `${escapeHTML(email)} <span class="go-pill">&lt;GO&gt;</span>`;
  }
  hintEl && (hintEl.textContent = "");
  mlEmail.value = email.toLowerCase();

  // iOS Safari sometimes ignores form.requestSubmit on offscreen forms; click a hidden submit instead
  let tempSubmitBtn = null;
  if (isIOS && !isIOSChrome) {
    tempSubmitBtn = mlForm.querySelector('button[type="submit"]');
    if (!tempSubmitBtn) {
      tempSubmitBtn = document.createElement('button');
      tempSubmitBtn.type = 'submit';
      tempSubmitBtn.style.position = 'absolute';
      tempSubmitBtn.style.left = '-9999px';
      tempSubmitBtn.style.width = '1px';
      tempSubmitBtn.style.height = '1px';
      mlForm.appendChild(tempSubmitBtn);
    }
  }

  const onLoad = () => {
    setTimeout(() => { window.location.href = NEXT_URL; }, GO_HOLD_MS);
  };
  mlIframe.addEventListener("load", onLoad, { once: true });

  try {
    if (isIOS && !isIOSChrome && tempSubmitBtn) {
      tempSubmitBtn.click();
    } else if (typeof mlForm.requestSubmit === "function") {
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
  if (!isAndroid) requestAnimationFrame(caretRAF); // Android: real input, no mirror
  if (DIAG) console.info("[gate] diagnostics mode ON");
});
