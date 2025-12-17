// product.js
// Dynamic product page driven by REFsiteproductdescriptions.csv
// URL format: product.html?id=101 (id = UniqueID column)

(function () {
  const CSV_URL    = "assets/productdescriptions/REFsiteproductdescriptions.csv";
  const IMAGE_BASE = "assets/shop/"; // Image1..Image7 live here

  function getIdParam() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
  }

  // ----- CSV helpers -----

  function splitCSVLine(line) {
    const out = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  }

  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (!lines.length) return [];

    const headers = splitCSVLine(lines[0]).map((h) => h.trim());

    return lines.slice(1).map((line) => {
      const cols = splitCSVLine(line);
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = (cols[i] || "").trim();
      });
      return obj;
    });
  }

  function isProductsRow(row) {
    const page = (row["Site Page"] || row["SitePage"] || "").trim().toLowerCase();
    return !page || page === "products";
  }

  function findProductById(rows, id) {
    if (!id) return null;
    const target = String(id).trim();
    return (
      rows.find(
        (r) =>
          isProductsRow(r) &&
          (r["UniqueID"] || "").trim() === target
      ) || null
    );
  }

  function findVariants(rows, product) {
    if (!product) return [];
    const key = (product["StyleCode"] || product["Title"] || "").trim();
    if (!key) return [];
    return rows.filter(
      (p) =>
        isProductsRow(p) &&
        (p["StyleCode"] || p["Title"] || "").trim() === key
    );
  }

  function collectImages(product) {
    if (!product) return [];
    const images = [];
    for (let i = 1; i <= 7; i++) {
      const key = "Image" + i;
      const val = (product[key] || "").trim();
      if (!val) continue;
      images.push(val);
    }
    return images;
  }

  // ----- Rendering -----

  function renderImages(files, title) {
    const stack = document.getElementById("imageStack");
    if (!stack) return;

    stack.innerHTML = "";
    if (!files || !files.length) return;

    files.forEach((fileName, idx) => {
      const img = document.createElement("img");
      img.src = IMAGE_BASE + fileName;
      img.alt = (title || fileName) + " view " + (idx + 1);
      img.loading = "lazy";
      img.decoding = "async";
      img.addEventListener("error", () => img.remove(), { once: true });
      stack.appendChild(img);
    });
  }

  // COLOR row – one chip per variant in StyleCode group
  function renderColorOptions(currentProduct, rows) {
    const row = document.getElementById("colorRow");
    if (!row || !currentProduct) return;

    const variants = findVariants(rows, currentProduct);
    if (!variants.length || variants.length === 1) {
      row.innerHTML = "";
      row.style.display = "none";
      return;
    }

    row.style.display = "flex";
    row.innerHTML = "";

    const currentId = (currentProduct["UniqueID"] || "").trim();

    variants.forEach((v) => {
      const variantId = (v["UniqueID"] || "").trim();
      const mainImage = (v["Image1"] || "").trim();
      if (!variantId) return;

      const colorDesc = v["ColorDescription"] || "";
      const rawCode   = (v["ColorCode"] || "").trim();
      const colorCode = rawCode.replace(/^#/, "");

      const a = document.createElement("a");
      a.href = `product.html?id=${encodeURIComponent(variantId)}`;
      a.className = "product-color-chip";
      a.title = colorDesc || mainImage || "";

      if (colorCode) {
        a.style.backgroundColor = `#${colorCode}`;
      }

      if (variantId === currentId) {
        a.classList.add("is-current");
        a.setAttribute("aria-current", "true");
      }

      row.appendChild(a);
    });
  }

  // sizes from separate columns S / M / L / XL / XXL
  function getAvailableSizes(product) {
    const sizeCols = ["S", "M", "L", "XL", "XXL"];
    const available = new Set();

    sizeCols.forEach((col) => {
      const val = (product[col] || "").trim().toLowerCase();
      // any non-empty marker = available
      if (val) {
        available.add(col);
      }
    });

    return available;
  }

  function renderSizeOptions(product) {
    const row = document.getElementById("sizeRow");
    if (!row || !product) return;

    const available = getAvailableSizes(product);
    const ALL_SIZES = ["S", "M", "L", "XL", "XXL"];

    row.innerHTML = "";

    ALL_SIZES.forEach((size) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "product-size-pill";
      btn.textContent = size;
      btn.dataset.size = size;

      if (!available.has(size)) {
        btn.disabled = true;
        btn.classList.add("is-disabled");
      } else {
        btn.addEventListener("click", () => {
          document
            .querySelectorAll(".product-size-pill.is-selected")
            .forEach((b) => b.classList.remove("is-selected"));
          btn.classList.add("is-selected");
        });
      }

      row.appendChild(btn);
    });
  }

  // Add to Cart button behaviour
  function setupAddToCart(product) {
    const btn = document.querySelector(".buy-button");
    if (!btn || !product) return;

    const errorEl = document.getElementById("productError");

    btn.addEventListener("click", () => {
      const selected = document.querySelector(".product-size-pill.is-selected");
      const size = selected ? selected.dataset.size : "";

      if (!size) {
        if (errorEl) errorEl.textContent = "please choose a size.";
        return;
      }
      if (errorEl) errorEl.textContent = "";

      const priceId      = product["StripePriceId"] || "";
      const displayPrice = product["Price"] || "";
      const title        = product["Title"] || "";
      const mainImage    = product["Image1"] || "";
      const color        = product["ColorDescription"] || "";
      const colorCode    = product["ColorCode"] || "";
      const uniqueId     = product["UniqueID"] || "";

      const newItem = {
        id: uniqueId,
        priceId,
        title,
        displayPrice,
        file: mainImage,
        size,
        color,
        colorCode,
        quantity: 1
      };

      let cart;
      try {
        cart = JSON.parse(localStorage.getItem("ref_cart") || "[]");
        if (!Array.isArray(cart)) cart = [];
      } catch {
        cart = [];
      }

      const existing = cart.find(
        (item) =>
          item.priceId === newItem.priceId &&
          item.size === newItem.size &&
          (item.color || "") === (newItem.color || "")
      );

      if (existing) {
        existing.quantity = (existing.quantity || 1) + 1;
      } else {
        cart.push(newItem);
      }

      localStorage.setItem("ref_cart", JSON.stringify(cart));

      btn.classList.add("is-success");
      setTimeout(() => btn.classList.remove("is-success"), 600);

      if (window.refCart) {
        if (typeof window.refCart.render === "function") {
          window.refCart.render();           // refresh contents
        }
        if (typeof window.refCart.openPanelTemporarily === "function") {
          window.refCart.openPanelTemporarily(3000); // 3s
        }
      }
    });
  }

  // DETAILS toggle with smooth open/close
  function setupDetails(detailsText) {
    const toggle = document.getElementById("detailsToggle");
    const body   = document.getElementById("detailsBody");
    if (!toggle || !body) return;

    body.textContent = detailsText || "";
    body.style.maxHeight = "0px";

    toggle.addEventListener("click", () => {
      const isOpen = body.classList.contains("is-open");

      if (isOpen) {
        const currentHeight = body.scrollHeight;
        body.style.maxHeight = currentHeight + "px";
        requestAnimationFrame(() => {
          body.classList.remove("is-open");
          body.style.maxHeight = "0px";
        });
      } else {
        body.classList.add("is-open");
        const targetHeight = body.scrollHeight;
        body.style.maxHeight = targetHeight + "px";
        body.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    });
  }

  function renderProduct(product, id, rows) {
    const titleEl     = document.getElementById("prodTitle");
    const priceEl     = document.getElementById("prodPrice");
    const colorLabelEl = document.getElementById("colorLabel");

    if (!product) {
      if (titleEl) titleEl.textContent = "PRODUCT NOT FOUND";
      if (priceEl) priceEl.textContent = "";
      if (colorLabelEl) colorLabelEl.textContent = "COLOR";
      renderImages([], "");
      setupDetails("");
      return;
    }

    const title     = product["Title"]   || id || "Product";
    const price     = product["Price"]   || "";
    const details   = product["Details"] || "";
    const colorName = product["ColorDescription"] || "";

    if (titleEl) titleEl.textContent = title;
    if (priceEl) priceEl.textContent = price;

    if (colorLabelEl) {
      colorLabelEl.textContent = colorName
        ? `COLOR — ${colorName}`
        : "COLOR";
    }

    const images = collectImages(product);
    renderImages(images, title);
    renderColorOptions(product, rows);
    renderSizeOptions(product);
    setupAddToCart(product);
    setupDetails(details);
  }

  // ----- Init -----

  function init() {
    const id = getIdParam();
    if (!id) {
      renderProduct(null, "", []);
      return;
    }

    fetch(CSV_URL, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load CSV");
        return res.text();
      })
      .then((text) => {
        const rows = parseCSV(text);
        const product = findProductById(rows, id);
        renderProduct(product, id, rows);
      })
      .catch((err) => {
        console.error("Error loading product data:", err);
        renderProduct(null, id, []);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
