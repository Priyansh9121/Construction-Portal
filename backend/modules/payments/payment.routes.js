const express = require("express");
const router = express.Router();

const paymentController = require("./payment.controller");
const validatePayment = require("./validations/payment.validation");

router.get("/", paymentController.getPayments);
router.post("/", validatePayment, paymentController.createPayment);
router.delete("/:id", paymentController.deletePayment);

module.exports = router;