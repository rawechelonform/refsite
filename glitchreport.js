// ===== CONFIG =====
const TARGET     = "REF CORP";
const NEXT_URL   = "main.html";     // change later to your newsletter page if you want
const GO_HOLD_MS = 300;
const SPRITE_PATH= "avatar/avatar_intro.png";

// ===== ELEMENTS =====
const staticEl = document.getElementById("static-part");
const typeEl   = document.getElementById("typed-part");
const inputEl  = document.getElementById("cmd");
const typedEl  = document.getElementById("typed");
const hintEl   = document.getElementById("hint");
const figureEl = document.querySelector(".figure");
const promptEl = document.getElementById("prompt");

// ===== COPY =====
const STATIC_TEXT = "REGISTRATION TERMINAL //";
const TYPE_TEXT   = ' ENTER EMAIL FOR QUARTERLY GLITCH REPORT';

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
  const v   = raw.toUpperCase();
  let start = inputEl.selectionStart ?? v.length;
  let end   = inputEl.selectionEnd   ?? v.length;

  if (v.length > 0 && start === 0 && end === v.length){
    typedEl.innerHTML = v.split("").map(ch =>
      `<span class="cursor-sel" style="color:#000;-webkit-text-fill-color:#000">${escapeHTML(ch)}</span>`
    ).join("");
    return;
  }

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

  inputEl.addEventListener("keydown", (e) => {
    if(e.key !== "Enter") return;
    const value = (inputEl.value || "").trim().toUpperCase();
    if(value === TARGET){
      lockedOutput = true;
      typedEl.innerHTML = `REF CORP <span class="go-pill">&lt;GO&gt;</span>`;
      hintEl && (hintEl.textContent = "");
      setTimeout(() => { window.location.href = NEXT_URL; }, GO_HOLD_MS);
    } else {
      hintEl && (hintEl.innerHTML = "<em>denied.</em>");
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
