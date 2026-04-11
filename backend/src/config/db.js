const mongoose = require("mongoose");
const { ensureLocalStore } = require("../services/localStore");

let databaseMode = "mongo";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectDatabase(options = {}) {
  const mongoUri = process.env.MONGODB_URI;
  const allowLocalFallback = process.env.ALLOW_LOCAL_FALLBACK !== "false";
  const retries = options.retries ?? Number(process.env.DB_CONNECT_RETRIES || (allowLocalFallback ? 1 : 5));
  const retryDelayMs = options.retryDelayMs ?? Number(process.env.DB_CONNECT_RETRY_DELAY_MS || (allowLocalFallback ? 500 : 3000));
  const serverSelectionTimeoutMS = options.serverSelectionTimeoutMS ?? Number(process.env.DB_SERVER_SELECTION_TIMEOUT_MS || (allowLocalFallback ? 1500 : 5000));

  if (process.env.FORCE_LOCAL_STORE === "true") {
    ensureLocalStore();
    databaseMode = "local";
    console.warn("Using local JSON store because FORCE_LOCAL_STORE=true.");
    return databaseMode;
  }

  if (!mongoUri) {
    if (allowLocalFallback) {
      ensureLocalStore();
      databaseMode = "local";
      console.warn("MONGODB_URI is not configured. Using local JSON store.");
      return databaseMode;
    }

    throw new Error("MONGODB_URI is not configured.");
  }

  let lastError;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await mongoose.connect(mongoUri, {
        dbName: process.env.MONGODB_DB_NAME || "ecomm_web_mvp",
        serverSelectionTimeoutMS
      });

      databaseMode = "mongo";
      console.log(`MongoDB connected: ${mongoose.connection.host}`);
      return databaseMode;
    } catch (error) {
      lastError = error;
      console.error(`MongoDB connection attempt ${attempt}/${retries} failed: ${error.message}`);

      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }

      if (attempt < retries) {
        await sleep(retryDelayMs);
      }
    }
  }

  if (allowLocalFallback) {
    ensureLocalStore();
    databaseMode = "local";
    console.warn("MongoDB is unavailable. Falling back to local JSON store.");
    return databaseMode;
  }

  throw lastError;
}

function getDatabaseMode() {
  return databaseMode;
}

module.exports = { connectDatabase, getDatabaseMode };
