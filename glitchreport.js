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

// ===== COPY =====
const STATIC_TEXT = "REGISTRATION TERMINAL //";
const TYPE_TEXT   = " ENTER EMAIL FOR QUARTERLY GLITCH REPORT";

// ===== STATE =====
let terminalStarted = false;
let lockedOutput    = false;
let submitInFlight  = false;
let dragAnchorIdx   = null;  // anchor index while dragging over .typed

// ===== MOBILE FLAGS + HELPERS =====
const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

// set inline styles with !important
function setImp(el, prop, value){ el && el.style.setProperty(prop, value, 'important'); }

// keep real input in-viewport on mobile so IME can open
function enableMobileIME(){
  if (!isTouch || !inputEl) return;
  setImp(inputEl, 'position', 'fixed');
  setImp(inputEl, 'left', '0');
  setImp(inputEl, 'bottom', '0');
  setImp(inputEl, 'width', '1px');
  setImp(inputEl, 'height', '1.4rem');
  setImp(inputEl, 'opacity', '0.1'); // changed from 0.01 for reliability
  setImp(inputEl, 'color', 'transparent');
  setImp(inputEl, 'background', 'transparent');
  setImp(inputEl, 'border', '0');
  setImp(inputEl, 'padding', '0');
  setImp(inputEl, 'z-index', '1');
  setImp(inputEl, 'font-size', '16px'); // avoid iOS zoom-on-focus
  setImp(inputEl, 'pointer-events', 'auto');
  if (inputEl.type !== 'email') { try { inputEl.type = 'email'; } catch(_) {} }
  inputEl.setAttribute('inputmode', 'email');
  inputEl.setAttribute('enterkeyhint', 'go');
}

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

// ===== RENDER (we wrap every char so we can hit-test precisely) =====
function renderMirror(){
  if (lockedOutput || !typedEl || !inputEl) return;
  const raw = inputEl.value || "";

  const start = inputEl.selectionStart ?? raw.length;
  const end   = inputEl.selectionEnd   ?? raw.length;
  const selMin = Math.min(start, end);
  const selMax = Math.max(start, end);

  // Build char spans so clicks/drags can map to indices
  let html = "";
  for (let i = 0; i < raw.length; i++){
    const ch = escapeHTML(raw[i]);
    const cls = (i >= selMin && i < selMax) ? "ch cursor-sel" : "ch";
    html += `<span class="${cls}" data-i="${i}">${ch}</span>`;
  }

  if (selMin === selMax) {
    // Caret: insert a blinking block between characters (or at end)
    const idx = selMin;
    const before = htmlAtRange(0, idx, raw);
    const atChar = raw[idx] ? escapeHTML(raw[idx]) : "&nbsp;";
    const after  = htmlAtRange(idx + (raw[idx] ? 1 : 0), raw.length, raw);
    typedEl.innerHTML =
      before + `<span class="cursor-block">${atChar}</span>` + after;
  } else {
    // Selection rendered via classes above
    typedEl.innerHTML = html;
  }
}

// helper: build HTML for [a,b) using .ch spans from current raw
function htmlAtRange(a, b, raw){
  let out = "";
  for (let i = a; i < b; i++) {
    out += `<span class="ch" data-i="${i}">${escapeHTML(raw[i])}</span>`;
  }
  return out;
}

// ===== Hit-testing: map mouse X to nearest character index =====
function indexFromPoint(clientX){
  if (!typedEl) return 0;
  const boxes = typedEl.querySelectorAll('.ch');
  if (!boxes.length) return 0;

  // Choose the .ch whose center is closest to the pointer X
  let bestI = 0;
  let bestDist = Infinity;
  boxes.forEach((el) => {
    const rect = el.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const d = Math.abs(clientX - midX);
    if (d < bestDist) { bestDist = d; bestI = Number(el.getAttribute('data-i')) || 0; }
  });
  return bestI;
}

// ===== SAFETY NET: repaint on value/selection changes =====
let _v = null, _s = -1, _e = -1;
function caretRAF(){
  if (!inputEl || lockedOutput) { requestAnimationFrame(caretRAF); return; }
  const v = inputEl.value || "";
  const s = inputEl.selectionStart ?? v.length;
  const e = inputEl.selectionEnd   ?? v.length;
  if (v !== _v || s !== _s || e !== _e) {
    _v = v; _s = s; _e = e;
    renderMirror();
  }
  requestAnimationFrame(caretRAF);
}

// ===== TERMINAL =====
function startTerminalSequence(){
  if (terminalStarted) return;
  terminalStarted = true;
  staticEl && (staticEl.textContent = STATIC_TEXT);
  setTimeout(() => {
    typeWriter(TYPE_TEXT, typeEl, 50, () => {
      if (promptEl) {
        promptEl.classList.add("show");
        // Desktop autofocus preserved
        if (!isTouch) { inputEl && inputEl.focus(); }
        // Mobile: prepare input, wait for user tap to focus
        if (isTouch) enableMobileIME();
        renderMirror();
      }
    });
  }, 300);
}

function bindPrompt(){
  if (!inputEl || !typedEl) return;

  if (!isTouch) {
    // ===== DESKTOP (unchanged) =====
    typedEl.addEventListener("mousedown", (e) => {
      const i = indexFromPoint(e.clientX);
      dragAnchorIdx = i;
      try {
        if (document.activeElement !== inputEl) inputEl.focus();
        inputEl.setSelectionRange(i, Math.min(i + 1, (inputEl.value || "").length));
      } catch (_) {}
      renderMirror();
      e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
      if (dragAnchorIdx == null) return;
      const j = indexFromPoint(e.clientX);
      const a = Math.min(dragAnchorIdx, j);
      const b = Math.max(dragAnchorIdx, j) + 1;
      try { inputEl.setSelectionRange(a, Math.min(b, (inputEl.value || "").length)); } catch (_) {}
      renderMirror();
    });

    window.addEventListener("mouseup", () => {
      dragAnchorIdx = null;
    });

  } else {
    // ===== MOBILE ONLY =====
    enableMobileIME();

    // Focus the input when user interacts with the prompt area (for reliable IME opening)
    promptEl.addEventListener("touchstart", function() {
      inputEl.focus();
    }, { passive: false });

    typedEl.addEventListener("touchstart", (e) => {
      const t = e.touches && e.touches[0];
      if (!t) return;
      const i = indexFromPoint(t.clientX);
      dragAnchorIdx = i;
      try {
        if (document.activeElement !== inputEl) inputEl.focus(); // user gesture → opens IME
        inputEl.setSelectionRange(i, Math.min(i + 1, (inputEl.value || "").length));
      } catch (_) {}
      renderMirror();
      e.preventDefault();
    }, { passive: false });

    window.addEventListener("touchmove", (e) => {
      if (dragAnchorIdx == null) return;
      const t = e.touches && e.touches[0];
      if (!t) return;
      const j = indexFromPoint(t.clientX);
      const a = Math.min(dragAnchorIdx, j);
      const b = Math.max(dragAnchorIdx, j) + 1;
      try { inputEl.setSelectionRange(a, Math.min(b, (inputEl.value || "").length)); } catch (_) {}
      renderMirror();
    }, { passive: false });

    window.addEventListener("touchend", () => {
      dragAnchorIdx = null;
    });
  }

  // ===== Shared bindings =====
  ["input","focus","blur","keyup","select","click"].forEach(evt =>
    inputEl.addEventListener(evt, renderMirror)
  );
  inputEl.addEventListener("keydown", () => setTimeout(renderMirror, 0));

  // Cmd/Ctrl+A (select all)
  document.addEventListener("keydown", (e) => {
    const isA = (e.key === 'a' || e.key === 'A');
    const withMeta = (e.metaKey || e.ctrlKey);
    if (!isA || !withMeta) return;
    e.preventDefault();
    const len = (inputEl.value || "").length;
    try { inputEl.setSelectionRange(0, len); } catch (_) {}
    renderMirror();
  }, true);

  // Submit on Enter → MailerLite → redirect
  inputEl.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    if (submitInFlight) { e.preventDefault(); return; }

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

    // Lock and submit
    lockedOutput = true;
    submitInFlight = true;
    inputEl.setAttribute("disabled", "disabled");
    typedEl.innerHTML = `${escapeHTML(email)} <span class="go-pill">&lt;GO&gt;</span>`;
    hintEl && (hintEl.textContent = "");
    log("submitting to MailerLite…");

    if (mlForm && mlEmail){
      mlEmail.value = email.toLowerCase();

      let done = false;
      const CLEANUP = () => { mlIframe?.removeEventListener("load", onLoad); };

      const onLoad = () => {
        if (done) return; done = true; CLEANUP();
        log("iframe loaded (success path)");
        if (NEXT_URL && !DIAG) {
          setTimeout(() => { window.location.href = NEXT_URL; }, GO_HOLD_MS);
        } else {
          hintEl && (hintEl.textContent = "ok—received response from mail server.");
        }
      };

      const onTimeout = () => {
        if (done) return; done = true; CLEANUP();
        log("timeout waiting for iframe (failure path)");
        inputEl.removeAttribute("disabled");
        submitInFlight = false;
        lockedOutput = false;
        renderMirror();
        hintEl && (hintEl.textContent = "hmm… couldn’t reach mail server. try again?");
      };

      if (mlIframe) {
        mlIframe.addEventListener("load", onLoad, { once: true });
        setTimeout(onTimeout, 8000);
      } else {
        setTimeout(onTimeout, 0);
      }

      try { mlForm.submit(); } catch(err) {
        log("submit threw:", err);
        onTimeout();
      }
    }
  });
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
  requestAnimationFrame(caretRAF);
  if (isTouch) enableMobileIME(); // ensure override applied early on mobile
  if (DIAG) console.info("[gate] diagnostics mode ON — no auto-continue; watch console logs");
});
