// functions/payment.js
const Stripe = require('stripe');

// Uses the secret key you’ll set in Netlify → Environment variables
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Allow': 'POST' },
      body: 'Method not allowed'
    };
  }

  try {
    // Expecting the cart array itself:
    // [ { priceId: "price_123", quantity: 1 }, ... ]
    const cart = JSON.parse(event.body || '[]');

    if (!Array.isArray(cart) || cart.length === 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Cart is empty' })
      };
    }

    const line_items = cart.map(item => ({
      price: item.priceId,
      quantity: item.quantity || 1,
    }));

    const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  line_items,

  // NEW: collect shipping address
  shipping_address_collection: {
    // only US; add more country codes if you want (e.g. ['US', 'CA', 'GB'])
    allowed_countries: ['US'],
  },

  success_url: 'https://rawechelonform.netlify.app/success.html?session_id={CHECKOUT_SESSION_ID}',
  cancel_url:  'https://rawechelonform.netlify.app/checkout.html',
});



    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };

  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: 'Error creating checkout session'
    };
  }
};


const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  line_items,

  shipping_address_collection: {
    allowed_countries: ['US'],
  },

  shipping_options: [
    { shipping_rate: 'shr_1SgFiNRUeLzZqzRzXYqdRNhd' } // your $8 pre-order rate
  ],

  // OPTIONAL — only add if Stripe Tax is enabled
  // automatic_tax: { enabled: true },

  success_url: 'https://rawechelonform.netlify.app/success.html?session_id={CHECKOUT_SESSION_ID}',
  cancel_url:  'https://rawechelonform.netlify.app/checkout.html',
});
