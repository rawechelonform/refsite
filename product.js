// product.js
// Dynamic product page driven by REFsiteproductdescriptions.csv
// URL format: product.html?file=shirt1.png

(function () {
  const CSV_URL = "assets/productdescriptions/REFsiteproductdescriptions.csv";

  // keep track of whichever product is currently shown
  let currentProduct = null;
  let currentFileName = null;

  function getFileParam() {
    const params = new URLSearchParams(window.location.search);
    return params.get("file"); // e.g. "shirt1.png"
  }

  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (!lines.length) return [];

    const headers = lines[0].split(",").map(h => h.trim());
    return lines.slice(1).map(line => {
      const cols = line.split(",");
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = (cols[i] || "").trim();
      });
      return obj;
    });
  }

  function findProduct(rows, fileName) {
    return rows.find(
      r => r["File"] === fileName && (!r["Site Page"] || r["Site Page"] === "products")
    );
  }

  // Build the vertical image stack for a product
  function renderImages(fileName, title) {
    const stack = document.getElementById("imageStack");
    if (!stack) return;

    stack.innerHTML = "";

    if (!fileName) return;

    const base = fileName.replace(/\.[^.]+$/, ""); // "shirt1"
    const images = [];

    // 1) main grid image: assets/shop/shirt1.png
    images.push(`assets/shop/${fileName}`);

    // 2) additional detail images:
    //    assets/shop/products/shirt1/shirt1a.png, b, c, d, e, f
    const suffixes = ["a", "b", "c", "d", "e", "f"];
    suffixes.forEach(suf => {
      images.push(`assets/shop/products/${base}/${base}${suf}.png`);
    });

    images.forEach((src, idx) => {
      const img = document.createElement("img");
      img.src = src;
      img.alt = (title || base) + " view " + (idx + 1);

      // If an image doesn't exist, just remove it
      img.addEventListener("error", () => img.remove(), { once: true });

      stack.appendChild(img);
    });
  }

  function renderProduct(product, fileName) {
    const titleEl = document.getElementById("prodTitle");
    const priceEl = document.getElementById("prodPrice");
    const descEl  = document.getElementById("prodDesc");
    const buyBtn  = document.querySelector(".buy-button");

    currentFileName = fileName || null;
    currentProduct = product || null;

    if (!product) {
      const fallbackTitle = fileName || "Product";
      if (titleEl) titleEl.textContent = "Product not found";
      if (descEl)  descEl.textContent  = "Check the link or go back to the cafeteria.";
      if (priceEl) priceEl.textContent = "";
      if (buyBtn)  buyBtn.disabled = true;
      renderImages(fileName || "", fallbackTitle);
      return;
    }

    const title         = product["Title"]          || fileName;
    const price         = product["Price"]          || "";
    const details       = product["Details"]        || "";
    const stripePriceId = product["StripePriceId"]  || "";

    if (titleEl) titleEl.textContent = title;
    if (priceEl) priceEl.textContent = price;
    if (descEl)  descEl.textContent  = details;

    if (buyBtn) {
      buyBtn.disabled = !stripePriceId;          // disable if no Stripe price configured
      buyBtn.dataset.priceId = stripePriceId;    // store priceId on the button for later
    }

    renderImages(fileName, title);
  }

  function init() {
    const fileName = getFileParam();
    if (!fileName) {
      renderProduct(null, "");
      return;
    }

    fetch(CSV_URL, { cache: "no-store" })
      .then(res => {
        if (!res.ok) throw new Error("Failed to load CSV");
        return res.text();
      })
      .then(text => {
        const rows = parseCSV(text);
        const product = findProduct(rows, fileName);
        renderProduct(product, fileName);
      })
      .catch(err => {
        console.error("Error loading product data:", err);
        renderProduct(null, fileName);
      });
  }

  // =========================
  // SIMPLE CART (localStorage)
  // =========================

  function loadCart() {
    try {
      return JSON.parse(localStorage.getItem("ref_cart") || "[]");
    } catch {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem("ref_cart", JSON.stringify(cart));
  }

  function addCurrentProductToCart() {
    if (!currentProduct) return;

    const buyBtn = document.querySelector(".buy-button");
    if (!buyBtn) return;

    const priceId = buyBtn.dataset.priceId;
    if (!priceId) {
      alert("This product is not ready for checkout yet.");
      return;
    }

    const title        = currentProduct["Title"]   || currentFileName || "Shirt";
    const displayPrice = currentProduct["Price"]   || "";
    const file         = currentFileName;

    const cart = loadCart();

    // If this price already exists in cart, just bump quantity
    const existing = cart.find(item => item.priceId === priceId);
    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({
        priceId,
        title,
        displayPrice,
        file,
        quantity: 1,
      });
    }

    saveCart(cart);

    // Small visual confirmation
    buyBtn.textContent = "added ✓";
    setTimeout(() => {
      buyBtn.textContent = "add to cart";
    }, 1200);
  }

  // DOM ready hook
  document.addEventListener("DOMContentLoaded", () => {
    init();

    const buyBtn = document.querySelector(".buy-button");
    if (buyBtn) {
      buyBtn.addEventListener("click", addCurrentProductToCart);
    }
  });
})();
