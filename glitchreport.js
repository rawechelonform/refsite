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
const isIOSChrome  = /CriOS/i.test(UA);         // Chrome on iOS (WebKit)
const isTouch      = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);

if (isIOSChrome) {
  document.documentElement.classList.add("ios-chrome");
} else if (isAndroid) {
  document.documentElement.classList.add("android-stable");
}

const isDesktop = !isTouch;
if (isDesktop) document.documentElement.classList.add("desktop");

// ===== STATE =====
let lockedOutput = false;
let submittedUI  = false;
let ceEl = null;              // iOS Chrome contenteditable shim
let iosChromeUsingCE = false; // whether CE is active

// Line map cache for robust hit-testing
let _lineMap = null;     // [{top,bottom,midY,spans:[{i,left,midX,right}]}...]

// ===== UTIL =====
function log(...a){ if (DIAG) console.log("[gate]", ...a); }
function escapeHTML(s){
  return String(s).replace(/[&<>\"']/g, c =>
    c === "&" ? "&amp;" :
    c === "<" ? "&lt;" :
    c === ">" ? "&gt;" :
    c === "\"" ? "&quot;" : "&#39;"
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

// ===== MIRROR (non–iOS Chrome paths) =====
function htmlAtRange(a, b, raw){
  let out = "";
  for (let i = a; i < b; i++){
    out += `<span class="ch" data-i="${i}">${escapeHTML(raw[i])}</span>`;
  }
  return out;
}

// Paint the mirror using an explicit [start, end) range (used during drag)
function paintMirrorRange(raw, start, end){
  if (!typedEl) return;
  const len = raw.length;
  const a = Math.max(0, Math.min(start ?? 0, len));
  const b = Math.max(0, Math.min(end   ?? a, len));

  if (a === b) {
    const before = htmlAtRange(0, a, raw);
    const atChar = raw[a] ? escapeHTML(raw[a]) : "&nbsp;";
    const after  = htmlAtRange(a + (raw[a] ? 1 : 0), len, raw);
    typedEl.innerHTML = before + `<span class="cursor-block">${atChar}</span>` + after;
    _lineMap = null;
    return;
  }

  let html = "";
  for (let i = 0; i < len; i++){
    const ch = escapeHTML(raw[i]);
    const cls = (i >= a && i < b) ? "ch cursor-sel" : "ch";
    html += `<span class="${cls}" data-i="${i}">${ch}</span>`;
  }
  typedEl.innerHTML = html;
  _lineMap = null;
}

function renderMirror(){
  if (submittedUI) return;
  if (!typedEl || !inputEl) return;
  if (isIOSChrome && iosChromeUsingCE) return; // iOS Chrome paints via CE

  if (document.activeElement !== inputEl || lockedOutput) {
    typedEl.textContent = inputEl.value || "";
    _lineMap = null;
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
  _lineMap = null;
}

// ===== ROW-AWARE HIT TEST =====
function buildLineMap(){
  if (!typedEl) return [];
  const spans = typedEl.querySelectorAll(".ch");
  if (!spans.length) return [];

  const rows = new Map();
  const tolerance = 3;

  spans.forEach(el => {
    const rect = el.getBoundingClientRect();
    let key = null;
    for (const k of rows.keys()){
      if (Math.abs(Number(k) - rect.top) <= tolerance) { key = k; break; }
    }
    if (key == null) key = String(rect.top);
    const row = rows.get(key) || { topMin: rect.top, botMax: rect.bottom, spans: [] };
    row.topMin = Math.min(row.topMin, rect.top);
    row.botMax = Math.max(row.botMax, rect.bottom);
    row.spans.push({
      i: Number(el.getAttribute("data-i")) || 0,
      left: rect.left,
      right: rect.right,
      midX: rect.left + rect.width/2
    });
    rows.set(key, row);
  });

  const list = Array.from(rows.values())
    .map(r => {
      r.spans.sort((a,b) => a.left - b.left);
      return { top: r.topMin, bottom: r.botMax, midY: (r.topMin + r.botMax)/2, spans: r.spans };
    })
    .sort((a,b) => a.top - b.top);

  return list;
}

function getLineMap(){
  if (_lineMap) return _lineMap;
  _lineMap = buildLineMap();
  return _lineMap;
}

// Accurate caret index from a screen point, bottom-biased for easier low touches
function indexFromPoint(clientX, clientY){
  if (!typedEl) return 0;
  const raw = (inputEl?.value || "");
  if (!raw.length) return 0;

  if (clientY == null) {
    const tr = typedEl.getBoundingClientRect();
    clientY = tr.top + tr.height / 2;
  }

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  // Bottom-friendly vertical sampling for WebKit caretFromPoint
  const cs = getComputedStyle(typedEl);
  const lh = parseFloat(cs.lineHeight) || 20;
  const band = Math.max(30, lh * 1.4);
  const probe = [
    0, band*0.25, band*0.5, band*0.75, band,
    -band*0.25, -band*0.5, -band, band*1.25, -band*1.25
  ];

  const caretFromPoint = (x, y) =>
    (document.caretPositionFromPoint && document.caretPositionFromPoint(x, y)) ||
    (document.caretRangeFromPoint && document.caretRangeFromPoint(x, y));

  const toIndexFromCaret = (node) => {
    if (!node) return null;
    if (node.nodeType === 3 && node.parentElement?.classList?.contains("ch")) {
      const base = Number(node.parentElement.getAttribute("data-i")) || 0;
      const r = node.parentElement.getBoundingClientRect();
      return clamp(base + (clientX > (r.left + r.width/2) ? 1 : 0), 0, raw.length);
    }
    if (node.nodeType === 1) {
      const el = node;
      const hit = el.classList?.contains("ch") ? el : (el.closest?.(".ch") || el.querySelector?.(".ch"));
      if (hit) {
        const base = Number(hit.getAttribute("data-i")) || 0;
        const r = hit.getBoundingClientRect();
        return clamp(base + (clientX > (r.left + r.width/2) ? 1 : 0), 0, raw.length);
      }
    }
    return null;
  };

  for (const dy of probe) {
    const c = caretFromPoint(clientX, clientY + dy);
    if (!c) continue;
    const node = "offsetNode" in c ? c.offsetNode : c.startContainer;
    const idx = toIndexFromCaret(node);
    if (idx != null) return idx;
  }

  // Line-aware fallback with bottom bias
  const lines = getLineMap();
  if (!lines.length) return 0;

  let bestLine = lines[0];
  let bestScore = Infinity;
  for (const line of lines) {
    const dy = Math.abs(clientY - line.midY);
    const belowBias = clientY >= line.midY ? 0.7 : 1.0;
    const score = dy * belowBias;
    if (score < bestScore) { bestScore = score; bestLine = line; }
  }

  const firstLine = lines[0], lastLine = lines[lines.length - 1];
  if (clientY < firstLine.top - band) bestLine = firstLine;
  else if (clientY > lastLine.bottom + band) bestLine = lastLine;

  let bestIdx = bestLine.spans[0].i;
  let bestDx = Infinity;
  for (const ch of bestLine.spans) {
    const dx = Math.abs(clientX - ch.midX);
    if (dx < bestDx) { bestDx = dx; bestIdx = ch.i; }
  }

  // outside left → start of this line
  if (clientX < bestLine.spans[0].left - 16) return clamp(bestLine.spans[0].i, 0, raw.length);

  // outside right → ***END OF WHOLE STRING*** (requested behavior)
  const lastCh = bestLine.spans[bestLine.spans.length - 1];
  if (clientX > lastCh.right + 16) return raw.length;

  return clamp(bestIdx, 0, raw.length);
}

// ===== RAF (desktop + iOS Safari; CE paints for iOS Chrome) =====
let _v = null, _s = -1, _e = -1;
function caretRAF(){
  if (!inputEl || (isIOSChrome && iosChromeUsingCE)) { requestAnimationFrame(caretRAF); return; }
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

// ===== iOS CHROME CE SHIM =====
function ensureIOSChromeCE(){
  if (!isIOSChrome || iosChromeUsingCE || !promptEl) return;

  ceEl = document.createElement("span");
  ceEl.id = "iosc-ce";
  ceEl.contentEditable = "true";
  ceEl.setAttribute("role","textbox");
  ceEl.setAttribute("aria-label","email input");
  ceEl.spellcheck = false;
  ceEl.autocapitalize = "off";
  ceEl.autocorrect = "off";

  Object.assign(ceEl.style, {
    position: "absolute",
    left: "-9999px",
    top: "-9999px",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    outline: "none",
    border: "0",
    background: "transparent",
    color: "transparent",
    caretColor: "transparent",
    WebkitUserModify: "read-write-plaintext-only",
    textDecoration: "none",
    WebkitTextDecorationSkip: "none",
    textDecorationColor: "transparent",
    WebkitTapHighlightColor: "transparent",
    letterSpacing: "0.08em"
  });

  ceEl.textContent = (inputEl?.value || "");

  const getNode = () => ceEl.firstChild || ceEl;
  const getText = () => (ceEl.textContent || "");

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

    // iOS Chrome wrapping + gesture behavior
    typedEl.style.textDecoration = "none";
    typedEl.style.whiteSpace = "normal";
    typedEl.style.wordBreak = "break-all";
    typedEl.style.overflowWrap = "anywhere";
    typedEl.style.maxWidth = "100%";
    typedEl.style.touchAction = "none";
    promptEl.style.touchAction = "none";

    const raw = getText();
    const sel = getSel();

    if (raw.length === 0) {
      typedEl.innerHTML = `<span class="cursor-block">&nbsp;</span>`;
      _lineMap = null;
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
    _lineMap = null;
  };

  const syncFromCE = () => {
    if (!inputEl) return;
    inputEl.value = getText().trim();
    paint();
  };

  ceEl.addEventListener("beforeinput", (e) => {
    const t = e.inputType || "";
    if (t === "insertLineBreak" || t === "insertParagraph") e.preventDefault();
  });

  ceEl.addEventListener("input", syncFromCE);
  ceEl.addEventListener("keyup", (e) => {
    if (e.key === "Enter") { e.preventDefault(); trySubmitEmail(); return; }
    paint();
  });
  ceEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); trySubmitEmail(); return; }
  });
  ceEl.addEventListener("focus", () => {
    const len = (ceEl.textContent || "").length;
    setSel(len, len);
    paint();
  });

  document.addEventListener("selectionchange", () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const a = sel.anchorNode, f = sel.focusNode;
    if (ceEl.contains(a) || ceEl.contains(f) || a === ceEl || f === ceEl) paint();
  });

  promptEl.appendChild(ceEl);
  if (typedEl) typedEl.style.display = "inline";
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
  try { inputEl.type = "text"; } catch(_) {}
  inputEl.setAttribute("inputmode","email");
  inputEl.setAttribute("autocomplete","email");
  inputEl.setAttribute("autocapitalize","off");
  inputEl.setAttribute("enterkeyhint","go");
  if (isIOSChrome) typedEl && (typedEl.style.display = "inline");
}

// ===== TERMINAL =====
function startTerminalSequence(){
  if (staticEl) staticEl.textContent = "REGISTRATION TERMINAL //";

  if (isAndroid && promptEl && !promptEl.classList.contains("show")) {
    promptEl.classList.add("show");
  }

  setTimeout(() => {
    typeWriter(" ENTER EMAIL FOR QUARTERLY GLITCH REPORT", typeEl, 50, () => {
      if (promptEl && !promptEl.classList.contains("show")) promptEl.classList.add("show");
      if (!isTouch) { inputEl && inputEl.focus(); }
      if (isTouch) enableMobileIME();
      if (!isAndroid) renderMirror();
    });
  }, 300);
}

// ===== PROMPT BINDINGS =====
function bindPrompt(){
  if (!inputEl) return;

  if (!isTouch) {
    try {
      inputEl.setAttribute("autocomplete", "off");
      inputEl.setAttribute("autocorrect", "off");
      inputEl.setAttribute("autocapitalize", "off");
    } catch (_) {}
  }

  // Desktop + iOS Safari mirror interactions
  if (!isTouch || (isIOS && !isIOSChrome)) {
    let dragging = false;
    let dragAnchorIdx = null;

    typedEl && typedEl.addEventListener("mousedown", (e) => {
      if (submittedUI) return;
      const i = indexFromPoint(e.clientX, e.clientY);
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
      const j = indexFromPoint(e.clientX, e.clientY);
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

  // iOS Chrome ONLY: Pointer Events with capture for single-finger highlight
  if (isIOSChrome && window.PointerEvent) {
    typedEl.style.touchAction = "none";
    promptEl.style.touchAction = "none";

    const getXY = (ev) => {
      if (ev.touches && ev.touches[0]) return [ev.touches[0].clientX, ev.touches[0].clientY];
      return [ev.clientX, ev.clientY];
    };

    let peDragging = false;
    let peAnchor = null;

    const peDown = (ev) => {
      if (submittedUI) return;
      if (ev.pointerType !== "touch" && ev.pointerType !== "pen") return;
      ensureIOSChromeCE();
      if (!ceEl) return;

      typedEl.setPointerCapture?.(ev.pointerId);
      peDragging = true;

      const [x, y] = getXY(ev);
      const i = indexFromPoint(x, y);
      peAnchor = i;

      ceEl._setSel?.(i, i);
      paintMirrorRange(ceEl.textContent || "", i, i);

      try { ceEl.focus(); } catch(_) {}
      focusWithKeyboard(ceEl, () => {});
      ev.preventDefault();
    };

    const peMove = (ev) => {
      if (!peDragging || peAnchor == null || !ceEl) return;
      const [x, y] = getXY(ev);
      const j = indexFromPoint(x, y);

      const a = Math.min(peAnchor, j);
      const b = Math.max(peAnchor, j) + 1; // inclusive end

      ceEl._setSel?.(a, b);
      paintMirrorRange(ceEl.textContent || "", a, b);
      ev.preventDefault();
    };

    const peUp = (ev) => {
      if (!peDragging) return;
      peDragging = false;
      peAnchor = null;
      typedEl.releasePointerCapture?.(ev.pointerId);
      ev.preventDefault();
    };

    // Allow tapping in whole prompt region with asymmetric vertical padding
    const regionDown = (ev) => {
      if (submittedUI) return;
      if (ev.pointerType !== "touch" && ev.pointerType !== "pen") return;
      ensureIOSChromeCE();
      if (!ceEl) return;

      const [x, y] = getXY(ev);
      const tr = typedEl.getBoundingClientRect();

      const V_PAD_TOP = 60;
      const V_PAD_BOTTOM = 140; // larger bottom pad for easier low touches
      const H_PAD = 40;

      if (y >= tr.top - V_PAD_TOP && y <= tr.bottom + V_PAD_BOTTOM &&
          x >= tr.left - H_PAD && x <= tr.right + H_PAD) {
        peDown(ev);
      } else if (x > tr.right + H_PAD) {
        // Tap far to the RIGHT of the text region → jump to END of whole string
        const raw = (ceEl.textContent || "");
        const len = raw.length;
        ceEl._setSel?.(len, len);
        paintMirrorRange(raw, len, len);
        try { ceEl.focus(); } catch(_) {}
        focusWithKeyboard(ceEl, () => {});
      } else {
        try { ceEl.focus(); } catch(_) {}
        focusWithKeyboard(ceEl, () => {});
      }
      ev.preventDefault();
    };

    // Bind pointer events
    typedEl.addEventListener("pointerdown", peDown, { passive: false });
    typedEl.addEventListener("pointermove", peMove, { passive: false });
    typedEl.addEventListener("pointerup",   peUp,   { passive: false });
    typedEl.addEventListener("pointercancel", peUp, { passive: false });

    promptEl.addEventListener("pointerdown", regionDown, { passive: false });
  }

  // iOS Safari (not Chrome): tap to focus the real input
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
    const isA = (e.key === "a" || e.key === "A");
    const withMeta = (e.metaKey || e.ctrlKey);
    if (!isA || !withMeta || lockedOutput || submittedUI) return;
    e.preventDefault();
    const len = (inputEl.value || "").length;
    try { inputEl.setSelectionRange(0, len); } catch(_) {}
    if (!(isAndroid || (isIOSChrome && iosChromeUsingCE))) renderMirror();
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
    typedEl.style.display = "inline";
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
    inputEl.value = (ceEl.textContent || "").replace(/\r?\n/g, "").trim();
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

  let hiddenBtn = mlForm.querySelector("#ml-hidden-submit");
  if (!hiddenBtn) {
    hiddenBtn = document.createElement("button");
    hiddenBtn.type = "submit";
    hiddenBtn.id = "ml-hidden-submit";
    hiddenBtn.style.display = "none";
    mlForm.appendChild(hiddenBtn);
  }

  if (!isAndroid) showGO(email);
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
    const base = mlForm.getAttribute("action");
    const cbName = "mlcb_" + Math.random().toString(36).slice(2);
    const url = `${base}?ml-submit=1&fields%5Bemail%5D=${encodeURIComponent(email)}&callback=${encodeURIComponent(cbName)}`;

    const cleanupJSONP = (script) => {
      try { delete window[cbName]; } catch(_) { window[cbName] = undefined; }
      if (script && script.parentNode) script.parentNode.removeChild(script);
    };

    const script = document.createElement("script");
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
  if (!isIOSChrome) requestAnimationFrame(caretRAF); // CE paints for iOS Chrome
  if (DIAG) console.info("[gate] diagnostics mode ON");
});
