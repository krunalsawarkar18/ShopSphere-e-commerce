const express = require("express");
const {
  createOrder,
  createCheckoutSession,
  confirmCheckoutSession,
  getOrders,
  cancelOrder,
  adminCancelOrder,
  adminUpdateOrderStatus,
  getAdminAnalytics
} = require("../controllers/orderController");
const { protect, adminOnly, customerOnly } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.get("/admin/analytics", adminOnly, getAdminAnalytics);
router.patch("/admin/:id/cancel", adminOnly, adminCancelOrder);
router.patch("/admin/:id/status", adminOnly, adminUpdateOrderStatus);
router.post("/checkout-session", customerOnly, createCheckoutSession);
router.post("/checkout-session/:sessionId/confirm", customerOnly, confirmCheckoutSession);
router.get("/", getOrders);
router.post("/", customerOnly, createOrder);
router.patch("/:id/cancel", customerOnly, cancelOrder);

module.exports = router;
