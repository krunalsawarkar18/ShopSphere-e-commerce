require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const User = require("./models/User");
const Product = require("./models/Product");
const Order = require("./models/Order");

const localStorePath = path.join(__dirname, "..", ".local-store.json");

function loadLocalStore() {
  if (!fs.existsSync(localStorePath)) {
    throw new Error("Local store file was not found.");
  }

  return JSON.parse(fs.readFileSync(localStorePath, "utf-8"));
}

async function migrate() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  const data = loadLocalStore();

  await mongoose.connect(mongoUri, {
    dbName: process.env.MONGODB_DB_NAME || "ecomm_web_mvp",
    serverSelectionTimeoutMS: Number(process.env.DB_SERVER_SELECTION_TIMEOUT_MS || 5000)
  });

  const productIdMap = new Map();
  const userIdMap = new Map();

  const products = (data.products || []).map((product) => {
    const _id = new mongoose.Types.ObjectId();
    productIdMap.set(product.id, _id);

    return {
      _id,
      name: product.name,
      price: product.price,
      image: product.image,
      description: product.description,
      category: product.category,
      stock: product.stock,
      createdAt: product.createdAt ? new Date(product.createdAt) : new Date(),
      updatedAt: product.updatedAt ? new Date(product.updatedAt) : new Date()
    };
  });

  const users = (data.users || []).map((user) => {
    const _id = new mongoose.Types.ObjectId();
    userIdMap.set(user.id, _id);

    return {
      _id,
      name: user.name,
      email: user.email,
      role: user.role || "customer",
      password: user.passwordHash,
      cartItems: (user.cartItems || [])
        .map((item) => {
          const mappedProductId = productIdMap.get(item.productId);

          if (!mappedProductId) {
            return null;
          }

          return {
            product: mappedProductId,
            quantity: item.quantity
          };
        })
        .filter(Boolean),
      createdAt: user.createdAt ? new Date(user.createdAt) : new Date(),
      updatedAt: user.updatedAt ? new Date(user.updatedAt) : new Date()
    };
  });

  const fallbackProductId = products[0]?._id || new mongoose.Types.ObjectId();

  const orders = (data.orders || []).map((order) => ({
    _id: new mongoose.Types.ObjectId(),
    user: userIdMap.get(order.userId) || users[0]?._id,
    items: (order.items || []).map((item) => ({
      productId: productIdMap.get(item.productId) || fallbackProductId,
      name: item.name,
      image: item.image,
      price: item.price,
      quantity: item.quantity
    })),
    totalAmount: order.totalAmount,
    shippingAddress: {
      fullName: order.shippingAddress.fullName,
      phone: order.shippingAddress.phone,
      line1: order.shippingAddress.line1,
      line2: order.shippingAddress.line2 || "",
      city: order.shippingAddress.city,
      state: order.shippingAddress.state,
      postalCode: order.shippingAddress.postalCode,
      country: order.shippingAddress.country
    },
    paymentMethod: order.paymentMethod || "Cash on Delivery",
    status: order.status || "Placed",
    createdAt: order.createdAt ? new Date(order.createdAt) : new Date(),
    updatedAt: order.createdAt ? new Date(order.createdAt) : new Date()
  }));

  await Order.deleteMany({});
  await User.deleteMany({});
  await Product.deleteMany({});

  if (products.length) {
    await Product.collection.insertMany(products);
  }

  if (users.length) {
    await User.collection.insertMany(users);
  }

  if (orders.length) {
    await Order.collection.insertMany(orders);
  }

  console.log(
    `Migrated ${products.length} products, ${users.length} users, and ${orders.length} orders to MongoDB.`
  );
}

migrate()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Mongo migration failed:", error.message);

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    process.exit(1);
  });
