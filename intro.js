// Where to go after correct entry
const NEXT_URL = "main.html";
const TARGET   = "REF CORP";

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

// Guards
let terminalStarted = false;

// Simple typewriter
function typeWriter(text, el, speed = 40, done) {
  let i = 0;
  el.textContent = "";
  function step() {
    if (i <= text.length) {
      el.textContent = text.slice(0, i);
      i++;
      setTimeout(step, speed);
    } else if (done) {
      done();
    }
  }
  step();
}

function startTerminalSequence() {
  if (terminalStarted) return;
  terminalStarted = true;

  if (staticEl) staticEl.textContent = STATIC_TEXT;

  setTimeout(() => {
    typeWriter(TYPE_TEXT, typeEl, 50, () => {
      if (promptEl) promptEl.classList.add("show"); // shows caret + input
      if (inputEl) inputEl.focus();
    });
  }, 300);
}

document.addEventListener("DOMContentLoaded", () => {
  // === AVATAR: walk in, then hold forward ===
  if (figureEl) {
    // clear any stale classes
    figureEl.classList.remove("forward", "walking");

    // start walking (legs cycle while sliding in)
    figureEl.classList.add("walking");

    // when slide-in finishes, stop on frame 3, then start terminal
    figureEl.addEventListener(
      "animationend",
      (e) => {
        if (e.animationName !== "walk-in") return; // ignore leg-cycle iterations
        figureEl.classList.remove("walking");       // stop both animations
        figureEl.classList.add("forward");          // face forward (frame 3)
        startTerminalSequence();
      },
      { once: true }
    );
  } else {
    // no avatar: start terminal immediately
    startTerminalSequence();
  }

  // === PROMPT: typing / mirror / submit ===
  if (inputEl && mirrorEl) {
    // mirror typing, uppercase
    inputEl.addEventListener("input", () => {
      const val = inputEl.value.toUpperCase();
      inputEl.value = val;
      mirrorEl.textContent = val;
    });

    // keep caret hidden before prompt
    window.addEventListener("load", () => {
      inputEl.blur();
    });

    // Enter handler
    inputEl.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;

      const value = inputEl.value.trim().toUpperCase();
      if (value === TARGET) {
        mirrorEl.textContent = "REF CORP <GO>";
        if (cursorEl) cursorEl.remove();
        if (hintEl) hintEl.textContent = "";
        setTimeout(() => { window.location.href = NEXT_URL; }, 400);
      } else {
        if (hintEl) hintEl.innerHTML = "<em>denied.</em>";
        inputEl.select();
      }
    });
  }
});
