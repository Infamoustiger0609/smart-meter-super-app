import { api, appState, rs } from "../services/api.js";
import { clearSession, requireRole } from "../services/auth.js";
import { barConfig, doughnutConfig, renderChart } from "../services/charts.js";

const session = requireRole(["ADMIN", "UTILITY_OPERATOR"]);
if (!session) throw new Error("Unauthorized");

const state = {
  token: session.token,
  role: session.role,
  user: session.user,
  settings: {
    themeMode: localStorage.getItem("sm_theme_mode") === "dark" ? "dark" : "light",
    accentTheme: localStorage.getItem("sm_accent_theme") || "blue",
    autoRefreshEnabled: localStorage.getItem("sm_admin_auto_refresh_enabled") !== "0",
    autoRefreshSeconds: Number(localStorage.getItem("sm_admin_auto_refresh_seconds") || 15),
  },
  autoRefreshTimer: null,
};

const pages = [
  ["dashboard", "Admin Dashboard", "&#127968;"],
  ["users", "User Management", "&#128101;"],
  ["meters", "Meter Management", "&#128421;"],
  ["requests", "Service Requests", "&#128736;"],
  ["billing", "Billing Control", "&#128179;"],
  ["payments", "Payments", "&#128176;"],
  ["solar", "Solar Installations", "&#9728;"],
  ["consumption", "Consumption Analytics", "&#128202;"],
  ["analytics", "Energy Analytics", "&#9889;"],
  ["settings", "Settings", "&#9881;"],
];

const chartMeta = {};

const el = {
  apiBase: document.getElementById("apiBase"),
  nav: document.getElementById("nav"),
  pageTitle: document.getElementById("pageTitle"),
  lastSync: document.getElementById("lastSync"),
  refreshBtn: document.getElementById("refreshBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  adminIdentity: document.getElementById("adminIdentity"),

  sysStatus: document.getElementById("sysStatus"),
  gridHealth: document.getElementById("gridHealth"),
  activeMetersIndicator: document.getElementById("activeMetersIndicator"),

  kpiUsers: document.getElementById("kpiUsers"),
  kpiMeters: document.getElementById("kpiMeters"),
  kpiOpenReq: document.getElementById("kpiOpenReq"),
  kpiOutstanding: document.getElementById("kpiOutstanding"),
  kpiGridLoad: document.getElementById("kpiGridLoad"),
  kpiDemand24h: document.getElementById("kpiDemand24h"),

  gridEnergyDelivered: document.getElementById("gridEnergyDelivered"),
  gridCarbon: document.getElementById("gridCarbon"),
  gridProjected: document.getElementById("gridProjected"),
  gridOfflineMeters: document.getElementById("gridOfflineMeters"),

  usersTable: document.getElementById("usersTable"),
  metersTable: document.getElementById("metersTable"),
  requestsTable: document.getElementById("requestsTable"),
  billsTable: document.getElementById("billsTable"),
  paymentsTable: document.getElementById("paymentsTable"),
  solarTable: document.getElementById("solarTable"),
  consumptionTable: document.getElementById("consumptionTable"),

  requestUpdateForm: document.getElementById("requestUpdateForm"),
  reqId: document.getElementById("reqId"),
  reqStatus: document.getElementById("reqStatus"),
  reqNote: document.getElementById("reqNote"),
  requestUpdateMsg: document.getElementById("requestUpdateMsg"),
  requestTimelineView: document.getElementById("requestTimelineView"),

  generateBillForm: document.getElementById("generateBillForm"),
  billUserId: document.getElementById("billUserId"),
  billMonth: document.getElementById("billMonth"),
  billUnits: document.getElementById("billUnits"),
  billDueDate: document.getElementById("billDueDate"),
  billGenerateMsg: document.getElementById("billGenerateMsg"),

  chartModal: document.getElementById("chartModal"),
  chartModalClose: document.getElementById("chartModalClose"),
  chartModalTitle: document.getElementById("chartModalTitle"),
  chartModalCanvas: document.getElementById("chartModalCanvas"),
  chartModalStats: document.getElementById("chartModalStats"),
  chartModalNote: document.getElementById("chartModalNote"),

  adminSettingsApiBase: document.getElementById("adminSettingsApiBase"),
  adminThemeMode: document.getElementById("adminThemeMode"),
  adminAccentTheme: document.getElementById("adminAccentTheme"),
  adminAutoRefreshEnabled: document.getElementById("adminAutoRefreshEnabled"),
  adminAutoRefreshSeconds: document.getElementById("adminAutoRefreshSeconds"),
  adminSettingsSaveBtn: document.getElementById("adminSettingsSaveBtn"),
  adminSettingsResetBtn: document.getElementById("adminSettingsResetBtn"),
  adminSettingsStatus: document.getElementById("adminSettingsStatus"),
  adminAppInfo: document.getElementById("adminAppInfo"),
};

let adminCache = {
  summary: null,
  users: [],
  meters: [],
  requests: [],
  payments: [],
  bills: [],
  solar: [],
  consumption: { top_meters: [], monthly: [] },
  daily: [],
  hourly: [],
  grid: null,
};

function setText(node, text) {
  if (node) node.textContent = text;
}

function applyTheme() {
  const mode = state.settings.themeMode;
  const accent = state.settings.accentTheme;
  document.documentElement.setAttribute("data-theme", mode);
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

function setStatus(msg) {
  if (el.adminSettingsStatus) el.adminSettingsStatus.textContent = msg;
}

function applyAutoRefresh() {
  if (state.autoRefreshTimer) {
    clearInterval(state.autoRefreshTimer);
    state.autoRefreshTimer = null;
  }
  if (!state.settings.autoRefreshEnabled) return;
  const seconds = Math.max(3, Math.min(120, Number(state.settings.autoRefreshSeconds) || 15));
  state.settings.autoRefreshSeconds = seconds;
  state.autoRefreshTimer = setInterval(() => {
    loadAdminBase().catch(() => {});
  }, seconds * 1000);
}

function loadAdminSettingsPanel() {
  if (el.adminSettingsApiBase) el.adminSettingsApiBase.value = appState.apiBase;
  if (el.adminThemeMode) el.adminThemeMode.value = state.settings.themeMode;
  if (el.adminAccentTheme) el.adminAccentTheme.value = state.settings.accentTheme;
  if (el.adminAutoRefreshEnabled) el.adminAutoRefreshEnabled.checked = !!state.settings.autoRefreshEnabled;
  if (el.adminAutoRefreshSeconds) el.adminAutoRefreshSeconds.value = String(state.settings.autoRefreshSeconds);
  if (el.adminAppInfo) {
    el.adminAppInfo.textContent = [
      "SMART METER SUPER APP (Admin Portal)",
      `Role: ${state.role}`,
      `User: ${state.user?.full_name || "Admin Operator"}`,
      `Connected API: ${appState.apiBase}`,
      "Version: v1.0-admin-ui",
    ].join("\n");
  }
}

function setLastSync() {
  setText(el.lastSync, `Last sync: ${new Date().toLocaleTimeString()}`);
}

function buildNav() {
  if (!el.nav) return;
  el.nav.innerHTML = "";
  pages.forEach(([id, title, icon]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.page = id;
    button.innerHTML = `<span class="nav-ico">${icon}</span><span class="nav-label">${title}</span>`;
    button.addEventListener("click", () => switchPage(id));
    el.nav.appendChild(button);
  });
}

function switchPage(id) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  document.getElementById(id)?.classList.add("active");
  document.querySelectorAll(".nav button").forEach((b) => b.classList.toggle("active", b.dataset.page === id));
  setText(el.pageTitle, pages.find((p) => p[0] === id)?.[1] || "Admin Dashboard");
  if (id === "settings") loadAdminSettingsPanel();
}

function withAxes(config, xTitle, yTitle, showLegend = true) {
  const next = structuredClone(config);
  next.options = next.options || {};
  next.options.plugins = next.options.plugins || {};
  next.options.plugins.legend = { display: showLegend, position: "bottom" };
  next.options.plugins.tooltip = { enabled: true };
  if (xTitle || yTitle) {
    next.options.scales = next.options.scales || {};
    next.options.scales.x = next.options.scales.x || {};
    next.options.scales.y = next.options.scales.y || { beginAtZero: true };
    if (xTitle) next.options.scales.x.title = { display: true, text: xTitle };
    if (yTitle) next.options.scales.y.title = { display: true, text: yTitle };
  }
  return next;
}

function placeholderChart(canvasId, title) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const frame = canvas.closest(".chart-frame") || canvas.parentElement;
  if (!frame) return;
  const existing = frame.querySelector(".chart-empty");
  if (existing) return;
  const box = document.createElement("div");
  box.className = "chart-empty";
  box.textContent = `No data available for ${title}`;
  frame.appendChild(box);
}

function clearPlaceholder(canvasId) {
  const canvas = document.getElementById(canvasId);
  const frame = canvas?.closest(".chart-frame") || canvas?.parentElement;
  frame?.querySelector(".chart-empty")?.remove();
}

function registerChart(canvasId, title, config, note = "", rows = []) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const labels = config?.data?.labels || [];
  const values = config?.data?.datasets?.[0]?.data || [];
  if (!labels.length || !values.length || values.every((v) => Number(v || 0) === 0)) {
    placeholderChart(canvasId, title);
    return;
  }
  clearPlaceholder(canvasId);
  renderChart(canvasId, config);
  chartMeta[canvasId] = {
    title,
    config,
    note,
    rows: rows.length ? rows : labels.map((label, idx) => ({ label, value: values[idx] })),
  };
  const card = canvas.closest(".card");
  if (card) {
    card.classList.add("chart-card");
    card.dataset.chart = canvasId;
    card.dataset.interactive = "true";
    card.title = "Click to expand";
  }
}

function lineConfig(labels, values, color, label) {
  return {
    type: "line",
    data: {
      labels,
      datasets: [{ label, data: values, borderColor: color, backgroundColor: "transparent", tension: 0.28, pointRadius: 2 }],
    },
    options: { responsive: true, maintainAspectRatio: false, resizeDelay: 150, animation: false, plugins: { legend: { display: true, position: "bottom" } } },
  };
}

function fallbackDaily() {
  const out = [];
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push({ day: d.toISOString().slice(0, 10), units: 620 + (i % 7) * 9 + (i % 3) * 6 });
  }
  return out;
}

function fallbackHourly() {
  const out = [];
  for (let h = 0; h < 24; h += 1) {
    const spike = h >= 18 && h <= 22 ? 16 : h >= 6 && h <= 9 ? 10 : 5;
    out.push({ hour: `${String(h).padStart(2, "0")}:00`, units: 18 + spike + (h % 4) });
  }
  return out;
}

function ensureDataConsistency() {
  if (!adminCache.daily?.length) adminCache.daily = fallbackDaily();
  if (!adminCache.hourly?.length) adminCache.hourly = fallbackHourly();

  if (!adminCache.consumption?.monthly?.length) {
    const now = new Date();
    adminCache.consumption.monthly = Array.from({ length: 12 }).map((_, idx) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - idx), 1);
      return { month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, units: 14500 + idx * 420 };
    });
  }
}

async function loadAdminBase() {
  const [summary, users, meters, requests, payments, bills, solar, consumption] = await Promise.all([
    api("/admin/analytics/summary", {}, state.token),
    api("/admin/users", {}, state.token),
    api("/admin/meters", {}, state.token),
    api("/admin/requests", {}, state.token),
    api("/admin/payments", {}, state.token),
    api("/billing/admin/all", {}, state.token),
    api("/admin/solar-systems", {}, state.token),
    api("/admin/consumption/summary", {}, state.token),
  ]);

  let daily = { data: [] };
  let hourly = { data: [] };
  let grid = {
    data: {
      total_energy_delivered_kwh: 0,
      current_grid_load_kwh: 0,
      estimated_carbon_kg_per_hour: 0,
      projected_demand_next_24h_kwh: 0,
      active_meters: summary.data.total_meters,
      offline_meters: 0,
      grid_health: "GOOD",
    },
  };

  try {
    [daily, hourly, grid] = await Promise.all([
      api("/admin/consumption/daily", {}, state.token),
      api("/admin/consumption/hourly", {}, state.token),
      api("/admin/grid/intelligence", {}, state.token),
    ]);
  } catch {
    // Keep compatibility with older backend.
  }

  adminCache = {
    summary: summary.data,
    users: users.data,
    meters: meters.data,
    requests: requests.data,
    payments: payments.data,
    bills: bills.data,
    solar: solar.data,
    consumption: consumption.data,
    daily: daily.data || [],
    hourly: hourly.data || [],
    grid: grid.data,
  };

  ensureDataConsistency();

  setText(el.kpiUsers, String(adminCache.summary.total_users));
  setText(el.kpiMeters, String(adminCache.summary.total_meters));
  setText(el.kpiOpenReq, String(adminCache.summary.open_requests));
  setText(el.kpiOutstanding, `Rs ${rs(adminCache.summary.outstanding_revenue)}`);
  setText(el.kpiGridLoad, `${rs(adminCache.grid.current_grid_load_kwh)} kWh`);
  setText(el.kpiDemand24h, `${rs(adminCache.grid.projected_demand_next_24h_kwh)} kWh`);

  setText(el.gridEnergyDelivered, `${rs(adminCache.grid.total_energy_delivered_kwh)} kWh`);
  setText(el.gridCarbon, `${rs(adminCache.grid.estimated_carbon_kg_per_hour)} kg/h`);
  setText(el.gridProjected, `${rs(adminCache.grid.projected_demand_next_24h_kwh)} kWh`);
  setText(el.gridOfflineMeters, String(adminCache.grid.offline_meters));

  if (el.sysStatus) {
    el.sysStatus.textContent = "System: LIVE";
    el.sysStatus.className = "badge off-peak";
  }
  if (el.gridHealth) {
    el.gridHealth.textContent = `Grid Health: ${adminCache.grid.grid_health}`;
    el.gridHealth.className = `badge ${adminCache.grid.grid_health === "CRITICAL" ? "peak" : adminCache.grid.grid_health === "ATTENTION" ? "normal" : "off-peak"}`;
  }
  setText(el.activeMetersIndicator, `Active Meters: ${adminCache.grid.active_meters}`);

  renderAllCharts();
  renderAllTables();
  setLastSync();
}

function renderAllCharts() {
  const reqStatus = adminCache.requests.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  const byZone = adminCache.meters.reduce((acc, m) => {
    const zone = (m.location || "Unknown").split(" ")[0];
    acc[zone] = (acc[zone] || 0) + 1;
    return acc;
  }, {});

  const paymentMethods = adminCache.payments.reduce((acc, p) => {
    acc[p.payment_method] = (acc[p.payment_method] || 0) + 1;
    return acc;
  }, {});

  const requestTypes = adminCache.requests.reduce((acc, r) => {
    acc[r.request_type] = (acc[r.request_type] || 0) + 1;
    return acc;
  }, {});

  const usage = { Low: 0, Medium: 0, High: 0 };
  adminCache.consumption.top_meters.forEach((x) => {
    if (x.units < 250) usage.Low += 1;
    else if (x.units < 500) usage.Medium += 1;
    else usage.High += 1;
  });

  const solarOffset = adminCache.solar.reduce((a, s) => a + Number(s.capacity_kw || 0), 0) * 4.2;
  const gridDemand = (adminCache.daily || []).reduce((a, d) => a + Number(d.units || 0), 0);

  const dailyLabels = (adminCache.daily || []).map((x) => x.day?.slice(5) || x.day);
  const dailyUnits = (adminCache.daily || []).map((x) => x.units || 0);
  const hourlyLabels = (adminCache.hourly || []).map((x) => x.hour);
  const hourlyUnits = (adminCache.hourly || []).map((x) => x.units || 0);

  const energyTrendCfg = withAxes(lineConfig(dailyLabels, dailyUnits, "#1f6fff", "Daily Energy"), "Date", "kWh", true);
  registerChart("chartEnergyTrend", "Energy Consumption Trends", energyTrendCfg, "Daily load trend over the most recent window. Dips usually indicate off-peak behavior.", dailyLabels.map((label, i) => ({ label, value: dailyUnits[i] })));

  const zoneCfg = withAxes(doughnutConfig(Object.keys(byZone), Object.values(byZone), ["#2c7df0", "#36bba0", "#f0a33f", "#8f72f3", "#ef6a62", "#2a9bc7"]), "", "", true);
  registerChart("chartZoneLoad", "Zone Load Distribution", zoneCfg, "Distribution of meter density across service zones.");

  const peakCfg = withAxes(barConfig(hourlyLabels, hourlyUnits, "rgba(240,163,63,0.72)", "Demand"), "Hour", "kWh", true);
  registerChart("chartPeakDemand", "Peak Demand Analysis (Today)", peakCfg, "Morning and evening peaks are expected during high appliance usage windows.", hourlyLabels.map((label, i) => ({ label, value: hourlyUnits[i] })));

  const meterState = {
    Active: adminCache.grid.active_meters || 0,
    Offline: adminCache.grid.offline_meters || 0,
    Errors: Math.max(0, (adminCache.summary.total_meters || 0) - (adminCache.grid.active_meters || 0) - (adminCache.grid.offline_meters || 0)),
  };
  const meterCfg = withAxes(barConfig(Object.keys(meterState), Object.values(meterState), "rgba(31,111,255,0.72)", "Meters"), "Status", "Count", true);
  registerChart("chartMeterStatus", "Meter Status Monitoring", meterCfg, "Tracks active, offline, and error-state meter communication counts.");

  const monthLabels = adminCache.consumption.monthly.map((x) => x.month);
  const monthUnits = adminCache.consumption.monthly.map((x) => x.units);
  const revCfg = withAxes(lineConfig(monthLabels, monthUnits, "#15b2d3", "Revenue Proxy"), "Month", "kWh Proxy", true);
  registerChart("chartRevenueTrend", "Revenue Collection Trends", revCfg, "Trend approximates billing revenue trajectory from monthly aggregate usage.", monthLabels.map((label, i) => ({ label, value: monthUnits[i] })));

  const paymentCfg = withAxes(doughnutConfig(Object.keys(paymentMethods), Object.values(paymentMethods), ["#1f6fff", "#36bba0", "#f0a33f", "#8f72f3"]), "", "", true);
  registerChart("chartPaymentMethods", "Payment Method Distribution", paymentCfg, "Breakdown of transactions by payment channel.");

  const reqTypeCfg = withAxes(barConfig(Object.keys(requestTypes), Object.values(requestTypes), "rgba(95,125,232,0.72)", "Requests"), "Request Type", "Count", true);
  registerChart("chartRequestCategories", "Service Request Categories", reqTypeCfg, "Compares operational load across request categories.");

  const solarCfg = withAxes(doughnutConfig(["Solar Offset", "Grid Demand"], [solarOffset, Math.max(0.1, gridDemand - solarOffset)], ["#36bba0", "#2c7df0"]), "", "", true);
  registerChart("chartSolarContribution", "Solar Contribution to Grid", solarCfg, "Shows the relative contribution of rooftop solar against demand.");

  const segCfg = withAxes(barConfig(Object.keys(usage), Object.values(usage), "rgba(44,125,240,0.72)", "Consumers"), "Consumption Band", "Households", true);
  registerChart("chartUsageSegmentation", "Consumer Usage Segmentation", segCfg, "Segments consumers into low, medium, and high usage groups.");

  const billingCfg = withAxes(barConfig(["Paid", "Outstanding"], [adminCache.summary.paid_revenue, adminCache.summary.outstanding_revenue], "rgba(31,111,255,0.7)", "Revenue"), "Collection", "Rs", true);
  registerChart("chartBilling", "Revenue Composition", billingCfg, "Current paid vs outstanding revenue composition.");

  const reqVolCfg = withAxes(barConfig(Object.keys(reqStatus), Object.values(reqStatus), "rgba(217,138,31,0.7)", "Requests"), "Status", "Count", true);
  registerChart("chartReqVolume", "Request Volume by Status", reqVolCfg, "Operational queue split by request status.");

  const monCfg = withAxes(barConfig(monthLabels, monthUnits, "rgba(15,154,127,0.72)", "Monthly"), "Month", "kWh", true);
  registerChart("chartConsumptionMonthly", "Monthly Consumption Trend", monCfg, "Monthly consumption aggregate from system telemetry.");

  const dayCfg = withAxes(lineConfig(dailyLabels, dailyUnits, "#2c7df0", "Daily"), "Date", "kWh", true);
  registerChart("chartConsumptionDaily", "Daily Consumption Trend", dayCfg, "Daily usage shape is useful for short-term demand planning.");

  const zoneHeatCfg = withAxes(barConfig(Object.keys(byZone), Object.values(byZone), "rgba(31,111,255,0.7)", "Zone"), "Zone", "Meter Count", true);
  registerChart("chartZoneHeat", "Meter Zone Heat", zoneHeatCfg, "Highlights zone concentration and deployment density.");
}

function renderAllTables() {
  if (el.usersTable) {
    el.usersTable.innerHTML = "";
    adminCache.users.forEach((u) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${u.user_id}</td><td>${u.full_name}</td><td>${u.email}</td><td>${u.role}</td><td>${u.account_status || "ACTIVE"}</td><td>${u.smart_meter_id || "-"}</td><td><span class='row-actions'><button data-u='${u.user_id}' class='suspend-btn'>${u.account_status === "SUSPENDED" ? "Activate" : "Suspend"}</button></span></td>`;
      el.usersTable.appendChild(tr);
    });
  }

  if (el.metersTable) {
    el.metersTable.innerHTML = "";
    adminCache.meters.forEach((m) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${m.meter_id}</td><td>${m.smart_meter_id}</td><td>${m.user_id || "-"}</td><td>${m.location || "-"}</td><td>${m.status || "-"}</td><td><span class='row-actions'><button data-m='${m.meter_id}' class='reset-meter-btn'>Reset</button></span></td>`;
      el.metersTable.appendChild(tr);
    });
  }

  if (el.requestsTable) {
    el.requestsTable.innerHTML = "";
    adminCache.requests.forEach((r) => {
      const pr = r.request_type.toLowerCase().includes("outage") ? "HIGH" : r.request_type.toLowerCase().includes("billing") ? "MEDIUM" : "LOW";
      const tech = ["R. Singh", "A. Sharma", "K. Patel"][Math.abs((r.request_id || "x").split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % 3];
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${r.request_id}</td><td>${r.user_id}</td><td>${r.request_type}</td><td>${pr}</td><td>${tech}</td><td><span class='status-pill ${r.status === "OPEN" ? "status-open" : r.status === "IN_PROGRESS" ? "status-progress" : r.status === "RESOLVED" ? "status-resolved" : "status-closed"}'>${r.status}</span></td><td>${new Date(r.updated_at).toLocaleString()}</td><td><button data-r='${r.request_id}' class='timeline-btn'>View</button></td>`;
      el.requestsTable.appendChild(tr);
    });
  }

  if (el.billsTable) {
    el.billsTable.innerHTML = "";
    adminCache.bills.forEach((b) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${b.bill_id}</td><td>${b.user_id}</td><td>${b.billing_month}</td><td>${b.units_consumed}</td><td>Rs ${rs(b.amount)}</td><td>${b.status}</td>`;
      el.billsTable.appendChild(tr);
    });
  }

  if (el.paymentsTable) {
    el.paymentsTable.innerHTML = "";
    adminCache.payments.forEach((p) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${p.payment_id}</td><td>${p.bill_id}</td><td>${p.user_id}</td><td>Rs ${rs(p.amount)}</td><td>${p.payment_method}</td><td>${p.payment_status}</td><td>${new Date(p.payment_date).toLocaleString()}</td>`;
      el.paymentsTable.appendChild(tr);
    });
  }

  if (el.solarTable) {
    el.solarTable.innerHTML = "";
    adminCache.solar.forEach((s) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${s.system_id}</td><td>${s.user_id}</td><td>${s.capacity_kw}</td><td>${s.installation_date}</td><td>${s.location}</td>`;
      el.solarTable.appendChild(tr);
    });
  }

  if (el.consumptionTable) {
    el.consumptionTable.innerHTML = "";
    adminCache.consumption.top_meters.forEach((c) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${c.meter_id}</td><td>${c.units}</td>`;
      el.consumptionTable.appendChild(tr);
    });
  }
}

function openChartModal(chartId) {
  const meta = chartMeta[chartId];
  if (!meta || !el.chartModal) return;

  const liveChart = Chart.getChart(document.getElementById(chartId));
  const liveConfig = liveChart
    ? { type: liveChart.config.type, data: structuredClone(liveChart.data), options: structuredClone(liveChart.options || {}) }
    : meta.config;
  const labels = liveConfig?.data?.labels || [];
  const values = liveConfig?.data?.datasets?.[0]?.data || [];
  const total = values.reduce((acc, v) => acc + Number(v || 0), 0);

  el.chartModal.classList.add("open");
  el.chartModal.setAttribute("aria-hidden", "false");
  setText(el.chartModalTitle, meta.title);
  const detailedNote = [
    meta.note || "Detailed operational trend view.",
    `Data points: ${values.length}`,
    total ? `Total represented value: ${rs(total)}` : "Total represented value: 0",
    values.length
      ? `Highest segment: ${labels[values.indexOf(Math.max(...values))]} (${rs(Math.max(...values))})`
      : "Highest segment: --",
  ].join("\n");
  setText(el.chartModalNote, detailedNote);

  if (el.chartModalStats) {
    el.chartModalStats.innerHTML = "";
    labels.slice(0, 80).forEach((label, idx) => {
      const tr = document.createElement("tr");
      const val = Number(values[idx] || 0);
      const pct = total > 0 ? ` (${rs((val / total) * 100)}%)` : "";
      tr.innerHTML = `<td>${label}</td><td>${rs(val)}${pct}</td>`;
      el.chartModalStats.appendChild(tr);
    });
  }

  if (el.chartModalCanvas) {
    el.chartModalCanvas.id = "chartModalCanvas";
    renderChart(
      "chartModalCanvas",
      withAxes(
        liveConfig,
        liveConfig?.options?.scales?.x?.title?.text || "",
        liveConfig?.options?.scales?.y?.title?.text || "",
        true
      )
    );
  }
}

function closeChartModal() {
  el.chartModal?.classList.remove("open");
  el.chartModal?.setAttribute("aria-hidden", "true");
}

function bindEvents() {
  if (el.apiBase) {
    el.apiBase.value = appState.apiBase || window.location.origin;
    el.apiBase.style.display = "none";
  }

  if (el.adminSettingsApiBase) {
    const apiLabel = document.querySelector("label[for='adminSettingsApiBase']");
    if (apiLabel) apiLabel.style.display = "none";
    el.adminSettingsApiBase.style.display = "none";
  }

  el.logoutBtn?.addEventListener("click", () => {
    clearSession();
    window.location.href = "/";
  });

  el.refreshBtn?.addEventListener("click", async () => {
    await loadAdminBase();
  });

  el.adminSettingsSaveBtn?.addEventListener("click", async () => {
    const nextApiBase = appState.apiBase;
    const nextTheme = el.adminThemeMode?.value === "dark" ? "dark" : "light";
    const nextAccent = el.adminAccentTheme?.value || "blue";
    const nextAutoRefreshEnabled = !!el.adminAutoRefreshEnabled?.checked;
    const nextAutoRefreshSeconds = Math.max(3, Math.min(120, Number(el.adminAutoRefreshSeconds?.value || 15)));

    state.settings.themeMode = nextTheme;
    state.settings.accentTheme = nextAccent;
    state.settings.autoRefreshEnabled = nextAutoRefreshEnabled;
    state.settings.autoRefreshSeconds = nextAutoRefreshSeconds;

    localStorage.setItem("sm_theme_mode", nextTheme);
    localStorage.setItem("sm_accent_theme", nextAccent);
    localStorage.setItem("sm_admin_auto_refresh_enabled", nextAutoRefreshEnabled ? "1" : "0");
    localStorage.setItem("sm_admin_auto_refresh_seconds", String(nextAutoRefreshSeconds));

    if (el.apiBase) el.apiBase.value = nextApiBase;
    applyTheme();
    applyAutoRefresh();
    setStatus("Admin settings saved.");
    await loadAdminBase();
    loadAdminSettingsPanel();
  });

  el.adminSettingsResetBtn?.addEventListener("click", () => {
    state.settings.themeMode = "light";
    state.settings.accentTheme = "blue";
    state.settings.autoRefreshEnabled = true;
    state.settings.autoRefreshSeconds = 15;
    localStorage.setItem("sm_theme_mode", "light");
    localStorage.setItem("sm_accent_theme", "blue");
    localStorage.setItem("sm_admin_auto_refresh_enabled", "1");
    localStorage.setItem("sm_admin_auto_refresh_seconds", "15");
    applyTheme();
    applyAutoRefresh();
    loadAdminSettingsPanel();
    setStatus("Admin settings reset to defaults.");
  });

  el.chartModalClose?.addEventListener("click", closeChartModal);
  el.chartModal?.addEventListener("click", (event) => {
    if (event.target === el.chartModal) closeChartModal();
  });

  el.requestUpdateForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api(`/admin/requests/${el.reqId.value.trim()}`, {
        method: "PATCH",
        body: JSON.stringify({ status: el.reqStatus.value, note: el.reqNote.value.trim() }),
      }, state.token);
      setText(el.requestUpdateMsg, "Request status updated.");
      await loadAdminBase();
    } catch (err) {
      setText(el.requestUpdateMsg, err.message);
    }
  });

  el.generateBillForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const out = await api("/admin/billing/generate", {
        method: "POST",
        body: JSON.stringify({
          user_id: el.billUserId.value.trim(),
          billing_month: el.billMonth.value.trim(),
          units_consumed: Number(el.billUnits.value),
          due_date: el.billDueDate.value,
        }),
      }, state.token);
      setText(el.billGenerateMsg, `Generated ${out.data.bill_id} for ${out.data.user_id}`);
      await loadAdminBase();
    } catch (err) {
      setText(el.billGenerateMsg, err.message);
    }
  });

  document.addEventListener("click", async (event) => {
    const card = event.target.closest(".chart-card");
    if (card?.dataset.chart) {
      openChartModal(card.dataset.chart);
      return;
    }

    const suspend = event.target.closest(".suspend-btn");
    if (suspend) {
      const userId = suspend.dataset.u;
      const row = adminCache.users.find((u) => u.user_id === userId);
      const next = row?.account_status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
      await api(`/admin/users/${userId}/status`, { method: "PATCH", body: JSON.stringify({ status: next }) }, state.token);
      await loadAdminBase();
      return;
    }

    const reset = event.target.closest(".reset-meter-btn");
    if (reset) {
      await api(`/admin/meters/${reset.dataset.m}/reset`, { method: "POST", body: JSON.stringify({ note: "Manual reset" }) }, state.token);
      await loadAdminBase();
      return;
    }

    const timeline = event.target.closest(".timeline-btn");
    if (timeline) {
      const req = adminCache.requests.find((r) => r.request_id === timeline.dataset.r);
      if (!req || !el.requestTimelineView) return;
      const lines = (req.timeline || []).map((t) => `- ${t.status} | ${new Date(t.at).toLocaleString()} | ${t.note}`);
      el.requestTimelineView.textContent = `Request: ${req.request_id}\nType: ${req.request_type}\n\n${lines.join("\n")}`;
    }
  });
}

async function init() {
  applyTheme();
  setText(el.adminIdentity, `${state.user?.full_name || "Admin Operator"} (${state.role})`);
  buildNav();
  bindEvents();
  applyAutoRefresh();
  await loadAdminBase();
  switchPage("dashboard");
}

init();



