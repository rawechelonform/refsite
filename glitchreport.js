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
const isIOSChrome  = /CriOS/i.test(UA);   // iOS Chrome (WebKit)
const isTouch      = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

// Mark Android early so CSS can stabilize layout before any taps
if (isAndroid) document.documentElement.classList.add('android-stable');

// Desktop flag for tiny desktop-only behavior
const isDesktop = !isTouch;
if (isDesktop) document.documentElement.classList.add('desktop');

// ===== STATE =====
let lockedOutput = false;     // freezes mirror during/after submit
let submittedUI  = false;     // prevents any mirror repaint after <GO> shown
let dragging = false;
let dragAnchorIdx = null;
let ceEl = null;              // iOS Chrome contenteditable shim
let iosChromeUsingCE = false; // whether CE is active

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
function isValidEmail(e){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function setImp(el, prop, value){ el && el.style.setProperty(prop, value, 'important'); }

// ===== MIRROR (desktop + iOS Safari; NOT Android; NOT iOS Chrome when CE mode) =====
function htmlAtRange(a, b, raw){
  let out = "";
  for (let i = a; i < b; i++){
    out += `<span class="ch" data-i="${i}">${escapeHTML(raw[i])}</span>`;
  }
  return out;
}
function renderMirror(){
  // hard stop once we have shown <GO> so it cannot flash away
  if (submittedUI) return;

  if (!typedEl || !inputEl || isAndroid) return;
  if (isIOSChrome && iosChromeUsingCE) return;

  // Hide caret unless the real input has focus, or when we freeze for submit
  if (document.activeElement !== inputEl || lockedOutput) {
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

// ===== RAF (desktop + iOS Safari only) =====
let _v = null, _s = -1, _e = -1;
function caretRAF(){
  if (!inputEl || isAndroid || (isIOSChrome && iosChromeUsingCE)) { requestAnimationFrame(caretRAF); return; }
  if (!lockedOutput && !submittedUI) {
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

function ensureIOSChromeCE(){
  if (!isIOSChrome || iosChromeUsingCE || !promptEl) return;

  ceEl = document.createElement('span');
  ceEl.id = 'iosc-ce';
  ceEl.contentEditable = 'true';
  ceEl.setAttribute('role','textbox');
  ceEl.setAttribute('aria-label','email input');
  ceEl.spellcheck = false;
  ceEl.autocapitalize = 'off';
  ceEl.autocorrect = 'off';

  Object.assign(ceEl.style, {
    position: 'relative',
    display: 'inline-block',
    minWidth: '2ch',
    lineHeight: '1',
    outline: 'none',
    border: '0',
    background: 'transparent',
    /* keep the CE text invisible; we render the green cursor in #typed */
    color: 'transparent',
    caretColor: 'var(--crt)',
    marginLeft: '0.3ch',
    letterSpacing: '0.08em',
    /* iOS Chrome: force plain text (stops .com autolink underline) */
    WebkitUserModify: 'read-write-plaintext-only'
  });

  // Build per-char spans in #typed so we can map taps to indices
  const paintTypedFromInput = () => {
    if (submittedUI) return;
    const raw = (inputEl.value || '');
    let html = '';
    for (let i = 0; i < raw.length; i++) {
      const ch = escapeHTML(raw[i]);
      html += `<span class="ch" data-i="${i}">${ch}</span>`;
    }
    typedEl.innerHTML = html + `<span class="cursor-block">&nbsp;</span>`;
  };

  // Keep CE → hidden input in sync (form still submits the input value)
  const syncFromCE = () => {
    inputEl.value = (ceEl.textContent || '').trim();
    paintTypedFromInput();
  };

  ceEl.addEventListener('input', syncFromCE);
  ceEl.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); trySubmitEmail(); }
  });
  ceEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); trySubmitEmail(); }
  });

  promptEl.appendChild(ceEl);
  if (typedEl) typedEl.style.display = 'inline';

  // Initialize typed mirror once CE is in DOM
  paintTypedFromInput();

  iosChromeUsingCE = true;
}


function focusWithKeyboard(el, onFail){
  const baseH = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  let fired = false;
  const t0 = Date.now();

  const check = () => {
    const nowH = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const delta = baseH - nowH;
    if (document.activeElement === el && (delta > 40 || Date.now() - t0 > 200)) {
      fired = true;
      return;
    }
    if (!fired && Date.now() - t0 > 220) {
      onFail && onFail();
    }
  };

  try { el.focus(); } catch(_) {}
  setTimeout(check, 160);
  setTimeout(check, 240);
}

// ===== MOBILE IME CONFIG =====
function enableMobileIME(){
  if (!isTouch) return;

  try { inputEl.type = 'text'; } catch(_) {}
  inputEl.setAttribute('inputmode','email');
  inputEl.setAttribute('autocomplete','email');
  inputEl.setAttribute('autocapitalize','off');
  inputEl.setAttribute('enterkeyhint','go');

  if (isIOSChrome) {
    if (typedEl) typedEl.style.display = 'inline';
  }
}

// ===== TERMINAL =====
function startTerminalSequence(){
  if (staticEl) staticEl.textContent = "REGISTRATION TERMINAL //";

  // Show prompt early for Android and iOS Chrome to avoid visibility flip
  if ((isAndroid || isIOSChrome) && promptEl && !promptEl.classList.contains('show')) {
    promptEl.classList.add('show');
  }

  setTimeout(() => {
    typeWriter(" ENTER EMAIL FOR QUARTERLY GLITCH REPORT", typeEl, 50, () => {
      if (promptEl && !(isAndroid || isIOSChrome)) promptEl.classList.add("show");
      if (!isTouch) { inputEl && inputEl.focus(); }
      if (isTouch) enableMobileIME();
      if (!isAndroid) renderMirror();
    });
  }, 300);
}

// ===== PROMPT BINDINGS =====
function bindPrompt(){
  if (!inputEl) return;

  // Desktop only: disable browser autocomplete UI on the hidden input
  if (!isTouch) {
    try {
      inputEl.setAttribute('autocomplete', 'off');
      inputEl.setAttribute('autocorrect', 'off');
      inputEl.setAttribute('autocapitalize', 'off');
    } catch (_) {}
  }

  // Desktop + iOS Safari mirror interactions
  if (!isTouch || (isIOS && !isIOSChrome)) {
    typedEl && typedEl.addEventListener("mousedown", (e) => {
      if (submittedUI) return;
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
      if (!dragging || dragAnchorIdx == null || lockedOutput || submittedUI) return;
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

  // iOS Chrome: activate CE shim if needed + enable tap/drag caret/selection
  if (isIOSChrome) {
    const activate = () => {
      if (submittedUI) return;
      focusWithKeyboard(inputEl, () => {
        ensureIOSChromeCE();
        focusWithKeyboard(ceEl);
      });
    };
    promptEl.addEventListener("touchstart", activate, { passive: true });
    promptEl.addEventListener("click", activate, { passive: true });

    // After CE is active, let taps/drag on the green line control caret/selection
    const setCESelection = (start, end) => {
      if (!ceEl) return;
      // CE contains a single text node; if not, fall back to CE itself
      const txtNode = ceEl.firstChild || ceEl;
      const len = (ceEl.textContent || '').length;
      const a = Math.max(0, Math.min(start, len));
      const b = Math.max(0, Math.min(end == null ? a : end, len));
      const r = document.createRange();
      try { r.setStart(txtNode, a); r.setEnd(txtNode, b); } catch(_) { return; }
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    };

    let dragAnchor = null;

    const indexAtClientX = (clientX) => indexFromPoint(clientX);

    const handleDown = (clientX) => {
      ensureIOSChromeCE();          // make sure CE exists
      if (!ceEl) return;
      dragAnchor = indexAtClientX(clientX);
      setCESelection(dragAnchor, dragAnchor);
      try { ceEl.focus(); } catch(_) {}
    };

    const handleMove = (clientX) => {
      if (dragAnchor == null) return;
      const j = indexAtClientX(clientX);
      setCESelection(Math.min(dragAnchor, j), Math.max(dragAnchor, j));
    };

    const handleUp = () => { dragAnchor = null; };

    if (typedEl) {
      // mouse (desktop simulator / dev tools)
      typedEl.addEventListener('mousedown', (e) => { e.preventDefault(); handleDown(e.clientX); });
      window.addEventListener('mousemove', (e) => handleMove(e.clientX));
      window.addEventListener('mouseup', handleUp);

      // touch (actual phone)
      typedEl.addEventListener('touchstart', (e) => {
        const t = e.touches && e.touches[0];
        if (t) handleDown(t.clientX);
      }, { passive: true });

      window.addEventListener('touchmove', (e) => {
        const t = e.touches && e.touches[0];
        if (t) handleMove(t.clientX);
      }, { passive: true });

      window.addEventListener('touchend', handleUp);
    }
  }

  // iOS Safari: tap to focus the real input
  if (isIOS && !isIOSChrome) {
    promptEl.addEventListener("touchstart", () => {
      if (submittedUI) return;
      try { inputEl.focus(); } catch(_) {}
    }, { passive: true });
  }

  // Mirror updates (desktop + iOS Safari)
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
    if (!isA || !withMeta || lockedOutput || submittedUI) return;
    e.preventDefault();
    const len = (inputEl.value || "").length;
    try { inputEl.setSelectionRange(0, len); } catch(_) {}
    if (!(isAndroid || (isIOSChrome && iosChromeUsingCE))) renderMirror();
  }, true);

  // Enter/Go to submit (cover all event types)
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


// Small helper: render <GO> and permanently freeze the mirror
function showGO(emailText){
  submittedUI = true;                 // never repaint again
  lockedOutput = true;
  if (typedEl) {
    typedEl.style.display = 'inline'; // ensure visible on Safari
    typedEl.innerHTML = `${escapeHTML(emailText)} <span class="go-pill">&lt;GO&gt;</span>`;
  }
  try { inputEl.setAttribute("disabled", "disabled"); } catch(_) {}

  // remove any late mirror triggers that might still be queued
  try {
    ["input","focus","blur","keyup","select","click","keydown","keypress"].forEach(evt => {
      inputEl && inputEl.removeEventListener(evt, renderMirror, true);
      inputEl && inputEl.removeEventListener(evt, renderMirror, false);
    });
  } catch(_) {}
}

// ===== SUBMIT (iframe + JSONP fallback) =====
function trySubmitEmail() {
  if (lockedOutput || submittedUI) return;

  if (isIOSChrome && iosChromeUsingCE && ceEl) {
    inputEl.value = (ceEl.textContent || '').trim();
  }

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

  // Keep iframe present (1x1)
  try {
    mlIframe.style.position = "absolute";
    mlIframe.style.left = "-9999px";
    mlIframe.style.top = "-9999px";
    mlIframe.style.width = "1px";
    mlIframe.style.height = "1px";
    mlIframe.style.border = "0";
    if (!mlIframe.src) mlIframe.src = "about:blank";
  } catch(_) {}

  // Ensure there is a real submit button for requestSubmit()
  let hiddenBtn = mlForm.querySelector('#ml-hidden-submit');
  if (!hiddenBtn) {
    hiddenBtn = document.createElement('button');
    hiddenBtn.type = 'submit';
    hiddenBtn.id = 'ml-hidden-submit';
    hiddenBtn.style.display = 'none';
    mlForm.appendChild(hiddenBtn);
  }

  // Freeze UI and show <GO> immediately (Desktop + iOS)
  if (!isAndroid) showGO(email);
  hintEl && (hintEl.textContent = "");
  log("submitting to MailerLite…");
  mlEmail.value = email.toLowerCase();

  // Gate for success/failure
  let finished = false;
  const doneSuccess = () => {
    if (finished) return; finished = true;
    setTimeout(() => { window.location.href = NEXT_URL; }, GO_HOLD_MS);
  };
  const doneFail = () => {
    if (finished) return; finished = true;
    submittedUI = false;
    lockedOutput = false;
    try { inputEl.removeAttribute("disabled"); } catch(_) {}
    hintEl && (hintEl.textContent = "hmm… couldn’t reach mail server. try again?");
    renderMirror();
  };

  // Strategy A: hidden-iframe submit
  const onLoad = () => doneSuccess();
  mlIframe.addEventListener("load", onLoad, { once: true });

  const iframeTO = setTimeout(() => {
    mlIframe.removeEventListener("load", onLoad);
    // jsonp might still succeed
  }, 9000);

  try {
    if (typeof mlForm.requestSubmit === "function") {
      mlForm.requestSubmit(hiddenBtn);
    } else {
      hiddenBtn.click();
    }
  } catch (err) {
    log("iframe submit threw:", err);
  }

  // Strategy B: JSONP fallback
  try {
    const base = mlForm.getAttribute('action');
    const cbName = "mlcb_" + Math.random().toString(36).slice(2);
    const url = `${base}?ml-submit=1&fields%5Bemail%5D=${encodeURIComponent(email)}&callback=${encodeURIComponent(cbName)}`;

    const cleanupJSONP = (script) => {
      try { delete window[cbName]; } catch(_) { window[cbName] = undefined; }
      if (script && script.parentNode) script.parentNode.removeChild(script);
    };

    const script = document.createElement('script');
    window[cbName] = function jsonpOK(resp){
      cleanupJSONP(script);
      clearTimeout(jsonpTO);
      doneSuccess();
    };
    script.src = url;
    script.async = true;
    document.head.appendChild(script);

    const jsonpTO = setTimeout(() => {
      cleanupJSONP(script);
      if (!finished) {
        clearTimeout(iframeTO);
        doneFail();
      }
    }, 9000);
  } catch (e) {
    log("jsonp path error:", e);
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
  if (!(isAndroid)) requestAnimationFrame(caretRAF);
  if (DIAG) console.info("[gate] diagnostics mode ON — no auto-continue; watch console logs");
});
