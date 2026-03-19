import { api } from "../services/api.js";
import { storeSession } from "../services/auth.js";

const el = {
  roleSelect: document.getElementById("roleSelect"),
  tabLogin: document.getElementById("tabLogin"),
  tabRegister: document.getElementById("tabRegister"),
  loginForm: document.getElementById("loginForm"),
  registerForm: document.getElementById("registerForm"),
  loginEmail: document.getElementById("loginEmail"),
  loginPassword: document.getElementById("loginPassword"),
  regName: document.getElementById("regName"),
  regEmail: document.getElementById("regEmail"),
  regMeter: document.getElementById("regMeter"),
  regPassword: document.getElementById("regPassword"),
  notice: document.getElementById("authNotice"),
  toggleLoginPwd: document.getElementById("toggleLoginPwd"),
  toggleRegPwd: document.getElementById("toggleRegPwd"),
};

let mode = "login";

function applyTheme() {
  const modeVal = localStorage.getItem("sm_theme_mode") === "dark" ? "dark" : "light";
  const accent = localStorage.getItem("sm_accent_theme") || "blue";
  document.documentElement.setAttribute("data-theme", modeVal);
  if (accent === "violet") {
    document.documentElement.style.setProperty("--brand", "#6f66ff");
    document.documentElement.style.setProperty("--brand-2", "#2ac4df");
  } else if (accent === "emerald") {
    document.documentElement.style.setProperty("--brand", "#149a83");
    document.documentElement.style.setProperty("--brand-2", "#30c6dd");
  } else {
    document.documentElement.style.setProperty("--brand", "#1f6fff");
    document.documentElement.style.setProperty("--brand-2", "#15b2d3");
  }
}

function setNotice(text, isError = false) {
  el.notice.textContent = text;
  el.notice.classList.toggle("error", isError);
}

function isAdminRole(role = "") {
  const normalized = String(role || "").toUpperCase();
  return normalized === "ADMIN" || normalized === "UTILITY_OPERATOR";
}

function rolePath(role) {
  return isAdminRole(role) ? "/admin" : "/app";
}

function setMode(nextMode) {
  mode = nextMode;
  el.tabLogin.classList.toggle("active", nextMode === "login");
  el.tabRegister.classList.toggle("active", nextMode === "register");
  el.loginForm.style.display = nextMode === "login" ? "grid" : "none";
  el.registerForm.style.display = nextMode === "register" ? "grid" : "none";

  const isAdminSelected = el.roleSelect.value === "ADMIN";
  el.tabRegister.disabled = isAdminSelected;
  if (isAdminSelected && nextMode === "register") setMode("login");
}

function togglePwd(input, btn) {
  const hidden = input.type === "password";
  const eyeId = btn.id === "toggleLoginPwd" ? "loginEyeIcon" : "regEyeIcon";
  const icon = document.getElementById(eyeId);

  input.type = hidden ? "text" : "password";
  btn.setAttribute("aria-pressed", hidden ? "true" : "false");

  if (icon) {
    if (hidden) {
      icon.innerHTML =
        '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"></path>' +
        '<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path>' +
        '<line x1="1" y1="1" x2="23" y2="23"></line>';
    } else {
      icon.innerHTML =
        '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>' +
        '<circle cx="12" cy="12" r="3"></circle>';
    }
  }
}

function persistRoleAndToken(token, role) {
  localStorage.setItem("token", token || "");
  localStorage.setItem("role", role || "");
}

function redirectIfLoggedIn() {
  const token = localStorage.getItem("token") || "";
  const role = localStorage.getItem("role") || "";
  if (!token) return;
  window.location.href = rolePath(role);
}

async function doLogin(event) {
  event.preventDefault();
  setNotice("Authenticating...");
  try {
    const loginRes = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: el.loginEmail.value.trim(),
        password: el.loginPassword.value,
      }),
    });

    const role = loginRes.role;
    const selected = el.roleSelect.value;
    if (selected === "CONSUMER" && role !== "USER") {
      throw new Error("Selected Consumer role, but account is not a Consumer.");
    }
    if (selected === "ADMIN" && !isAdminRole(role)) {
      throw new Error("Selected Admin role, but account is not Admin/Utility Operator.");
    }

    const profileRes = await api("/auth/profile", {}, loginRes.access_token);
    storeSession({ token: loginRes.access_token, role, user: profileRes.data });
    persistRoleAndToken(loginRes.access_token, role);

    setNotice("Login successful. Redirecting...");
    window.location.href = rolePath(role);
  } catch (err) {
    setNotice(err.message, true);
  }
}

async function doRegister(event) {
  event.preventDefault();

  if (el.roleSelect.value === "ADMIN") {
    setNotice("Admin registration is disabled. Use admin credentials.", true);
    return;
  }

  setNotice("Creating account...");
  try {
    const res = await api("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        full_name: el.regName.value.trim(),
        email: el.regEmail.value.trim(),
        password: el.regPassword.value,
        smart_meter_id: el.regMeter.value.trim(),
      }),
    });

    storeSession({ token: res.access_token, role: res.user.role, user: res.user });
    persistRoleAndToken(res.access_token, res.user.role);

    setNotice("Registration successful. Redirecting to Consumer app...");
    window.location.href = "/app";
  } catch (err) {
    setNotice(err.message, true);
  }
}

function init() {
  applyTheme();
  redirectIfLoggedIn();

  el.tabLogin.addEventListener("click", () => setMode("login"));
  el.tabRegister.addEventListener("click", () => setMode("register"));
  el.loginForm.addEventListener("submit", doLogin);
  el.registerForm.addEventListener("submit", doRegister);
  el.roleSelect.addEventListener("change", () => setMode(mode));

  el.toggleLoginPwd.addEventListener("click", () => togglePwd(el.loginPassword, el.toggleLoginPwd));
  el.toggleRegPwd.addEventListener("click", () => togglePwd(el.regPassword, el.toggleRegPwd));

  setMode("login");
  setNotice("Demo Consumer: user@demo.com / demo123 | Demo Admin: admin@demo.com / admin123");
}

init();
