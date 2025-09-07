// Config
const TARGET   = "REF CORP";
const NEXT_URL = "main.html";

// Elements
const staticEl  = document.getElementById("static-part");
const typeEl    = document.getElementById("typed-part");
const inputEl   = document.getElementById("cmd");
const mirrorEl  = document.getElementById("typed");
const cursorEl  = document.querySelector(".cursor-block");
const hintEl    = document.getElementById("hint");
const figureEl  = document.querySelector(".figure");
const promptEl  = document.querySelector(".prompt");

// Messages
const STATIC_TEXT = "ACCESS GATE //";
const TYPE_TEXT   = ' TYPE "REF CORP" + PRESS ENTER';

let terminalStarted = false;

/* --- Typewriter --- */
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

function startTerminalSequence(){
  if(terminalStarted) return;
  terminalStarted = true;
  if(staticEl) staticEl.textContent = STATIC_TEXT;
  setTimeout(() => {
    if(typeEl){
      typeWriter(TYPE_TEXT, typeEl, 50, () => {
        if(promptEl) promptEl.classList.add("show");
        if(inputEl) inputEl.focus();
      });
    }else{
      if(promptEl) promptEl.classList.add("show");
      if(inputEl) inputEl.focus();
    }
  }, 300);
}

/* --- Ensure sprite really loads; if not, force the fallback path into the CSS var --- */
function preload(url){
  return new Promise(res => {
    const img = new Image();
    img.onload  = () => res(true);
    img.onerror = () => res(false);
    img.src = url + "?" + Date.now();
  });
}

async function ensureSprite(){
  const style = getComputedStyle(figureEl);
  let bg = style.backgroundImage;         // may look like: url("blob1"), url("avatar/avatar_intro.png")
  if(bg && bg !== "none"){
    // extract last url(...) from multi-background
    const urls = [...bg.matchAll(/url\(([^)]+)\)/g)].map(m => m[1].replace(/^["']|["']$/g, ""));
    const last = urls[urls.length - 1]; // the fallback we declared in CSS
    const ok = await preload(last);
    if(!ok){
      // if fallback didn't load, try common alternates then override var
      const candidates = [
        "avatar/avatar_intro.png",
        "./avatar/avatar_intro.png",
        "../avatar/avatar_intro.png",
        "avatar/avatar_walkingforward.png",
        "avatar/avatar_standing.png"
      ];
      for(const p of candidates){
        // eslint-disable-next-line no-await-in-loop
        if(await preload(p)){
          document.documentElement.style.setProperty("--avatar-url", `url("${p}")`);
          hintEl && (hintEl.textContent = "");
          return;
        }
      }
      hintEl && (hintEl.textContent = "avatar not found — check that /avatar/avatar_intro.png is deployed next to index.html");
    }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if(figureEl){
    await ensureSprite();

    // reset classes
    figureEl.classList.remove("forward","walking");
    // start walking
    figureEl.classList.add("walking");

    // on slide-in end: set forward pose first, then stop walking
    figureEl.addEventListener("animationend", (e) => {
      if(e.animationName !== "walk-in") return;
      figureEl.classList.add("forward");     // keep final frame & position
      figureEl.classList.remove("walking");  // stop animations
      startTerminalSequence();
    }, { once:true });
  }else{
    startTerminalSequence();
  }

  // Prompt wiring
  if(inputEl && mirrorEl){
    inputEl.addEventListener("input", () => {
      const val = inputEl.value.toUpperCase();
      inputEl.value = val;
      mirrorEl.textContent = val;
    });
    window.addEventListener("load", () => { inputEl.blur(); });
    inputEl.addEventListener("keydown", (e) => {
      if(e.key !== "Enter") return;
      const value = inputEl.value.trim().toUpperCase();
      if(value === TARGET){
        mirrorEl.textContent = "REF CORP <GO>";
        cursorEl && cursorEl.remove();
        hintEl && (hintEl.textContent = "");
        setTimeout(() => { window.location.href = NEXT_URL; }, 400);
      }else{
        hintEl && (hintEl.innerHTML = "<em>denied.</em>");
        inputEl.select();
      }
    });
  }
});
