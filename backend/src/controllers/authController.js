const asyncHandler = require("../utils/asyncHandler");
const { createToken } = require("../utils/token");
const { getUserByEmail, createUser, verifyUserPassword, updateSavedAddress } = require("../services/store");

async function handleSignup(req, res, role = "customer") {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email, and password are required." });
  }

  const existingUser = await getUserByEmail(email);

  if (existingUser) {
    return res.status(409).json({ message: "An account with that email already exists." });
  }

  const user = await createUser({
    name,
    email,
    password,
    role
  });

  return res.status(201).json({
    token: createToken(user.id),
    user
  });
}

async function handleLogin(req, res, role) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  const user = await getUserByEmail(email, { includePassword: true });

  if (!user) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  const matches = await verifyUserPassword(user, password);

  if (!matches) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  if (role && user.role !== role) {
    return res.status(403).json({ message: "This account does not have the required access." });
  }

  return res.json({
    token: createToken(user.id),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role || "customer"
    }
  });
}

const signup = asyncHandler(async (req, res) => handleSignup(req, res, "customer"));
const adminSignup = asyncHandler(async (req, res) => handleSignup(req, res, "admin"));
const login = asyncHandler(async (req, res) => handleLogin(req, res, null));
const adminLogin = asyncHandler(async (req, res) => handleLogin(req, res, "admin"));

const me = asyncHandler(async (req, res) => {
  return res.json({ user: req.user });
});

const saveAddress = asyncHandler(async (req, res) => {
  const requiredFields = ["fullName", "phone", "line1", "city", "state", "postalCode", "country"];

  for (const field of requiredFields) {
    if (!req.body?.[field]) {
      return res.status(400).json({ message: `Address field "${field}" is required.` });
    }
  }

  const user = await updateSavedAddress(req.user.id, req.body);

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  return res.json({ user, message: "Address saved successfully." });
});

module.exports = { signup, adminSignup, login, adminLogin, me, saveAddress };
