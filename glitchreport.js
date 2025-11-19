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
const isIOS = /iPhone|iPad|iPod/i.test(UA);
const isAndroid = /Android/i.test(UA);
const isTouch = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);

// ===== UTIL =====
function setImp(el, prop, value){ el && el.style.setProperty(prop, value, "important"); }
function log(...a){ if (DIAG) console.log("[gate]", ...a); }

// ===== EMAIL + MIRROR HELPERS =====
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
    c === "&" ? "&amp;" :
    c === "<" ? "&lt;" :
    c === ">" ? "&gt;" :
    c === '"' ? "&quot;" : "&#39;"
  );
}
function isValidEmail(e){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

// ===== MIRROR (desktop + iOS only) =====
function renderMirror(){
  if (!typedEl || !inputEl || isAndroid) return; // Android uses real input, no mirror
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
  const boxes = typedEl.querySelectorAll(".ch");
  if (!boxes.length) return 0;
  let bestI = 0, bestDist = Infinity;
  boxes.forEach((el) => {
    const rect = el.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const d = Math.abs(clientX - midX);
    if (d < bestDist) { bestDist = d; bestI = Number(el.getAttribute("data-i")) || 0; }
  });
  return bestI;
}

// ===== RAF safety net (desktop + iOS only) =====
let _v = null, _s = -1, _e = -1;
function caretRAF(){
  if (!inputEl) { requestAnimationFrame(caretRAF); return; }
  if (isAndroid) { requestAnimationFrame(caretRAF); return; }
  const v = inputEl.value || "";
  const s = inputEl.selectionStart ?? v.length;
  const e = inputEl.selectionEnd   ?? v.length;
  if (v !== _v || s !== _s || e !== _e) {
    _v = v; _s = s; _e = e;
    renderMirror();
  }
  requestAnimationFrame(caretRAF);
}

// ===== IME SETUP =====
function enableMobileIME(){
  if (!isTouch || !inputEl) return;

  if (isIOS) {
    // iOS: tiny fixed input, invisible; mirror shows text
    setImp(inputEl, "position", "fixed");
    setImp(inputEl, "left", "0");
    setImp(inputEl, "bottom", "0");
    setImp(inputEl, "width", "1px");
    setImp(inputEl, "height", "1.6rem");
    setImp(inputEl, "opacity", "0.01");
    setImp(inputEl, "color", "transparent");
    setImp(inputEl, "background", "transparent");
    setImp(inputEl, "border", "0");
    setImp(inputEl, "padding", "0");
    setImp(inputEl, "z-index", "1000");
    setImp(inputEl, "font-size", "16px");
    setImp(inputEl, "pointer-events", "auto");
    setImp(inputEl, "caret-color", "transparent");
    try { inputEl.type = "text"; } catch(_) {}
  } else if (isAndroid) {
    // ANDROID: make the REAL input visible and primary. Hide the mirror.
    document.documentElement.classList.add("android-real-input");

    const host = promptEl;
    if (host && inputEl.parentElement !== host) host.appendChild(inputEl);

    setImp(host, "position", "relative");
    setImp(inputEl, "position", "relative");
    setImp(inputEl, "display", "block");
    setImp(inputEl, "margin-left", "1.3ch"); // after ">" caret
    setImp(inputEl, "width", "100%");
    setImp(inputEl, "height", "1.8rem");
    setImp(inputEl, "line-height", "1.8rem");
    setImp(inputEl, "opacity", "1");              // real, visible input
    setImp(inputEl, "background", "transparent");
    setImp(inputEl, "border", "0");
    setImp(inputEl, "padding", "0");
    setImp(inputEl, "z-index", "1001");
    setImp(inputEl, "font-size", "var(--term-font-size)");
    setImp(inputEl, "font-family", "'DotGothic16', system-ui, monospace");
    setImp(inputEl, "letter-spacing", "0.08em");
    setImp(inputEl, "color", "var(--crt)");
    setImp(inputEl, "caret-color", "var(--crt)");
    // ensure taps reach the input directly
    try { typedEl && typedEl.style.setProperty("display", "none", "important"); } catch(_) {}
  }

  // common hints
  try { inputEl.type = "text"; } catch(_) {}
  inputEl.setAttribute("inputmode", "email");
  inputEl.setAttribute("autocomplete", "email");
  inputEl.setAttribute("autocapitalize", "off");
  inputEl.setAttribute("enterkeyhint", "go");
}

// ===== TERMINAL =====
function startTerminalSequence(){
  if (staticEl) staticEl.textContent = "REGISTRATION TERMINAL //";
  setTimeout(() => {
    typeWriter(" ENTER EMAIL FOR QUARTERLY GLITCH REPORT", typeEl, 50, () => {
      if (promptEl) {
        promptEl.classList.add("show");
        if (!isTouch) { inputEl && inputEl.focus(); }
        if (isTouch)   enableMobileIME();
        if (!isAndroid) renderMirror(); // Android shows the real input instead
      }
    });
  }, 300);
}

// ===== PROMPT BINDINGS =====
function bindPrompt(){
  if (!inputEl) return;

  if (!isTouch) {
    // DESKTOP: mirror UI + click-to-set-caret
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
    window.addEventListener("mouseup", () => { /* no-op */ });

  } else if (isIOS) {
    // iOS: touchstart → focus tiny input; mirror renders text
    promptEl.addEventListener("touchstart", () => { try { inputEl.focus(); } catch(_) {} }, { passive: true });
  } else if (isAndroid) {
    // ANDROID: no preventDefault; let the real input handle everything
    const focusInput = () => { try { inputEl.focus(); } catch(_) {} };
    promptEl.addEventListener("pointerdown", focusInput, { passive: true });
    promptEl.addEventListener("click",       focusInput, { passive: true });
  }

  // Shared mirror updates (desktop + iOS)
  ["input","focus","blur","keyup","select","click"].forEach(evt =>
    inputEl.addEventListener(evt, () => { if (!isAndroid) renderMirror(); })
  );
  inputEl.addEventListener("keydown", () => { if (!isAndroid) setTimeout(renderMirror, 0); });

  // Cmd/Ctrl+A (desktop)
  document.addEventListener("keydown", (e) => {
    const isA = (e.key === "a" || e.key === "A");
    const withMeta = (e.metaKey || e.ctrlKey);
    if (!isA || !withMeta) return;
    e.preventDefault();
    const len = (inputEl.value || "").length;
    try { inputEl.setSelectionRange(0, len); } catch(_) {}
    if (!isAndroid) renderMirror();
  }, true);

  // Enter/Go to submit
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
  if (!isAndroid) {
    // show the mirror GO pill on desktop/iOS
    typedEl && (typedEl.innerHTML = `${escapeHTML(email)} <span class="go-pill">&lt;GO&gt;</span>`);
  }
  hintEl && (hintEl.textContent = "");
  log("submitting to MailerLite…");
  mlEmail.value = email.toLowerCase();

  // If iframe loads, we consider it success and continue
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
  if (!isAndroid) requestAnimationFrame(caretRAF); // Android uses real input, no mirror RAF
  if (isTouch) enableMobileIME();
  if (DIAG) console.info("[gate] diagnostics mode ON — no auto-continue; watch console logs");
});
