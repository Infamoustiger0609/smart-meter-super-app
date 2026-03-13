import { API_BASE } from "../config.js";

export const appState = {
  apiBase: API_BASE,
};

export function setApiBase() {
  appState.apiBase = API_BASE;
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
