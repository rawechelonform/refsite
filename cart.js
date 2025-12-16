// cart.js

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

function formatLine(item) {
  const qty = item.quantity || 1;
  const label = item.displayPrice ? `${item.displayPrice}` : "";
  return `${item.title} × ${qty}${label ? " — " + label : ""}`;
}

function renderCart() {
  const itemsContainer = document.getElementById("cartItems");
  const emptyEl = document.getElementById("cartEmpty");
  const totalEl = document.getElementById("cartTotal");

  const cart = loadCart();

  if (!cart.length) {
    itemsContainer.innerHTML = "";
    emptyEl.hidden = false;
    totalEl.textContent = "";
    return;
  }

  emptyEl.hidden = true;
  itemsContainer.innerHTML = "";

  cart.forEach((item, idx) => {
    const row = document.createElement("div");
    row.className = "cart-item";

    row.innerHTML = `
      <span class="cart-item-text">${formatLine(item)}</span>
      <div class="cart-item-controls">
        <button data-idx="${idx}" data-action="dec">-</button>
        <span class="cart-item-qty">${item.quantity || 1}</span>
        <button data-idx="${idx}" data-action="inc">+</button>
        <button data-idx="${idx}" data-action="remove">x</button>
      </div>
    `;

    itemsContainer.appendChild(row);
  });

  const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
  totalEl.textContent = `items: ${totalItems}`;
}

function handleCartClick(e) {
  const btn = e.target.closest("button");
  if (!btn) return;

  const idx = p
