(function () {
  const el = document.getElementById('type-title');
  if (!el) return;

  const TEXT = 'RAW ECHELON FORM';  // all uppercase
  const TYPE_DELAY = 70;            // ms between letters
  const BLINK_PERIOD = 600;         // must match CSS cursor blink timing
  const BLINKS_AFTER_RAW = 1.5;       // number of blinks after "RAW"
  const BLINKS_AT_END = 2;          // number of blinks after the whole text

  // pause points → indexes in TEXT where we want pauses
  // we want a pause after "RAW" (index 3), not after the space
  const PAUSE_POINTS = new Map([
    [3, BLINKS_AFTER_RAW],           // after "RAW"
    [TEXT.length, BLINKS_AT_END]     // after the full text
  ]);

  let i = 0;        // index of next char to type
  let typed = '';

  const esc = (s) => s.replace(/[&<>"]/g, m => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]
  ));

  function renderFrame(nextCharShown) {
    if (i < TEXT.length && nextCharShown) {
      el.innerHTML = esc(typed) + `<span class="cursor-block">${esc(TEXT[i])}</span>`;
    } else if (i < TEXT.length) {
      el.innerHTML = esc(typed) + `<span class="cursor-block">&nbsp;</span>`;
    } else {
      // at the end: keep cursor visible until final blinks are done
      el.innerHTML = esc(typed) + `<span class="cursor-block">&nbsp;</span>`;
    }
  }

  function pauseThen(next, blinks, isFinal=false) {
    let count = 0;
    const cursor = el.querySelector('.cursor-block');
    if (!cursor) return;

    cursor.classList.add('cursor-pause');

    const interval = setInterval(() => {
      count++;
      if (count >= blinks) {
        clearInterval(interval);
        cursor.classList.remove('cursor-pause');

        if (isFinal) {
          // remove cursor completely after final pause
          cursor.remove();
          return;
        }

        next();
      }
    }, BLINK_PERIOD);
  }

  function step() {
    if (i >= TEXT.length) return;

    renderFrame(true);

    setTimeout(() => {
      typed += TEXT[i];
      i++;
      renderFrame(false);

      if (PAUSE_POINTS.has(i)) {
        const blinks = PAUSE_POINTS.get(i);
        const isFinal = (i === TEXT.length);
        pauseThen(step, blinks, isFinal);
      } else {
        setTimeout(step, TYPE_DELAY);
      }
    }, TYPE_DELAY);
  }

  renderFrame(false);
  step();
})();
