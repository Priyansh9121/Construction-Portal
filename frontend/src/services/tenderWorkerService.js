import axiosClient from "../api/axiosClient";

/*
|--------------------------------------------------------------------------
| Tender worker assignments
|--------------------------------------------------------------------------
|
| Nested under the tender that owns them, for the same reason as the other
| child resources in tenderDetailsService: the server can confirm the
| parent belongs to the caller's company before touching a child row.
|
| These previously went through /api/tender-workers, an adapter whose own
| header described it as temporary and which rewrote the parameters before
| forwarding to this same controller.
|
*/

const tenderPath = (tenderId, suffix = "") => {
  const id = Number(tenderId);

  if (!id || Number.isNaN(id)) {
    throw new Error("A valid tender ID is required.");
  }

  return `/tenders/${id}/workers${suffix}`;
};

export const getTenderWorkers = async (tenderId) => {
  const response = await axiosClient.get(tenderPath(tenderId));

  return response.data;
};

export const assignWorkerToTender = async ({ tender_id, ...payload }) => {
  const response = await axiosClient.post(
    tenderPath(tender_id),
    payload
  );

  return response.data;
};

export const updateTenderWorker = async (
  tenderId,
  assignmentId,
  payload
) => {
  const response = await axiosClient.put(
    tenderPath(tenderId, `/${assignmentId}`),
    payload
  );

  return response.data;
};

export const removeTenderWorker = async (tenderId, assignmentId) => {
  const response = await axiosClient.delete(
    tenderPath(tenderId, `/${assignmentId}`)
  );

  return response.data;
};
