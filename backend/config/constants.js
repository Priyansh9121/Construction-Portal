const USER_ROLES = Object.freeze({
  ADMIN: "admin",
  MANAGER: "manager",
  WORKER: "worker",
  SUBCONTRACTOR: "subcontractor",
});

const COMPANY_ROLES = Object.freeze({
  ADMIN: "admin",
  MANAGER: "manager",
  WORKER: "worker",
  SUBCONTRACTOR: "subcontractor",
});

const RECORD_STATUS = Object.freeze({
  ACTIVE: "active",
  INACTIVE: "inactive",
});

const TENDER_STATUS = Object.freeze({
  RUNNING: "running",
  PENDING: "pending",
  COMPLETED: "completed",
  PASSED: "passed",
});

const TENDER_TYPES = Object.freeze({
  PERSONAL: "Personal Tender",
  SUBCONTRACTOR: "Subcontractor Tender",
});

const PRIORITY_LEVELS = Object.freeze({
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
});

const RISK_LEVELS = Object.freeze({
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
});

const SITE_STATUS = Object.freeze({
  ACTIVE: "active",
  INACTIVE: "inactive",
  COMPLETED: "completed",
  ON_HOLD: "on_hold",
});

const SITE_TYPES = Object.freeze({
  PERSONAL: "Personal Site",
  SUBCONTRACTOR: "Subcontractor Site",
});

const ASSIGNMENT_STATUS = Object.freeze({
  ACTIVE: "active",
  INACTIVE: "inactive",
  COMPLETED: "completed",
});

const APPROVAL_STATUS = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
});

const INSPECTION_STATUS = Object.freeze({
  SCHEDULED: "scheduled",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
});

const MILESTONE_STATUS = Object.freeze({
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  DELAYED: "delayed",
  CANCELLED: "cancelled",
});

const NOTIFICATION_TYPES = Object.freeze({
  INFO: "info",
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "error",
});

const COMMENT_MODULES = Object.freeze({
  TENDER: "tender",
  SITE: "site",
  WORKER: "worker",
  SUBCONTRACTOR: "subcontractor",
  INVOICE: "invoice",
  PAYMENT: "payment",
  INSPECTION: "inspection",
  MILESTONE: "milestone",
});

const FILE_MODULES = Object.freeze({
  TENDER: "tender",
  SITE: "site",
  WORKER: "worker",
  SUBCONTRACTOR: "subcontractor",
  INVOICE: "invoice",
  DAILY_UPDATE: "daily_update",
  INSPECTION: "inspection",
  MODEL: "model",
});

const ACTIVITY_ACTIONS = Object.freeze({
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  RESTORE: "restore",
  APPROVE: "approve",
  REJECT: "reject",
  ASSIGN: "assign",
  REMOVE: "remove",
  LOGIN: "login",
  LOGOUT: "logout",
  UPLOAD: "upload",
  DOWNLOAD: "download",
});

const PAYMENT_TYPES = Object.freeze({
  INCOME: "Income",
  EXPENSE: "Expense",
  INVESTMENT: "Investment",
  LOAN: "Loan",
  RETURN: "Return",
});

const FINANCE_RECORD_TYPES = Object.freeze({
  INVESTOR: "INVESTOR",
  GOVERNMENT_BILL: "GOVERNMENT_BILL",
  SUBCONTRACTOR: "SUBCONTRACTOR",
  OFFICE: "OFFICE",
  COMPANY_CHARGE: "COMPANY_CHARGE",
  COMPANY_CHARGE_PAYMENT: "COMPANY_CHARGE_PAYMENT",
  TDS: "TDS",
  GST_RETURN: "GST_RETURN",
});

const PAYMENT_MODES = Object.freeze({
  CASH: "cash",
  BANK: "bank",
  CHEQUE: "cheque",
  UPI: "upi",
});

const PAYMENT_DIRECTIONS = Object.freeze({
  INCOME: "income",
  EXPENSE: "expense",
});

const CURRENCY_CODES = Object.freeze({
  AUD: "AUD",
  INR: "INR",
  USD: "USD",
});

const DEFAULTS = Object.freeze({
  COMPANY_CURRENCY: "AUD",
  COMPANY_TIMEZONE: "Australia/Melbourne",
  TENDER_PRIORITY: PRIORITY_LEVELS.MEDIUM,
  TENDER_RISK: RISK_LEVELS.LOW,
  TENDER_STATUS: TENDER_STATUS.PENDING,
  TENDER_TYPE: TENDER_TYPES.PERSONAL,
  SITE_STATUS: SITE_STATUS.ACTIVE,
  SITE_TYPE: SITE_TYPES.PERSONAL,
  ASSIGNMENT_STATUS: ASSIGNMENT_STATUS.ACTIVE,
});

module.exports = {
  USER_ROLES,
  COMPANY_ROLES,
  RECORD_STATUS,

  TENDER_STATUS,
  TENDER_TYPES,
  PRIORITY_LEVELS,
  RISK_LEVELS,

  SITE_STATUS,
  SITE_TYPES,
  ASSIGNMENT_STATUS,

  APPROVAL_STATUS,
  INSPECTION_STATUS,
  MILESTONE_STATUS,

  NOTIFICATION_TYPES,
  COMMENT_MODULES,
  FILE_MODULES,
  ACTIVITY_ACTIONS,

  PAYMENT_TYPES,
  FINANCE_RECORD_TYPES,
  PAYMENT_MODES,
  PAYMENT_DIRECTIONS,

  CURRENCY_CODES,
  DEFAULTS,
};