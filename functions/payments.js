/* ===== payments.js (full updated) =====
   Netlify Function: /.netlify/functions/payments
   Expects POST body:
   {
     items: [ { priceId: "price_...", quantity: 1, ... }, ... ],
     cancelUrl: "https://rawechelonform.netlify.app/whatever.html"
   }
*/

const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { Allow: "POST" },
      body: "Method not allowed",
    };
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const items = Array.isArray(payload.items) ? payload.items : [];
    const cancelUrl = typeof payload.cancelUrl === "string" ? payload.cancelUrl : "";

    if (items.length === 0) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Cart is empty" }),
      };
    }

    const missing = items.some((it) => !it.priceId);
    if (missing) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing priceId on one or more items" }),
      };
    }

    const SAFE_ORIGIN = "https://rawechelonform.netlify.app";
    const safeCancelUrl = cancelUrl.startsWith(SAFE_ORIGIN)
      ? cancelUrl
      : `${SAFE_ORIGIN}/shop.html`; // fallback page (change if you want)

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
    { shipping_rate: "shr_1SgFiNRUeLzZqzRzXYqdRNhd" },
  ],

  metadata: {
    items: JSON.stringify(
      items.map(it => ({
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


    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error("[payments] Error creating checkout session", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Error creating checkout session" }),
    };
  }
};
