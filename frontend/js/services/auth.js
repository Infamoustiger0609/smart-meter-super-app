const TOKEN_KEY = "token";
const ROLE_KEY = "role";
const USER_KEY = "sm_user";
const LEGACY_TOKEN_KEY = "sm_token";
const LEGACY_ROLE_KEY = "sm_role";

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
  const t = token || "";
  const r = role || "";
  localStorage.setItem(TOKEN_KEY, t);
  localStorage.setItem(ROLE_KEY, r);
  localStorage.setItem(LEGACY_TOKEN_KEY, t);
  localStorage.setItem(LEGACY_ROLE_KEY, r);
  localStorage.setItem(USER_KEY, JSON.stringify(user || null));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  localStorage.removeItem(LEGACY_ROLE_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getSession() {
  const token = localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY) || "";
  const role = localStorage.getItem(ROLE_KEY) || localStorage.getItem(LEGACY_ROLE_KEY) || "";
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
    window.location.href = "/";
    return null;
  }
  return session;
}
