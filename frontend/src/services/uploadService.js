import axiosClient from "../api/axiosClient";

export async function uploadFile(file, folder = "general") {
  if (!file) {
    throw new Error("No file selected");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);

  const { data } = await axiosClient.post("/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return data.fileUrl;
}