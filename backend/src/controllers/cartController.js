const asyncHandler = require("../utils/asyncHandler");
const {
  getCart: loadCart,
  addCartItem: storeCartItem,
  updateCartItem: patchCartItem,
  removeCartItem: deleteCartItem
} = require("../services/store");

const getCart = asyncHandler(async (req, res) => {
  const cart = await loadCart(req.user.id);
  return res.json(cart);
});

const addCartItem = asyncHandler(async (req, res) => {
  const { productId, quantity = 1 } = req.body;

  if (!productId) {
    return res.status(400).json({ message: "Product ID is required." });
  }

  const parsedQuantity = Number(quantity);

  if (Number.isNaN(parsedQuantity) || parsedQuantity < 1) {
    return res.status(400).json({ message: "Quantity must be at least 1." });
  }

  const result = await storeCartItem(req.user.id, productId, parsedQuantity);

  if (result.error) {
    return res.status(result.error.status).json({ message: result.error.message });
  }

  return res.status(201).json(result.cart);
});

const updateCartItem = asyncHandler(async (req, res) => {
  const parsedQuantity = Number(req.body.quantity);

  if (Number.isNaN(parsedQuantity) || parsedQuantity < 1) {
    return res.status(400).json({ message: "Quantity must be at least 1." });
  }

  const result = await patchCartItem(req.user.id, req.params.productId, parsedQuantity);

  if (result.error) {
    return res.status(result.error.status).json({ message: result.error.message });
  }

  return res.json(result.cart);
});

const removeCartItem = asyncHandler(async (req, res) => {
  const cart = await deleteCartItem(req.user.id, req.params.productId);
  return res.json(cart);
});

module.exports = { getCart, addCartItem, updateCartItem, removeCartItem };
