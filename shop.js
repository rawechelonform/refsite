(() => {
  const ITEMS = [
    { src: "assets/shop/shirt1.png", title: "Shirt 1", price: "$60" },
    { src: "assets/shop/shirt2.png", title: "Shirt 2", price: "$60" },
    { src: "assets/shop/shirt3.png", title: "Shirt 3", price: "$60" },
    { src: "assets/shop/shirt4.png", title: "Shirt 4", price: "$60" },
    { src: "assets/shop/shirt5.png", title: "Shirt 5", price: "$60" },
    { src: "assets/shop/shirt6.png", title: "Shirt 6", price: "$60" },
    { src: "assets/shop/shirt7.png", title: "Shirt 7", price: "$60" },
    { src: "assets/shop/shirt8.png", title: "Shirt 8", price: "$60" },
    { src: "assets/shop/shirt9.png", title: "Shirt 9", price: "$60" }
  ];

  const grid = document.getElementById("shopGrid");

  function makeItem(it) {
    const card = document.createElement("article");
    card.className = "item";

    const img = document.createElement("img");
    img.src = it.src;
    img.alt = it.title;
    img.loading = "lazy";

    img.addEventListener("error", () => card.remove(), { once: true });

    const meta = document.createElement("div");
    meta.className = "meta";

    const name = document.createElement("div");
    name.className = "meta-name";
    name.textContent = it.title;

    const price = document.createElement("div");
    price.className = "meta-price";
    price.textContent = it.price;

    meta.appendChild(name);
    meta.appendChild(price);

    card.appendChild(img);
    card.appendChild(meta);

    return card;
  }

  function render() {
    ITEMS.forEach(it => grid.appendChild(makeItem(it)));
  }

  render();
})();
