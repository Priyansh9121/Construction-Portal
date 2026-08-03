/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The HTTP layer for /api/company. Six thin handlers over
| company.service.js.
|
| Thin is the design, not an accident. Every handler does the same four
| things and nothing more: resolve the company from the session, validate
| the path and body inputs, call one service function, and shape the
| response. No SQL, no authorisation decisions beyond what the route gate
| already applied.
|
| The authorisation that the route gate CANNOT express — "only the owner may
| do this", "you may not remove yourself" — lives in the service rather than
| here, because those rules need to read the current database state. Each
| handler notes which rules its service call enforces.
|
| Responsibilities:
|   - Read companyId and userId from the authenticated session
|   - Validate route parameters and body fields
|   - Delegate to company.service.js
|   - Return { success, ... }
|
| Exports (all Express handlers):
|   getCompany, updateCompany, getMembers,
|   updateMemberRole, removeMember, transferOwnership
|
| Used by:
|   ./company.routes.js
|
| Depends on:
|   utils/requestContext.js  identity, validation, responses
|   ./company.service.js     all business logic and every query
|
| Database tables touched (via the service):
|   companies, company_users, users
|
| Frontend consumers:
|   companyService.js -> SettingsPage.jsx, UsersPage.jsx
|
| Error handling:
|   The service throws errors carrying statusCode and publicMessage.
|   Nothing here catches them: asyncHandler forwards them to
|   errorHandler.js, which is why these handlers have no try/catch and no
|   403 branches of their own.
|
| Security:
|   Every handler starts with requireCompanyId, so all six are scoped to the
|   caller's own company. No handler reads a company id from the request.
|
*/

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
   *
   * Purpose:
   * Supplies the company context the whole frontend renders against — name,
   * currency and timezone.
   *
   * Parameters:
   * req - Express request, after authMiddleware
   * res - Express response
   *
   * Returns:
   * 200 { success, company }
   * 400 the account is not linked to a company
   * 404 the company id on the session no longer resolves
   *
   * Side effects:
   * One read through the service.
   *
   * Security:
   * The only route in this module open to every role, which is why the
   * service decides what a given user may see rather than returning the
   * whole row — userId is passed for exactly that reason.
   *
   * Frontend:
   * Loaded early by AuthProvider so currency and timezone are available
   * before any screen formats a figure or a date.
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
   *
   * Purpose:
   * Edits the company profile: name, industry, currency and timezone.
   *
   * Parameters:
   * req - Express request. Body is passed through to the service as
   *       `updates`; the service decides which keys are writable.
   * res - Express response
   *
   * Returns:
   * 200 { success, message, company }
   * 400 validation failed
   * 403 the service's own administrator check refused
   *
   * Side effects:
   * One UPDATE on companies.
   *
   * Business rule:
   * The timezone is not cosmetic. It defines "today" for the supervisor
   * backdated-entry window, so changing it moves the boundary of what site
   * staff may still record.
   *
   * Security:
   * req.body is forwarded wholesale, so the service — not this handler — is
   * responsible for the writable-column allow-list. That is the right place
   * for it, but it does mean this handler must never be repointed at a
   * service that trusts its input.
   *
   * The company id comes from the session, so an admin cannot edit another
   * tenant even by guessing an id.
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
   *
   * Purpose:
   * Lists who belongs to this company, for the team screens.
   *
   * Parameters:
   * req - Express request. Query: include_inactive.
   * res - Express response
   *
   * Returns:
   * 200 { success, members, count }
   * 400 the account has no company
   *
   * Side effects:
   * One read.
   *
   * Business rule:
   * Inactive members are INCLUDED by default — see the inline note on the
   * flag. An administrator managing the team needs to see disabled accounts
   * in order to re-enable them.
   *
   * Security:
   * Scoped to the caller's company. Managers may call this but none of the
   * mutating routes below.
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
  
    /*
     * Opt-OUT rather than opt-in: the flag is true unless the caller
     * explicitly sends "false". An absent parameter, an empty string or an
     * unrecognised value all mean "include them".
     *
     * That default is the useful one for a team-management screen, where
     * hiding disabled accounts would make them impossible to re-enable.
     *
     * Wrapped in String() because a repeated query parameter arrives as an
     * array, and .trim() on an array would throw.
     */
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
   *
   * Purpose:
   * Changes what someone may do inside this company, without touching their
   * account.
   *
   * Parameters:
   * req - Express request. Params: userId. Body: role.
   * res - Express response
   *
   * Returns:
   * 200 { success, message, membership }
   * 400 invalid id, or a missing role
   * 403 a non-owner granting administrator access
   * 404 the user is not a member of this company
   *
   * Side effects:
   * One UPDATE on company_users.
   *
   * Business rules:
   * - Only company_users.role changes. users.role is untouched, which is
   *   the documented split between this module and the auth module.
   * - Granting admin requires ownership, checked in the service.
   *
   * Security:
   * Worth understanding the consequence of the narrow scope. Because
   * roleMiddleware runs with `source: "either"`, raising someone's
   * company_role to admin grants administrative access across the API even
   * though their users.role still reads worker. The two routes reach the
   * same outcome by different paths.
   *
   * actingUserId is read from the session, so the service's owner check
   * cannot be spoofed through the body.
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
   *
   * Purpose:
   * Detaches someone from the company when they leave.
   *
   * Parameters:
   * req - Express request. Params: userId.
   * res - Express response
   *
   * Returns:
   * 200 { success, message, membership }
   * 400 invalid id, removing yourself, or removing the owner
   * 404 not a member of this company
   *
   * Side effects:
   * Deletes one company_users row.
   *
   * Business rules:
   * - The users row survives. It is referenced as created_by, approved_by
   *   and requested_by throughout the schema; deleting it would orphan
   *   history. What the person loses is their company, and with it every
   *   request — getCompanyId returns null and requireCompanyId answers 400.
   * - The owner cannot be removed. Ownership must be transferred first,
   *   otherwise the company would be left with no one able to administer it.
   * - Removing yourself is refused, for the same lockout reason as
   *   disableUser.
   *
   * Notes:
   * A hard DELETE, unlike most of this schema's soft deletes. That is
   * consistent — company_users is a link row that nothing else references,
   * so there is no history to preserve. It also means re-adding someone
   * later creates a fresh membership with a new joined-at date.
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
   *
   * Purpose:
   * Hands the company to another member — when a founder leaves, or when
   * the account that registered the company was never meant to hold it.
   *
   * Parameters:
   * req - Express request. Body: new_owner_user_id.
   * res - Express response
   *
   * Returns:
   * 200 { success, message, company }
   * 400 a missing or non-positive-integer id
   * 403 the caller is not the current owner
   * 404 the nominated user is not a member of this company
   *
   * Side effects:
   * Updates companies.owner_user_id and, in the service, ensures the new
   * owner holds administrator standing.
   *
   * Business rules:
   * - Only the sitting owner may transfer. The route's admin gate is not
   *   enough on its own; the service compares currentOwnerUserId against
   *   the stored owner, and that is the real check.
   * - The recipient must already be a member.
   * - The recipient is made an administrator, since an owner who is not one
   *   would be precisely the locked-out state that the owner-protection
   *   rules elsewhere exist to prevent.
   *
   * Security:
   * The most consequential operation in the module. Ownership is what gates
   * admin creation, admin promotion, and this endpoint itself — so a
   * successful transfer permanently changes who controls the tenant, and
   * the previous owner cannot reverse it.
   *
   * currentOwnerUserId comes from the session, never the body.
   *
   * Note:
   * Not written to the audit trail — see F-09 in findings.md.
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
  
    /*
     * Validated inline rather than through toPositiveInteger, which is what
     * the rest of the codebase uses for exactly this. The behaviour is the
     * same — reject anything that is not a positive integer — so it is an
     * inconsistency rather than a defect. Left as found.
     *
     * The check matters regardless: an unvalidated value reaching the
     * service would be compared against a user id, and NaN would make the
     * query fail on a type error instead of answering a clean 400.
     */
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