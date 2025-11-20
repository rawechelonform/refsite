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
const isIOS       = /iPhone|iPad|iPod/i.test(UA);
const isIOSChrome = /CriOS/i.test(UA);       // Chrome on iOS
const isAndroid   = /Android/i.test(UA);
const isTouch     = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

// ===== HELPERS =====
function log(...a){ if (DIAG) console.log("[gate]", ...a); }

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

// ===== MIRROR (desktop + Safari iOS only) =====
function renderMirror(){
  if (!typedEl || !inputEl || isIOSChrome || isAndroid) return;
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

// ===== RAF (desktop + Safari iOS) =====
let _v = null, _s = -1, _e = -1;
function caretRAF(){
  if (!inputEl || isIOSChrome || isAndroid) { requestAnimationFrame(caretRAF); return; }
  const v = inputEl.value || "";
  const s = inputEl.selectionStart ?? v.length;
  const e = inputEl.selectionEnd   ?? v.length;
  if (v !== _v || s !== _s || e !== _e) {
    _v = v; _s = s; _e = e;
    renderMirror();
  }
  requestAnimationFrame(caretRAF);
}

// ===== iOS Chrome ONLY: inline real input, remove box, match font, make Enter work =====
let iosChromeForm = null;
function applyIOSChromeInline() {
  if (!(isIOS && isIOSChrome && isTouch) || !inputEl || !promptEl) return;

  // 1) Hide the CRT mirror; use the real input
  if (typedEl) typedEl.style.display = 'none';

  // 2) Create a throwaway form so the "Go" key submits
  if (!iosChromeForm) {
    iosChromeForm = document.createElement('form');
    iosChromeForm.style.display = 'contents'; // no visual box
    // Fallback if display:contents isn’t supported
    if (getComputedStyle(iosChromeForm).display !== 'contents') {
      iosChromeForm.style.display = 'inline';
      iosChromeForm.style.border = '0';
      iosChromeForm.style.margin = '0';
      iosChromeForm.style.padding = '0';
      iosChromeForm.style.background = 'transparent';
    }
    // Move input into the form (keeps it inside the same prompt line)
    promptEl.insertBefore(iosChromeForm, inputEl);
    iosChromeForm.appendChild(inputEl);

    iosChromeForm.addEventListener('submit', (e) => {
      e.preventDefault();
      trySubmitEmail();
    });
  }

  // 3) Inline styles to remove box + match CRT look
  const s = inputEl.style;
  s.position        = 'static';
  s.width           = '100%';
  s.height          = '1.9rem';
  s.lineHeight      = '1.9rem';
  s.marginLeft      = '1.3ch';                 // sit after ">" caret
  s.opacity         = '1';
  s.color           = 'var(--crt)';
  s.caretColor      = 'var(--crt)';
  s.background      = 'transparent';
  s.fontSize        = 'var(--term-font-size)';
  s.letterSpacing   = '0.08em';
  s.fontFamily      = "'DotGothic16', system-ui, monospace";
  s.pointerEvents   = 'auto';
  s.zIndex          = '1';

  // Remove border/focus ring/rounded corners/inner shadow
  s.border          = '0';
  s.outline         = '0';
  s.boxShadow       = 'none';
  s.borderRadius    = '0';
  s.webkitAppearance = 'none';
  s.appearance      = 'none';

  // Input semantics so keyboard is email + Go
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
      if (promptEl && !promptEl.classList.contains('show')) {
        promptEl.classList.add('show');
      }
      if (!isTouch) { inputEl && inputEl.focus(); }
      applyIOSChromeInline();     // only affects Chrome on iOS
      if (!isIOSChrome && !isAndroid) renderMirror(); // desktop + Safari iOS
    });
  }, 300);
}

// ===== PROMPT BINDINGS =====
function bindPrompt(){
  if (!inputEl) return;

  if (!isTouch) {
    // Desktop mirror interactions
    typedEl.addEventListener("mousedown", (e) => {
      const i = indexFromPoint(e.clientX);
      try {
        if (document.activeElement !== inputEl) inputEl.focus();
        inputEl.setSelectionRange(i, Math.min(i + 1, (inputEl.value || "").length));
      } catch(_) {}
      renderMirror();
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (document.activeElement !== inputEl) return;
      const j = indexFromPoint(e.clientX);
      const a = Math.max(0, Math.min(j, (inputEl.value||"").length));
      const b = Math.max(0, Math.min(j + 1, (inputEl.value||"").length));
      try { inputEl.setSelectionRange(a, b); } catch(_) {}
      renderMirror();
    });

  } else if (isIOS && !isIOSChrome) {
    // Safari iOS: tap prompt to focus the tiny fixed input (opens IME reliably)
    promptEl.addEventListener("touchstart", () => { try { inputEl.focus(); } catch(_) {} }, { passive: true });

  } else if (isIOSChrome) {
    // Chrome iOS: input is inline; let it focus naturally
    // No preventDefault, no programmatic focus
  }

  // Mirror updates only where mirror exists
  if (!isIOSChrome && !isAndroid) {
    ["input","focus","blur","keyup","select","click"].forEach(evt =>
      inputEl.addEventListener(evt, renderMirror)
    );
    inputEl.addEventListener("keydown", () => setTimeout(renderMirror, 0));
  }

  // Cmd/Ctrl+A (desktop)
  document.addEventListener("keydown", (e) => {
    const isA = (e.key === 'a' || e.key === 'A');
    const withMeta = (e.metaKey || e.ctrlKey);
    if (!isA || !withMeta) return;
    e.preventDefault();
    const len = (inputEl.value || "").length;
    try { inputEl.setSelectionRange(0, len); } catch(_) {}
    if (!isIOSChrome && !isAndroid) renderMirror();
  }, true);

  // Enter/Go to submit — keep as a backup if the IME fires key events
  const enterLike = (e) => e.key === "Enter" || e.key === "Go" || e.keyCode === 13;
  inputEl.addEventListener("keydown", (e) => { if (enterLike(e)) trySubmitEmail(); });
  inputEl.addEventListener("keyup",   (e) => { if (enterLike(e)) trySubmitEmail(); });
}

// ===== SUBMIT =====
function trySubmitEmail() {
  if (!inputEl || inputEl.disabled) return;

  const email = (inputEl.value || "").trim();
  if (!isValidEmail(email)){
    hintEl && (hintEl.textContent = "invalid email.");
    log("invalid email");
    return;
  }

  // Honeypot
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

  inputEl.setAttribute("disabled", "disabled");
  if (!isIOSChrome && !isAndroid && typedEl) {
    typedEl.innerHTML = `${escapeHTML(email)} <span class="go-pill">&lt;GO&gt;</span>`;
  }
  hintEl && (hintEl.textContent = "");
  log("submitting to MailerLite…");
  mlEmail.value = email.toLowerCase();

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
    log("submit threw:", err);
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
  if (!isIOSChrome && !isAndroid) requestAnimationFrame(caretRAF);
  if (isTouch && isIOSChrome) applyIOSChromeInline();
  if (DIAG) console.info("[gate] diagnostics mode ON — no auto-continue; watch console logs");
});
