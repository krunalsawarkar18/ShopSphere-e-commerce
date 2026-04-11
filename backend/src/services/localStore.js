const fs = require("fs");
const path = require("path");

const seedProducts = require("../data/products");

const localStorePath = path.join(__dirname, "..", "..", ".local-store.json");
const STORE_VERSION = 7;

function buildSeedProducts(now = new Date().toISOString()) {
  return seedProducts.map((product, index) => ({
    id: `prod_${index + 1}`,
    ...product,
    createdAt: now,
    updatedAt: now
  }));
}

function ensureLocalStore() {
  if (!fs.existsSync(localStorePath)) {
    const now = new Date().toISOString();
    const initialData = {
      version: STORE_VERSION,
      products: buildSeedProducts(now),
      users: [],
      orders: []
    };

    fs.writeFileSync(localStorePath, JSON.stringify(initialData, null, 2));
    return;
  }

  const existing = JSON.parse(fs.readFileSync(localStorePath, "utf-8"));

  if (existing.version === STORE_VERSION) {
    return;
  }

  const now = new Date().toISOString();
  const updated = {
    version: STORE_VERSION,
    products: buildSeedProducts(now),
      users: existing.users || [],
      orders: existing.orders || []
    };

  updated.users = updated.users.map((user) => ({
    ...user,
    role: user.role || "customer",
    savedAddress: user.savedAddress || {}
  }));

  fs.writeFileSync(localStorePath, JSON.stringify(updated, null, 2));
}

function readLocalStore() {
  ensureLocalStore();
  return JSON.parse(fs.readFileSync(localStorePath, "utf-8"));
}

function writeLocalStore(data) {
  fs.writeFileSync(localStorePath, JSON.stringify(data, null, 2));
}

module.exports = {
  ensureLocalStore,
  readLocalStore,
  writeLocalStore
};
