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
 */
router.get(
  "/",
  asyncHandler(companyController.getCompany)
);

/**
 * PUT /api/company
 *
 * Company service also verifies administrator access.
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
 */
router.post(
  "/transfer-ownership",
  roleMiddleware(["admin"], {
    source: "either",
  }),
  asyncHandler(companyController.transferOwnership)
);

module.exports = router;