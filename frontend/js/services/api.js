import { API_BASE } from "../config.js";

const isLocalhost = window.location.hostname === "localhost";
const savedApiBase = (localStorage.getItem("sm_api_base") || "").trim().replace(/\/$/, "");

export const appState = {
  apiBase: isLocalhost ? (savedApiBase || API_BASE) : API_BASE,
};

export function setApiBase(url) {
  const normalized = (url || "").trim().replace(/\/$/, "");
  appState.apiBase = isLocalhost ? (normalized || API_BASE) : API_BASE;
  localStorage.setItem("sm_api_base", appState.apiBase);
}

export async function api(path, options = {}, token = "") {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${appState.apiBase}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data.detail || data.message || `HTTP ${response.status}`);
  }

  return data;
}

export function rs(value) {
  return Number(value || 0).toFixed(2);
}
