import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

// base64url decode helper
function fromBase64Url(b64url) {
  const b64 = String(b64url).replace(/-/g, "+").replace(/_/g, "/");
  const padimport Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

// base64url decode (matches cart.js base64url encoding)
function fromBase64Url(b64url) {
  const b64 = String(b64url).replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  return Buffer.from(b64 + pad, "base64").toString("utf8");
}

export default async function handler(req, res) {
  // Allow GET (Neocities navigation), keep POST optional
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).send("Method Not Allowed");
  }

  try {
    let items = [];
    let cancelUrl = "";

    if (req.method === "GET") {
      const payload = req.query?.payload;
      if (!payload) return res.status(400).send("Missing payload");

      const json = fromBase64Url(payload);
      const data = JSON.parse(json);

      items = Array.isArray(data.items) ? data.items : [];
      cancelUrl = typeof data.cancelUrl === "string" ? data.cancelUrl : "";
    } else {
      // Optional POST support
      const body = req.body || {};
      items = Array.isArray(body.items) ? body.items : [];
      cancelUrl = typeof body.cancelUrl === "string" ? body.cancelUrl : "";
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).send("Cart is empty");
    }

    if (items.some((it) => !it.priceId)) {
      return res.status(400).send("Missing priceId");
    }

    const SAFE_ORIGIN = process.env.SAFE_ORIGIN;
    if (!SAFE_ORIGIN) {
      return res.status(500).send("SAFE_ORIGIN env var is not set");
    }

    const safeCancelUrl =
      cancelUrl && cancelUrl.startsWith(SAFE_ORIGIN)
        ? cancelUrl
        : `${SAFE_ORIGIN}/shop.html`;

    const line_items = items.map((it) => ({
      price: it.priceId,
      quantity: Number(it.quantity) > 0 ? Number(it.quantity) : 1,
    }));

    const shippingRateId = process.env.SHIPPING_RATE_ID;
    if (!shippingRateId) {
      return res.status(500).send("SHIPPING_RATE_ID env var is not set");
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,

      shipping_address_collection: { allowed_countries: ["US"] },
      shipping_options: [{ shipping_rate: shippingRateId }],

      metadata: {
        items: JSON.stringify(
          items.map((it) => ({
            title: it.title || "",
            size: it.size || "",
            color: it.color || "",
            quantity: it.quantity || 1,
          }))
        ),
      },

      success_url: `${SAFE_ORIGIN}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: safeCancelUrl,
    });

    // Critical: redirect the browser to Stripe Checkout
    res.writeHead(303, { Location: session.url });
    res.end();
    return;
  } catch (err) {
    console.error("[payments] error", err);
    return res
      .status(500)
      .send(err?.message || "Stripe error creating checkout session");
  }
}
 = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  return Buffer.from(b64 + pad, "base64").toString("utf8");
}

export default async function handler(req, res) {
  // Allow preflight just in case, but GET nav won't need CORS
  if (req.method === "OPTIONS") return res.status(204).end();

  // ✅ allow GET (from Neocities) and POST (optional future)
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return res.status(405).send("Method Not Allowed");
  }

  try {
    let items = [];
    let cancelUrl = "";

    if (req.method === "GET") {
      const payload = req.query?.payload;
      if (!payload) return res.status(400).send("Missing payload");

      const json = fromBase64Url(payload);
      const data = JSON.parse(json);

      items = Array.isArray(data.items) ? data.items : [];
      cancelUrl = typeof data.cancelUrl === "string" ? data.cancelUrl : "";
    } else {
      // Optional: keep POST support if you want it later
      const body = req.body || {};
      items = Array.isArray(body.items) ? body.items : [];
      cancelUrl = typeof body.cancelUrl === "string" ? body.cancelUrl : "";
    }

    if (!items.length) {
      return res.status(400).send("Cart is empty");
    }

    if (items.some((it) => !it.priceId)) {
      return res.status(400).send("Missing priceId");
    }

    const SAFE_ORIGIN = process.env.SAFE_ORIGIN;
    if (!SAFE_ORIGIN) {
      return res.status(500).send("SAFE_ORIGIN env var is not set");
    }

    const safeCancelUrl =
      cancelUrl && cancelUrl.startsWith(SAFE_ORIGIN)
        ? cancelUrl
        : `${SAFE_ORIGIN}/shop.html`;

    const line_items = items.map((it) => ({
      price: it.priceId,
      quantity: Number(it.quantity) > 0 ? Number(it.quantity) : 1,
    }));

    const shippingRateId = process.env.SHIPPING_RATE_ID;
    if (!shippingRateId) {
      return res.status(500).send("SHIPPING_RATE_ID env var is not set");
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,

      shipping_address_collection: { allowed_countries: ["US"] },
      shipping_options: [{ shipping_rate: shippingRateId }],

      // optional metadata
      metadata: {
        items: JSON.stringify(
          items.map((it) => ({
            title: it.title,
            size: it.size,
            color: it.color,
            quantity: it.quantity,
          }))
        ),
      },

      success_url: `${SAFE_ORIGIN}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: safeCancelUrl,
    });

    // ✅ redirect browser straight to Stripe Checkout
    res.writeHead(303, { Location: session.url });
    res.end();
    return;
  } catch (err) {
    console.error("[payments] Error creating checkout session", err);
    return res.status(500).send(err?.message || "Stripe error creating checkout session");
  }
}
