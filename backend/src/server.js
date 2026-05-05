require("dotenv").config();

const express = require("express");
const { connectDatabase, getDatabaseMode } = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const app = express();
const port = process.env.PORT || 5001;
const frontendOrigins = (process.env.FRONTEND_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function resolveAllowedOrigin(requestOrigin) {
  if (!requestOrigin) {
    return frontendOrigins[0] || "*";
  }

  if (frontendOrigins.includes("*") || frontendOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  if (/^https:\/\/.+\.vercel\.app$/i.test(requestOrigin)) {
    return requestOrigin;
  }

  return frontendOrigins[0] || "*";
}

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", resolveAllowedOrigin(req.headers.origin));
  res.header("Vary", "Origin");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  return next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", mode: getDatabaseMode() });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);

app.use(notFound);
app.use(errorHandler);

connectDatabase()
  .then((mode) => {
    const server = app.listen(port, () => {
      console.log(`Server running on http://localhost:${port} using ${mode} mode`);
    });

    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.error(
          `Port ${port} is already in use. Another ShopSphere backend instance is probably already running.`
        );
        console.error(`Stop the existing process on port ${port}, or start this one with a different PORT value.`);
        process.exit(1);
      }

      console.error("Failed to start server:", error.message);
      process.exit(1);
    });
  })
  .catch((error) => {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  });
