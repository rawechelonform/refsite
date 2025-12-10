// product.js
// Single dynamic product page driven by REFsiteproductdescriptions.csv
// URL format: product.html?file=shirt1.png

(function () {
  const CSV_URL = "assets/productdescriptions/REFsiteproductdescriptions.csv";

  function getFileParam() {
    const params = new URLSearchParams(window.location.search);
    return params.get("file"); // e.g. "shirt1.png"
  }

  function parseCSV(text) {
    // Simple CSV parser (no quoted commas support – OK for your current sheet)
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

  function renderProduct(product, fileName) {
    const mainImg = document.getElementById("mainImage");
    const titleEl = document.getElementById("prodTitle");
    const priceEl = document.getElementById("prodPrice");
    const descEl  = document.getElementById("prodDesc");

    if (!product) {
      if (titleEl) titleEl.textContent = "Product not found";
      if (descEl)  descEl.textContent  = "Check the link or go back to the cafeteria.";
      if (mainImg) {
        mainImg.alt = "No product image";
        mainImg.style.display = "none";
      }
      return;
    }

    // Metadata from CSV
    const title = product["Title"] || fileName;
    const price = product["Price"] || "";
    const details = product["Details"] || "";

    if (titleEl) titleEl.textContent = title;
    if (priceEl) priceEl.textContent = price;
    if (descEl)  descEl.textContent  = details;

    // Use the File column to point to the main image (same as grid)
    // assets/shop/shirt1.png, etc.
    if (mainImg) {
      const imgPath = "assets/shop/" + fileName;
      mainImg.src = imgPath;
      mainImg.alt = title;
      mainImg.style.display = "block";
    }

    // If later you add more images per shirt, you can build thumbnails here
    // using a naming convention or extra CSV columns.
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

  document.addEventListener("DOMContentLoaded", init);
})();
