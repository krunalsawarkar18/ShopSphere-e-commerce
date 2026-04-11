const jwt = require("jsonwebtoken");
const { getUserById } = require("../services/store");

async function protect(req, res, next) {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserById(decoded.userId);

    if (!user) {
      return res.status(401).json({ message: "User no longer exists." });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }

  return next();
}

function customerOnly(req, res, next) {
  if (!req.user || req.user.role !== "customer") {
    return res.status(403).json({ message: "Customer access required for shopping actions." });
  }

  return next();
}

module.exports = { protect, adminOnly, customerOnly };
