import axiosClient from "../api/axiosClient";

/*
|--------------------------------------------------------------------------
| Tender Details
|--------------------------------------------------------------------------
*/

export const getTenderDetails = async (id) => {
  const response = await axiosClient.get(
    `/tender-details/${id}`
  );

  return response.data;
};

/*
|--------------------------------------------------------------------------
| Materials
|--------------------------------------------------------------------------
*/

export const addTenderMaterial = async (payload) => {
  const response = await axiosClient.post(
    "/tender-details/materials",
    payload
  );

  return response.data;
};

export const deleteTenderMaterial = async (id) => {
  const response = await axiosClient.delete(
    `/tender-details/materials/${id}`
  );

  return response.data;
};

/*
|--------------------------------------------------------------------------
| Banking
|--------------------------------------------------------------------------
*/

export const addTenderBanking = async (payload) => {
  const response = await axiosClient.post(
    "/tender-details/banking",
    payload
  );

  return response.data;
};

export const deleteTenderBanking = async (id) => {
  const response = await axiosClient.delete(
    `/tender-details/banking/${id}`
  );

  return response.data;
};

/*
|--------------------------------------------------------------------------
| Documents
|--------------------------------------------------------------------------
*/

export const addTenderDocument = async (payload) => {
  const response = await axiosClient.post(
    "/tender-details/documents",
    payload
  );

  return response.data;
};

export const deleteTenderDocument = async (id) => {
  const response = await axiosClient.delete(
    `/tender-details/documents/${id}`
  );

  return response.data;
};

/*
|--------------------------------------------------------------------------
| Uploads
|--------------------------------------------------------------------------
*/

export const uploadFile = async (file) => {
  const formData = new FormData();

  formData.append("photo", file);

  const response = await axiosClient.post(
    "/upload",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return response.data;
};

/*
|--------------------------------------------------------------------------
| Daily Progress
|--------------------------------------------------------------------------
*/

export const addDailyProgress = async (payload) => {
  const response = await axiosClient.post(
    "/site-logs",
    payload
  );

  return response.data;
};

export const deleteDailyProgress = async (id) => {
  const response = await axiosClient.delete(
    `/site-logs/${id}`
  );

  return response.data;
};

/*
|--------------------------------------------------------------------------
| Tender Subcontractors
|--------------------------------------------------------------------------
*/

export const assignTenderSubcontractor = async (
  payload
) => {
  const response = await axiosClient.post(
    "/tender-details/subcontractors",
    payload
  );

  return response.data;
};

export const removeTenderSubcontractor = async (
  id
) => {
  const response = await axiosClient.delete(
    `/tender-details/subcontractors/${id}`
  );

  return response.data;
};