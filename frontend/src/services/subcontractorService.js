import axiosClient from "../api/axiosClient";

export const getSubcontractors = async () => {
  const response = await axiosClient.get(
    "/subcontractors"
  );

  return response.data;
};

export const createSubcontractor = async (
  payload
) => {
  const response = await axiosClient.post(
    "/subcontractors",
    payload
  );

  return response.data;
};

export const deleteSubcontractor = async (
  id
) => {
  const response =
    await axiosClient.delete(
      `/subcontractors/${id}`
    );

  return response.data;
};

export const updateSubcontractor = async (
  id,
  payload
) => {
  const response =
    await axiosClient.put(
      `/subcontractors/${id}`,
      payload
    );

  return response.data;
};