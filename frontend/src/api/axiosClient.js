import axios from "axios";

const axiosClient = axios.create({
  baseURL: "http://127.0.0.1:5051/api",
});

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default axiosClient;