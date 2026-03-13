const TOKEN_KEY = "sm_token";
const ROLE_KEY = "sm_role";
const USER_KEY = "sm_user";

export function decodeJwt(token) {
  try {
    const base64 = token.split(".")[1];
    const normalized = base64.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalized));
  } catch {
    return null;
  }
}

export function storeSession({ token, role, user }) {
  localStorage.setItem(TOKEN_KEY, token || "");
  localStorage.setItem(ROLE_KEY, role || "");
  localStorage.setItem(USER_KEY, JSON.stringify(user || null));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getSession() {
  const token = localStorage.getItem(TOKEN_KEY) || "";
  const role = localStorage.getItem(ROLE_KEY) || "";
  const userRaw = localStorage.getItem(USER_KEY);
  const user = userRaw ? JSON.parse(userRaw) : null;

  if (!token) return { token: "", role: "", user: null, valid: false };

  const payload = decodeJwt(token);
  if (!payload || (payload.exp && payload.exp * 1000 < Date.now())) {
    clearSession();
    return { token: "", role: "", user: null, valid: false };
  }

  return { token, role, user, valid: true, payload };
}

export function requireRole(allowedRoles = []) {
  const session = getSession();
  if (!session.valid || (allowedRoles.length && !allowedRoles.includes(session.role))) {
    window.location.href = "../index.html";
    return null;
  }
  return session;
}

