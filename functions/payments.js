import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * CORS helper
 * Allows ONLY your site (SAFE_ORIGIN) to call this endpoint from the browser
 */
function setCors(res) {
  const origin = process.env.SAFE_ORIGIN;

  // If SAFE_ORIGIN isn't set, don't accidentally allow everyone
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCors(res);

  // Preflight request (browser sends this before POST)
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

    const SAFE_ORIGIN = process.env.SAFE_ORIGIN;
    if (!SAFE_ORIGIN) {
      return res
        .status(500)
        .json({ error: "SAFE_ORIGIN env var is not set on server" });
    }

    const safeCancelUrl = cancelUrl.startsWith(SAFE_ORIGIN)
      ? cancelUrl
      : `${SAFE_ORIGIN}/shop.html`;

    const line_items = items.map((item) => ({
      price: item.priceId,
      quantity: item.quantity || 1,
    }));

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,

      shipping_address_collection: {
        allowed_countries: ["US"],
      },

      shipping_options: [
        { shipping_rate: process.env.SHIPPING_RATE_ID },
      ],

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
