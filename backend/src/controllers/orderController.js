const asyncHandler = require("../utils/asyncHandler");
const {
  createOrder: storeOrder,
  createPaidOrder,
  cancelOrder: storeCancelOrder,
  updateOrderStatus: storeUpdateOrderStatus,
  getOrders: loadOrders,
  getAdminAnalytics: loadAdminAnalytics
} = require("../services/store");
const { getCart } = require("../services/store");
const { createHostedCheckoutSession, retrieveCheckoutSession } = require("../services/stripeService");

function validateShippingAddress(shippingAddress) {
  const requiredFields = ["fullName", "phone", "line1", "city", "state", "postalCode", "country"];

  for (const field of requiredFields) {
    if (!shippingAddress || !shippingAddress[field]) {
      return `Shipping field "${field}" is required.`;
    }
  }

  return "";
}

const createOrder = asyncHandler(async (req, res) => {
  const { shippingAddress, paymentMethod = "Cash on Delivery" } = req.body;

  const validationMessage = validateShippingAddress(shippingAddress);

  if (validationMessage) {
    return res.status(400).json({ message: validationMessage });
  }

  const result = await storeOrder(req.user.id, shippingAddress, paymentMethod);

  if (result.error) {
    return res.status(result.error.status).json({ message: result.error.message });
  }

  return res.status(201).json(result);
});

const createCheckoutSession = asyncHandler(async (req, res) => {
  const { shippingAddress } = req.body;
  const validationMessage = validateShippingAddress(shippingAddress);

  if (validationMessage) {
    return res.status(400).json({ message: validationMessage });
  }

  const cart = await getCart(req.user.id);
  const result = await createHostedCheckoutSession({
    user: req.user,
    cart,
    shippingAddress
  });

  if (result.error) {
    return res.status(result.error.status).json({ message: result.error.message });
  }

  return res.status(201).json(result);
});

const confirmCheckoutSession = asyncHandler(async (req, res) => {
  const session = await retrieveCheckoutSession(req.params.sessionId);

  if (!session) {
    return res.status(503).json({ message: "Pay Online is not configured yet. Add your Stripe secret key to enable it." });
  }

  if (session.mode !== "payment" || session.payment_status !== "paid") {
    return res.status(400).json({ message: "Payment is not confirmed yet." });
  }

  if (String(session.metadata?.userId || "") !== String(req.user.id)) {
    return res.status(403).json({ message: "This payment session does not belong to your account." });
  }

  const shippingAddress = {
    fullName: session.metadata?.fullName || "",
    phone: session.metadata?.phone || "",
    line1: session.metadata?.line1 || "",
    line2: session.metadata?.line2 || "",
    city: session.metadata?.city || "",
    state: session.metadata?.state || "",
    postalCode: session.metadata?.postalCode || "",
    country: session.metadata?.country || ""
  };

  const validationMessage = validateShippingAddress(shippingAddress);

  if (validationMessage) {
    return res.status(400).json({ message: validationMessage });
  }

  const result = await createPaidOrder(
    req.user.id,
    shippingAddress,
    session.id,
    Math.round((session.amount_total || 0) / 100)
  );

  if (result.error) {
    return res.status(result.error.status).json({ message: result.error.message });
  }

  return res.status(201).json(result);
});

const getOrders = asyncHandler(async (req, res) => {
  const orders = await loadOrders(req.user.id, { isAdmin: req.user.role === "admin" });
  return res.json({ orders });
});

const cancelOrder = asyncHandler(async (req, res) => {
  const result = await storeCancelOrder(req.params.id, { userId: req.user.id, isAdmin: false });

  if (result.error) {
    return res.status(result.error.status).json({ message: result.error.message });
  }

  return res.json(result);
});

const adminCancelOrder = asyncHandler(async (req, res) => {
  const result = await storeCancelOrder(req.params.id, { userId: req.user.id, isAdmin: true });

  if (result.error) {
    return res.status(result.error.status).json({ message: result.error.message });
  }

  return res.json(result);
});

const adminUpdateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const result = await storeUpdateOrderStatus(req.params.id, status, { isAdmin: true });

  if (result.error) {
    return res.status(result.error.status).json({ message: result.error.message });
  }

  return res.json(result);
});

const getAdminAnalytics = asyncHandler(async (_req, res) => {
  const analytics = await loadAdminAnalytics();
  return res.json({ analytics });
});

module.exports = {
  createOrder,
  createCheckoutSession,
  confirmCheckoutSession,
  getOrders,
  cancelOrder,
  adminCancelOrder,
  adminUpdateOrderStatus,
  getAdminAnalytics
};
