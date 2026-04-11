const express = require("express");
const { getCart, addCartItem, updateCartItem, removeCartItem } = require("../controllers/cartController");
const { protect, customerOnly } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.get("/", customerOnly, getCart);
router.post("/items", customerOnly, addCartItem);
router.patch("/items/:productId", customerOnly, updateCartItem);
router.delete("/items/:productId", customerOnly, removeCartItem);

module.exports = router;
