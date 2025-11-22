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
const isIOSChrome  = /CriOS/i.test(UA); // Chrome on iOS

// Android Chrome only (exclude Edge, Samsung, Opera)
const isAndroidChrome =
  isAndroid &&
  /Chrome\/\d+/i.test(UA) &&
  !/EdgA|SamsungBrowser|OPR\//i.test(UA);

// Add classes:
// - android-chrome → our mirror + wrapping rules
// - android-stable → original Android fallback (non-Chrome)
if (isAndroidChrome) {
  document.documentElement.classList.add('android-chrome');
} else if (isAndroid) {
  document.documentElement.classList.add('android-stable');
}

// Desktop flag (unchanged)
const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
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

// ===== MIRROR RENDERING =====
function htmlAtRange(a, b, raw){
  let out = "";
  for (let i = a; i < b; i++){
    out += `<span class="ch" data-i="${i}">${escapeHTML(raw[i])}</span>`;
  }
  return out;
}

function renderMirror(){
  if (submittedUI) return;

  // Skip only for non-Chrome Android (which uses native input path)
  if (!typedEl || !inputEl) return;
  if (isAndroid && !isAndroidChrome) return;
  if (isIOSChrome && iosChromeUsingCE) return; // iOS Chrome paints via CE path

  // If not focused or locked, just show plain text
  if (document.activeElement !== inputEl || lockedOutput) {
    typedEl.textContent = inputEl.value || "";
    return;
  }

  const raw = inputEl.value || "";
  const start = inputEl.selectionStart ?? raw.length;
  const end   = inputEl.selectionEnd   ?? raw.length;
  const selMin = Math.min(start, end);
  const selMax = Math.max(start, end);

  if (selMin === selMax) {
    const idx = selMin;
    const before = htmlAtRange(0, idx, raw);
    const atChar = raw[idx] ? escapeHTML(raw[idx]) : "&nbsp;";
    const after  = htmlAtRange(idx + (raw[idx] ? 1 : 0), raw.length, raw);
    typedEl.innerHTML = before + `<span class="cursor-block">${atChar}</span>` + after;
  } else {
    let html = "";
    for (let i = 0; i < raw.length; i++){
      const ch = escapeHTML(raw[i]);
      const cls = (i >= selMin && i < selMax) ? "ch cursor-sel" : "ch";
      html += `<span class="${cls}" data-i="${i}">${ch}</span>`;
    }
    typedEl.innerHTML = html;
  }
}

function indexFromPoint(clientX){
  if (!typedEl) return 0;
  const boxes = typedEl.querySelectorAll('.ch');
  if (!boxes.length) return Math.min((inputEl.value || "").length, 0);
  let bestI = 0, bestDist = Infinity;
  boxes.forEach((el) => {
    const rect = el.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const d = Math.abs(clientX - midX);
    if (d < bestDist) { bestDist = d; bestI = Number(el.getAttribute('data-i')) || 0; }
  });
  return bestI;
}

// ===== RAF (desktop + iOS Safari + Android Chrome) =====
let _v = null, _s = -1, _e = -1;
function caretRAF(){
  const skip =
    (isAndroid && !isAndroidChrome) ||      // native input only for non-Chrome Android
    (isIOSChrome && iosChromeUsingCE);      // CE handles paint on iOS Chrome

  if (!inputEl || skip) { requestAnimationFrame(caretRAF); return; }

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

// ===== iOS CHROME CE SHIM (Chrome on iOS only) =====
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
    position: 'absolute',
    left: '-9999px',
    top: '-9999px',
    width: '1px',
    height: '1px',
    overflow: 'hidden',
    outline: 'none',
    border: '0',
    background: 'transparent',
    color: 'transparent',
    caretColor: 'transparent',
    WebkitUserModify: 'read-write-plaintext-only',
    textDecoration: 'none',
    WebkitTextDecorationSkip: 'none',
    textDecorationColor: 'transparent',
    WebkitTapHighlightColor: 'transparent',
    letterSpacing: '0.08em'
  });

  ceEl.textContent = (inputEl?.value || '');

  const getNode = () => ceEl.firstChild || ceEl;
  const getText = () => (ceEl.textContent || '');

  const setSel = (start, end) => {
    const len = getText().length;
    const a = Math.max(0, Math.min(start, len));
    const b = Math.max(0, Math.min(end == null ? a : end, len));
    const r = document.createRange();
    const n = getNode();
    try {
      r.setStart(n, a); r.setEnd(n, b);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    } catch(_){}
  };

  const getSel = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      const len = getText().length;
      return { start: len, end: len, collapsed: true };
    }
    const r = sel.getRangeAt(0);
    return { start: r.startOffset, end: r.endOffset, collapsed: r.startOffset === r.endOffset };
  };

  const paint = () => {
    if (submittedUI || !typedEl) return;

    typedEl.style.textDecoration = 'none';
    typedEl.style.whiteSpace = 'pre-wrap';
    typedEl.style.wordBreak = 'break-word';
    typedEl.style.overflowWrap = 'anywhere';
    typedEl.style.maxWidth = '100%';

    const raw = getText();
    const sel = getSel();

    if (raw.length === 0) {
      typedEl.innerHTML = `<span class="cursor-block">&nbsp;</span>`;
      return;
    }

    if (sel.collapsed) {
      const idx = sel.start;
      const before = htmlAtRange(0, idx, raw);
      const atChar = raw[idx] ? escapeHTML(raw[idx]) : "&nbsp;";
      const after  = htmlAtRange(idx + (raw[idx] ? 1 : 0), raw.length, raw);
      typedEl.innerHTML = before + `<span class="cursor-block">${atChar}</span>` + after;
    } else {
      let html = "";
      for (let i = 0; i < raw.length; i++){
        const ch = escapeHTML(raw[i]);
        const cls = (i >= sel.start && i < sel.end) ? "ch cursor-sel" : "ch";
        html += `<span class="${cls}" data-i="${i}">${ch}</span>`;
      }
      typedEl.innerHTML = html;
    }
  };

  const syncFromCE = () => {
    if (!inputEl) return;
    inputEl.value = getText().trim();
    paint();
  };

  ceEl.addEventListener('beforeinput', (e) => {
    const t = e.inputType || "";
    if (t === 'insertLineBreak' || t === 'insertParagraph') e.preventDefault();
  });

  ceEl.addEventListener('input', syncFromCE);
  ceEl.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); trySubmitEmail(); return; }
    paint();
  });
  ceEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); trySubmitEmail(); return; }
  });
  ceEl.addEventListener('focus', () => {
    const len = (ceEl.textContent || '').length;
    setSel(len, len);
    paint();
  });

  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const a = sel.anchorNode, f = sel.focusNode;
    if (ceEl.contains(a) || ceEl.contains(f) || a === ceEl || f === ceEl) paint();
  });

  promptEl.appendChild(ceEl);
  if (typedEl) typedEl.style.display = 'inline';
  paint();

  ceEl._setSel = setSel;
  ceEl._paint  = paint;

  iosChromeUsingCE = true;
}

function focusWithKeyboard(el, onFail){
  const baseH = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  let fired = false;
  const t0 = Date.now();
  const check = () => {
    const nowH = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const delta = baseH - nowH;
    if (document.activeElement === el && (delta > 40 || Date.now() - t0 > 200)) { fired = true; return; }
    if (!fired && Date.now() - t0 > 220) { onFail && onFail(); }
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
  if (isIOSChrome) typedEl && (typedEl.style.display = 'inline');
}

// ===== TERMINAL =====
function startTerminalSequence(){
  if (staticEl) staticEl.textContent = "REGISTRATION TERMINAL //";

  // Show prompt early on Android non-Chrome path only
  if (isAndroid && !isAndroidChrome && promptEl && !promptEl.classList.contains('show')) {
    promptEl.classList.add('show');
  }

  setTimeout(() => {
    typeWriter(" ENTER EMAIL FOR QUARTERLY GLITCH REPORT", typeEl, 50, () => {
      if (promptEl && !promptEl.classList.contains('show')) promptEl.classList.add("show");
      if (!isTouch) { inputEl && inputEl.focus(); }
      if (isTouch) enableMobileIME();
      if (!(isAndroid && !isAndroidChrome)) renderMirror();
    });
  }, 300);
}

// ===== PROMPT BINDINGS =====
function bindPrompt(){
  if (!inputEl) return;

  // Desktop only: reduce autocomplete UI on the hidden input
  if (!isTouch) {
    try {
      inputEl.setAttribute('autocomplete', 'off');
      inputEl.setAttribute('autocorrect', 'off');
      inputEl.setAttribute('autocapitalize', 'off');
    } catch (_) {}
  }

  // Desktop + iOS Safari mirror interactions (unchanged)
  if (!isTouch || (isIOS && !isIOSChrome)) {
    typedEl && typedEl.addEventListener("mousedown", (e) => {
      if (submittedUI) return;
      const i = indexFromPoint(e.clientX);
      dragging = true;
      dragAnchorIdx = i;
      try {
        if (document.activeElement !== inputEl) inputEl.focus();
        inputEl.setSelectionRange(i, i);
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

  // ANDROID CHROME: tap-to-place caret + drag to highlight using the mirror
  if (isAndroidChrome) {
    // Ensure mirror is visible on Android Chrome
    if (typedEl) typedEl.style.display = 'inline';

    // Help Android open keyboard when input is visually tiny/offscreen
    const focusInputForIME = () => {
      try { inputEl.focus({ preventScroll: true }); } catch(_) { try { inputEl.focus(); } catch(_) {} }
    };

    const handleDown = (clientX, e) => {
      if (submittedUI) return;
      const i = indexFromPoint(clientX);
      dragging = true;
      dragAnchorIdx = i;
      focusInputForIME();
      try { inputEl.setSelectionRange(i, i); } catch(_){}
      renderMirror();
      if (e) e.preventDefault();
    };

    const handleMove = (clientX, e) => {
      if (!dragging || dragAnchorIdx == null || submittedUI) return;
      const j = indexFromPoint(clientX);
      const a = Math.min(dragAnchorIdx, j);
      const b = Math.max(dragAnchorIdx, j) + 1;
      try { inputEl.setSelectionRange(a, Math.min(b, (inputEl.value || "").length)); } catch(_){}
      renderMirror();
      if (e) e.preventDefault();
    };

    const handleUp = () => {
      dragging = false;
      dragAnchorIdx = null;
    };

    if (typedEl) {
      // Mouse (desktop Android emulators)
      typedEl.addEventListener('mousedown', (e) => handleDown(e.clientX, e), { passive: false });
      window.addEventListener('mousemove', (e) => handleMove(e.clientX, e), { passive: false });
      window.addEventListener('mouseup', handleUp);

      // Touch
      typedEl.addEventListener('touchstart', (e) => {
        const t = e.touches && e.touches[0];
        if (t) handleDown(t.clientX, e);
      }, { passive: false });

      window.addEventListener('touchmove', (e) => {
        const t = e.touches && e.touches[0];
        if (t) handleMove(t.clientX, e);
      }, { passive: false });

      window.addEventListener('touchend', handleUp);
      window.addEventListener('touchcancel', handleUp);
    }
  }

  // iOS Chrome: CE shim path
  if (isIOSChrome) {
    const showCursorNow = () => {
      if (submittedUI) return;
      ensureIOSChromeCE();
      const len = (ceEl?.textContent || '').length;
      ceEl?._setSel?.(len, len);
      try { ceEl?.focus(); } catch (_) {}
      focusWithKeyboard(ceEl, () => {});
      ceEl?._paint?.();
      if (typedEl) typedEl.style.display = 'inline';
    };

    promptEl.addEventListener('touchstart', (e) => {
      e.preventDefault();
      showCursorNow();
    }, { passive: false });
    promptEl.addEventListener('click', showCursorNow, { passive: true });

    const placeFromPoint = (clientX) => indexFromPoint(clientX);
    let dragAnchor = null;

    const handleDown = (clientX, e) => {
      ensureIOSChromeCE();
      if (!ceEl) return;
      const i = placeFromPoint(clientX);
      dragAnchor = i;
      ceEl._setSel?.(i, i);
      focusWithKeyboard(ceEl, () => {});
      ceEl._paint?.();
      if (e) e.preventDefault();
    };

    const handleMove = (clientX, e) => {
      if (dragAnchor == null || !ceEl) return;
      const j = placeFromPoint(clientX);
      const a = Math.min(dragAnchor, j);
      const b = Math.max(dragAnchor, j);
      ceEl._setSel?.(a, b);
      ceEl._paint?.();
      if (e) e.preventDefault();
    };

    const handleUp = () => { dragAnchor = null; };

    if (typedEl) {
      typedEl.addEventListener('mousedown', (e) => handleDown(e.clientX, e));
      window.addEventListener('mousemove', (e) => handleMove(e.clientX, e), { passive: false });
      window.addEventListener('mouseup', handleUp);

      typedEl.addEventListener('touchstart', (e) => {
        const t = e.touches && e.touches[0];
        if (t) handleDown(t.clientX, e);
      }, { passive: false });
      window.addEventListener('touchmove', (e) => {
        const t = e.touches && e.touches[0];
        if (t) handleMove(t.clientX, e);
      }, { passive: false });
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

  // Mirror updates (desktop + iOS Safari + Android Chrome)
  if (!(isAndroid && !isAndroidChrome) && !isIOSChrome) {
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
    if (!((isAndroid && !isAndroidChrome) || (isIOSChrome && iosChromeUsingCE))) renderMirror();
  }, true);

  // Enter/Go to submit
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
  submittedUI = true;
  lockedOutput = true;
  if (typedEl) {
    typedEl.style.display = 'inline';
    typedEl.innerHTML = `${escapeHTML(emailText)} <span class="go-pill">&lt;GO&gt;</span>`;
  }
  try { inputEl.setAttribute("disabled", "disabled"); } catch(_) {}

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
    inputEl.value = (ceEl.textContent || '').replace(/\r?\n/g, '').trim();
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

  if (!(isAndroid && !isAndroidChrome)) showGO(email);
  hintEl && (hintEl.textContent = "");
  mlEmail.value = email.toLowerCase();

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

  const onLoad = () => doneSuccess();
  mlIframe.addEventListener("load", onLoad, { once: true });

  const iframeTO = setTimeout(() => {
    mlIframe.removeEventListener("load", onLoad);
  }, 9000);

  try {
    if (typeof mlForm.requestSubmit === "function") {
      mlForm.requestSubmit(hiddenBtn);
    } else {
      hiddenBtn.click();
    }
  } catch (_) {}

  try {
    const base = mlForm.getAttribute('action');
    const cbName = "mlcb_" + Math.random().toString(36).slice(2);
    const url = `${base}?ml-submit=1&fields%5Bemail%5D=${encodeURIComponent(email)}&callback=${encodeURIComponent(cbName)}`;

    const cleanupJSONP = (script) => {
      try { delete window[cbName]; } catch(_) { window[cbName] = undefined; }
      if (script && script.parentNode) script.parentNode.removeChild(script);
    };

    const script = document.createElement('script');
    window[cbName] = function jsonpOK(){
      cleanupJSONP(script);
      clearTimeout(jsonpTO);
      doneSuccess();
    };
    script.src = url;
    script.async = true;
    document.head.appendChild(script);

    const jsonpTO = setTimeout(() => {
      cleanupJSONP(script);
      if (!finished) { clearTimeout(iframeTO); doneFail(); }
    }, 9000);
  } catch (_) {}
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
  // run RAF for desktop, iOS Safari, and Android Chrome mirror
  if (!((isAndroid && !isAndroidChrome))) requestAnimationFrame(caretRAF);
  if (DIAG) console.info("[gate] diagnostics mode ON");
});
