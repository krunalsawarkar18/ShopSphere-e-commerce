import { clearSession, getToken } from "./storage.js";

const API_BASE = `${window.location.protocol}//${window.location.hostname}:5001/api`;

export async function request(path, options = {}) {
  const {
    method = "GET",
    body,
    auth = false,
    headers = {}
  } = options;

  const config = {
    method,
    headers: {
      ...headers
    }
  };

  if (body !== undefined) {
    config.headers["Content-Type"] = "application/json";
    config.body = JSON.stringify(body);
  }

  if (auth) {
    const token = getToken();

    if (!token) {
      throw new Error("Please log in to continue.");
    }

    config.headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, config);
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await response.json() : {};

  if (!response.ok) {
    if (response.status === 401) {
      clearSession();
    }

    throw new Error(data.message || "Request failed.");
  }

  return data;
}
