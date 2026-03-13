import { API_BASE } from "../js/config.js";

const state = {
  apiBase: API_BASE,
  token: localStorage.getItem("superapp_token") || "",
  role: localStorage.getItem("superapp_role") || "",
  user: null,
  charts: {},
  appliances: {}
};

const pages = [
  ["dashboard", "Dashboard"],
  ["appliances", "Appliances"],
  ["billing", "Billing"],
  ["payments", "Payments"],
  ["analytics", "Consumption Analytics"],
  ["service", "Service Requests"],
  ["solar", "Solar"],
  ["calculator", "Calculator"],
  ["help", "Help"],
  ["settings", "Settings"],
  ["admin", "Admin Portal"],
];

const el = {
  nav: document.getElementById("nav"),
  pageTitle: document.getElementById("pageTitle"),
  refreshBtn: document.getElementById("refreshBtn"),
  apiBase: document.getElementById("apiBase"),
  authStatus: document.getElementById("authStatus"),
  logoutBtn: document.getElementById("logoutBtn"),
  events: document.getElementById("events"),
  kpiLoad: document.getElementById("kpiLoad"),
  kpiTariff: document.getElementById("kpiTariff"),
  kpiCost: document.getElementById("kpiCost"),
  kpiSavings: document.getElementById("kpiSavings"),
  runAi: document.getElementById("runAi"),
  aiText: document.getElementById("aiText"),
  applianceList: document.getElementById("applianceList"),
  scheduleDevice: document.getElementById("scheduleDevice"),
  scheduleTime: document.getElementById("scheduleTime"),
  scheduleForm: document.getElementById("scheduleForm"),
  scheduleList: document.getElementById("scheduleList"),
  currentBill: document.getElementById("currentBill"),
  billHistory: document.getElementById("billHistory"),
  payForm: document.getElementById("payForm"),
  payBillId: document.getElementById("payBillId"),
  payAmount: document.getElementById("payAmount"),
  payMethod: document.getElementById("payMethod"),
  payMsg: document.getElementById("payMsg"),
  paymentHistory: document.getElementById("paymentHistory"),
  serviceForm: document.getElementById("serviceForm"),
  serviceType: document.getElementById("serviceType"),
  serviceDesc: document.getElementById("serviceDesc"),
  serviceHistory: document.getElementById("serviceHistory"),
  serviceDetail: document.getElementById("serviceDetail"),
  solarSummary: document.getElementById("solarSummary"),
  solarNet: document.getElementById("solarNet"),
  calcForm: document.getElementById("calcForm"),
  calcType: document.getElementById("calcType"),
  calcPower: document.getElementById("calcPower"),
  calcHours: document.getElementById("calcHours"),
  calcResult: document.getElementById("calcResult"),
  faqList: document.getElementById("faqList"),
  helpForm: document.getElementById("helpForm"),
  helpSubject: document.getElementById("helpSubject"),
  helpMessage: document.getElementById("helpMessage"),
  helpResult: document.getElementById("helpResult"),
  registerForm: document.getElementById("registerForm"),
  regName: document.getElementById("regName"),
  regEmail: document.getElementById("regEmail"),
  regMeter: document.getElementById("regMeter"),
  regPassword: document.getElementById("regPassword"),
  loginForm: document.getElementById("loginForm"),
  loginEmail: document.getElementById("loginEmail"),
  loginPassword: document.getElementById("loginPassword"),
  profile: document.getElementById("profile"),
  plans: document.getElementById("plans"),
  subStatus: document.getElementById("subStatus"),
  adminSummary: document.getElementById("adminSummary"),
  adminUsers: document.getElementById("adminUsers"),
  adminRequests: document.getElementById("adminRequests"),
  adminReqForm: document.getElementById("adminReqForm"),
  adminReqId: document.getElementById("adminReqId"),
  adminReqStatus: document.getElementById("adminReqStatus"),
  adminReqNote: document.getElementById("adminReqNote")
};

function logEvent(text, isError = false) {
  const li = document.createElement("li");
  li.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  if (isError) li.style.color = "#ba2e2e";
  el.events.prepend(li);
  while (el.events.children.length > 15) el.events.lastChild.remove();
}

function money(v) {
  return Number(v || 0).toFixed(2);
}

function setToken(token, role) {
  state.token = token || "";
  state.role = role || "";
  localStorage.setItem("superapp_token", state.token);
  localStorage.setItem("superapp_role", state.role);
  refreshAuthUI();
}

async function api(path, options = {}, authRequired = false) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  const res = await fetch(`${state.apiBase}${path}`, { ...options, headers });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch {
    throw new Error(text || `HTTP ${res.status}`);
  }

  if (!res.ok) throw new Error(data.detail || data.message || `HTTP ${res.status}`);
  if (authRequired && !state.token) throw new Error("Login required");
  return data;
}

function buildNav() {
  el.nav.innerHTML = "";
  pages.forEach(([id, label]) => {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.dataset.page = id;
    btn.addEventListener("click", () => showPage(id));
    el.nav.appendChild(btn);
  });
}

function showPage(id) {
  document.querySelectorAll(".page").forEach((x) => x.classList.remove("active"));
  document.getElementById(`page-${id}`)?.classList.add("active");
  document.querySelectorAll(".nav button").forEach((b) => b.classList.toggle("active", b.dataset.page === id));
  el.pageTitle.textContent = pages.find((p) => p[0] === id)?.[1] || "Dashboard";
  refreshPage(id).catch((e) => logEvent(e.message, true));
}

function refreshAuthUI() {
  const role = state.role || "GUEST";
  el.authStatus.textContent = state.user ? `${state.user.full_name} (${role})` : `Role: ${role}`;
  const adminAllowed = role === "ADMIN" || role === "UTILITY_OPERATOR";
  const adminBtn = [...el.nav.querySelectorAll("button")].find((b) => b.dataset.page === "admin");
  if (adminBtn) adminBtn.style.display = adminAllowed ? "block" : "none";
}

async function loadDashboard() {
  const [system, meter] = await Promise.all([api("/system/status"), api("/meter/live")]);
  el.kpiLoad.textContent = meter.data.units_kwh.toFixed(2);
  el.kpiTariff.textContent = money(system.data.tariff.data.effective_tariff);
  el.kpiCost.textContent = money(system.data.cost.data.cost_per_hour);
  el.kpiSavings.textContent = money(system.data.optimization.data.savings_per_hour);
}

async function loadAppliances() {
  const sys = await api("/system/status");
  const devices = sys.data.devices;
  state.appliances = devices;
  el.applianceList.innerHTML = "";
  el.scheduleDevice.innerHTML = "";

  Object.entries(devices).forEach(([id, d]) => {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `<strong>${d.name}</strong><span>${d.units_per_hour} kWh/h</span>`;
    const tog = document.createElement("input");
    tog.type = "checkbox";
    tog.checked = d.state;
    tog.addEventListener("change", async () => {
      await api(`/appliance/toggle/${id}`, { method: "POST", body: JSON.stringify({ state: tog.checked }) });
      logEvent(`${d.name} -> ${tog.checked ? "ON" : "OFF"}`);
    });
    row.appendChild(tog);
    el.applianceList.appendChild(row);

    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = d.name;
    el.scheduleDevice.appendChild(opt);
  });

  const schedule = await api("/schedule");
  el.scheduleList.innerHTML = "";
  schedule.forEach((s) => {
    const li = document.createElement("li");
    li.textContent = `${state.appliances[s.device_id]?.name || s.device_id} @ ${s.run_time}`;
    el.scheduleList.appendChild(li);
  });
}

async function loadBilling() {
  if (!state.token) return;
  const [current, history] = await Promise.all([api("/billing/current"), api("/billing/history")]);
  el.currentBill.innerHTML = `
    <p><strong>ID:</strong> ${current.data.bill_id}</p>
    <p><strong>Month:</strong> ${current.data.billing_month}</p>
    <p><strong>Amount:</strong> Rs ${money(current.data.amount)}</p>
    <p><strong>Status:</strong> ${current.data.status}</p>
  `;

  el.billHistory.innerHTML = "";
  history.data.forEach((b) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${b.billing_month}</td>
      <td>${b.units_consumed}</td>
      <td>Rs ${money(b.amount)}</td>
      <td>${b.status}</td>
      <td><a href="#" data-dl="${b.bill_id}">Download</a></td>
      <td>${b.status === "UNPAID" ? `<button data-pay="${b.bill_id}" data-amt="${b.amount}">Pay</button>` : "-"}</td>
    `;
    el.billHistory.appendChild(tr);
  });

  el.billHistory.querySelectorAll("button[data-pay]").forEach((btn) => {
    btn.addEventListener("click", () => {
      el.payBillId.value = btn.dataset.pay;
      el.payAmount.value = btn.dataset.amt;
      showPage("payments");
    });
  });
}

async function loadPayments() {
  if (!state.token) return;
  const history = await api("/payment/history");
  el.paymentHistory.innerHTML = "";
  history.data.forEach((p) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${p.transaction_id}</td><td>${p.bill_id}</td><td>Rs ${money(p.amount)}</td><td>${p.payment_method}</td><td>${p.payment_status}</td><td>${new Date(p.payment_date).toLocaleString()}</td>`;
    el.paymentHistory.appendChild(tr);
  });
}

function renderChart(id, labels, values, label) {
  if (state.charts[id]) state.charts[id].destroy();
  const ctx = document.getElementById(id).getContext("2d");
  state.charts[id] = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ label, data: values, backgroundColor: "rgba(15,154,127,0.6)" }] },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });
}

async function loadAnalytics() {
  if (!state.token) return;
  const [daily, monthly, yearly] = await Promise.all([
    api("/consumption/daily"),
    api("/consumption/monthly"),
    api("/consumption/yearly")
  ]);
  renderChart("chartDaily", daily.data.map((x) => x.hour), daily.data.map((x) => x.units), "Hourly");
  renderChart("chartMonthly", monthly.data.map((x) => x.day), monthly.data.map((x) => x.units), "Daily");
  renderChart("chartYearly", yearly.data.map((x) => x.month), yearly.data.map((x) => x.units), "Monthly");
}

async function loadService() {
  if (!state.token) return;
  const history = await api("/service/history");
  el.serviceHistory.innerHTML = "";
  history.data.forEach((r) => {
    const li = document.createElement("li");
    li.innerHTML = `<button data-id="${r.request_id}">${r.request_id} - ${r.request_type} (${r.status})</button>`;
    el.serviceHistory.appendChild(li);
  });

  el.serviceHistory.querySelectorAll("button[data-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const detail = await api(`/service/${btn.dataset.id}`);
      const timeline = detail.data.timeline.map((t) => `- ${t.status} | ${new Date(t.at).toLocaleString()} | ${t.note}`).join("\n");
      el.serviceDetail.textContent = `Request: ${detail.data.request_id}\nStatus: ${detail.data.status}\n\nTimeline:\n${timeline}`;
    });
  });
}

async function loadSolar() {
  if (!state.token) return;
  const [production, net] = await Promise.all([api("/solar/production"), api("/solar/net-metering")]);

  if (!production.data) {
    el.solarSummary.textContent = production.message;
    return;
  }

  el.solarSummary.innerHTML = `
    <p><strong>Capacity:</strong> ${production.data.system.capacity_kw} kW</p>
    <p><strong>Generated Today:</strong> ${production.data.total_generated_today} kWh</p>
  `;
  renderChart("chartSolar", production.data.hourly.map((x) => x.hour), production.data.hourly.map((x) => x.units_generated), "Solar");

  el.solarNet.innerHTML = `
    <p><strong>Consumed:</strong> ${net.data.consumed_units} kWh</p>
    <p><strong>Generated:</strong> ${net.data.generated_units} kWh</p>
    <p><strong>Grid Import:</strong> ${net.data.grid_import_units} kWh</p>
    <p><strong>Grid Export:</strong> ${net.data.grid_export_units} kWh</p>
    <p><strong>Savings:</strong> Rs ${money(net.data.estimated_savings_rs)}</p>
  `;
}

async function loadHelp() {
  const faq = await api("/help/faqs");
  el.faqList.innerHTML = "";
  faq.data.forEach((f) => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${f.question}</strong><div>${f.answer}</div>`;
    el.faqList.appendChild(li);
  });
}

async function loadSettings() {
  if (!state.token) {
    el.profile.textContent = "Login to see profile and subscriptions. Demo users: user@demo.com/demo123, admin@demo.com/admin123";
    return;
  }
  const [profile, plans, status] = await Promise.all([
    api("/auth/profile"),
    api("/subscriptions/plans"),
    api("/subscriptions/status")
  ]);
  state.user = profile.data;
  el.profile.textContent = JSON.stringify(profile.data, null, 2);
  el.plans.innerHTML = "";
  plans.data.forEach((p) => {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `<span>${p.plan_name} (Rs ${p.price_monthly}/mo)</span><button data-plan="${p.plan_name}">Activate</button>`;
    el.plans.appendChild(row);
  });
  el.plans.querySelectorAll("button[data-plan]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api("/subscriptions/activate", { method: "POST", body: JSON.stringify({ plan_name: btn.dataset.plan }) });
      logEvent(`Subscription activated: ${btn.dataset.plan}`);
      await loadSettings();
    });
  });
  el.subStatus.textContent = status.data ? `Active: ${status.data.plan_name} (till ${status.data.end_date})` : "No active subscription";
  refreshAuthUI();
}

async function loadAdmin() {
  if (!(state.role === "ADMIN" || state.role === "UTILITY_OPERATOR")) return;
  const [summary, users, requests] = await Promise.all([
    api("/admin/analytics/summary"),
    api("/admin/users"),
    api("/admin/requests")
  ]);

  el.adminSummary.innerHTML = Object.entries(summary.data).map(([k, v]) => `<p><strong>${k}:</strong> ${v}</p>`).join("");
  el.adminUsers.innerHTML = users.data.map((u) => `<li>${u.user_id} - ${u.full_name} (${u.role})</li>`).join("");
  el.adminRequests.innerHTML = requests.data.map((r) => `<li>${r.request_id} - ${r.request_type} (${r.status})</li>`).join("");
}

async function refreshPage(pageId) {
  const page = pageId || document.querySelector(".page.active")?.id.replace("page-", "") || "dashboard";
  const loaders = {
    dashboard: loadDashboard,
    appliances: loadAppliances,
    billing: loadBilling,
    payments: loadPayments,
    analytics: loadAnalytics,
    service: loadService,
    solar: loadSolar,
    calculator: async () => {},
    help: loadHelp,
    settings: loadSettings,
    admin: loadAdmin,
  };
  if (loaders[page]) await loaders[page]();
}

function attachEvents() {
  const isLocalhost = window.location.hostname === "localhost";
  if (el.apiBase) {
    el.apiBase.value = state.apiBase || window.location.origin;
    if (!isLocalhost) {
      const apiLabel = document.querySelector("label[for='apiBase']");
      if (apiLabel) apiLabel.style.display = "none";
      el.apiBase.style.display = "none";
    }
  }
  if (isLocalhost) {
    el.apiBase.addEventListener("change", () => {
      state.apiBase = el.apiBase.value.trim().replace(/\/$/, "");
      logEvent(`API base updated: ${state.apiBase}`);
    });
  }

  el.refreshBtn.addEventListener("click", () => refreshPage().catch((e) => logEvent(e.message, true)));

  el.runAi.addEventListener("click", async () => {
    try {
      const data = await api("/ai/auto-recommend");
      el.aiText.textContent = data.ai_recommendation || "AI unavailable";
    } catch (e) {
      el.aiText.textContent = e.message;
    }
  });

  el.scheduleForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await api("/schedule", {
      method: "POST",
      body: JSON.stringify({ device_id: el.scheduleDevice.value, run_time: el.scheduleTime.value })
    });
    logEvent("Schedule added");
    await loadAppliances();
  });

  el.payForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const data = await api("/payment/pay", {
        method: "POST",
        body: JSON.stringify({ bill_id: el.payBillId.value, amount: Number(el.payAmount.value), payment_method: el.payMethod.value })
      });
      el.payMsg.textContent = `${data.data.payment_status} - ${data.data.transaction_id}`;
      await Promise.all([loadPayments(), loadBilling()]);
    } catch (err) {
      el.payMsg.textContent = err.message;
    }
  });

  el.serviceForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await api("/service/request", {
      method: "POST",
      body: JSON.stringify({ request_type: el.serviceType.value, description: el.serviceDesc.value })
    });
    el.serviceDesc.value = "";
    logEvent("Service request submitted");
    await loadService();
  });

  el.calcForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = await api("/calculator/consumption", {
      method: "POST",
      body: JSON.stringify({
        appliance_type: el.calcType.value,
        power_rating_watts: Number(el.calcPower.value),
        usage_hours_per_day: Number(el.calcHours.value)
      })
    });
    const d = data.data;
    el.calcResult.textContent = `Daily: ${d.daily_consumption_kwh} kWh\nMonthly: ${d.monthly_consumption_kwh} kWh\nMonthly Cost: Rs ${money(d.monthly_cost)}`;
  });

  el.helpForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = await api("/help/contact", {
      method: "POST",
      body: JSON.stringify({ subject: el.helpSubject.value, message: el.helpMessage.value })
    });
    el.helpResult.textContent = data.message;
    el.helpMessage.value = "";
    el.helpSubject.value = "";
  });

  el.registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = await api("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        full_name: el.regName.value,
        email: el.regEmail.value,
        password: el.regPassword.value,
        smart_meter_id: el.regMeter.value
      })
    });
    setToken(data.access_token, data.user.role);
    state.user = data.user;
    logEvent("Registered and logged in");
    await loadSettings();
  });

  el.loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const data = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: el.loginEmail.value, password: el.loginPassword.value })
      });
      setToken(data.access_token, data.role);
      logEvent("Login successful");
      await loadSettings();
    } catch (err) {
      logEvent(err.message, true);
      el.profile.textContent = err.message;
    }
  });

  el.logoutBtn.addEventListener("click", () => {
    setToken("", "");
    state.user = null;
    el.profile.textContent = "Logged out";
    logEvent("Logged out");
  });

  el.adminReqForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await api(`/admin/requests/${el.adminReqId.value}`, {
      method: "PATCH",
      body: JSON.stringify({ status: el.adminReqStatus.value, note: el.adminReqNote.value })
    });
    logEvent("Request status updated");
    await loadAdmin();
  });
}

async function init() {
  buildNav();
  refreshAuthUI();
  attachEvents();
  showPage("dashboard");
  try {
    if (state.token) {
      const p = await api("/auth/profile");
      state.user = p.data;
      state.role = p.data.role;
      localStorage.setItem("superapp_role", state.role);
    }
    refreshAuthUI();
    await Promise.all([loadHelp(), loadDashboard()]);
  } catch (e) {
    logEvent(e.message, true);
  }
}

init();
setInterval(() => {
  if (document.getElementById("page-dashboard").classList.contains("active")) {
    loadDashboard().catch(() => {});
  }
}, 6000);


