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
