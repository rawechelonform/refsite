// refsite/functions/payments.js
const Stripe = require("stripe");

// Netlify environment variable: STRIPE_SECRET_KEY
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { Allow: "POST" },
      body: "Method not allowed",
    };
  }

  try {
    const cart = JSON.parse(event.body || "[]");

    if (!Array.isArray(cart) || cart.length === 0) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Cart is empty" }),
      };
    }

    // Validate items
    const bad = cart.find((it) => !it.priceId || !(it.quantity > 0));
    if (bad) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing priceId or invalid quantity" }),
      };
    }

    const line_items = cart.map((item) => ({
      price: item.priceId,
      quantity: item.quantity || 1,
    }));

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,

      shipping_address_collection: {
        allowed_countries: ["US"],
      },

      // If you want a fixed shipping rate, keep this
      // Make sure this shipping_rate id exists in the same Stripe account as STRIPE_SECRET_KEY
      shipping_options: [
        { shipping_rate: "shr_1SgFiNRUeLzZqzRzXYqdRNhd" },
      ],

      success_url:
        "https://rawechelonform.netlify.app/success.html?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://rawechelonform.netlify.app/checkout.html",
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
