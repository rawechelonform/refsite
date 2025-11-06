// ===== CONFIG =====
const NEXT_URL = "artist.html?registration=complete";   // internal continue page
const GO_HOLD_MS  = 600;                                 // delay before auto-continue
const SPRITE_PATH = "avatar/avatar_intro.png";

// ===== ELEMENTS =====
const staticEl = document.getElementById("static-part");
const typeEl   = document.getElementById("typed-part");
const inputEl  = document.getElementById("cmd");
const typedEl  = document.getElementById("typed");
const hintEl   = document.getElementById("hint");
const figureEl = document.querySelector(".figure");
const promptEl = document.getElementById("prompt");

const mlForm    = document.getElementById("ml-form");
const mlEmail   = document.getElementById("ml-email");
const mlIframe  = document.getElementById("ml_iframe");
const successUI = document.getElementById("success-ui");
const continueLink = document.getElementById("continue-link");

// ===== COPY =====
const STATIC_TEXT = "REGISTRATION TERMINAL //";
const TYPE_TEXT   = " ENTER EMAIL FOR QUARTERLY GLITCH REPORT";

// ===== STATE =====
let terminalStarted = false;
let lockedOutput    = false;

// ===== HELPERS =====
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

// ===== TERMINAL =====
function startTerminalSequence(){
  if(terminalStarted) return;
  terminalStarted = true;
  staticEl && (staticEl.textContent = STATIC_TEXT);
  setTimeout(() => {
    typeWriter(TYPE_TEXT, typeEl, 50, () => {
      if (promptEl) {
        promptEl.classList.add("show");
        inputEl && inputEl.focus();
        renderMirror();
      }
    });
  }, 300);
}

function renderMirror(){
  if(lockedOutput) return;
  if(!typedEl || !inputEl) return;

  const raw = inputEl.value || "";
  let start = inputEl.selectionStart ?? raw.length;
  let end   = inputEl.selectionEnd   ?? raw.length;

  if (raw.length > 0 && start === 0 && end === raw.length){
    typedEl.innerHTML = raw.split("").map(ch =>
      `<span class="cursor-sel" style="-webkit-text-fill-color:#000">${escapeHTML(ch)}</span>`
    ).join("");
    return;
  }

  const idx = Math.min(Math.max(0, start), raw.length);
  const ch  = raw.slice(idx, idx + 1);
  const before = escapeHTML(raw.slice(0, idx));
  const at     = ch ? escapeHTML(ch) : "&nbsp;";
  const after  = escapeHTML(raw.slice(idx + (ch ? 1 : 0)));
  typedEl.innerHTML = before + `<span class="cursor-block">${at}</span>` + after;
}

function bindPrompt(){
  if(!inputEl || !typedEl) return;

  typedEl.parentElement.addEventListener("click", () => inputEl.focus());
  ["input","focus","blur","keyup","click"].forEach(evt =>
    inputEl.addEventListener(evt, renderMirror)
  );

  document.addEventListener("selectionchange", () => {
    if(document.activeElement === inputEl) renderMirror();
  });

  // Cmd/Ctrl+A → select all in input so CRT mirror shows selection block
  document.addEventListener("keydown", (e) => {
    const isA = (e.key === 'a' || e.key === 'A');
    const withMeta = (e.metaKey || e.ctrlKey);
    if (!isA || !withMeta) return;
    e.preventDefault();
    inputEl.focus();
    const len = (inputEl.value || "").length;
    try { inputEl.setSelectionRange(0, len); } catch(_) {}
    renderMirror();
  }, true);

  // Submit on Enter (stay on page; rely on hidden iframe load)
  inputEl.addEventListener("keydown", (e) => {
    if(e.key !== "Enter") return;

    const email = (inputEl.value || "").trim();

    // INVALID → show "denied."
    if(!isValidEmail(email)){
      hintEl && (hintEl.innerHTML = "<em>denied.</em>");
      return;
    }

    // VALID → lock UI, mirror OK, submit hidden form
    lockedOutput = true;
    inputEl.setAttribute("disabled", "disabled");
    typedEl.innerHTML = `${escapeHTML(email)} <span class="go-pill">&lt;GO&gt;</span>`;
    hintEl && (hintEl.textContent = "");

    if (mlForm && mlEmail){
      mlEmail.value = email.toLowerCase();

      // --- stay on page: detect result via hidden iframe load/timeout ---
      let done = false;

      const CLEANUP = () => {
        if (!mlIframe) return;
        mlIframe.removeEventListener("load", onLoad);
      };

      const onLoad = () => {
        if (done) return;
        done = true;
        CLEANUP();

        // show in-page success UI
        if (successUI) successUI.classList.remove("hidden");

        // Optional: auto-continue internally after a short beat
        if (NEXT_URL) {
          setTimeout(() => { window.location.href = NEXT_URL; }, GO_HOLD_MS);
        }
      };

      const onTimeout = () => {
        if (done) return;
        done = true;
        CLEANUP();

        // treat as failure; restore input and show a hint
        inputEl.removeAttribute("disabled");
        lockedOutput = false;
        hintEl && (hintEl.textContent = "hmm… couldn’t reach mail server. try again?");
        renderMirror();
      };

      if (mlIframe) {
        mlIframe.addEventListener("load", onLoad, { once: true });
        // give MailerLite a reasonable window to respond
        setTimeout(onTimeout, 8000);
      } else {
        // no iframe? consider this a failure path
        setTimeout(onTimeout, 0);
      }

      try { mlForm.submit(); } catch(_) {
        // submit blew up synchronously – fail fast
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
});
