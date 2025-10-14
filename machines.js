(() => {
  // Images in homeroom/machines — order: BBG, Tonic, Commodore
  const IMAGES = [
    { src: "homeroom/machines/bbgterminal.png",       title: "BBG Terminal",   caption: "" },
    { src: "homeroom/machines/tonic.png", title: "Tonic Operator", caption: "" },
    { src: "homeroom/machines/commodore.png",     title: "Commodore",      caption: "" }
  ];

  const colEls = [
    document.getElementById('col1'),
    document.getElementById('col2'),
    document.getElementById('col3')
  ];

  // Lightbox (click backdrop or press Esc to close)
  function ensureLightbox() {
    let root = document.querySelector('.lightbox');
    if (root) return root;
    root = document.createElement('div');
    root.className = 'lightbox';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.innerHTML = `
      <div class="backdrop" data-close></div>
      <div class="frame" aria-live="polite">
        <img alt="" />
      </div>`;
    document.body.appendChild(root);
    root.addEventListener('click', (e) => { if (e.target.matches('[data-close]')) closeLightbox(); });
    window.addEventListener('keydown', (e) => { if (root.classList.contains('open') && e.key === 'Escape') closeLightbox(); });
    return root;
  }

  function openLightbox(src, alt) {
    const lb = ensureLightbox();
    const img = lb.querySelector('img');
    img.src = src;
    img.alt = alt || "";
    lb.classList.add('open');
  }
  function closeLightbox() {
    const lb = ensureLightbox();
    lb.classList.remove('open');
  }

  function makeCard(item){
    const card = document.createElement('article');
    card.className = 'card';
    card.tabIndex = 0;

    const img = document.createElement('img');
    img.alt = item.title || '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = item.src;

    // If an image fails to load, remove the card so layout stays clean
    img.addEventListener('error', () => { card.remove(); }, { once: true });

    // Green hover tint with centered title
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = item.title || '';
    overlay.appendChild(label);

    // Click to open lightbox
    const open = () => openLightbox(item.src, item.title);
    img.addEventListener('click', open);
    card.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });

    card.appendChild(img);
    card.appendChild(overlay);
    return card;
  }

  function render(){
    if (!colEls.every(Boolean)) return;
    IMAGES.forEach((it, i) => {
      const col = colEls[i % 3];
      col.appendChild(makeCard(it));
    });
  }

  render();
})();
