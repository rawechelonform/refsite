/* ===== cart.js =====
   - Neocities-safe checkout (NO fetch)
   - Uses form POST + redirect to Vercel
   - Auto-injects hidden checkout form
*/

(function () {
  const STORAGE_KEY = "ref_cart";
  const IMAGE_BASE = "assets/shop/";
  const PAYMENTS_URL = "https://ref-payments-backend.vercel.app/api/payments";

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
      const parsed = JSON.parse(raw || "[]");
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

  /* ---------- checkout form ---------- */

  function ensureCheckoutForm() {
    let form = document.getElementById("checkoutForm");
    if (form) return form;

    form = document.createElement("form");
    form.id = "checkoutForm";
    form.method = "POST";
    form.action = PAYMENTS_URL;
    form.target = "_self";
    form.style.display = "none";

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "payload";

    form.appendChild(input);
    document.body.appendChild(form);

    return form;
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
    panel.classList.contains("open") ? closePanel() : openPanel();
  }

  function openPanelTemporarily(ms = 3000) {
    openPanel();
    clearTimeout(autoCloseTimer);
    autoCloseTimer = setTimeout(closePanel, ms);
  }

  /* ---------- helpers ---------- */

  function getMenuBadgeEl() {
    return document.getElementById("cartMenuCount");
  }

  function parsePrice(str) {
    const n = parseFloat(String(str || "").replace(/[^0-9.]+/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  /* ---------- rendering ---------- */

  function renderRow(item, idx) {
    const row = document.createElement("div");
    row.className = "cart-drawer-item";

    const thumbWrap = document.createElement("div");
    thumbWrap.className = "cart-drawer-thumb-wrap";

    if (item.file) {
      const img = document.createElement("img");
      img.src = IMAGE_BASE + item.file;
      img.loading = "lazy";
      thumbWrap.appendChild(img);
    }

    const main = document.createElement("div");
    main.className = "cart-drawer-item-main";

    const title = document.createElement("div");
    title.textContent = item.title || "";

    const meta = document.createElement("div");
    meta.textContent = [item.color, item.size].filter(Boolean).join(" · ");

    main.append(title, meta);

    const controls = document.createElement("div");
    const minus = document.createElement("button");
    const plus = document.createElement("button");
    const qty = document.createElement("span");

    minus.textContent = "−";
    plus.textContent = "+";
    qty.textContent = item.quantity || 1;

    minus.onclick = () => changeQuantity(idx, -1);
    plus.onclick = () => changeQuantity(idx, 1);

    controls.append(minus, qty, plus);
    row.append(thumbWrap, main, controls);

    return row;
  }

  function render() {
    if (!listEl || !countEl) return;

    const items = readCart();
    listEl.innerHTML = "";

    if (!items.length) {
      listEl.textContent = "your bag is empty.";
      countEl.textContent = "items: 0";
      const badge = getMenuBadgeEl();
      if (badge) badge.textContent = "";
      return;
    }

    items.forEach((it, idx) => listEl.appendChild(renderRow(it, idx)));

    const totalQty = items.reduce((s, it) => s + (it.quantity || 0), 0);
    const subtotal = items.reduce(
      (s, it) => s + parsePrice(it.displayPrice) * (it.quantity || 0),
      0
    );

    countEl.innerHTML = `items: ${totalQty}
      <span class="cart-drawer-subtotal">
        subtotal $${subtotal.toFixed(2).replace(/\.00$/, "")}
      </span>`;

    const badge = getMenuBadgeEl();
    if (badge) badge.textContent = ` [${totalQty}]`;
  }

  /* ---------- quantity ---------- */

  function changeQuantity(index, delta) {
    const items = readCart();
    const next = (items[index]?.quantity || 0) + delta;

    if (next <= 0) items.splice(index, 1);
    else items[index].quantity = next;

    saveCart(items);
    render();
  }

  /* ---------- checkout ---------- */

  function handleCheckoutClick() {
    const items = readCart();
    if (!items.length) return;

    if (items.some(it => !it.priceId)) {
      alert("missing stripe price id");
      return;
    }

    const form = ensureCheckoutForm();
    form.querySelector("input[name='payload']").value = JSON.stringify({
      items,
      cancelUrl: window.location.href,
    });

    form.submit();
  }

  /* ---------- init ---------- */

  function init() {
    ensureCheckoutForm();
    render();

    document.addEventListener("click", (e) => {
      const t = e.target.closest("[data-cart-toggle]");
      if (t) {
        e.preventDefault();
        togglePanel();
      }

      const c = e.target.closest("#cartCheckoutBtn,[data-cart-checkout]");
      if (c) {
        e.preventDefault();
        handleCheckoutClick();
      }

      const close = e.target.closest("[data-cart-close]");
      if (close) {
        e.preventDefault();
        closePanel();
      }
    });

    if (overlay) overlay.onclick = closePanel;

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
