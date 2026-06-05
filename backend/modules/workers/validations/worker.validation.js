function validateWorker(req, res, next) {
    const {
      full_name,
      phone,
      salary,
      role,
      status,
    } = req.body;
  
    if (!full_name || !phone || !salary || !role || !status) {
      return res.status(400).json({
        success: false,
        message: "Worker name, phone, salary, role and status are required",
      });
    }
  
    if (Number(salary) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Salary must be greater than 0",
      });
    }
  
    next();
  }
  
  module.exports = validateWorker;