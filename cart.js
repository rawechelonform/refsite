// cart.js
// Slide-out cart panel that reads from localStorage.ref_cart

(function () {
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

  // only show the price in the meta line
  function formatMeta(item) {
    const price = item.displayPrice || "";
    return price || "";
  }

  let drawer, overlay, itemsContainer, totalEl, statusEl;
  let built = false;

  function renderCartDrawer() {
    const cart = loadCart();
    if (!itemsContainer || !totalEl) return;

    itemsContainer.innerHTML = "";

    if (!cart.length) {
      const empty = document.createElement("div");
      empty.className = "cart-drawer-empty";
      empty.textContent = "your bag is empty.";
      itemsContainer.appendChild(empty);
      totalEl.textContent = "";
      return;
    }

    cart.forEach((item, idx) => {
      const row = document.createElement("div");
      row.className = "cart-drawer-item";

      // assumes your product grid images live at assets/shop/<file>
      const thumbSrc = item.file ? `assets/shop/${item.file}` : "";

      row.innerHTML = `
        ${thumbSrc ? `
          <div class="cart-drawer-thumb-wrap">
            <img class="cart-drawer-thumb"
                 src="${thumbSrc}"
                 alt="${item.title || ""}">
          </div>
        ` : ``}
        <div class="cart-drawer-item-main">
          <div class="cart-drawer-item-title">${item.title}</div>
          <div class="cart-drawer-item-meta">${formatMeta(item)}</div>
        </div>
        <div class="cart-drawer-item-controls">
          <button data-idx="${idx}" data-action="dec">-</button>
          <span>${item.quantity || 1}</span>
          <button data-idx="${idx}" data-action="inc">+</button>
        </div>
      `;

      itemsContainer.appendChild(row);
    });

    const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    totalEl.textContent = `items: ${totalItems}`;
  }

  function handleItemsClick(e) {
    const btn = e.target.closest("button");
    if (!btn) return;

    const idx = parseInt(btn.dataset.idx, 10);
    const action = btn.dataset.action;
    if (Number.isNaN(idx) || !action) return;

    const cart = loadCart();
    const item = cart[idx];
    if (!item) return;

    if (action === "inc") {
      item.quantity = (item.quantity || 1) + 1;
    } else if (action === "dec") {
      item.quantity = (item.quantity || 1) - 1;
      if (item.quantity <= 0) {
        cart.splice(idx, 1); // 0 or less → remove from cart
      }
    }

    saveCart(cart);
    renderCartDrawer();
  }

  // temporary placeholder — Stripe wiring comes next
  function fakeCheckout() {
    if (!statusEl) return;

    const cart = loadCart();
    if (!cart.length) {
      statusEl.textContent = "cart is empty.";
      return;
    }

    statusEl.textContent = "checkout not wired yet (Stripe is next).";
  }

  function openDrawer() {
    if (!drawer || !overlay) return;
    drawer.classList.add("open");
    overlay.classList.add("open");
    if (statusEl) statusEl.textContent = "";
    renderCartDrawer();
  }

  function closeDrawer() {
    if (!drawer || !overlay) return;
    drawer.classList.remove("open");
    overlay.classList.remove("open");
  }

  function buildCartDrawer() {
    if (built) return;
    built = true;

    // overlay
    overlay = document.createElement("div");
    overlay.className = "cart-drawer-overlay";
    overlay.addEventListener("click", closeDrawer);

    // drawer
    drawer = document.createElement("aside");
    drawer.className = "cart-drawer";
    drawer.innerHTML = `
      <div class="cart-drawer-header">
        <h2 class="cart-drawer-title">SHOPPING BAG</h2>
        <button class="cart-drawer-close" type="button" data-cart-close>close</button>
      </div>
      <div class="cart-drawer-body">
        <div class="cart-drawer-items" data-cart-items></div>
      </div>
      <div class="cart-drawer-footer">
        <div class="cart-drawer-total" data-cart-total></div>
        <button class="cart-drawer-checkout" type="button" data-cart-checkout>
          checkout
        </button>
        <div class="cart-drawer-status" data-cart-status></div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    itemsContainer = drawer.querySelector("[data-cart-items]");
    totalEl = drawer.querySelector("[data-cart-total]");
    statusEl = drawer.querySelector("[data-cart-status]");

    const closeBtn = drawer.querySelector("[data-cart-close]");
    const checkoutBtn = drawer.querySelector("[data-cart-checkout]");

    if (closeBtn) closeBtn.addEventListener("click", closeDrawer);
    if (itemsContainer) itemsContainer.addEventListener("click", handleItemsClick);
    if (checkoutBtn) checkoutBtn.addEventListener("click", fakeCheckout);

    // hook up the CART link in the menubar
    const toggle = document.querySelector("[data-cart-toggle]");
    if (toggle) {
      toggle.addEventListener("click", (e) => {
        e.preventDefault();   // stop "#" from jumping
        openDrawer();
      });
    } else {
      console.warn("[cart] no [data-cart-toggle] found");
    }
  }

  function initCart() {
    // If menubar already injected and CART link exists, build immediately
    if (document.querySelector("[data-cart-toggle]")) {
      buildCartDrawer();
      return;
    }

    // Otherwise, wait for menubar.js to signal it's ready
    window.addEventListener("ref-menubar-ready", buildCartDrawer, { once: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCart);
  } else {
    initCart();
  }
})();
