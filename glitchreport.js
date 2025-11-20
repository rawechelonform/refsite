// ===== CONFIG =====
const NEXT_URL   = "artist.html?registration=complete";
const GO_HOLD_MS = 600;
const SPRITE_PATH = "avatar/avatar_intro.png";

// Diagnostics
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
const isAndroid    = /Android/i.test(UA);
const isIOS        = /iPhone|iPad|iPod/i.test(UA);
const isIOSChrome  = /CriOS/i.test(UA);     // iOS Chrome (WebKit)
const isTouch      = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

// Mark Android early so CSS can stabilize layout before any taps
if (isAndroid) document.documentElement.classList.add('android-stable');

// ===== STATE =====
let lockedOutput = false;
let dragging = false;
let dragAnchorIdx = null;

// ===== UTIL =====
function log(...a){ if (DIAG) console.log("[gate]", ...a); }
function typeWriter(text, el, speed = 40, done){
  let i = 0;
  if (!el) { done && done(); return; }
  el.textContent = "";
  (function step(){
    if (i <= text.length) {
      el.textContent = text.slice(0, i++);
      setTimeout(step, speed);
    } else { done && done(); }
  })();
}
function escapeHTML(s){
  return String(s).replace(/[&<>\"']/g, c =>
    c === '&' ? '&amp;' :
    c === '<' ? '&lt;' :
    c === '>' ? '&gt;' :
    c === '\"' ? '&quot;' : '&#39;'
  );
}
function isValidEmail(e){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function setImp(el, prop, value){ el && el.style.setProperty(prop, value, 'important'); }

// ===== MIRROR (desktop + iOS Safari only; NOT Android, NOT iOS Chrome) =====
function htmlAtRange(a, b, raw){
  let out = "";
  for (let i = a; i < b; i++){
    out += `<span class="ch" data-i="${i}">${escapeHTML(raw[i])}</span>`;
  }
  return out;
}
function renderMirror(){
  if (!typedEl || !inputEl || isAndroid || isIOSChrome || lockedOutput) return;

  // Hide caret until the real input has focus
  if (document.activeElement !== inputEl) {
    typedEl.textContent = inputEl.value || "";
    return;
  }

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

// ===== RAF (desktop + iOS Safari) =====
let _v = null, _s = -1, _e = -1;
function caretRAF(){
  if (!inputEl || isAndroid || isIOSChrome) { requestAnimationFrame(caretRAF); return; }
  if (!lockedOutput) {
    const v = inputEl.value || "";
    const s = inputEl.selectionStart ?? v.length;
    const e = inputEl.selectionEnd   ?? v.length;
    if (v !== _v || s !== _s || e !== _e || document.activeElement !== inputEl) {
      _v = v; _s = s; _e = e;
      renderMirror();
    }
  }
  requestAnimationFrame(caretRAF);
}

// ===== MOBILE IME CONFIG =====
function enableMobileIME(){
  if (!isTouch || !inputEl) return;

  if (isIOSChrome) {
    // iOS Chrome: overlay an in-flow input inside the prompt to prevent the keyboard bounce
    try { inputEl.type = 'email'; } catch(_) {}
    inputEl.setAttribute('inputmode','email');
    inputEl.setAttribute('autocomplete','email');
    inputEl.setAttribute('autocapitalize','off');
    inputEl.setAttribute('enterkeyhint','go');

    // Make sure it's inside the prompt and overlayed after the caret
    if (promptEl && inputEl.parentElement !== promptEl) promptEl.appendChild(inputEl);
    setImp(promptEl, 'position', 'relative');
    setImp(inputEl, 'position', 'absolute');
    setImp(inputEl, 'left', '1.3ch');   // after the ">" caret
    setImp(inputEl, 'right', '0');
    setImp(inputEl, 'top', '0');
    setImp(inputEl, 'height', '1.9rem');
    setImp(inputEl, 'lineHeight', '1.9rem');
    setImp(inputEl, 'opacity', '0.18');    // barely visible, keeps IME stable
    setImp(inputEl, 'background', 'transparent');
    setImp(inputEl, 'border', '0');
    setImp(inputEl, 'padding', '0');
    setImp(inputEl, 'zIndex', '1001');
    setImp(inputEl, 'fontSize', '16px');
    setImp(inputEl, 'letterSpacing', '0.08em');
    setImp(inputEl, 'color', 'transparent');   // hide glyphs
    setImp(inputEl, 'caretColor', 'transparent');
    // The mirror fights with overlay—hide it for iOS Chrome
    if (typedEl) typedEl.style.display = 'none';
  }
  else if (isIOS) {
    // iOS Safari: tiny fixed input + mirror is fine
    try { inputEl.type = 'text'; } catch(_) {}
    inputEl.setAttribute('inputmode','email');
    inputEl.setAttribute('autocomplete','email');
    inputEl.setAttribute('autocapitalize','off');
    inputEl.setAttribute('enterkeyhint','go');
  }
  else if (isAndroid) {
    try { inputEl.type = 'email'; } catch(_) {}
    inputEl.setAttribute('inputmode','email');
    inputEl.setAttribute('autocomplete','email');
    inputEl.setAttribute('autocapitalize','off');
    inputEl.setAttribute('enterkeyhint','go');
  }
}

// ===== TERMINAL =====
function startTerminalSequence(){
  if (staticEl) staticEl.textContent = "REGISTRATION TERMINAL //";

  if (isAndroid && promptEl && !promptEl.classList.contains('show')) {
    promptEl.classList.add('show');
  }
  if (isIOSChrome && promptEl && !promptEl.classList.contains('show')) {
    // Show promptly so the overlay input is already "in flow" before first tap
    promptEl.classList.add('show');
  }

  setTimeout(() => {
    typeWriter(" ENTER EMAIL FOR QUARTERLY GLITCH REPORT", typeEl, 50, () => {
      if (promptEl && !(isAndroid || isIOSChrome)) promptEl.classList.add("show");
      if (!isTouch) { inputEl && inputEl.focus(); }
      if (isTouch) enableMobileIME();
      if (!(isAndroid || isIOSChrome)) renderMirror();
    });
  }, 300);
}

// ===== PROMPT BINDINGS =====
function bindPrompt(){
  if (!inputEl) return;

  // Desktop (and iOS Safari mirror)
  if (!isTouch || isIOS) {
    typedEl && typedEl.addEventListener("mousedown", (e) => {
      if (isIOSChrome) return; // no mirror here
      const i = indexFromPoint(e.clientX);
      dragging = true;
      dragAnchorIdx = i;
      try {
        if (document.activeElement !== inputEl) inputEl.focus();
        inputEl.setSelectionRange(i, i); // collapsed caret (insert, not replace)
      } catch(_) {}
      renderMirror();
      e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
      if (isIOSChrome) return;
      if (!dragging || dragAnchorIdx == null || lockedOutput) return;
      const j = indexFromPoint(e.clientX);
      const a = Math.min(dragAnchorIdx, j);
      const b = Math.max(dragAnchorIdx, j) + 1;
      try { inputEl.setSelectionRange(a, Math.min(b, (inputEl.value || "").length)); } catch(_) {}
      renderMirror();
    });

    window.addEventListener("mouseup", () => {
      dragging = false;
      dragAnchorIdx = null;
    });
  }

  // iOS Chrome: focus only on user tap; no preventDefault
  if (isIOSChrome) {
    promptEl.addEventListener("touchstart", () => {
      try { inputEl.focus(); } catch(_) {}
    }, { passive: true });
    promptEl.addEventListener("click", () => {
      try { inputEl.focus(); } catch(_) {}
    }, { passive: true });
  }

  // Mirror updates (desktop + iOS Safari only)
  if (!(isAndroid || isIOSChrome)) {
    ["input","focus","blur","keyup","select","click"].forEach(evt =>
      inputEl.addEventListener(evt, renderMirror)
    );
    inputEl.addEventListener("keydown", () => setTimeout(renderMirror, 0));
  }

  // Cmd/Ctrl+A (desktop)
  document.addEventListener("keydown", (e) => {
    const isA = (e.key === 'a' || e.key === 'A');
    const withMeta = (e.metaKey || e.ctrlKey);
    if (!isA || !withMeta || lockedOutput) return;
    e.preventDefault();
    const len = (inputEl.value || "").length;
    try { inputEl.setSelectionRange(0, len); } catch(_) {}
    if (!(isAndroid || isIOSChrome)) renderMirror();
  }, true);

  // Enter/Go to submit (many hooks for mobile reliability)
  const isEnter = (e) => e && (e.key === "Enter" || e.key === "Go" || e.keyCode === 13);
  inputEl.addEventListener("keydown", (e) => { if (isEnter(e)) { e.preventDefault(); trySubmitEmail(); } });
  inputEl.addEventListener("keyup",   (e) => { if (isEnter(e)) { e.preventDefault(); trySubmitEmail(); } });
  inputEl.addEventListener("keypress",(e) => { if (isEnter(e)) { e.preventDefault(); trySubmitEmail(); } });
  inputEl.addEventListener("beforeinput", (e) => {
    if (e.inputType === "insertLineBreak") { e.preventDefault(); trySubmitEmail(); }
  });
  inputEl.addEventListener("textInput", (e) => {
    if (e && e.data === "\n") { e.preventDefault(); trySubmitEmail(); }
  });
}

// ===== SUBMIT (unchanged logic, but robust for iOS Chrome) =====
function trySubmitEmail() {
  if (!inputEl || inputEl.disabled) return;

  const email = (inputEl.value || "").trim();
  if (!isValidEmail(email)){
    hintEl && (hintEl.textContent = "invalid email.");
    log("invalid email");
    return;
  }

  const honeypot = mlForm?.querySelector('input[name="website"]');
  if (honeypot && honeypot.value) {
    log("honeypot filled; dropping");
    hintEl && (hintEl.textContent = "hmm… couldn’t reach mail server. try again?");
    return;
  }
  if (!(mlForm && mlEmail && mlIframe)) {
    hintEl && (hintEl.textContent = "form not ready");
    return;
  }

  // Keep iframe 1x1 so iOS Chrome fires load
  try {
    mlIframe.style.position = "absolute";
    mlIframe.style.left = "-9999px";
    mlIframe.style.top = "-9999px";
    mlIframe.style.width = "1px";
    mlIframe.style.height = "1px";
    mlIframe.style.border = "0";
    if (!mlIframe.src) mlIframe.src = "about:blank";
  } catch(_) {}

  let hiddenBtn = mlForm.querySelector('#ml-hidden-submit');
  if (!hiddenBtn) {
    hiddenBtn = document.createElement('button');
    hiddenBtn.type = 'submit';
    hiddenBtn.id = 'ml-hidden-submit';
    hiddenBtn.style.display = 'none';
    mlForm.appendChild(hiddenBtn);
  }

  lockedOutput = true;
  inputEl.setAttribute("disabled", "disabled");
  if (!isAndroid && !isIOSChrome && typedEl) {
    typedEl.innerHTML = `${escapeHTML(email)} <span class="go-pill">&lt;GO&gt;</span>`;
  }
  hintEl && (hintEl.textContent = "");
  log("submitting to MailerLite…");
  mlEmail.value = email.toLowerCase();

  let finished = false;
  const doneSuccess = () => {
    if (finished) return; finished = true;
    setTimeout(() => { window.location.href = NEXT_URL; }, GO_HOLD_MS);
  };
  const doneFail = () => {
    if (finished) return; finished = true;
    lockedOutput = false;
    inputEl.removeAttribute("disabled");
    hintEl && (hintEl.textContent = "hmm… couldn’t reach mail server. try again?");
    renderMirror();
  };

  const onLoad = () => doneSuccess();
  mlIframe.addEventListener("load", onLoad, { once: true });

  const to = setTimeout(() => {
    mlIframe.removeEventListener("load", onLoad);
    doneFail();
  }, 9000);

  try {
    if (typeof mlForm.requestSubmit === "function") {
      mlForm.requestSubmit(hiddenBtn);
    } else {
      hiddenBtn.click();
    }
  } catch (err) {
    clearTimeout(to);
    mlIframe.removeEventListener("load", onLoad);
    log("submit threw:", err);
    doneFail();
  }
}

// ===== AVATAR =====
function startAvatar(){
  if (!figureEl) { startTerminalSequence(); return; }
  const img = new Image();
  img.onload = () => {
    figureEl.style.backgroundImage = `url("${SPRITE_PATH}")`;
    figureEl.classList.add("walking");
    figureEl.addEventListener("animationend", (e) => {
      if (e.animationName !== "walk-in") return;
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
  if (!(isAndroid || isIOSChrome)) requestAnimationFrame(caretRAF);
  if (isTouch) enableMobileIME(); // configure (focus only on user action)
  if (DIAG) console.info("[gate] diagnostics mode ON — no auto-continue; watch console logs");
});
