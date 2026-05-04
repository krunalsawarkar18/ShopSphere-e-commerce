const asyncHandler = require("../utils/asyncHandler");
const {
  getProducts: loadProducts,
  getProductById: loadProductById,
  getCategories: loadCategories,
  createProduct: createProductRecord,
  updateProduct: updateProductRecord,
  deleteProduct: deleteProductRecord
} = require("../services/store");

const getProducts = asyncHandler(async (req, res) => {
  const { search = "", category = "", limit, offset } = req.query;
  const parsedLimit = limit === undefined ? undefined : Number(limit);
  const parsedOffset = offset === undefined ? 0 : Number(offset);
  const { products, total } = await loadProducts({
    search,
    category,
    limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : undefined,
    offset: Number.isFinite(parsedOffset) && parsedOffset > 0 ? parsedOffset : 0
  });

  const effectiveOffset = Number.isFinite(parsedOffset) && parsedOffset > 0 ? parsedOffset : 0;
  const effectiveLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : products.length;

  return res.json({
    products,
    pagination: {
      total,
      offset: effectiveOffset,
      limit: effectiveLimit,
      hasMore: effectiveOffset + products.length < total
    }
  });
});

const getProductById = asyncHandler(async (req, res) => {
  const product = await loadProductById(req.params.id);

  if (!product) {
    return res.status(404).json({ message: "Product not found." });
  }

  return res.json({ product });
});

const getCategories = asyncHandler(async (req, res) => {
  const categories = await loadCategories();
  return res.json({ categories });
});

const createProduct = asyncHandler(async (req, res) => {
  const { name, price, image, description, category, stock } = req.body;

  if (!name || price === undefined || !image || !description || !category || stock === undefined) {
    return res.status(400).json({ message: "All product fields are required." });
  }

  const product = await createProductRecord({ name, price, image, description, category, stock });
  return res.status(201).json({ product });
});

const updateProduct = asyncHandler(async (req, res) => {
  const updates = req.body || {};
  const product = await updateProductRecord(req.params.id, updates);

  if (!product) {
    return res.status(404).json({ message: "Product not found." });
  }

  return res.json({ product });
});

const deleteProduct = asyncHandler(async (req, res) => {
  const deleted = await deleteProductRecord(req.params.id);

  if (!deleted) {
    return res.status(404).json({ message: "Product not found." });
  }

  return res.json({ message: "Product removed." });
});

module.exports = { getProducts, getProductById, getCategories, createProduct, updateProduct, deleteProduct };
