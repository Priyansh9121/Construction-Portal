const express = require("express");
const router = express.Router();

const authController = require("./auth.controller");
const authMiddleware = require("../../middleware/authMiddleware");

router.post("/register", authController.register);
router.post("/login", authController.login);

router.post("/create-user", authMiddleware, authController.createUser);
router.put("/change-password", authMiddleware, authController.changePassword);

router.get("/users", authMiddleware, authController.getUsers);
router.put("/users/:userId", authMiddleware, authController.updateUser);
router.put("/users/:userId/disable", authMiddleware, authController.disableUser);

router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

module.exports = router;