const express = require("express");
const { signup, adminSignup, login, adminLogin, me, saveAddress } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/signup", signup);
router.post("/admin/signup", adminSignup);
router.post("/login", login);
router.post("/admin/login", adminLogin);
router.get("/me", protect, me);
router.patch("/address", protect, saveAddress);

module.exports = router;
