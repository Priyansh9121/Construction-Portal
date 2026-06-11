const express = require("express");
const router = express.Router();

const authController = require("./auth.controller");
const authMiddleware = require("../../middleware/authMiddleware");
const roleMiddleware = require("../../middleware/roleMiddleware");

router.post("/register", authController.register);
router.post("/login", authController.login);

router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

router.put(
  "/change-password",
  authMiddleware,
  authController.changePassword
);

router.post(
  "/create-user",
  authMiddleware,
  roleMiddleware(["admin"]),
  authController.createUser
);

router.get(
  "/users",
  authMiddleware,
  roleMiddleware(["admin"]),
  authController.getUsers
);

router.put(
  "/users/:userId",
  authMiddleware,
  roleMiddleware(["admin"]),
  authController.updateUser
);

router.put(
  "/users/:userId/disable",
  authMiddleware,
  roleMiddleware(["admin"]),
  authController.disableUser
);

module.exports = router;