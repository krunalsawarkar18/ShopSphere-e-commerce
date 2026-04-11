const Stripe = require("stripe");

let stripeClient;

function getFrontendOrigin() {
  return process.env.FRONTEND_ORIGIN || "http://localhost:3000";
}

function isStripeEnabled() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function getStripeClient() {
  if (!isStripeEnabled()) {
    return null;
  }

  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  return stripeClient;
}

function buildShippingMetadata(shippingAddress = {}) {
  return {
    fullName: shippingAddress.fullName || "",
    phone: shippingAddress.phone || "",
    line1: shippingAddress.line1 || "",
    line2: shippingAddress.line2 || "",
    city: shippingAddress.city || "",
    state: shippingAddress.state || "",
    postalCode: shippingAddress.postalCode || "",
    country: shippingAddress.country || ""
  };
}

async function createHostedCheckoutSession({ user, cart, shippingAddress }) {
  const stripe = getStripeClient();

  if (!stripe) {
    return { error: { status: 503, message: "Pay Online is not configured yet. Add your Stripe secret key to enable it." } };
  }

  if (!cart?.items?.length) {
    return { error: { status: 400, message: "Your cart is empty." } };
  }

  const lineItems = cart.items.map((item) => ({
    quantity: item.quantity,
    price_data: {
      currency: (process.env.STRIPE_CURRENCY || "inr").toLowerCase(),
      unit_amount: Math.round(item.product.price * 100),
      product_data: {
        name: item.product.name,
        images: item.product.image ? [`${getFrontendOrigin()}${item.product.image}`] : [],
        description: item.product.description?.slice(0, 500) || undefined
      }
    }
  }));

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    client_reference_id: String(user.id),
    customer_email: user.email,
    success_url: `${getFrontendOrigin()}/success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${getFrontendOrigin()}/checkout.html?payment=cancelled`,
    metadata: {
      userId: String(user.id),
      ...buildShippingMetadata(shippingAddress)
    },
    line_items: lineItems
  });

  return {
    sessionId: session.id,
    url: session.url
  };
}

async function retrieveCheckoutSession(sessionId) {
  const stripe = getStripeClient();

  if (!stripe) {
    return null;
  }

  return stripe.checkout.sessions.retrieve(sessionId);
}

module.exports = {
  isStripeEnabled,
  createHostedCheckoutSession,
  retrieveCheckoutSession
};
