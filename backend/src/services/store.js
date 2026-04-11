const bcrypt = require("bcryptjs");
const { randomUUID } = require("crypto");

const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const { getDatabaseMode } = require("../config/db");
const { ensureLocalStore, readLocalStore, writeLocalStore } = require("./localStore");

const ADMIN_MANAGED_ORDER_STATUSES = ["Placed", "Processing", "Shipped", "Delivered"];

function toId(value) {
  if (!value) {
    return "";
  }

  return String(value._id || value.id || value);
}

function safeUser(user) {
  return {
    id: toId(user),
    name: user.name,
    email: user.email,
    role: user.role || "customer",
    savedAddress: user.savedAddress || {}
  };
}

function mapProduct(product) {
  return {
    id: toId(product),
    name: product.name,
    price: product.price,
    image: product.image,
    description: product.description,
    category: product.category,
    stock: product.stock
  };
}

function buildCartResponseFromItems(items) {
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const shippingFee = 0;

  return {
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal,
    shippingFee,
    total: subtotal + shippingFee
  };
}

function isSameDay(date, reference) {
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
}

function getStartOfWeek(reference) {
  const date = new Date(reference);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + diff);
  return date;
}

function mapOrder(order, userName = "") {
  return {
    id: toId(order),
    items: (order.items || []).map((item) => ({
      productId: toId(item.productId),
      name: item.name,
      image: item.image,
      price: item.price,
      quantity: item.quantity
    })),
    totalAmount: order.totalAmount,
    shippingAddress: order.shippingAddress,
    paymentMethod: order.paymentMethod,
    stripeCheckoutSessionId: order.stripeCheckoutSessionId || "",
    status: order.status,
    createdAt: order.createdAt,
    userName
  };
}

function buildAdminAnalytics({ orders, users, products }) {
  const now = new Date();
  const startOfWeek = getStartOfWeek(now);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const customerUsers = users.filter((user) => (user.role || "customer") === "customer");
  const revenueSeriesMap = new Map();

  for (let index = 6; index >= 0; index -= 1) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(now.getDate() - index);
    const key = day.toISOString().slice(0, 10);
    revenueSeriesMap.set(key, {
      label: day.toLocaleDateString("en-IN", { weekday: "short" }),
      revenue: 0
    });
  }

  let dailyRevenue = 0;
  let weeklyRevenue = 0;
  let monthlyRevenue = 0;
  let totalRevenue = 0;
  let todayOrders = 0;
  let weeklyOrders = 0;
  let monthlyOrders = 0;

  const topProductsMap = new Map();

  orders.forEach((order) => {
    if (order.status === "Cancelled") {
      return;
    }

    const createdAt = new Date(order.createdAt);
    totalRevenue += order.totalAmount || 0;

    if (isSameDay(createdAt, now)) {
      dailyRevenue += order.totalAmount || 0;
      todayOrders += 1;
    }

    if (createdAt >= startOfWeek) {
      weeklyRevenue += order.totalAmount || 0;
      weeklyOrders += 1;
    }

    if (createdAt >= startOfMonth) {
      monthlyRevenue += order.totalAmount || 0;
      monthlyOrders += 1;
    }

    const revenueKey = createdAt.toISOString().slice(0, 10);
    if (revenueSeriesMap.has(revenueKey)) {
      revenueSeriesMap.get(revenueKey).revenue += order.totalAmount || 0;
    }

    (order.items || []).forEach((item) => {
      const key = toId(item.productId) || item.name;
      const existing = topProductsMap.get(key) || {
        name: item.name,
        quantity: 0,
        revenue: 0,
        image: item.image
      };

      existing.quantity += item.quantity;
      existing.revenue += item.price * item.quantity;
      topProductsMap.set(key, existing);
    });
  });

  const averageOrderValue = orders.length ? Math.round(totalRevenue / orders.length) : 0;
  const revenueSeries = [...revenueSeriesMap.values()];
  const topProducts = [...topProductsMap.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
  const recentOrders = orders
    .filter((order) => order.status !== "Cancelled")
    .slice(0, 5)
    .map((order) => ({
    id: order.id,
    totalAmount: order.totalAmount,
    status: order.status,
    createdAt: order.createdAt,
    itemCount: (order.items || []).reduce((sum, item) => sum + item.quantity, 0),
    userName: order.userName || "Customer",
    userEmail: order.userEmail || order.shippingAddress?.email || "",
    previewImage: order.items?.[0]?.image || "",
    previewName: order.items?.[0]?.name || "",
    paymentMethod: order.paymentMethod,
    shippingAddress: order.shippingAddress,
    items: (order.items || []).map((item) => ({
      productId: item.productId,
      name: item.name,
      image: item.image,
      price: item.price,
      quantity: item.quantity
    }))
  }));

  return {
    revenue: {
      daily: dailyRevenue,
      weekly: weeklyRevenue,
      monthly: monthlyRevenue,
      total: totalRevenue
    },
    orders: {
      today: todayOrders,
      weekly: weeklyOrders,
      monthly: monthlyOrders,
      total: orders.length
    },
    customers: {
      total: customerUsers.length
    },
    averageOrderValue,
    revenueSeries,
    topProducts,
    recentOrders,
    inventory: {
      totalProducts: products.length,
      activeProducts: products.filter((product) => product.stock > 0).length
    }
  };
}

function findLocalUserById(data, userId) {
  return data.users.find((user) => user.id === String(userId));
}

function buildLocalCart(data, user) {
  const items = (user.cartItems || [])
    .map((item) => {
      const product = data.products.find((entry) => entry.id === item.productId);

      if (!product) {
        return null;
      }

      return {
        product: mapProduct(product),
        quantity: item.quantity,
        lineTotal: product.price * item.quantity
      };
    })
    .filter(Boolean);

  return buildCartResponseFromItems(items);
}

async function getUserByEmail(email, options = {}) {
  const normalizedEmail = email.toLowerCase().trim();

  if (getDatabaseMode() === "local") {
    const data = readLocalStore();
    const user = data.users.find((entry) => entry.email === normalizedEmail);

    if (!user) {
      return null;
    }

    return options.includePassword ? user : safeUser(user);
  }

  const query = User.findOne({ email: normalizedEmail });

  if (options.includePassword) {
    query.select("+password");
  }

  const user = await query;

  if (!user) {
    return null;
  }

    return options.includePassword
      ? {
        id: toId(user),
        name: user.name,
        email: user.email,
        role: user.role || "customer",
        passwordHash: user.password,
        cartItems: user.cartItems || []
      }
    : safeUser(user);
}

async function getUserById(userId, options = {}) {
  if (getDatabaseMode() === "local") {
    const data = readLocalStore();
    const user = findLocalUserById(data, userId);

    if (!user) {
      return null;
    }

    return options.includePassword ? user : safeUser(user);
  }

  const query = User.findById(userId);

  if (options.includePassword) {
    query.select("+password");
  }

  const user = await query;

  if (!user) {
    return null;
  }

  return options.includePassword
    ? {
      id: toId(user),
      name: user.name,
      email: user.email,
      role: user.role || "customer",
      passwordHash: user.password,
      cartItems: user.cartItems || []
    }
    : safeUser(user);
}

async function createUser({ name, email, password, role = "customer" }) {
  const normalizedEmail = email.toLowerCase().trim();

  if (getDatabaseMode() === "local") {
    const data = readLocalStore();
    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash(password, 10);
    const user = {
      id: `user_${randomUUID()}`,
      name: name.trim(),
      email: normalizedEmail,
      role,
      passwordHash,
      cartItems: [],
      savedAddress: {},
      createdAt: now,
      updatedAt: now
    };

    data.users.push(user);
    writeLocalStore(data);
    return safeUser(user);
  }

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    role,
    password,
    savedAddress: {}
  });

  return safeUser(user);
}

async function verifyUserPassword(user, password) {
  const passwordHash = user.passwordHash || user.password;
  return bcrypt.compare(password, passwordHash);
}

async function getProducts({ search = "", category = "" } = {}) {
  if (getDatabaseMode() === "local") {
    const data = readLocalStore();
    const normalizedSearch = search.trim().toLowerCase();

    return data.products
      .filter((product) => {
        const matchesSearch = normalizedSearch ? product.name.toLowerCase().includes(normalizedSearch) : true;
        const matchesCategory = category ? product.category === category : true;
        return matchesSearch && matchesCategory;
      })
      .map(mapProduct);
  }

  const query = {};

  if (search) {
    query.name = { $regex: search, $options: "i" };
  }

  if (category) {
    query.category = category;
  }

  const products = await Product.find(query).sort({ createdAt: -1 });
  return products.map(mapProduct);
}

async function getCategories() {
  if (getDatabaseMode() === "local") {
    const data = readLocalStore();
    return [...new Set(data.products.map((product) => product.category))];
  }

  return Product.find().distinct("category");
}

async function getProductById(productId) {
  if (getDatabaseMode() === "local") {
    const data = readLocalStore();
    const product = data.products.find((entry) => entry.id === String(productId));
    return product ? mapProduct(product) : null;
  }

  const product = await Product.findById(productId);
  return product ? mapProduct(product) : null;
}

async function createProduct(productInput) {
  const payload = {
    name: productInput.name.trim(),
    price: Number(productInput.price),
    image: productInput.image.trim(),
    description: productInput.description.trim(),
    category: productInput.category.trim(),
    stock: Number(productInput.stock)
  };

  if (getDatabaseMode() === "local") {
    const data = readLocalStore();
    const now = new Date().toISOString();
    const product = {
      id: `prod_${randomUUID()}`,
      ...payload,
      createdAt: now,
      updatedAt: now
    };

    data.products.unshift(product);
    writeLocalStore(data);
    return mapProduct(product);
  }

  const product = await Product.create(payload);
  return mapProduct(product);
}

async function updateProduct(productId, updates) {
  const payload = {};

  ["name", "image", "description", "category"].forEach((field) => {
    if (updates[field] !== undefined) {
      payload[field] = String(updates[field]).trim();
    }
  });

  ["price", "stock"].forEach((field) => {
    if (updates[field] !== undefined) {
      payload[field] = Number(updates[field]);
    }
  });

  if (getDatabaseMode() === "local") {
    const data = readLocalStore();
    const product = data.products.find((entry) => entry.id === String(productId));

    if (!product) {
      return null;
    }

    Object.assign(product, payload, { updatedAt: new Date().toISOString() });
    writeLocalStore(data);
    return mapProduct(product);
  }

  const product = await Product.findByIdAndUpdate(productId, payload, { new: true, runValidators: true });
  return product ? mapProduct(product) : null;
}

async function deleteProduct(productId) {
  if (getDatabaseMode() === "local") {
    const data = readLocalStore();
    const productIndex = data.products.findIndex((entry) => entry.id === String(productId));

    if (productIndex === -1) {
      return false;
    }

    data.products.splice(productIndex, 1);
    data.users = data.users.map((user) => ({
      ...user,
      cartItems: (user.cartItems || []).filter((item) => item.productId !== String(productId))
    }));
    writeLocalStore(data);
    return true;
  }

  const deleted = await Product.findByIdAndDelete(productId);
  return Boolean(deleted);
}

async function getCart(userId) {
  if (getDatabaseMode() === "local") {
    const data = readLocalStore();
    const user = findLocalUserById(data, userId);
    return buildLocalCart(data, user);
  }

  const user = await User.findById(userId).populate("cartItems.product");
  const items = (user.cartItems || []).map((item) => ({
    product: mapProduct(item.product),
    quantity: item.quantity,
    lineTotal: item.product.price * item.quantity
  }));

  return buildCartResponseFromItems(items);
}

async function updateSavedAddress(userId, addressInput) {
  const savedAddress = {
    fullName: String(addressInput.fullName || "").trim(),
    phone: String(addressInput.phone || "").trim(),
    line1: String(addressInput.line1 || "").trim(),
    line2: String(addressInput.line2 || "").trim(),
    city: String(addressInput.city || "").trim(),
    state: String(addressInput.state || "").trim(),
    postalCode: String(addressInput.postalCode || "").trim(),
    country: String(addressInput.country || "").trim()
  };

  if (getDatabaseMode() === "local") {
    const data = readLocalStore();
    const user = findLocalUserById(data, userId);

    if (!user) {
      return null;
    }

    user.savedAddress = savedAddress;
    user.updatedAt = new Date().toISOString();
    writeLocalStore(data);
    return safeUser(user);
  }

  const user = await User.findById(userId);

  if (!user) {
    return null;
  }

  user.savedAddress = savedAddress;
  await user.save();
  return safeUser(user);
}

async function addCartItem(userId, productId, quantity) {
  if (getDatabaseMode() === "local") {
    const data = readLocalStore();
    const user = findLocalUserById(data, userId);
    const product = data.products.find((entry) => entry.id === String(productId));

    if (!product) {
      return { error: { status: 404, message: "Product not found." } };
    }

    if (product.stock < quantity) {
      return { error: { status: 400, message: "Requested quantity is not available." } };
    }

    const existingItem = user.cartItems.find((item) => item.productId === String(productId));

    if (existingItem) {
      const updatedQuantity = existingItem.quantity + quantity;

      if (updatedQuantity > product.stock) {
        return { error: { status: 400, message: "Not enough stock to add more of this item." } };
      }

      existingItem.quantity = updatedQuantity;
    } else {
      user.cartItems.push({ productId: String(productId), quantity });
    }

    user.updatedAt = new Date().toISOString();
    writeLocalStore(data);
    return { cart: buildLocalCart(data, user) };
  }

  const product = await Product.findById(productId);

  if (!product) {
    return { error: { status: 404, message: "Product not found." } };
  }

  if (product.stock < quantity) {
    return { error: { status: 400, message: "Requested quantity is not available." } };
  }

  const user = await User.findById(userId);
  const existingItem = user.cartItems.find((item) => item.product.toString() === String(productId));

  if (existingItem) {
    const updatedQuantity = existingItem.quantity + quantity;

    if (updatedQuantity > product.stock) {
      return { error: { status: 400, message: "Not enough stock to add more of this item." } };
    }

    existingItem.quantity = updatedQuantity;
  } else {
    user.cartItems.push({ product: product._id, quantity });
  }

  await user.save();
  return { cart: await getCart(userId) };
}

async function updateCartItem(userId, productId, quantity) {
  if (getDatabaseMode() === "local") {
    const data = readLocalStore();
    const user = findLocalUserById(data, userId);
    const product = data.products.find((entry) => entry.id === String(productId));

    if (!product) {
      return { error: { status: 404, message: "Product not found." } };
    }

    if (quantity > product.stock) {
      return { error: { status: 400, message: "Requested quantity is not available." } };
    }

    const existingItem = user.cartItems.find((item) => item.productId === String(productId));

    if (!existingItem) {
      return { error: { status: 404, message: "Cart item not found." } };
    }

    existingItem.quantity = quantity;
    user.updatedAt = new Date().toISOString();
    writeLocalStore(data);
    return { cart: buildLocalCart(data, user) };
  }

  const product = await Product.findById(productId);

  if (!product) {
    return { error: { status: 404, message: "Product not found." } };
  }

  if (quantity > product.stock) {
    return { error: { status: 400, message: "Requested quantity is not available." } };
  }

  const user = await User.findById(userId);
  const existingItem = user.cartItems.find((item) => item.product.toString() === String(productId));

  if (!existingItem) {
    return { error: { status: 404, message: "Cart item not found." } };
  }

  existingItem.quantity = quantity;
  await user.save();
  return { cart: await getCart(userId) };
}

async function removeCartItem(userId, productId) {
  if (getDatabaseMode() === "local") {
    const data = readLocalStore();
    const user = findLocalUserById(data, userId);

    user.cartItems = user.cartItems.filter((item) => item.productId !== String(productId));
    user.updatedAt = new Date().toISOString();
    writeLocalStore(data);
    return buildLocalCart(data, user);
  }

  const user = await User.findById(userId);
  user.cartItems = user.cartItems.filter((item) => item.product.toString() !== String(productId));
  await user.save();
  return getCart(userId);
}

async function createOrderFromCart(
  userId,
  shippingAddress,
  { paymentMethod = "Cash on Delivery", stripeCheckoutSessionId = null, expectedTotalAmount = null } = {}
) {
  if (getDatabaseMode() === "local") {
    const data = readLocalStore();
    const user = findLocalUserById(data, userId);

    if (stripeCheckoutSessionId) {
      const existingOrder = data.orders.find((entry) => entry.stripeCheckoutSessionId === stripeCheckoutSessionId);

      if (existingOrder) {
        return {
          order: {
            id: existingOrder.id,
            totalAmount: existingOrder.totalAmount,
            status: existingOrder.status,
            createdAt: existingOrder.createdAt
          }
        };
      }
    }

    if (!user.cartItems.length) {
      return { error: { status: 400, message: "Your cart is empty." } };
    }

    const items = [];
    let totalAmount = 0;

    for (const cartItem of user.cartItems) {
      const product = data.products.find((entry) => entry.id === cartItem.productId);

      if (!product) {
        return { error: { status: 400, message: "A product in your cart no longer exists." } };
      }

      if (product.stock < cartItem.quantity) {
        return { error: { status: 400, message: `${product.name} does not have enough stock.` } };
      }

      product.stock -= cartItem.quantity;
      product.updatedAt = new Date().toISOString();

      items.push({
        productId: product.id,
        name: product.name,
        image: product.image,
        price: product.price,
        quantity: cartItem.quantity
      });

      totalAmount += product.price * cartItem.quantity;
    }

    if (expectedTotalAmount !== null && Number(expectedTotalAmount) !== totalAmount) {
      return { error: { status: 400, message: "Cart total changed before payment confirmation. Please try again." } };
    }

    const order = {
      id: `order_${randomUUID()}`,
      userId: user.id,
      items,
      totalAmount,
      shippingAddress: {
        fullName: shippingAddress.fullName.trim(),
        phone: shippingAddress.phone.trim(),
        line1: shippingAddress.line1.trim(),
        line2: (shippingAddress.line2 || "").trim(),
        city: shippingAddress.city.trim(),
        state: shippingAddress.state.trim(),
        postalCode: shippingAddress.postalCode.trim(),
        country: shippingAddress.country.trim()
      },
      paymentMethod,
      status: "Placed",
      createdAt: new Date().toISOString()
    };

    if (stripeCheckoutSessionId) {
      order.stripeCheckoutSessionId = stripeCheckoutSessionId;
    }

    data.orders.unshift(order);
    user.cartItems = [];
    user.updatedAt = new Date().toISOString();
    writeLocalStore(data);

    return {
      order: {
        id: order.id,
        totalAmount: order.totalAmount,
        status: order.status,
        createdAt: order.createdAt
      }
    };
  }

  const user = await User.findById(userId).populate("cartItems.product");

  if (stripeCheckoutSessionId) {
    const existingOrder = await Order.findOne({ stripeCheckoutSessionId });

    if (existingOrder) {
      return {
        order: {
          id: toId(existingOrder),
          totalAmount: existingOrder.totalAmount,
          status: existingOrder.status,
          createdAt: existingOrder.createdAt
        }
      };
    }
  }

  if (!user.cartItems.length) {
    return { error: { status: 400, message: "Your cart is empty." } };
  }

  const items = [];
  let totalAmount = 0;

  for (const cartItem of user.cartItems) {
    const product = await Product.findById(cartItem.product._id);

    if (!product) {
      return { error: { status: 400, message: "A product in your cart no longer exists." } };
    }

    if (product.stock < cartItem.quantity) {
      return { error: { status: 400, message: `${product.name} does not have enough stock.` } };
    }

    product.stock -= cartItem.quantity;
    await product.save();

    items.push({
      productId: toId(product),
      name: product.name,
      image: product.image,
      price: product.price,
      quantity: cartItem.quantity
    });

    totalAmount += product.price * cartItem.quantity;
  }

  if (expectedTotalAmount !== null && Number(expectedTotalAmount) !== totalAmount) {
    return { error: { status: 400, message: "Cart total changed before payment confirmation. Please try again." } };
  }

  const orderPayload = {
    user: user._id,
    items,
    totalAmount,
    shippingAddress: {
      fullName: shippingAddress.fullName.trim(),
      phone: shippingAddress.phone.trim(),
      line1: shippingAddress.line1.trim(),
      line2: (shippingAddress.line2 || "").trim(),
      city: shippingAddress.city.trim(),
      state: shippingAddress.state.trim(),
      postalCode: shippingAddress.postalCode.trim(),
      country: shippingAddress.country.trim()
    },
    paymentMethod,
    status: "Placed"
  };

  if (stripeCheckoutSessionId) {
    orderPayload.stripeCheckoutSessionId = stripeCheckoutSessionId;
  }

  const order = await Order.create(orderPayload);

  user.cartItems = [];
  await user.save();

  return {
    order: {
      id: toId(order),
      totalAmount: order.totalAmount,
      status: order.status,
      createdAt: order.createdAt
    }
  };
}

async function createOrder(userId, shippingAddress, paymentMethod = "Cash on Delivery") {
  return createOrderFromCart(userId, shippingAddress, { paymentMethod });
}

async function createPaidOrder(userId, shippingAddress, stripeCheckoutSessionId, expectedTotalAmount) {
  return createOrderFromCart(userId, shippingAddress, {
    paymentMethod: "Pay Online",
    stripeCheckoutSessionId,
    expectedTotalAmount
  });
}

async function cancelOrder(orderId, { userId, isAdmin = false } = {}) {
  if (getDatabaseMode() === "local") {
    const data = readLocalStore();
    const order = data.orders.find((entry) => entry.id === String(orderId));

    if (!order) {
      return { error: { status: 404, message: "Order not found." } };
    }

    if (!isAdmin && order.userId !== String(userId)) {
      return { error: { status: 403, message: "You can only cancel your own orders." } };
    }

    if (order.status === "Cancelled") {
      return { error: { status: 400, message: "Order is already cancelled." } };
    }

    for (const item of order.items || []) {
      const product = data.products.find((entry) => entry.id === String(item.productId));
      if (product) {
        product.stock += item.quantity;
        product.updatedAt = new Date().toISOString();
      }
    }

    order.status = "Cancelled";
    writeLocalStore(data);

    return { order: mapOrder(order) };
  }

  if (!/^[a-f\d]{24}$/i.test(String(orderId))) {
    return { error: { status: 404, message: "Order not found." } };
  }

  const order = await Order.findById(orderId);

  if (!order) {
    return { error: { status: 404, message: "Order not found." } };
  }

  if (!isAdmin && toId(order.user) !== String(userId)) {
    return { error: { status: 403, message: "You can only cancel your own orders." } };
  }

  if (order.status === "Cancelled") {
    return { error: { status: 400, message: "Order is already cancelled." } };
  }

  for (const item of order.items || []) {
    const product = await Product.findById(item.productId);
    if (product) {
      product.stock += item.quantity;
      await product.save();
    }
  }

  order.status = "Cancelled";
  await order.save();

  return { order: mapOrder(order) };
}

async function updateOrderStatus(orderId, status, { isAdmin = false } = {}) {
  if (!isAdmin) {
    return { error: { status: 403, message: "Admin access required." } };
  }

  if (!ADMIN_MANAGED_ORDER_STATUSES.includes(status)) {
    return { error: { status: 400, message: "Invalid order status." } };
  }

  if (getDatabaseMode() === "local") {
    const data = readLocalStore();
    const order = data.orders.find((entry) => entry.id === String(orderId));

    if (!order) {
      return { error: { status: 404, message: "Order not found." } };
    }

    if (order.status === "Cancelled") {
      return { error: { status: 400, message: "Cancelled orders cannot be updated." } };
    }

    order.status = status;
    writeLocalStore(data);

    return { order: mapOrder(order) };
  }

  if (!/^[a-f\d]{24}$/i.test(String(orderId))) {
    return { error: { status: 404, message: "Order not found." } };
  }

  const order = await Order.findById(orderId);

  if (!order) {
    return { error: { status: 404, message: "Order not found." } };
  }

  if (order.status === "Cancelled") {
    return { error: { status: 400, message: "Cancelled orders cannot be updated." } };
  }

  order.status = status;
  await order.save();

  return { order: mapOrder(order) };
}

async function getOrders(userId, { isAdmin = false } = {}) {
  if (getDatabaseMode() === "local") {
    const data = readLocalStore();
    const usersById = new Map(data.users.map((user) => [String(user.id), user]));
    const filteredOrders = data.orders.filter((order) => {
      if (!isAdmin) {
        return order.userId === String(userId);
      }

      const orderUser = usersById.get(String(order.userId));
      return (orderUser?.role || "customer") === "customer";
    });

    return filteredOrders
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((order) => {
        const mapped = mapOrder(order, usersById.get(String(order.userId))?.name || "");
        mapped.userEmail = usersById.get(String(order.userId))?.email || "";
        return mapped;
      });
  }

  if (isAdmin) {
    const orders = await Order.find()
      .populate("user", "name email role")
      .sort({ createdAt: -1 });

    return orders
      .filter((order) => (order.user?.role || "customer") === "customer")
      .map((order) => {
        const mapped = mapOrder(order, order.user?.name || "");
        mapped.userEmail = order.user?.email || "";
        return mapped;
      });
  }

  const orders = await Order.find({ user: userId }).sort({ createdAt: -1 });
  return orders.map((order) => mapOrder(order));
}

async function getAdminAnalytics() {
  if (getDatabaseMode() === "local") {
    const data = readLocalStore();
    const usersById = new Map(data.users.map((user) => [String(user.id), user]));
    const orders = [...data.orders]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((order) => mapOrder(order, usersById.get(String(order.userId))?.name || ""));

    return buildAdminAnalytics({
      orders,
      users: data.users,
      products: data.products.map(mapProduct)
    });
  }

  const [orders, users, products] = await Promise.all([
    Order.find().populate("user", "name email role").sort({ createdAt: -1 }),
    User.find().select("name email role"),
    Product.find()
  ]);

  const mappedOrders = orders.map((order) => mapOrder(order, order.user?.name || ""));
  mappedOrders.forEach((order, index) => {
    order.userEmail = orders[index]?.user?.email || "";
  });

  return buildAdminAnalytics({
    orders: mappedOrders,
    users,
    products: products.map(mapProduct)
  });
}

module.exports = {
  ensureLocalStore,
  getUserByEmail,
  getUserById,
  createUser,
  verifyUserPassword,
  getProducts,
  getCategories,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
  updateSavedAddress,
  createOrder,
  createPaidOrder,
  cancelOrder,
  updateOrderStatus,
  getOrders,
  getAdminAnalytics
};
