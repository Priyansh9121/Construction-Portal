/**
 * File purpose:
 * Company profile and membership.
 *
 * API endpoints:
 * - GET    /company
 * - PUT    /company
 * - GET    /company/members
 * - PUT    /company/members/:userId/role
 * - DELETE /company/members/:userId
 * - POST   /company/transfer-ownership
 *
 * Connected to:
 * - SettingsPage.jsx, UsersPage.jsx
 * - Backed by backend/modules/companies/company.controller.js
 * - Uses api/axiosClient.js, which attaches the bearer token and
 *   signs the user out on a 401.
 *
 * Important notes:
 * - GET /company is the one call every role may make — currency and
 * - timezone drive how every screen formats figures and dates.
 * - The mutating calls are admin-only, and granting admin or transferring
 * - ownership additionally requires being the company owner.
 */

import axiosClient from "../api/axiosClient";

/*
|--------------------------------------------------------------------------
| Company
|--------------------------------------------------------------------------
|
| The company profile and its membership. Any signed-in member can read the
| profile; the member list is admin and manager only, which is why the
| supervisor picker on Site Operations is office-side.
|
*/


export const getCompanyMembers = async (params = {}) => {
  const { data } = await axiosClient.get("/company/members", { params });

  return data.members ?? [];
};

export default {
  getCompanyMembers,
};
