// checkout.js — render checkout summary from localStorage "ref_cart"

(() => {
  const STORAGE_KEY = "ref_cart";
  const IMAGE_BASE  = "assets/shop/";

  const itemsEl    = document.getElementById("checkoutItems");
  const emptyEl    = document.getElementById("checkoutEmpty");
  const subtotalEl = document.getElementById("checkoutSubtotal");
  const totalEl    = document.getElementById("checkoutTotal");
  const payBtn     = document.getElementById("checkoutPayBtn");
  const noteEl     = document.getElementById("checkoutNote");

  function readCart() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function parsePrice(str) {
    if (!str) return 0;
    const n = parseFloat(String(str).replace(/[^0-9.]+/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function formatPrice(n) {
    return "$" + n.toFixed(2);
  }

  function renderItem(item) {
    const row = document.createElement("div");
    row.className = "checkout-item";

    // thumb
    const thumbWrap = document.createElement("div");
    thumbWrap.className = "checkout-thumb-wrap";

    if (item.file) {
      const img = document.createElement("img");
      img.className = "checkout-thumb";
      img.src = IMAGE_BASE + item.file;
      img.alt = item.title || "";
      img.loading = "lazy";
      img.decoding = "async";
      img.addEventListener("error", () => img.remove(), { once: true });
      thumbWrap.appendChild(img);
    }

    // meta
    const meta = document.createElement("div");
    meta.className = "checkout-meta";

    const titleEl = document.createElement("div");
    titleEl.className = "checkout-meta-title";
    titleEl.textContent = item.title || "";

    const sub = document.createElement("div");
    sub.className = "checkout-meta-sub";

    if (item.color) {
      const colorSpan = document.createElement("span");
      colorSpan.textContent = item.color;
      sub.appendChild(colorSpan);
    }
    if (item.size) {
      const sizeSpan = document.createElement("span");
      sizeSpan.textContent = item.size;
      sub.appendChild(sizeSpan);
    }

    meta.appendChild(titleEl);
    if (sub.childNodes.length) meta.appendChild(sub);

    // line total
    const qty = item.quantity || 1;
    const unit = parsePrice(item.displayPrice);
    const line = unit * qty;

    const lineWrap = document.createElement("div");
    lineWrap.className = "checkout-line-total";

    const amt = document.createElement("div");
    amt.textContent = formatPrice(line);

    const qtyLabel = document.createElement("span");
    qtyLabel.className = "qty";
    qtyLabel.textContent = "qty: " + qty;

    lineWrap.appendChild(amt);
    lineWrap.appendChild(qtyLabel);

    row.appendChild(thumbWrap);
    row.appendChild(meta);
    row.appendChild(lineWrap);

    return { row, lineAmount: line };
  }

  function render() {
    if (!itemsEl || !subtotalEl || !totalEl || !emptyEl || !payBtn) return;

    const items = readCart();
    itemsEl.innerHTML = "";

    if (!items.length) {
      emptyEl.hidden = false;
      payBtn.disabled = true;
      subtotalEl.textContent = "$0.00";
      totalEl.textContent = "$0.00";
      return;
    }

    emptyEl.hidden = true;
    payBtn.disabled = false;

    let subtotal = 0;
    items.forEach(it => {
      const { row, lineAmount } = renderItem(it);
      itemsEl.appendChild(row);
      subtotal += lineAmount;
    });

    subtotalEl.textContent = formatPrice(subtotal);
    totalEl.textContent    = formatPrice(subtotal); // shipping/tax later
  }

  // pay button — Stripe integration placeholder
  function handlePayClick() {
    const items = readCart();
    if (!items.length) return;

    console.log("[checkout] ready to send to Stripe:", items);

    // Later: replace with fetch to your Stripe Checkout endpoint:
    // fetch("/.netlify/functions/create-checkout-session", { ... })
  }

  function init() {
    render();

    if (payBtn) {
      payBtn.addEventListener("click", (e) => {
        e.preventDefault();
        handlePayClick();
      });
    }

    // re-render whenever cart.js updates the cart
    window.addEventListener("ref-cart-changed", () => {
      render();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
