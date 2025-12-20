/* ===== cart.js (new tab checkout, stable) =====
   - Opens Stripe Checkout in a NEW TAB
   - Works best when your page is served from the SAME domain as the Netlify function
     (i.e., when you’re on rawechelonform.netlify.app)

   If the browser blocks popups, it falls back to same-tab redirect
*/

(function () {
  const STORAGE_KEY = "ref_cart";
  const IMAGE_BASE  = "assets/shop/";

  const panel       = document.getElementById("cartPanel");
  const overlay     = document.querySelector(".cart-drawer-overlay");
  const listEl      = document.getElementById("cartItems");
  const countEl     = document.getElementById("cartItemsCount");
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

  /* ---------- rendering ---------- */

  function renderRow(item, idx) {
    const row = document.createElement("div");
    row.className = "cart-drawer-item";
    row.dataset.index = String(idx);

    // thumbnail
    const thumbWrap = document.createElement("div");
    thumbWrap.className = "cart-drawer-thumb-wrap";

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
    titleEl.className = "cart-drawer-item-title";
    titleEl.textContent = item.title || "";

    const metaEl = document.createElement("div");
    metaEl.className = "cart-drawer-item-meta";

    const bits = [];
    if (item.color) bits.push(item.color);
    if (item.size)  bits.push(item.size);
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
    items.forEach(it => {
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
    if (badge) {
      badge.textContent = totalQty ? ` [${totalQty}]` : "";
    }
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

  /* ---------- checkout (Stripe new tab) ---------- */

  async function handleCheckoutClick() {
    const items = readCart();
    if (!items.length) return;

    const missingPrice = items.some(it => !it.priceId);
    if (missingPrice) {
      alert("one or more items are missing a stripe price id.");
      return;
    }

    // Open a blank tab immediately (counts as user gesture; reduces popup blocking)
    const popup = window.open("", "_blank", "noopener,noreferrer");

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
        if (popup) popup.close();
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
        if (popup) {
          popup.location.href = data.url; // NEW TAB
        } else {
          // popup blocked -> fallback to same tab
          window.location.href = data.url;
        }
        return;
      }

      if (popup) popup.close();
      alert("unexpected response from payment gateway.");
      if (checkoutBtn) {
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = "CHECKOUT";
      }
    } catch (err) {
      if (popup) popup.close();
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
    if (!panel) {
      console.warn("[cart] #cartPanel not found on this page");
    }

    document.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const toggle = target.closest("[data-cart-toggle]");
      if (toggle) {
        e.preventDefault();
        togglePanel();
      }
    });

    if (panel) {
      const closeBtn = panel.querySelector("[data-cart-close]");
      if (closeBtn) {
        closeBtn.addEventListener("click", (e) => {
          e.preventDefault();
          closePanel();
        });
      }
    }

    if (overlay) {
      overlay.addEventListener("click", () => closePanel());
    }

    if (checkoutBtn) {
      checkoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        handleCheckoutClick();
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
