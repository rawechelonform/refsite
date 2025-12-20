/* ===== cart.js (full updated, product.html?id=UNIQUEID) =====
   Click product image OR title in the bag -> go to product page
   Prefers item.id / item.uniqueId / item.productId
   Fallback: maps Stripe priceId -> UniqueID (fill PRICE_ID_TO_UNIQUEID)

   Cart item should ideally include:
   { id: 101, priceId: "price_...", title, file, size, color, quantity, displayPrice }
*/

(function () {
  const STORAGE_KEY = "ref_cart";
  const IMAGE_BASE = "assets/shop/";

  // OPTIONAL FALLBACK:
  // If your cart items don't store id yet, fill this with your CSV mapping
  // Example:
  // "price_1Sd02LRUeLzZqzRzrtd672uT": 101,
  const PRICE_ID_TO_UNIQUEID = {
    // "price_...": 101,
  };

  const panel = document.getElementById("cartPanel");
  const overlay = document.querySelector(".cart-drawer-overlay");
  const listEl = document.getElementById("cartItems");
  const countEl = document.getElementById("cartItemsCount");
  const checkoutBtn = document.getElementById("cartCheckoutBtn");

  let autoCloseTimer = null;

  /* ---------- storage ---------- */

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

  function saveCart(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    try {
      window.dispatchEvent(
        new CustomEvent("ref-cart-changed", { detail: { items } })
      );
    } catch (_) {}
  }

  /* ---------- open / close ---------- */

  function openPanel() {
    if (!panel) return;
    panel.classList.add("open");
    if (overlay) overlay.classList.add("open");
    document.body.classList.add("cart-open");
  }

  function closePanel() {
    if (!panel) return;
    panel.classList.remove("open");
    if (overlay) overlay.classList.remove("open");
    document.body.classList.remove("cart-open");
  }

  function togglePanel() {
    if (!panel) return;
    if (panel.classList.contains("open")) closePanel();
    else openPanel();
  }

  function openPanelTemporarily(ms) {
    if (!panel) return;
    const dur = typeof ms === "number" ? ms : 3000;

    openPanel();

    if (autoCloseTimer) {
      clearTimeout(autoCloseTimer);
      autoCloseTimer = null;
    }

    autoCloseTimer = setTimeout(() => {
      autoCloseTimer = null;
      if (!panel.classList.contains("open")) return;
      closePanel();
    }, dur);
  }

  /* ---------- helpers ---------- */

  function getMenuBadgeEl() {
    return document.getElementById("cartMenuCount");
  }

  function parsePrice(str) {
    if (!str) return 0;
    const n = parseFloat(String(str).replace(/[^0-9.]+/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function getUniqueIdFromItem(item) {
    const direct =
      item?.id ??
      item?.uniqueId ??
      item?.UniqueID ??
      item?.productId ??
      item?.productID ??
      item?.skuId ??
      null;

    const n = Number(direct);
    if (Number.isFinite(n) && n > 0) return n;

    const byPrice = item?.priceId && PRICE_ID_TO_UNIQUEID[item.priceId];
    const m = Number(byPrice);
    if (Number.isFinite(m) && m > 0) return m;

    return null;
  }

  function buildProductHref(item) {
    // If you already store a url directly, honor it
    const directUrl =
      (item && (item.url || item.href || item.productUrl || item.productHref)) || "";
    if (typeof directUrl === "string" && directUrl) return directUrl;

    const uid = getUniqueIdFromItem(item);
    if (!uid) return "products.html"; // safe fallback page

    const url = new URL("product.html", window.location.origin);
    url.searchParams.set("id", String(uid));

    // Optional: preserve currently selected variant on return
    if (item?.color) url.searchParams.set("color", item.color);
    if (item?.size) url.searchParams.set("size", item.size);

    return url.pathname + url.search;
  }

  function goToProduct(item) {
    const href = buildProductHref(item);
    closePanel();
    window.location.assign(href);
  }

  /* ---------- rendering ---------- */

  function renderRow(item, idx) {
    const row = document.createElement("div");
    row.className = "cart-drawer-item";
    row.dataset.index = String(idx);

    // set href on the row so click handler doesn't depend on closures
    row.dataset.href = buildProductHref(item);

    // thumbnail
    const thumbWrap = document.createElement("div");
    thumbWrap.className = "cart-drawer-thumb-wrap cart-drawer-clickable";

    if (item.file) {
      const img = document.createElement("img");
      img.className = "cart-drawer-thumb";
      img.src = IMAGE_BASE + item.file;
      img.alt = item.title || "";
      img.loading = "lazy";
      img.decoding = "async";
      img.addEventListener("error", () => img.remove(), { once: true });
      thumbWrap.appendChild(img);
    }

    // main text
    const main = document.createElement("div");
    main.className = "cart-drawer-item-main";

    const titleEl = document.createElement("div");
    titleEl.className = "cart-drawer-item-title cart-drawer-clickable";
    titleEl.textContent = item.title || "";

    const metaEl = document.createElement("div");
    metaEl.className = "cart-drawer-item-meta";

    const bits = [];
    if (item.color) bits.push(item.color);
    if (item.size) bits.push(item.size);
    metaEl.textContent = bits.join(" · ");

    main.appendChild(titleEl);
    main.appendChild(metaEl);

    // quantity controls
    const controls = document.createElement("div");
    controls.className = "cart-drawer-item-controls";

    const minusBtn = document.createElement("button");
    minusBtn.type = "button";
    minusBtn.textContent = "−";

    const qtyLabel = document.createElement("span");
    qtyLabel.textContent = String(item.quantity || 1);

    const plusBtn = document.createElement("button");
    plusBtn.type = "button";
    plusBtn.textContent = "+";

    controls.appendChild(minusBtn);
    controls.appendChild(qtyLabel);
    controls.appendChild(plusBtn);

    row.appendChild(thumbWrap);
    row.appendChild(main);
    row.appendChild(controls);

    minusBtn.addEventListener("click", () => changeQuantity(idx, -1));
    plusBtn.addEventListener("click", () => changeQuantity(idx, +1));

    return row;
  }

  function render() {
    if (!listEl || !countEl) return;

    const items = readCart();
    listEl.innerHTML = "";

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "cart-drawer-empty";
      empty.textContent = "your bag is empty.";
      listEl.appendChild(empty);

      countEl.textContent = "items: 0";

      const badgeEmpty = getMenuBadgeEl();
      if (badgeEmpty) badgeEmpty.textContent = "";
      return;
    }

    items.forEach((it, idx) => {
      listEl.appendChild(renderRow(it, idx));
    });

    const totalQty = items.reduce((sum, it) => sum + (it.quantity || 0), 0);

    let subtotal = 0;
    items.forEach((it) => {
      const q = it.quantity || 0;
      subtotal += parsePrice(it.displayPrice) * q;
    });

    const subtotalText = "$" + subtotal.toFixed(2).replace(/\.00$/, "");

    countEl.innerHTML =
      `items: ${totalQty}
       <span class="cart-drawer-subtotal">
         <span class="cart-drawer-subtotal-label">subtotal</span>
         ${subtotalText}
       </span>`;

    const badge = getMenuBadgeEl();
    if (badge) badge.textContent = totalQty ? ` [${totalQty}]` : "";
  }

  /* ---------- quantity ---------- */

  function changeQuantity(index, delta) {
    const items = readCart();
    if (index < 0 || index >= items.length) return;

    const item = items[index];
    const next = (item.quantity || 0) + delta;

    if (next <= 0) {
      items.splice(index, 1);
    } else {
      item.quantity = next;
    }

    saveCart(items);
    render();
  }

  /* ---------- checkout (Stripe redirect) ---------- */

  async function handleCheckoutClick() {
    const items = readCart();
    if (!items.length) return;

    const missingPrice = items.some((it) => !it.priceId);
    if (missingPrice) {
      alert("one or more items are missing a stripe price id.");
      return;
    }

    if (checkoutBtn) {
      checkoutBtn.disabled = true;
      checkoutBtn.textContent = "LOADING…";
    }

    try {
      const res = await fetch("/.netlify/functions/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          cancelUrl: window.location.href,
        }),
      });

      if (!res.ok) {
        console.error("[cart] payments error", res.status);
        alert("there was a problem creating the payment session.");
        if (checkoutBtn) {
          checkoutBtn.disabled = false;
          checkoutBtn.textContent = "CHECKOUT";
        }
        return;
      }

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }

      alert("unexpected response from payment gateway.");
      if (checkoutBtn) {
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = "CHECKOUT";
      }
    } catch (err) {
      console.error("[cart] network error", err);
      alert("network error creating payment session.");
      if (checkoutBtn) {
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = "CHECKOUT";
      }
    }
  }

  /* ---------- init ---------- */

  function init() {
    if (!panel) console.warn("[cart] #cartPanel not found on this page");

    // BAG button in menubar — event delegation
    document.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const toggle = target.closest("[data-cart-toggle]");
      if (toggle) {
        e.preventDefault();
        togglePanel();
      }
    });

    // Drawer close button
    if (panel) {
      const closeBtn = panel.querySelector("[data-cart-close]");
      if (closeBtn) {
        closeBtn.addEventListener("click", (e) => {
          e.preventDefault();
          closePanel();
        });
      }
    }

    // Overlay click closes drawer
    if (overlay) overlay.addEventListener("click", () => closePanel());

    // Checkout
    if (checkoutBtn) {
      checkoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        handleCheckoutClick();
      });
    }

    // Click image OR title -> go to product.html?id=...
    // Delegated on panel so it works even if cart items are re-rendered
    if (panel) {
      panel.addEventListener("click", (e) => {
        const target = e.target;
        if (!(target instanceof Element)) return;

        // ignore clicks inside quantity controls
        if (target.closest(".cart-drawer-item-controls")) return;

        const row = target.closest(".cart-drawer-item");
        if (!row) return;

        const clickedThumb = target.closest(".cart-drawer-thumb-wrap, .cart-drawer-thumb");
        const clickedTitle = target.closest(".cart-drawer-item-title");
        if (!clickedThumb && !clickedTitle) return;

        const idx = Number(row.dataset.index);
        if (!Number.isFinite(idx)) return;

        const items = readCart();
        const item = items[idx];
        if (!item) return;

        e.preventDefault();
        e.stopPropagation();
        goToProduct(item);
      });
    }

    window.addEventListener("ref-menubar-ready", () => render());

    render();

    window.refCart = {
      openPanel,
      closePanel,
      openPanelTemporarily,
      render,
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
