// shop.js — Cafeteria grid

(() => {
  // Each item maps to a row in the CSV via UniqueID
  // id = UniqueID from your Google Sheet
  const ITEMS = [
    { id: "101", image: "shirt1.png", title: "Shirt 1", price: "$60" }, // Shirt 1 black
    { id: "102", image: "shirt1_white.png", title: "Shirt 1", price: "$60" }, // Shirt 1 white (if you want it visible separately)
    { id: "103", image: "shirt2.png", title: "Shirt 2", price: "$60" },
    { id: "104", image: "shirt3.png", title: "Shirt 3", price: "$60" },
    { id: "105", image: "shirt4.png", title: "Shirt 4", price: "$60" },
    { id: "106", image: "shirt5.png", title: "Shirt 5", price: "$60" },
    { id: "107", image: "shirt6.png", title: "Shirt 6", price: "$60" },
    { id: "108", image: "shirt7.png", title: "Shirt 7", price: "$60" },
    { id: "109", image: "shirt8.png", title: "Shirt 8", price: "$60" },
    { id: "110", image: "shirt9.png", title: "Shirt 9", price: "$60" }
  ];

  const grid = document.getElementById("shopGrid");

  function makeItem(it) {
    const card = document.createElement("article");
    card.className = "item";

    const img = document.createElement("img");
    img.src = "assets/shop/" + it.image;   // thumbnail image
    img.alt = it.title || it.image;
    img.loading = "lazy";
    img.decoding = "async";

    // Remove the card if the image fails to load
    img.addEventListener("error", () => card.remove(), { once: true });

    const meta = document.createElement("div");
    meta.className = "meta";

    const name = document.createElement("div");
    name.className = "meta-name";
    name.textContent = it.title || "";

    const price = document.createElement("div");
    price.className = "meta-price";
    price.textContent = it.price || "";

    meta.appendChild(name);
    meta.appendChild(price);
    card.appendChild(img);
    card.appendChild(meta);

    // Make the whole card clickable → product.html?id=101
    const targetUrl = "product.html?id=" + encodeURIComponent(it.id);
    card.style.cursor = "pointer";

    card.addEventListener("click", () => {
      window.location.href = targetUrl;
    });

    // Keyboard accessibility (Enter / Space)
    card.tabIndex = 0;
    card.addEventListener("keypress", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        window.location.href = targetUrl;
      }
    });

    return card;
  }

  function render() {
    if (!grid) return;
    ITEMS.forEach(it => grid.appendChild(makeItem(it)));
  }

  render();
})();
