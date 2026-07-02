function validatePayment(req, res, next) {
  const { payment_type, amount, payment_date } = req.body;

  if (!payment_type || !amount || !payment_date) {
    return res.status(400).json({
      success: false,
      message: "Payment type, amount and date are required",
    });
  }

  if (Number(amount) <= 0) {
    return res.status(400).json({
      success: false,
      message: "Amount must be greater than 0",
    });
  }

  next();
}

module.exports = validatePayment;