import axiosClient from "../api/axiosClient";

const getErrorMessage = (
  error,
  fallbackMessage
) => {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallbackMessage
  );
};

const normaliseTenderResponse = (
  response
) => {
  const responseData =
    response?.data ?? response;

  if (responseData?.tender) {
    return responseData.tender;
  }

  if (responseData?.data?.tender) {
    return responseData.data.tender;
  }

  if (
    responseData?.data &&
    !Array.isArray(responseData.data)
  ) {
    return responseData.data;
  }

  return responseData;
};

const normaliseTenderListResponse = (
  response
) => {
  const responseData =
    response?.data ?? response;

  if (Array.isArray(responseData)) {
    return responseData;
  }

  if (
    Array.isArray(
      responseData?.tenders
    )
  ) {
    return responseData.tenders;
  }

  if (
    Array.isArray(
      responseData?.data
    )
  ) {
    return responseData.data;
  }

  if (
    Array.isArray(
      responseData?.data?.tenders
    )
  ) {
    return responseData.data.tenders;
  }

  return [];
};

const cleanSitePayload = (
  site
) => {
  const cleanedSite = {
    id:
      site?.id !== undefined &&
      site?.id !== null &&
      site?.id !== ""
        ? Number(site.id)
        : undefined,

    site_name: String(
      site?.site_name ||
        site?.name ||
        ""
    ).trim(),

    address: String(
      site?.address || ""
    ).trim(),

    site_type: String(
      site?.site_type || ""
    ).trim(),

    status: String(
      site?.status || "planned"
    ).trim(),

    progress_percent: Number(
      site?.progress_percent || 0
    ),

    description: String(
      site?.description || ""
    ).trim(),

    notes: String(
      site?.notes || ""
    ).trim(),

    manager_name: String(
      site?.manager_name ||
        site?.site_manager ||
        ""
    ).trim(),

    start_date:
      site?.start_date || null,

    due_date:
      site?.due_date || null,
  };

  if (!cleanedSite.id) {
    delete cleanedSite.id;
  }

  return cleanedSite;
};

const buildTenderPayload = (
  tenderData = {}
) => {
  const payload = {
    title: String(
      tenderData.title ||
        tenderData.tender_name ||
        ""
    ).trim(),

    client_name: String(
      tenderData.client_name || ""
    ).trim(),

    tender_type: String(
      tenderData.tender_type || ""
    ).trim(),

    status: String(
      tenderData.status || "planned"
    ).trim(),

    start_date:
      tenderData.start_date || null,

    due_date:
      tenderData.due_date || null,

    estimated_value: Number(
      tenderData.estimated_value ||
        tenderData.tender_value ||
        0
    ),

    progress_percent: Number(
      tenderData.progress_percent ||
        0
    ),

    description: String(
      tenderData.description || ""
    ).trim(),

    notes: String(
      tenderData.notes || ""
    ).trim(),

    company_id:
      tenderData.company_id !==
        undefined &&
      tenderData.company_id !== null &&
      tenderData.company_id !== ""
        ? Number(
            tenderData.company_id
          )
        : undefined,

    sites: Array.isArray(
      tenderData.sites
    )
      ? tenderData.sites
          .map(cleanSitePayload)
          .filter(
            (site) =>
              site.site_name
          )
      : [],
  };

  if (
    payload.company_id ===
    undefined
  ) {
    delete payload.company_id;
  }

  return payload;
};

export const getTenders =
  async (params = {}) => {
    try {
      const response =
        await axiosClient.get(
          "/tenders",
          {
            params,
          }
        );

      return normaliseTenderListResponse(
        response
      );
    } catch (error) {
      console.error(
        "Failed to fetch tenders:",
        error?.response?.data ||
          error
      );

      throw new Error(
        getErrorMessage(
          error,
          "Failed to fetch projects."
        ),
        { cause: error }
      );
    }
  };

export const getTenderById =
  async (id) => {
    if (
      !id ||
      Number.isNaN(Number(id))
    ) {
      throw new Error(
        "A valid tender ID is required."
      );
    }

    try {
      const response =
        await axiosClient.get(
          `/tenders/${id}`
        );

      return normaliseTenderResponse(
        response
      );
    } catch (error) {
      console.error(
        `Failed to fetch tender ${id}:`,
        error?.response?.data ||
          error
      );

      throw new Error(
        getErrorMessage(
          error,
          "Failed to fetch project details."
        ),
        { cause: error }
      );
    }
  };

export const createTender =
  async (tenderData) => {
    const payload =
      buildTenderPayload(
        tenderData
      );

    if (!payload.title) {
      throw new Error(
        "Project title is required."
      );
    }

    if (
      payload.sites.length === 0
    ) {
      throw new Error(
        "At least one project site is required."
      );
    }

    try {
      const response =
        await axiosClient.post(
          "/tenders",
          payload
        );

      return normaliseTenderResponse(
        response
      );
    } catch (error) {
      console.error(
        "Failed to create tender:",
        error?.response?.data ||
          error
      );

      throw new Error(
        getErrorMessage(
          error,
          "Failed to create project."
        ),
        { cause: error }
      );
    }
  };

export const updateTender =
  async (
    id,
    tenderData
  ) => {
    if (
      !id ||
      Number.isNaN(Number(id))
    ) {
      throw new Error(
        "A valid tender ID is required."
      );
    }

    const payload =
      buildTenderPayload(
        tenderData
      );

    if (!payload.title) {
      throw new Error(
        "Project title is required."
      );
    }

    if (
      payload.sites.length === 0
    ) {
      throw new Error(
        "At least one project site is required."
      );
    }

    try {
      const response =
        await axiosClient.put(
          `/tenders/${id}`,
          payload
        );

      return normaliseTenderResponse(
        response
      );
    } catch (error) {
      console.error(
        `Failed to update tender ${id}:`,
        error?.response?.data ||
          error
      );

      throw new Error(
        getErrorMessage(
          error,
          "Failed to update project."
        ),
        { cause: error }
      );
    }
  };

export const deleteTender =
  async (id) => {
    if (
      !id ||
      Number.isNaN(Number(id))
    ) {
      throw new Error(
        "A valid tender ID is required."
      );
    }

    try {
      const response =
        await axiosClient.delete(
          `/tenders/${id}`
        );

      return (
        response?.data ||
        response
      );
    } catch (error) {
      console.error(
        `Failed to delete tender ${id}:`,
        error?.response?.data ||
          error
      );

      throw new Error(
        getErrorMessage(
          error,
          "Failed to delete project."
        ),
        { cause: error }
      );
    }
  };

export const restoreTender =
  async (id) => {
    if (
      !id ||
      Number.isNaN(Number(id))
    ) {
      throw new Error(
        "A valid tender ID is required."
      );
    }

    try {
      const response =
        await axiosClient.post(
          `/tenders/${id}/restore`
        );

      return normaliseTenderResponse(
        response
      );
    } catch (error) {
      console.error(
        `Failed to restore tender ${id}:`,
        error?.response?.data ||
          error
      );

      throw new Error(
        getErrorMessage(
          error,
          "Failed to restore project."
        ),
        { cause: error }
      );
    }
  };

export default {
  getTenders,
  getTenderById,
  createTender,
  updateTender,
  deleteTender,
  restoreTender,
};