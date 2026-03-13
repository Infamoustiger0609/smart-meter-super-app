export const appState = {
  apiBase: localStorage.getItem("sm_api_base") || "http://127.0.0.1:8000",
};

export function setApiBase(url) {
  appState.apiBase = (url || "").trim().replace(/\/$/, "");
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

