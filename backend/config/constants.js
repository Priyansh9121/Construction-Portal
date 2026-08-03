/*
|--------------------------------------------------------------------------
| Shared enumerations
|--------------------------------------------------------------------------
|
| Every fixed value the API compares against or writes to a VARCHAR column
| lives here, so a status string is defined once rather than being retyped
| at each call site. The database stores these as plain text rather than
| PostgreSQL enum types, which means a typo would be accepted silently —
| importing from this file is what prevents that.
|
| Object.freeze on each group makes accidental mutation at runtime throw in
| strict mode instead of qui  etly corrupting the set for every later caller.
|
| Values are lowercase snake_case except where an existing column already
| holds title case ("Personal Tender", "Income"); those are kept exactly as
| the data has them, because changing the constant would orphan every row
| already written.
|
| Consumed by the per-module validation files, the role middleware, and the
| frontend indirectly through API responses.
|
*/

/*
|--------------------------------------------------------------------------
| Roles
|--------------------------------------------------------------------------
*/

/**
 * The role stored on users.role — a person's role across the product.
 *
 * admin and manager are "the office" and may reach the commercial
 * registers; worker and subcontractor are confined to their own portals.
 * server.js enforces that split at the mount, not per route.
 */
const USER_ROLES = Object.freeze({
  ADMIN: "admin",
  MANAGER: "manager",
  WORKER: "worker",
  SUBCONTRACTOR: "subcontractor",
});

/**
 * The role stored on company_users.role — the same person's role within one
 * company.
 *
 * Deliberately the same four values, because the product is multi-tenant
 * but a user currently belongs to a single company. The two are kept
 * separate so a future membership model can diverge without a migration:
 * authMiddleware already reads `cu.role AS company_role` alongside
 * `u.role`, and roleMiddleware accepts either.
 */
const COMPANY_ROLES = Object.freeze({
  ADMIN: "admin",
  MANAGER: "manager",
  WORKER: "worker",
  SUBCONTRACTOR: "subcontractor",
});

/**
 * Generic active/inactive flag, used for users, workers and subcontractors.
 *
 * Distinct from deletion: a row is soft-deleted with is_deleted, whereas an
 * inactive row still exists and can be switched back on. A disabled user
 * cannot sign in; the Users screen offers Enable to reverse it.
 */
const RECORD_STATUS = Object.freeze({
  ACTIVE: "active",
  INACTIVE: "inactive",
});

/*
|--------------------------------------------------------------------------
| Tenders (called "Projects" in the UI)
|--------------------------------------------------------------------------
*/

/**
 * Lifecycle of a tender.
 *
 * "passed" means the tender was won and handed over — not "elapsed".
 * tenderValidation.js rejects anything outside this set with
 * "Invalid tender status."
 */
const TENDER_STATUS = Object.freeze({
  RUNNING: "running",
  PENDING: "pending",
  COMPLETED: "completed",
  PASSED: "passed",
});

/**
 * Who the work is for.
 *
 * A personal tender is the company's own; a subcontractor tender is work
 * taken on under someone else. The distinction drives the Add Payment tree
 * — the two branches accept different sub-types.
 *
 * Title case because the column already holds it that way.
 */
const TENDER_TYPES = Object.freeze({
  PERSONAL: "Personal Tender",
  SUBCONTRACTOR: "Subcontractor Tender",
});

/**
 * Scheduling urgency. Display only — nothing branches on it.
 */
const PRIORITY_LEVELS = Object.freeze({
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
});

/**
 * Commercial or safety risk. Display only, same as priority.
 */
const RISK_LEVELS = Object.freeze({
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
});

/*
|--------------------------------------------------------------------------
| Sites
|--------------------------------------------------------------------------
|
| A site belongs to a tender (sites.tender_id). Note the direction: there
| is no tenders.site_id, and queries that assumed one were a recurring bug.
|
*/

/**
 * Lifecycle of a site. Carries on_hold, which tenders do not.
 */
const SITE_STATUS = Object.freeze({
  ACTIVE: "active",
  INACTIVE: "inactive",
  COMPLETED: "completed",
  ON_HOLD: "on_hold",
});

/**
 * Mirrors TENDER_TYPES for the site that sits under the tender.
 */
const SITE_TYPES = Object.freeze({
  PERSONAL: "Personal Site",
  SUBCONTRACTOR: "Subcontractor Site",
});

/**
 * State of a worker or subcontractor assignment to a tender.
 *
 * The worker portal only treats an assignment as current when this is
 * "active" — that check is what decides whether a labourer may submit a
 * daily update for a given site.
 */
const ASSIGNMENT_STATUS = Object.freeze({
  ACTIVE: "active",
  INACTIVE: "inactive",
  COMPLETED: "completed",
});

/*
|--------------------------------------------------------------------------
| Approvals
|--------------------------------------------------------------------------
*/

/**
 * The office sign-off state shared by everything a supervisor or worker
 * submits: material entries, supervisor expenses, worker allocations and
 * backdated daily updates.
 *
 * Rows are written "pending" and stay there until someone decides them.
 * A pending worker allocation cannot be spent against, so leaving one
 * undecided blocks the worker.
 */
const APPROVAL_STATUS = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
});

/**
 * Site inspection lifecycle.
 *
 * The site_inspections table exists and nothing writes to it yet; these are
 * here for when that screen is built.
 */
const INSPECTION_STATUS = Object.freeze({
  SCHEDULED: "scheduled",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
});

/**
 * Tender milestone lifecycle. Carries "delayed", which the other status
 * sets do not, because a milestone's whole purpose is tracking slippage.
 *
 * tender_milestones is likewise not yet written to.
 */
const MILESTONE_STATUS = Object.freeze({
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  DELAYED: "delayed",
  CANCELLED: "cancelled",
});

/*
|--------------------------------------------------------------------------
| Cross-cutting
|--------------------------------------------------------------------------
*/

/**
 * Severity of a notification, driving its colour in the bell panel.
 *
 * Note that notification.service.js writes its own richer set — for
 * instance "access_request" — so these four are the generic fallbacks
 * rather than the complete list of what the column holds.
 */
const NOTIFICATION_TYPES = Object.freeze({
  INFO: "info",
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "error",
});

/**
 * What a comment may be attached to.
 *
 * The comments table is not yet written to; this is the intended surface.
 */
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

/**
 * What an uploaded file may be attached to, stored on files.module.
 *
 * Duplicated on the frontend as FILE_MODULES in services/uploadService.js —
 * the two lists must be kept in step, since the upload controller rejects a
 * module it does not recognise.
 */
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

/**
 * Verbs written to activity_logs.action by the audit trail.
 *
 * utils/activityLog.js attaches a logActivity(module, action) middleware to
 * each mutating route, and the Activity Log screen filters on these.
 *
 * LOGIN, LOGOUT, UPLOAD and DOWNLOAD are declared but not yet emitted — the
 * trail currently covers record mutations only.
 */
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

/*
|--------------------------------------------------------------------------
| Money
|--------------------------------------------------------------------------
|
| Three overlapping vocabularies live here for historical reasons, and it
| is worth knowing which is which:
|
|   PAYMENT_TYPES        the older, coarse label on payments.payment_type
|   PAYMENT_DIRECTIONS   the newer income/expense axis the Add Payment tree
|                        is built on (payments.payment_direction)
|   FINANCE_RECORD_TYPES the record_type on tender_finance_records, a
|                        separate table from payments
|
| The authoritative tree for the Add Payment screen is not here — it is
| modules/payments/payment.hierarchy.js, which also validates the
| direction/scope/sub-type combination a submission uses.
|
*/

/**
 * Coarse classification on payments.payment_type. Title case, matching the
 * existing column contents.
 */
const PAYMENT_TYPES = Object.freeze({
  INCOME: "Income",
  EXPENSE: "Expense",
  INVESTMENT: "Investment",
  LOAN: "Loan",
  RETURN: "Return",
});

/**
 * record_type on tender_finance_records.
 *
 * That table is populated through /api/tenders/:id/finance and is not what
 * the Finance tab displays — that reads payments. The two are separate
 * ledgers.
 */
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

/**
 * How money moved.
 *
 * The site operations screens use a wider set of their own — they add
 * "gst_cash", the third route from the operations notebook — so this is not
 * the complete list of values the database holds.
 */
const PAYMENT_MODES = Object.freeze({
  CASH: "cash",
  BANK: "bank",
  CHEQUE: "cheque",
  UPI: "upi",
});

/**
 * The income/expense axis on payments.payment_direction.
 *
 * Together with payment_scope and payment_sub_type this forms the triple
 * that payment.hierarchy.js validates — 21 combinations are accepted and
 * anything else is refused.
 */
const PAYMENT_DIRECTIONS = Object.freeze({
  INCOME: "income",
  EXPENSE: "expense",
});

/**
 * Currencies a company may be denominated in, stored on
 * companies.currency_code as ISO 4217.
 *
 * AUD is the schema default; DEFAULT_CURRENCY in the environment overrides
 * it, and this deployment sets INR.
 */
const CURRENCY_CODES = Object.freeze({
  AUD: "AUD",
  INR: "INR",
  USD: "USD",
});

/*
|--------------------------------------------------------------------------
| Defaults
|--------------------------------------------------------------------------
*/

/**
 * Values applied when a field is left unset on create.
 *
 * COMPANY_TIMEZONE matters more than it looks: it decides what "today"
 * means for the two-day backdated-entry rule. A supervisor in India must
 * not be told an entry is in the future because the server is on UTC, so
 * the entry-window service formats dates in the company's own zone.
 *
 * Note this default is Australia/Melbourne while DEFAULT_TIMEZONE in the
 * environment is Asia/Kolkata — the environment wins at registration, and
 * this only applies if a company somehow has none.
 */
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

/*
|--------------------------------------------------------------------------
| Exports
|--------------------------------------------------------------------------
|
| Grouped by area rather than alphabetically so a reader can see which
| constants belong together.
|
*/
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
