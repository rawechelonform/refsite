// checkout.js — CONTACT / SHIPPING / PAYMENT accordion + redirect to Stripe Checkout
// Reads cart from localStorage "ref_cart"

(() => {
  const CART_KEY = "ref_cart";
  const CHECKOUT_INFO_KEY = "ref_checkout_info";

  // Status labels
  const contactStatus  = document.getElementById("contactStatus");
  const shippingStatus = document.getElementById("shippingStatus");
  const paymentStatus  = document.getElementById("paymentStatus");

  // Errors
  const contactError  = document.getElementById("contactError");
  const shippingError = document.getElementById("shippingError");
  const paymentError  = document.getElementById("paymentError");

  // Inputs
  const emailEl = document.getElementById("email");

  const shipFirst   = document.getElementById("shipFirst");
  const shipLast    = document.getElementById("shipLast");
  const shipLine1   = document.getElementById("shipLine1");
  const shipLine2   = document.getElementById("shipLine2");
  const shipCity    = document.getElementById("shipCity");
  const shipState   = document.getElementById("shipState");
  const shipZip     = document.getElementById("shipZip");
  const shipCountry = document.getElementById("shipCountry");

  // Mini summary
  const miniSubtotal = document.getElementById("miniSubtotal");
  const miniShipTax  = document.getElementById("miniShipTax");
  const miniTotal    = document.getElementById("miniTotal");

  // Buttons
  const toShippingBtn     = document.getElementById("toShipping");
  const backToContactBtn  = document.getElementById("backToContact");
  const toPaymentBtn      = document.getElementById("toPayment");
  const backToShippingBtn = document.getElementById("backToShipping");
  const finalizeBtn       = document.getElementById("finalizePayment");

  // Sections + headers
  const sections = Array.from(document.querySelectorAll(".acc-section"));
  const headers  = Array.from(document.querySelectorAll(".acc-header"));

  function setError(el, msg) {
    if (!el) return;
    el.textContent = msg || "";
  }

  function readCart() {
    try {
      const raw = localStorage.getItem(CART_KEY);
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

  function calcSubtotal(items) {
    let subtotal = 0;
    for (const it of items) {
      const qty = it.quantity || 1;
      const unit = parsePrice(it.displayPrice);
      subtotal += unit * qty;
    }
    return subtotal;
  }

  function setMiniSummary() {
    const items = readCart();
    const subtotal = calcSubtotal(items);

    if (miniSubtotal) miniSubtotal.textContent = formatPrice(subtotal);
    if (miniShipTax)  miniShipTax.textContent  = "TBD";
    if (miniTotal)    miniTotal.textContent    = formatPrice(subtotal);
  }

  function validateEmail(v) {
    const s = String(v || "").trim();
    if (!s) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }

  function shippingComplete() {
    const required = [shipFirst, shipLast, shipLine1, shipCity, shipState, shipZip, shipCountry];
    return required.every(el => el && String(el.value || "").trim().length > 0);
  }

  function saveCheckoutInfo() {
    const payload = {
      email: String(emailEl?.value || "").trim(),
      shipping: {
        first:   String(shipFirst?.value || "").trim(),
        last:    String(shipLast?.value || "").trim(),
        line1:   String(shipLine1?.value || "").trim(),
        line2:   String(shipLine2?.value || "").trim(),
        city:    String(shipCity?.value || "").trim(),
        state:   String(shipState?.value || "").trim(),
        zip:     String(shipZip?.value || "").trim(),
        country: String(shipCountry?.value || "").trim(),
      }
    };
    localStorage.setItem(CHECKOUT_INFO_KEY, JSON.stringify(payload));
  }

  function openOnly(name) {
    sections.forEach(sec => {
      const secName = sec.getAttribute("data-section");
      const header = sec.querySelector(".acc-header");
      const body   = sec.querySelector(".acc-body");
      const isTarget = secName === name;

      if (header) header.setAttribute("aria-expanded", isTarget ? "true" : "false");
      if (body) body.hidden = !isTarget;
    });

    if (contactStatus)  contactStatus.textContent  = name === "contact" ? "open" : "closed";
    if (shippingStatus) shippingStatus.textContent = name === "shipping" ? "open" : "closed";
    if (paymentStatus)  paymentStatus.textContent  = name === "payment" ? "open" : "closed";
  }

  async function finalizePayment() {
    setError(paymentError, "");

    const items = readCart();
    if (!items.length) {
      setError(paymentError, "your bag is empty.");
      return;
    }

    // must have Stripe price IDs
    const missingPrice = items.some(it => !it.priceId);
    if (missingPrice) {
      setError(paymentError, "one or more items are missing a stripe price id.");
      return;
    }

    // validate contact + shipping
    setError(contactError, "");
    if (!validateEmail(emailEl?.value)) {
      setError(contactError, "please enter a valid email.");
      openOnly("contact");
      return;
    }

    setError(shippingError, "");
    if (!shippingComplete()) {
      setError(shippingError, "please fill out all required fields.");
      openOnly("shipping");
      return;
    }

    // store info (for later receipts/shipping calc)
    saveCheckoutInfo();

    if (finalizeBtn) finalizeBtn.disabled = true;

    try {
      const res = await fetch("/.netlify/functions/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Your Netlify function expects the cart array itself
        body: JSON.stringify(items),
      });

      if (!res.ok) {
        setError(paymentError, "there was a problem creating the payment session.");
        if (finalizeBtn) finalizeBtn.disabled = false;
        return;
      }

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }

      setError(paymentError, "unexpected response from payment gateway.");
      if (finalizeBtn) finalizeBtn.disabled = false;
    } catch (err) {
      console.error(err);
      setError(paymentError, "network error creating payment session.");
      if (finalizeBtn) finalizeBtn.disabled = false;
    }
  }

  function init() {
    // header click: open that section
    headers.forEach(h => {
      h.addEventListener("click", () => {
        const sec = h.closest(".acc-section");
        const name = sec?.getAttribute("data-section");
        if (name) openOnly(name);
      });
    });

    // default open
    openOnly("contact");
    setMiniSummary();

    toShippingBtn?.addEventListener("click", () => {
      setError(contactError, "");
      if (!validateEmail(emailEl?.value)) {
        setError(contactError, "please enter a valid email.");
        return;
      }
      openOnly("shipping");
    });

    backToContactBtn?.addEventListener("click", () => openOnly("contact"));

    toPaymentBtn?.addEventListener("click", () => {
      setError(shippingError, "");
      if (!shippingComplete()) {
        setError(shippingError, "please fill out all required fields.");
        return;
      }
      openOnly("payment");
    });

    backToShippingBtn?.addEventListener("click", () => openOnly("shipping"));

    finalizeBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      finalizePayment();
    });

    // if bag changes while on this page, refresh totals
    window.addEventListener("ref-cart-changed", () => setMiniSummary());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
