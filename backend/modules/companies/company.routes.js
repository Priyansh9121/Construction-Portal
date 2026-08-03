/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The URL map for /api/company: the company's own profile, its membership
| list, and the transfer of ownership.
|
| This overlaps with /api/auth/users, and the split is by subject rather
| than by action. auth manages the USER — the account, its password, its
| global role. This module manages the MEMBERSHIP — who belongs to this
| company, in what capacity, and who owns it.
|
| Endpoint summary:
|
|   Method Path                        Auth  Roles
|   ------ --------------------------- ----  ----------------
|   GET    /                           yes   any member
|   PUT    /                           yes   admin
|   GET    /members                    yes   admin, manager
|   PUT    /members/:userId/role       yes   admin (+ owner rules)
|   DELETE /members/:userId            yes   admin
|   POST   /transfer-ownership         yes   admin (+ owner only)
|
| Mount:
|   server.js mounts this at /api/company behind authMiddleware but with NO
|   role gate, because GET / must be reachable by every role — the frontend
|   needs the company's name, currency and timezone to render anything.
|   Each route above therefore carries its own roleMiddleware.
|
| Exports:
|   an Express router
|
| Used by:
|   backend/server.js
|
| Depends on:
|   ./company.controller.js
|   middleware/roleMiddleware.js
|   utils/asyncHandler.js
|
| Database tables touched (through the controller):
|   companies, company_users, users
|
| Frontend consumers:
|   frontend/src/services/companyService.js, and through it SettingsPage
|   and UsersPage.
|
| Note:
|   None of these routes carry logActivity, so membership and ownership
|   changes are not written to the audit trail — unlike the equivalent user
|   changes under /api/auth/users, which are. Recorded as F-09 in
|   docs/repository-reference/findings.md.
|
*/

const express = require("express");

const asyncHandler = require("../../utils/asyncHandler");
const roleMiddleware = require("../../middleware/roleMiddleware");

const companyController = require("./company.controller");

const router = express.Router();

/**
 * Authentication is already applied in server.js.
 *
 * Do not add authMiddleware again here.
 */

/**
 * GET /api/company
 *
 * Any authenticated company member can view the company profile.
 *
 * Auth:       required
 * Roles:      any — deliberately ungated
 * Controller: company.getCompany
 * Response:   200 { success, company }
 *
 * The only route here without a role check, and it has to be. Currency and
 * timezone drive how every screen formats money and dates, so a worker in
 * the portal needs this exactly as much as an administrator does.
 */
router.get(
  "/",
  asyncHandler(companyController.getCompany)
);

/**
 * PUT /api/company
 *
 * Company service also verifies administrator access.
 *
 * Auth:       required
 * Roles:      admin
 * Body:       company_name, industry, currency_code, timezone
 * Controller: company.updateCompany
 * Response:   200 { success, company }
 *             400 validation failed
 *
 * Business rule:
 * Changing the timezone changes what "today" means for the supervisor
 * backdated-entry window, so this is not a purely cosmetic setting.
 *
 * Security:
 * The company id comes from the session, not the body, so an admin can only
 * ever edit their own company.
 *
 * Frontend: SettingsPage.jsx.
 */
router.put(
  "/",
  roleMiddleware(["admin"], {
    source: "either",
  }),
  asyncHandler(companyController.updateCompany)
);

/**
 * GET /api/company/members
 *
 * Administrators and managers can view company membership.
 *
 * Auth:       required
 * Roles:      admin, manager
 * Controller: company.getMembers
 * Response:   200 { success, members }
 *
 * Managers are included here but excluded from every mutating route below.
 * A manager needs to see who is on the team — to assign work — without
 * being able to change anyone's standing.
 */
router.get(
  "/members",
  roleMiddleware(["admin", "manager"], {
    source: "either",
  }),
  asyncHandler(companyController.getMembers)
);

/**
 * PUT /api/company/members/:userId/role
 *
 * The company service applies additional owner-only rules when
 * administrator access is granted.
 *
 * Auth:       required
 * Roles:      admin, plus an owner check in the controller when the new
 *             role is admin
 * Params:     :userId, who must be a member of this company
 * Body:       role
 * Controller: company.updateMemberRole
 * Response:   200 { success, member }
 *             403 a non-owner granting admin
 *             404 not a member of this company
 *
 * Security:
 * A privilege-escalation surface, contained the same way as
 * /api/auth/users/:userId — membership scoping plus owner-only promotion.
 * This route changes company_users.role; the auth module's route changes
 * both that and users.role together.
 */
router.put(
  "/members/:userId/role",
  roleMiddleware(["admin"], {
    source: "either",
  }),
  asyncHandler(companyController.updateMemberRole)
);

/**
 * DELETE /api/company/members/:userId
 *
 * Auth:       required
 * Roles:      admin
 * Params:     :userId
 * Controller: company.removeMember
 * Response:   200 on success
 *             400 removing yourself, or removing the owner
 *             404 not a member of this company
 *
 * Business rule:
 * Removes the MEMBERSHIP, not the user. The account survives — it simply
 * no longer belongs to this company, and every subsequent request fails
 * requireCompanyId. That distinction is why disabling a user lives under
 * /api/auth and removing one lives here.
 *
 * The owner cannot be removed; ownership must be transferred first.
 */
router.delete(
  "/members/:userId",
  roleMiddleware(["admin"], {
    source: "either",
  }),
  asyncHandler(companyController.removeMember)
);

/**
 * POST /api/company/transfer-ownership
 *
 * The service confirms that the authenticated user is the current owner.
 *
 * Auth:       required
 * Roles:      admin at the route, and the CURRENT OWNER in the controller
 * Body:       new_owner_user_id
 * Controller: company.transferOwnership
 * Response:   200 on success
 *             403 the caller is not the owner
 *             404 the nominated user is not a member
 *
 * Business rules:
 * - Only the sitting owner may hand ownership on. The admin gate at the
 *   route is not sufficient by itself, and the controller check is what
 *   actually enforces this.
 * - The nominated user must already be a member of the company.
 * - The recipient becomes an administrator as part of the transfer, since
 *   an owner who is not an admin would be the locked-out state that
 *   updateUser exists to prevent.
 *
 * Security:
 * The most consequential endpoint in the module — it moves the standing
 * that gates admin creation, admin promotion and this route itself. It is
 * also, notably, not audited. See F-09 in findings.md.
 */
router.post(
  "/transfer-ownership",
  roleMiddleware(["admin"], {
    source: "either",
  }),
  asyncHandler(companyController.transferOwnership)
);

module.exports = router;