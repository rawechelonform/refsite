import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  // optional but helps avoid Stripe default-version surprises
  apiVersion: "2024-06-20",
});

/**
 * CORS helper
 * Allows ONLY approved origins to call this endpoint from the browser
 */
function setCors(req, res) {
  const allowed = [
    process.env.SAFE_ORIGIN,          // e.g. "https://rawechelonform.neocities.org"
    process.env.SAFE_ORIGIN_WWW,      // optional: "https://www.rawechelonform.com"
  ].filter(Boolean);

  const origin = req.headers.origin;

  if (origin && allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCors(req, res);

  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const { items = [], cancelUrl = "" } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    if (items.some((it) => !it.priceId)) {
      return res.status(400).json({ error: "Missing priceId" });
    }

    const SAFE_ORIGIN = process.env.SAFE_ORIGIN; // must be your storefront origin
    if (!SAFE_ORIGIN) {
      return res.status(500).json({ error: "SAFE_ORIGIN env var is not set" });
    }

    const safeCancelUrl =
      typeof cancelUrl === "string" && cancelUrl.startsWith(SAFE_ORIGIN)
        ? cancelUrl
        : `${SAFE_ORIGIN}/shop.html`;

    const line_items = items.map((item) => ({
      price: item.priceId,
      quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
    }));

    const shippingRateId = process.env.SHIPPING_RATE_ID;
    if (!shippingRateId) {
      return res.status(500).json({ error: "SHIPPING_RATE_ID env var is not set" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,

      shipping_address_collection: { allowed_countries: ["US"] },
      shipping_options: [{ shipping_rate: shippingRateId }],

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

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("[payments] Error creating checkout session", err);

    return res.status(500).json({
      error: "Stripe error creating checkout session",
      message: err?.message || String(err),
      type: err?.type,
      code: err?.code,
      param: err?.param,
      requestId: err?.requestId,
    });
  }
}
