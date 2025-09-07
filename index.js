// ===== CONFIG =====
const TARGET     = "REF CORP";
const NEXT_URL   = "main.html";
const GO_HOLD_MS = 300; // your chosen delay
const SPRITE_PATH = "avatar/avatar_intro.png"; // exact relative path you confirmed

// ===== ELEMENTS =====
const staticEl  = document.getElementById("static-part");
const typeEl    = document.getElementById("typed-part");
const inputEl   = document.getElementById("cmd");
const typedEl   = document.getElementById("typed");
const hintEl    = document.getElementById("hint");
const figureEl  = document.querySelector(".figure");
const promptEl  = document.querySelector(".prompt");

// ===== COPY =====
const STATIC_TEXT = "ACCESS GATE //";
const TYPE_TEXT   = ' TYPE "REF CORP" + PRESS ENTER';

// ===== STATE =====
let terminalStarted = false;
let lockedOutput    = false; // once Enter with TARGET is pressed, freeze output (no cursor)

// ===== HELPERS =====
function typeWriter(text, el, speed = 40, done){
  let i = 0;
  if(!el){ done && done(); return; }
  el.textContent = "";
  (function step(){
    if(i <= text.length){
      el.textContent = text.slice(0, i++);
      setTimeout(step, speed);
    }else{
      done && done();
    }
  })();
}

function escapeHTML(s){
  return String(s).replace(/[&<>"']/g, c =>
    c === '&' ? '&amp;'
      : c === '<' ? '&lt;'
      : c === '>' ? '&gt;'
      : c === '"' ? '&quot;'
      : '&#39;'
  );
}

// ===== TERMINAL SEQUENCE =====
function startTerminalSequence(){
  if(terminalStarted) return;
  terminalStarted = true;
  if(staticEl) staticEl.textContent = STATIC_TEXT;

  setTimeout(() => {
    if(typeEl){
      typeWriter(TYPE_TEXT, typeEl, 50, () => {
        promptEl && promptEl.classList.add("show");
        inputEl && inputEl.focus();
        renderMirror();
      });
    } else {
      promptEl && promptEl.classList.add("show");
      inputEl && inputEl.focus();
      renderMirror();
    }
  }, 300);
}

// ===== MIRROR RENDERING (caret + Cmd/Ctrl-A) =====
function renderMirror(){
  if(lockedOutput) return;           // once locked, never draw a cursor again
  if(!typedEl || !inputEl) return;

  const raw = inputEl.value || "";
  const v   = raw.toUpperCase();

  let start = inputEl.selectionStart;
  let end   = inputEl.selectionEnd;
  if(start == null || end == null){ start = end = v.length; }

  // Full-selection (Cmd/Ctrl-A): render each glyph with inline black text
  if(v.length > 0 && start === 0 && end === v.length){
    typedEl.innerHTML = v.split("").map(ch =>
      `<span class="cursor-sel" style="background:rgb(0,255,0);color:#000;-webkit-text-fill-color:#000">${escapeHTML(ch)}</span>`
    ).join("");
    return;
  }

  // Single caret block (CSS anim handles flip between green/black states)
  const idx = Math.min(Math.max(0, start), v.length);
  const ch  = v.slice(idx, idx + 1);

  const before = escapeHTML(v.slice(0, idx));
  const at     = ch ? escapeHTML(ch) : "&nbsp;";
  const after  = escapeHTML(v.slice(idx + (ch ? 1 : 0)));

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

  // Enter submits
  inputEl.addEventListener("keydown", (e) => {
    if(e.key !== "Enter") return;

    const value = (inputEl.value || "").trim().toUpperCase();
    if(value === TARGET){
      // Freeze output: no further cursor renders
      lockedOutput = true;

      // Show: REF CORP <GO> (green text on black; no cursor)
      typedEl.innerHTML = `REF CORP <span class="go-pill">&lt;GO&gt;</span>`;
      hintEl && (hintEl.textContent = "");

      // Brief hold, then navigate
      setTimeout(() => { window.location.href = NEXT_URL; }, GO_HOLD_MS);
    } else {
      hintEl && (hintEl.innerHTML = "<em>denied.</em>");
    }
  });
}

// ===== AVATAR: force sprite inline so it always shows =====
function startAvatar(){
  if(!figureEl){
    startTerminalSequence();
    return;
  }

  // Preload and then apply
  const img = new Image();
  img.onload = () => {
    // Set inline background-image so CSS cascade can’t break it
    figureEl.style.backgroundImage = `url("${SPRITE_PATH}")`;

    figureEl.classList.remove("forward","walking");
    figureEl.classList.add("walking");

    figureEl.addEventListener("animationend", (e) => {
      if(e.animationName !== "walk-in") return;
      figureEl.classList.add("forward");     // keep landed position & frame
      figureEl.classList.remove("walking");  // stop animations
      startTerminalSequence();
    }, { once:true });
  };
  img.onerror = () => {
    if(hintEl) hintEl.textContent = "sprite not found at avatar/avatar_intro.png";
    // still start terminal so the page isn't stuck
    startTerminalSequence();
  };
  img.src = SPRITE_PATH + "?" + Date.now(); // cache-bust
}

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
  startAvatar();
  bindPrompt();
});
