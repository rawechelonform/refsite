// bag.js — render bag summary from localStorage "ref_cart"
// - +/- quantity controls
// - clicking thumbnail OR title goes to product.html?id=...

(() => {
  const STORAGE_KEY = "ref_cart";
  const IMAGE_BASE  = "assets/shop/";

  const itemsEl      = document.getElementById("checkoutItems");
  const emptyEl      = document.getElementById("checkoutEmpty");
  const subtotalEl   = document.getElementById("checkoutSubtotal");
  const totalEl      = document.getElementById("checkoutTotal");
  const continueBtn  = document.getElementById("checkoutPayBtn");

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

  function writeCart(cart) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    window.dispatchEvent(new Event("ref-cart-changed"));
  }

  function parsePrice(str) {
    if (!str) return 0;
    const n = parseFloat(String(str).replace(/[^0-9.]+/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function formatPrice(n) {
    return "$" + n.toFixed(2);
  }

  // identify a cart line item (same logic you used when adding)
  function sameLineItem(a, b) {
    return (
      (a.priceId || "") === (b.priceId || "") &&
      (a.size || "") === (b.size || "") &&
      (a.color || "") === (b.color || "")
    );
  }

  function updateQty(targetItem, delta) {
    const cart = readCart();
    const idx = cart.findIndex(it => sameLineItem(it, targetItem));
    if (idx === -1) return;

    const next = (cart[idx].quantity || 1) + delta;

    if (next <= 0) {
      cart.splice(idx, 1);
    } else {
      cart[idx].quantity = next;
    }

    writeCart(cart);
  }

  function productHref(item) {
    const id = (item.id || "").trim();
    if (!id) return "products.html"; // fallback, just in case
    return `product.html?id=${encodeURIComponent(id)}`;
  }

  function renderItem(item) {
    const row = document.createElement("div");
    row.className = "checkout-item";

    const href = productHref(item);

    // thumb (clickable)
    const thumbWrap = document.createElement("a");
    thumbWrap.className = "checkout-thumb-wrap";
    thumbWrap.href = href;
    thumbWrap.setAttribute("aria-label", item.title ? `View ${item.title}` : "View product");

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

    // title (clickable)
    const titleLink = document.createElement("a");
    titleLink.className = "checkout-meta-title checkout-meta-link";
    titleLink.href = href;
    titleLink.textContent = item.title || "";

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

    meta.appendChild(titleLink);
    if (sub.childNodes.length) meta.appendChild(sub);

    // qty controls + line total (controls left of price)
    const qty = item.quantity || 1;
    const unit = parsePrice(item.displayPrice);
    const line = unit * qty;

    const lineWrap = document.createElement("div");
    lineWrap.className = "checkout-line-total";

    const controls = document.createElement("div");
    controls.className = "qty-controls";

    const minus = document.createElement("button");
    minus.type = "button";
    minus.className = "qty-btn";
    minus.textContent = "−";
    minus.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      updateQty(item, -1);
    });

    const num = document.createElement("span");
    num.className = "qty-num";
    num.textContent = String(qty);

    const plus = document.createElement("button");
    plus.type = "button";
    plus.className = "qty-btn";
    plus.textContent = "+";
    plus.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      updateQty(item, +1);
    });

    controls.appendChild(minus);
    controls.appendChild(num);
    controls.appendChild(plus);

    const amt = document.createElement("div");
    amt.textContent = formatPrice(line);

    lineWrap.appendChild(controls);
    lineWrap.appendChild(amt);

    row.appendChild(thumbWrap);
    row.appendChild(meta);
    row.appendChild(lineWrap);

    return { row, lineAmount: line };
  }

  function render() {
    if (!itemsEl || !subtotalEl || !totalEl || !emptyEl || !continueBtn) return;

    const items = readCart();
    itemsEl.innerHTML = "";

    if (!items.length) {
      emptyEl.hidden = false;
      continueBtn.disabled = true;
      subtotalEl.textContent = "$0.00";
      totalEl.textContent = "$0.00";
      return;
    }

    emptyEl.hidden = true;
    continueBtn.disabled = false;

    let subtotal = 0;
    items.forEach(it => {
      const { row, lineAmount } = renderItem(it);
      itemsEl.appendChild(row);
      subtotal += lineAmount;
    });

    subtotalEl.textContent = formatPrice(subtotal);
    totalEl.textContent    = formatPrice(subtotal);
  }

  function init() {
    render();

    if (continueBtn) {
      continueBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (readCart().length) {
          window.location.href = "checkout.html";
        }
      });
    }

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
