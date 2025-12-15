// netlify/functions/create-checkout-session.js
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const cart = JSON.parse(event.body || '[]');

    const line_items = cart.map(item => ({
      price: item.priceId,     // We will add priceId to cart items later
      quantity: item.quantity || 1,
    }));

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      success_url: 'https://YOUR-NETLIFY-SITE.netlify.app/success.html',
      cancel_url: 'https://YOUR-NETLIFY-SITE.netlify.app/cart.html',
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: 'Error creating checkout session' };
  }
};
success_url: 'https://resilient-seahorse-811dfc.netlify.app/success.html',
cancel_url:  'https://resilient-seahorse-811dfc.netlify.app/cart.html',
// netlify/functions/create-checkout-session.js

const Stripe = require('stripe');

// Uses the secret key you’ll set in Netlify → Environment variables
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method not allowed'
    };
  }

  try {
    // Expecting an array like:
    // [{ priceId: 'price_123', quantity: 1 }, ...]
    const cart = JSON.parse(event.body || '[]');

    const line_items = cart.map(item => ({
      price: item.priceId,
      quantity: item.quantity || 1,
    }));

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      success_url: 'https://resilient-seahorse-811dfc.netlify.app/success.html',
      cancel_url:  'https://resilient-seahorse-811dfc.netlify.app/cart.html',
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
// netlify/functions/create-checkout-session.js

const Stripe = require('stripe');

// Uses the secret key you’ll set in Netlify → Environment variables
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method not allowed'
    };
  }

  try {
    // Expecting an array like:
    // [{ priceId: 'price_123', quantity: 1 }, ...]
    const cart = JSON.parse(event.body || '[]');

    const line_items = cart.map(item => ({
      price: item.priceId,
      quantity: item.quantity || 1,
    }));

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      success_url: 'https://resilient-seahorse-811dfc.netlify.app/success.html',
      cancel_url:  'https://resilient-seahorse-811dfc.netlify.app/cart.html',
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
