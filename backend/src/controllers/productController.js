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
  const { search = "", category = "" } = req.query;
  const products = await loadProducts({ search, category });
  return res.json({ products });
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
