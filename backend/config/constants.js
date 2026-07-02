const USER_ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  WORKER: "worker",
  SUBCONTRACTOR: "subcontractor",
};

const TENDER_STATUS = {
  RUNNING: "running",
  COMPLETED: "completed",
  PENDING: "pending",
};

const SITE_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
};

/*
|--------------------------------------------------------------------------
| Legacy Payments
|--------------------------------------------------------------------------
| Keep these until the new finance module completely replaces them.
|--------------------------------------------------------------------------
*/

const PAYMENT_TYPES = {
  INCOME: "Income",
  EXPENSE: "Expense",
  INVESTMENT: "Investment",
  LOAN: "Loan",
  RETURN: "Return",
};

/*
|--------------------------------------------------------------------------
| Tender Finance
|--------------------------------------------------------------------------
*/

const FINANCE_RECORD_TYPES = {
  INVESTOR: "INVESTOR",
  GOVERNMENT_BILL: "GOVERNMENT_BILL",
  SUBCONTRACTOR: "SUBCONTRACTOR",
  OFFICE: "OFFICE",
  COMPANY_CHARGE: "COMPANY_CHARGE",
  COMPANY_CHARGE_PAYMENT: "COMPANY_CHARGE_PAYMENT",
  TDS: "TDS",
  GST_RETURN: "GST_RETURN",
};

/*
|--------------------------------------------------------------------------
| Payment Modes
|--------------------------------------------------------------------------
*/

const PAYMENT_MODES = {
  CASH: "cash",
  BANK: "bank",
  CHEQUE: "cheque",
  UPI: "upi",
};

/*
|--------------------------------------------------------------------------
| Finance Direction
|--------------------------------------------------------------------------
*/

const PAYMENT_DIRECTIONS = {
  INCOME: "income",
  EXPENSE: "expense",
};

module.exports = {
  USER_ROLES,
  TENDER_STATUS,
  SITE_STATUS,
  PAYMENT_TYPES, // Keep until migration is complete
  FINANCE_RECORD_TYPES,
  PAYMENT_MODES,
  PAYMENT_DIRECTIONS,
};