(() => {
  // Add your shop items here
  const ITEMS = [
    { src: "shop/shessolucky.png", title: "She's So Lucky" }
    // Add more like:
    // { src: "shop/anotherpiece.png", title: "Another Piece" }
  ];

  const grid = document.getElementById('shopGrid');

  function makeItem(it) {
    const card = document.createElement('article');
    card.className = 'item';

    const img = document.createElement('img');
    img.src = it.src;
    img.alt = it.title || 'Shop item';
    img.loading = 'lazy';
    img.decoding = 'async';

    // Remove the card if the image fails to load
    img.addEventListener('error', () => card.remove(), { once: true });

    // Optional title/meta (hidden in CSS)
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = it.title || '';

    card.appendChild(img);
    card.appendChild(meta);
    return card;
  }

  function render() {
    if (!grid) return;
    ITEMS.forEach(it => grid.appendChild(makeItem(it)));
  }

  render();
})();

