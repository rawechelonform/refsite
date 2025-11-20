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
const isAndroid = /Android/i.test(UA);
const isIOS     = /iPhone|iPad|iPod/i.test(UA);
const isTouch   = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);

// Mark Android early so CSS can stabilize
if (isAndroid) document.documentElement.classList.add("android-stable");

// ===== STATE =====
let lockedOutput = false;   // <— NEW: freeze mirror once we render <GO>

// ===== UTIL =====
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

// ===== MIRROR (desktop + iOS only) =====
function renderMirror(){
  if (!typedEl || !inputEl || isAndroid || lockedOutput) return; // <— honor lock
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

// ===== RAF (desktop + iOS) =====
let _v = null, _s = -1, _e = -1;
function caretRAF(){
  if (!inputEl || isAndroid) { requestAnimationFrame(caretRAF); return; }
  if (!lockedOutput) {
    const v = inputEl.value || "";
    const s = inputEl.selectionStart ?? v.length;
    const e = inputEl.selectionEnd   ?? v.length;
    if (v !== _v || s !== _s || e !== _e) {
      _v = v; _s = s; _e = e;
      renderMirror();
    }
  }
  requestAnimationFrame(caretRAF);
}

// ===== IME CONFIG (mobile) =====
function enableMobileIME(){
  if (!isTouch || !inputEl) return;

  if (isIOS) {
    try { inputEl.type = "text"; } catch(_) {}
    inputEl.setAttribute("inputmode","email");
    inputEl.setAttribute("autocomplete","email");
    inputEl.setAttribute("autocapitalize","off");
    inputEl.setAttribute("enterkeyhint","go");
  } else if (isAndroid) {
    try { inputEl.type = "email"; } catch(_) {}
    inputEl.setAttribute("inputmode","email");
    inputEl.setAttribute("autocomplete","email");
    inputEl.setAttribute("autocapitalize","off");
    inputEl.setAttribute("enterkeyhint","go");
  }
}

// ===== TERMINAL =====
function startTerminalSequence(){
  if (staticEl) staticEl.textContent = "REGISTRATION TERMINAL //";

  if (isAndroid && promptEl && !promptEl.classList.contains("show")) {
    promptEl.classList.add("show");
  }

  setTimeout(() => {
    typeWriter(" ENTER EMAIL FOR QUARTERLY GLITCH REPORT", typeEl, 50, () => {
      if (promptEl && !isAndroid) promptEl.classList.add("show");
      if (!isTouch) { inputEl && inputEl.focus(); }
      if (isTouch) enableMobileIME();
      if (!isAndroid) renderMirror();
    });
  }, 300);
}

// ===== PROMPT BINDINGS =====
function bindPrompt(){
  if (!inputEl) return;

  // Desktop: click places a collapsed caret; drag selects
  if (!isTouch) {
    let dragging = false;
    let dragAnchorIdx = null;

    typedEl.addEventListener("mousedown", (e) => {
      const i = indexFromPoint(e.clientX);
      dragging = true;
      dragAnchorIdx = i;
      try {
        if (document.activeElement !== inputEl) inputEl.focus();
        inputEl.setSelectionRange(i, i); // collapsed caret so typing inserts
      } catch(_) {}
      renderMirror();
      e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
      if (!dragging || dragAnchorIdx == null || lockedOutput) return;
      const j = indexFromPoint(e.clientX);
      const a = Math.min(dragAnchorIdx, j);
      const b = Math.max(dragAnchorIdx, j) + 1; // include char under cursor
      try { inputEl.setSelectionRange(a, Math.min(b, (inputEl.value || "").length)); } catch(_) {}
      renderMirror();
    });

    window.addEventListener("mouseup", () => {
      dragging = false;
      dragAnchorIdx = null;
    });
  }

  // iOS: tap anywhere on prompt focuses tiny input
  if (isIOS) {
    promptEl.addEventListener("touchstart", () => {
      try { inputEl.focus(); } catch(_) {}
    }, { passive: true });
  }

  // Mirror updates (desktop + iOS)
  if (!isAndroid) {
    ["input","focus","blur","keyup","select","click"].forEach(evt =>
      inputEl.addEventListener(evt, renderMirror)
    );
    inputEl.addEventListener("keydown", () => setTimeout(renderMirror, 0));
  }

  // Cmd/Ctrl+A (desktop)
  document.addEventListener("keydown", (e) => {
    const isA = (e.key === "a" || e.key === "A");
    const withMeta = (e.metaKey || e.ctrlKey);
    if (!isA || !withMeta || lockedOutput) return;
    e.preventDefault();
    const len = (inputEl.value || "").length;
    try { inputEl.setSelectionRange(0, len); } catch(_) {}
    if (!isAndroid) renderMirror();
  }, true);

  // Enter/Go to submit
  const isEnter = (e) => (e.key === "Enter" || e.key === "Go" || e.keyCode === 13);
  inputEl.addEventListener("keydown", (e) => {
    if (!isEnter(e)) return;
    e.preventDefault();
    trySubmitEmail();
  });
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

  // Freeze mirror and show <GO>
  lockedOutput = true;                       // <— lock repaint
  inputEl.setAttribute("disabled", "disabled");
  if (!isAndroid && typedEl) {
    typedEl.innerHTML = `${escapeHTML(email)} <span class="go-pill">&lt;GO&gt;</span>`;
  }
  hintEl && (hintEl.textContent = "");
  log("submitting to MailerLite…");
  mlEmail.value = email.toLowerCase();

  let finished = false;

  const cleanupFail = (msg) => {
    if (finished) return;
    finished = true;
    lockedOutput = false;                   // <— unlock so caret returns if we failed
    inputEl.removeAttribute("disabled");
    hintEl && (hintEl.textContent = msg || "hmm… couldn’t reach mail server. try again?");
    renderMirror();
  };

  const onLoad = () => {
    if (finished) return;
    finished = true;
    setTimeout(() => { window.location.href = NEXT_URL; }, GO_HOLD_MS);
  };

  const timeoutId = setTimeout(() => cleanupFail(), 8000);
  mlIframe.addEventListener("load", () => {
    clearTimeout(timeoutId);
    onLoad();
  }, { once: true });

  try {
    if (typeof mlForm.requestSubmit === "function") {
      mlForm.requestSubmit();
    } else {
      mlForm.submit();
    }
  } catch(err) {
    clearTimeout(timeoutId);
    cleanupFail();
    log("submit threw:", err);
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
  if (!isAndroid) requestAnimationFrame(caretRAF); // Android: no mirror loop
  if (isTouch) enableMobileIME();
  if (DIAG) console.info("[gate] diagnostics mode ON — no auto-continue; watch console logs");
});
