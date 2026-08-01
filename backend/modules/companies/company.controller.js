const {
    requireCompanyId,
    requireParamId,
    getUserId,
    cleanText,
    sendNotFound,
  } = require("../../utils/requestContext");
  
const {
    getCompanyForUser,
    getCompanyMembers,
    updateCompany: updateCompanyService,
    transferCompanyOwnership,
    updateCompanyMemberRole,
    removeCompanyMember,
} = require("./company.service");
  
  /**
   * GET /api/company
   *
   * Returns the authenticated user's current company.
   */
  exports.getCompany = async (
    req,
    res
  ) => {
    const companyId =
      requireCompanyId(
        req,
        res
      );
  
    if (!companyId) {
      return;
    }
  
    const userId =
      getUserId(req);
  
    const company =
      await getCompanyForUser({
        companyId,
        userId,
      });
  
    if (!company) {
      return sendNotFound(
        res,
        "Company"
      );
    }
  
    return res.status(200).json({
      success: true,
      company,
    });
  };
  
  /**
   * PUT /api/company
   *
   * Updates company profile and configuration.
   *
   * Company service enforces administrator access.
   */
  exports.updateCompany = async (
    req,
    res
  ) => {
    const companyId =
      requireCompanyId(
        req,
        res
      );
  
    if (!companyId) {
      return;
    }
  
    const userId =
      getUserId(req);
  
    const company =
      await updateCompanyService({
        companyId,
        userId,
        updates: req.body,
      });
  
    return res.status(200).json({
      success: true,
      message:
        "Company updated successfully.",
      company,
    });
  };
  
  /**
   * GET /api/company/members
   *
   * Optional query:
   *
   * include_inactive=true|false
   */
  exports.getMembers = async (
    req,
    res
  ) => {
    const companyId =
      requireCompanyId(
        req,
        res
      );
  
    if (!companyId) {
      return;
    }
  
    const includeInactive =
      String(
        req.query
          .include_inactive ||
          ""
      )
        .trim()
        .toLowerCase() !==
      "false";
  
    const members =
      await getCompanyMembers({
        companyId,
        includeInactive,
      });
  
    return res.status(200).json({
      success: true,
      members,
      count: members.length,
    });
  };
  
  /**
   * PUT /api/company/members/:userId/role
   *
   * Changes only the company-specific membership role.
   *
   * It does not change users.role. Account-role changes remain in
   * the authenticated user-management controller.
   */
  exports.updateMemberRole = async (
    req,
    res
  ) => {
    const companyId =
      requireCompanyId(
        req,
        res
      );
  
    if (!companyId) {
      return;
    }
  
    const memberUserId =
      requireParamId(
        req,
        res,
        "userId",
        "user"
      );
  
    if (!memberUserId) {
      return;
    }
  
    const role =
      cleanText(
        req.body.role
      ).toLowerCase();
  
    if (!role) {
      return res.status(400).json({
        success: false,
        message:
          "Company role is required.",
      });
    }
  
    const membership =
      await updateCompanyMemberRole({
        companyId,
        actingUserId:
          getUserId(req),
        memberUserId,
        role,
      });
  
    return res.status(200).json({
      success: true,
      message:
        "Company member role updated successfully.",
      membership,
    });
  };
  
  /**
   * DELETE /api/company/members/:userId
   *
   * Removes the company_users relationship.
   *
   * This does not delete the underlying users row.
   */
  exports.removeMember = async (
    req,
    res
  ) => {
    const companyId =
      requireCompanyId(
        req,
        res
      );
  
    if (!companyId) {
      return;
    }
  
    const memberUserId =
      requireParamId(
        req,
        res,
        "userId",
        "user"
      );
  
    if (!memberUserId) {
      return;
    }
  
    const membership =
      await removeCompanyMember({
        companyId,
        actingUserId:
          getUserId(req),
        memberUserId,
      });
  
    return res.status(200).json({
      success: true,
      message:
        "User removed from the company successfully.",
      membership,
    });
  };
  
  /**
   * POST /api/company/transfer-ownership
   *
   * Body:
   *
   * {
   *   "new_owner_user_id": 5
   * }
   */
  exports.transferOwnership = async (
    req,
    res
  ) => {
    const companyId =
      requireCompanyId(
        req,
        res
      );
  
    if (!companyId) {
      return;
    }
  
    const nextOwnerUserId =
      Number(
        req.body
          .new_owner_user_id
      );
  
    if (
      !Number.isInteger(
        nextOwnerUserId
      ) ||
      nextOwnerUserId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "A valid new owner user ID is required.",
      });
    }
  
    const company =
      await transferCompanyOwnership({
        companyId,
        currentOwnerUserId:
          getUserId(req),
        nextOwnerUserId,
      });
  
    return res.status(200).json({
      success: true,
      message:
        "Company ownership transferred successfully.",
      company,
    });
  };