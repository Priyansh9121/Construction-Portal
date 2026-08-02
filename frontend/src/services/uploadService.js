import axiosClient from "../api/axiosClient";

/*
|--------------------------------------------------------------------------
| File upload
|--------------------------------------------------------------------------
|
| The upload API stores files under companies/<company_id>/... and records
| a row in `files`, so it needs to know which module and record the file
| belongs to. `module` is required; `record_id` links the file to a
| specific tender, site or worker when there is one.
|
| The response returns the whole file row. uploadFile returns the URL for
| convenience, which is what existing callers expect; uploadFileRecord
| returns the full row for callers that need the id or checksum.
|
*/

/**
 * Valid module values, matching FILE_MODULES on the server.
 */
export const FILE_MODULES = Object.freeze({
  TENDER: "tender",
  SITE: "site",
  WORKER: "worker",
  SUBCONTRACTOR: "subcontractor",
  INVOICE: "invoice",
  DAILY_UPDATE: "daily_update",
  INSPECTION: "inspection",
  MODEL: "model",
});

/**
 * Uploads a file and returns the stored record.
 *
 * Local to this module: uploadFile below is the only caller, and it is
 * what every screen uses.
 */
async function uploadFileRecord(
  file,
  {
    folder = "general",
    module = FILE_MODULES.SITE,
    recordId = null,
  } = {}
) {
  if (!file) {
    throw new Error("No file selected");
  }

  const formData = new FormData();

  formData.append("file", file);
  formData.append("folder", folder);
  formData.append("module", module);

  if (recordId) {
    formData.append("record_id", recordId);
  }

  const { data } = await axiosClient.post("/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return data.file ?? null;
}

/**
 * Uploads a file and returns just its URL.
 *
 * Accepts the original (file, folder) signature so existing call sites
 * keep working, and an options object for the newer fields.
 */
export async function uploadFile(file, folderOrOptions = "general") {
  const options =
    typeof folderOrOptions === "string"
      ? { folder: folderOrOptions }
      : folderOrOptions;

  const record = await uploadFileRecord(file, options);

  return record?.file_url ?? null;
}

export default {
  uploadFile,
  FILE_MODULES,
};
