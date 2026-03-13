import { api, appState, rs } from "../services/api.js";
import { clearSession, requireRole } from "../services/auth.js";
import { barConfig, doughnutConfig, renderChart } from "../services/charts.js";

const session = requireRole(["USER"]);
if (!session) {
  throw new Error("Unauthorized");
}

const state = {
  token: session.token,
  user: session.user,
  role: session.role,
  appliances: {},
  autoRefreshEnabled: true,
  autoRefreshSeconds: 6,
  autoRefreshTimer: null,
  chatSessionId: "",
  scheduleMeta: {},
  prefs: {
    darkMode: localStorage.getItem("sm_theme_mode") === "dark",
    accentTheme: localStorage.getItem("sm_accent_theme") || "blue",
    language: localStorage.getItem("sm_language") || "en",
    notifications: localStorage.getItem("sm_notifications") !== "0",
    energyAlerts: localStorage.getItem("sm_energy_alerts") !== "0",
    alertThreshold: Number(localStorage.getItem("sm_energy_threshold") || 18),
    aiEnabled: localStorage.getItem("sm_ai_enabled") !== "0",
    aiStyle: localStorage.getItem("sm_ai_style") || "balanced",
    defaultApplianceBehavior: localStorage.getItem("sm_appliance_behavior") || "retain",
    profileVisibility: localStorage.getItem("sm_profile_visibility") || "private",
  },
};

const pages = [
  ["overview", "Energy Overview", "bolt"],
  ["appliances", "Appliances", "power"],
  ["billing", "Billing", "receipt_long"],
  ["payments", "Payments", "payments"],
  ["analytics", "Consumption Analytics", "insights"],
  ["service", "Service Requests", "build"],
  ["solar", "Solar Dashboard", "solar_power"],
  ["calculator", "Energy Calculator", "calculate"],
  ["help", "Help Center", "help"],
  ["settings", "Settings", "settings"],
];

const el = {
  apiBase: document.getElementById("apiBase"),
  nav: document.getElementById("nav"),
  whoami: document.getElementById("whoami"),
  logoutBtn: document.getElementById("logoutBtn"),
  settingsBtn: document.getElementById("settingsBtn"),
  pageTitle: document.getElementById("pageTitle"),
  refreshBtn: document.getElementById("refreshBtn"),
  lastSync: document.getElementById("lastSync"),
  tariffBadge: document.getElementById("tariffBadge"),
  events: document.getElementById("events"),
  kpiLoad: document.getElementById("kpiLoad"),
  kpiCost: document.getElementById("kpiCost"),
  kpiSavings: document.getElementById("kpiSavings"),
  kpiSavingsPct: document.getElementById("kpiSavingsPct"),
  kpiCarbonRate: document.getElementById("kpiCarbonRate"),
  kpiCarbonToday: document.getElementById("kpiCarbonToday"),
  kpiCarbonMonth: document.getElementById("kpiCarbonMonth"),
  kpiCarbonIntensity: document.getElementById("kpiCarbonIntensity"),
  carbonGauge: document.getElementById("carbonGauge"),
  savingsGauge: document.getElementById("savingsGauge"),
  energyBalanceCard: document.getElementById("energyBalanceCard"),
  balanceMeterType: document.getElementById("balanceMeterType"),
  balanceCurrent: document.getElementById("balanceCurrent"),
  balanceDaily: document.getElementById("balanceDaily"),
  balanceDays: document.getElementById("balanceDays"),
  balanceNextBill: document.getElementById("balanceNextBill"),
  balanceInsight: document.getElementById("balanceInsight"),
  balanceActionBtn: document.getElementById("balanceActionBtn"),
  balanceForecastBtn: document.getElementById("balanceForecastBtn"),
  runAi: document.getElementById("runAi"),
  aiText: document.getElementById("aiText"),
  subStatus: document.getElementById("subStatus"),
  planActions: document.getElementById("planActions"),
  applianceList: document.getElementById("applianceList"),
  applianceMixSummary: document.getElementById("applianceMixSummary"),
  scheduleForm: document.getElementById("scheduleForm"),
  scheduleDevice: document.getElementById("scheduleDevice"),
  scheduleTime: document.getElementById("scheduleTime"),
  scheduleRepeat: document.getElementById("scheduleRepeat"),
  scheduleList: document.getElementById("scheduleList"),
  simulateTimeForm: document.getElementById("simulateTimeForm"),
  simulateTime: document.getElementById("simulateTime"),
  simulateMsg: document.getElementById("simulateMsg"),
  whatIfForm: document.getElementById("whatIfForm"),
  whatIfDevices: document.getElementById("whatIfDevices"),
  whatIfTime: document.getElementById("whatIfTime"),
  whatIfResult: document.getElementById("whatIfResult"),
  currentBill: document.getElementById("currentBill"),
  billingEstimateForm: document.getElementById("billingEstimateForm"),
  billingUnits: document.getElementById("billingUnits"),
  billingEstimate: document.getElementById("billingEstimate"),
  billHistory: document.getElementById("billHistory"),
  payForm: document.getElementById("payForm"),
  payBillId: document.getElementById("payBillId"),
  payAmount: document.getElementById("payAmount"),
  payMethod: document.getElementById("payMethod"),
  payMessage: document.getElementById("payMessage"),
  paymentHistory: document.getElementById("paymentHistory"),
  serviceForm: document.getElementById("serviceForm"),
  serviceType: document.getElementById("serviceType"),
  serviceDesc: document.getElementById("serviceDesc"),
  serviceHistory: document.getElementById("serviceHistory"),
  serviceTimeline: document.getElementById("serviceTimeline"),
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
  settingsApiBase: document.getElementById("settingsApiBase"),
  darkModeToggle: document.getElementById("darkModeToggle"),
  accentTheme: document.getElementById("accentTheme"),
  languageSelect: document.getElementById("languageSelect"),
  notifToggle: document.getElementById("notifToggle"),
  energyAlertToggle: document.getElementById("energyAlertToggle"),
  energyAlertThreshold: document.getElementById("energyAlertThreshold"),
  aiAssistantToggle: document.getElementById("aiAssistantToggle"),
  aiStyleSelect: document.getElementById("aiStyleSelect"),
  defaultApplianceBehavior: document.getElementById("defaultApplianceBehavior"),
  profileVisibility: document.getElementById("profileVisibility"),
  appInfo: document.getElementById("appInfo"),
  applySettingsApi: document.getElementById("applySettingsApi"),
  autoRefreshEnabled: document.getElementById("autoRefreshEnabled"),
  autoRefreshSeconds: document.getElementById("autoRefreshSeconds"),
  applyRefreshSettings: document.getElementById("applyRefreshSettings"),
  clearLogsBtn: document.getElementById("clearLogsBtn"),
  resetSettingsBtn: document.getElementById("resetSettingsBtn"),
  settingsStatus: document.getElementById("settingsStatus"),
  chatToggle: document.getElementById("chatToggle"),
  chatWidget: document.getElementById("chatWidget"),
  chatClose: document.getElementById("chatClose"),
  chatMessages: document.getElementById("chatMessages"),
  chatForm: document.getElementById("chatForm"),
  chatInput: document.getElementById("chatInput"),
  chatTyping: document.getElementById("chatTyping"),
  chatQuickActions: document.getElementById("chatQuickActions"),
  sidebar: document.querySelector(".sidebar"),
  sidebarToggle: document.getElementById("sidebarToggle"),
  sidebarBackdrop: document.getElementById("sidebarBackdrop"),
};

const DEVICE_ICONS = {
  "air conditioner": "AC",
  refrigerator: "RF",
  "ceiling fan": "FN",
  "led lights": "LG",
  "tube lights": "TL",
  "smart tv": "TV",
  geyser: "GY",
  "washing machine": "WM",
  "wi-fi router": "RT",
  "water pump": "WP",
  "induction cooktop": "IC",
  "microwave oven": "MW",
  "mobile chargers": "CH",
  "air cooler": "CL",
};

const CO2_PER_KWH = 0.82;
const TYPICAL_HOUSEHOLD_KWH_PER_HOUR = 1.8;
const TYPICAL_EMISSION_RATE = TYPICAL_HOUSEHOLD_KWH_PER_HOUR * CO2_PER_KWH;
const SAVINGS_FULL_SCALE_RATIO = 0.4;
const metricAnimations = new WeakMap();
const MOBILE_WIDTH = 768;

function logEvent(message, isError = false) {
  const li = document.createElement("li");
  li.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  if (isError) li.style.color = "#b63a31";
  el.events.prepend(li);
  while (el.events.children.length > 20) el.events.lastChild.remove();
}

function setText(node, value) {
  if (node) node.textContent = value;
}

function setLastSync() {
  setText(el.lastSync, `Last sync: ${new Date().toLocaleTimeString()}`);
}

function asNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function clamp(value, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

function cssVar(name, fallback = "") {
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return val || fallback;
}

function animateMetric(node, target, options = {}) {
  if (!node) return;
  const decimals = options.decimals ?? 2;
  const prefix = options.prefix ?? "";
  const suffix = options.suffix ?? "";
  const duration = options.duration ?? 520;
  const finalValue = asNumber(target);
  const currentValue = asNumber(node.dataset.metricValue);
  node.dataset.metricValue = String(finalValue);

  const formatValue = (value) => `${prefix}${value.toFixed(decimals)}${suffix}`;
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  if (reduceMotion || Math.abs(finalValue - currentValue) < 0.001) {
    node.textContent = formatValue(finalValue);
    return;
  }

  const animationId = Symbol("metric");
  metricAnimations.set(node, animationId);
  const start = performance.now();

  const step = (now) => {
    if (metricAnimations.get(node) !== animationId) return;
    const progress = clamp((now - start) / duration, 0, 1);
    const eased = 1 - (1 - progress) ** 3;
    const value = currentValue + (finalValue - currentValue) * eased;
    node.textContent = formatValue(value);
    if (progress < 1) requestAnimationFrame(step);
  };

  requestAnimationFrame(step);
}

function setGaugeValue(node, rawValue) {
  if (!node) return;
  node.style.setProperty("--value", String(clamp(rawValue, 0, 1)));
}

function sumDailyUnits(rows = []) {
  return rows.reduce((sum, row) => sum + asNumber(row?.units), 0);
}

function buildApplianceMix(devices = {}, meterLoad = 0) {
  const active = Object.values(devices)
    .filter((device) => !!device?.state)
    .map((device) => ({ name: device.name || "Device", units: asNumber(device.units_per_hour) }))
    .filter((item) => item.units > 0);

  active.sort((a, b) => b.units - a.units);
  const topLoads = active.slice(0, 5);
  const otherUnits = active.slice(5).reduce((sum, item) => sum + item.units, 0);
  const activeUnits = active.reduce((sum, item) => sum + item.units, 0);
  const baseUnits = Math.max(0, asNumber(meterLoad) - activeUnits);

  const labels = topLoads.map((item) => item.name);
  const values = topLoads.map((item) => item.units);

  if (otherUnits > 0) {
    labels.push("Other Active Loads");
    values.push(otherUnits);
  }

  if (baseUnits > 0.01) {
    labels.push("Base / Standby Load");
    values.push(baseUnits);
  }

  if (!labels.length) {
    labels.push("Idle");
    values.push(1);
  }

  return { labels, values, activeUnits, active };
}

function renderApplianceMixChart(devices = {}, meterLoad = 0) {
  const mix = buildApplianceMix(devices, meterLoad);
  const palette = [
    cssVar("--brand", "#1f6fff"),
    cssVar("--brand-2", "#15b2d3"),
    cssVar("--ok", "#1f9d62"),
    cssVar("--warn", "#d98a1f"),
    cssVar("--danger", "#d94b3f"),
    "#8b7bff",
    "#63c58b",
  ];

  renderChart("chartApplianceMix", doughnutConfig(mix.labels, mix.values, palette.slice(0, mix.labels.length)));

  if (!el.applianceMixSummary) return;
  if (!mix.active.length) {
    el.applianceMixSummary.textContent = "No appliances are currently active. Distribution is based on idle load.";
    return;
  }

  const top = mix.active[0];
  const total = Math.max(0.001, mix.values.reduce((sum, val) => sum + asNumber(val), 0));
  const topShare = (top.units / total) * 100;
  el.applianceMixSummary.textContent = [
    `Top load: ${top.name} (${top.units.toFixed(2)} kWh/h)`,
    `Share of active + base load: ${topShare.toFixed(0)}%`,
    `Total active appliance load: ${mix.activeUnits.toFixed(2)} kWh/h`,
  ].join("\n");
}

function updateCarbonFootprintCard({ liveLoad, devices, dailySeries, monthlyEstimateKwh }) {
  const activeLoad = Object.values(devices || {})
    .filter((device) => !!device?.state)
    .reduce((sum, device) => sum + asNumber(device.units_per_hour), 0);

  const currentLoad = Math.max(asNumber(liveLoad), activeLoad);
  const currentEmissionRate = currentLoad * CO2_PER_KWH;

  const todayUnitsFromSeries = sumDailyUnits(dailySeries);
  const now = new Date();
  const hourFactor = now.getHours() + now.getMinutes() / 60;
  const fallbackTodayUnits = currentLoad * Math.max(hourFactor, 1);
  const totalUnitsToday = todayUnitsFromSeries > 0 ? todayUnitsFromSeries : fallbackTodayUnits;

  const totalEmissionsToday = totalUnitsToday * CO2_PER_KWH;
  const monthlyKwh = asNumber(monthlyEstimateKwh) > 0
    ? asNumber(monthlyEstimateKwh)
    : (totalUnitsToday / Math.max(now.getDate(), 1)) * 30;
  const monthlyEmissions = monthlyKwh * CO2_PER_KWH;

  const intensityRatio = currentEmissionRate / Math.max(TYPICAL_EMISSION_RATE, 0.01);
  const cappedIntensity = clamp(intensityRatio, 0, 1);

  animateMetric(el.kpiCarbonRate, currentEmissionRate, { decimals: 2 });
  animateMetric(el.kpiCarbonToday, totalEmissionsToday, { decimals: 2 });
  animateMetric(el.kpiCarbonMonth, monthlyEmissions, { decimals: 1 });
  setGaugeValue(el.carbonGauge, cappedIntensity);
  setText(
    el.kpiCarbonIntensity,
    `Intensity: ${(intensityRatio * 100).toFixed(0)}% of typical household consumption`
  );
}

function updateSavingsGauge(savingsPerHour, costPerHour) {
  const savings = Math.max(0, asNumber(savingsPerHour));
  const burn = Math.max(0, asNumber(costPerHour));
  const ratio = burn > 0 ? clamp(savings / burn, 0, 2) : savings > 0 ? 1 : 0;

  animateMetric(el.kpiSavings, savings, { decimals: 2 });
  animateMetric(el.kpiSavingsPct, ratio * 100, { decimals: 0, suffix: "%" });
  setGaugeValue(el.savingsGauge, ratio / SAVINGS_FULL_SCALE_RATIO);
}

function renderSolarContributionChart(netData = {}) {
  const consumed = Math.max(0, asNumber(netData.consumed_units));
  const generated = Math.max(0, asNumber(netData.generated_units));
  const gridImport = Math.max(0, asNumber(netData.grid_import_units));
  const gridExport = Math.max(0, asNumber(netData.grid_export_units));
  const solarUsed = Math.min(consumed, generated);
  const nonSolar = Math.max(0, consumed - solarUsed);

  const labels = consumed > 0 ? ["Solar Used", "Grid Power"] : ["No consumption"];
  const values = consumed > 0 ? [solarUsed, nonSolar] : [1];
  const colors = consumed > 0
    ? [cssVar("--ok", "#1f9d62"), cssVar("--brand", "#1f6fff")]
    : [cssVar("--line", "#d7e2ec")];

  renderChart("chartSolarContribution", doughnutConfig(labels, values, colors));

  const share = consumed > 0 ? (solarUsed / consumed) * 100 : 0;
  el.solarNet.textContent = [
    `Consumed Units: ${consumed.toFixed(2)}`,
    `Generated Units: ${generated.toFixed(2)}`,
    `Grid Import: ${gridImport.toFixed(2)}`,
    `Grid Export: ${gridExport.toFixed(2)}`,
    `Solar share of usage: ${share.toFixed(0)}%`,
    `Estimated Savings: Rs ${rs(netData.estimated_savings_rs)}`,
  ].join("\n");
}

function appendChatMessage(role, text) {
  const bubble = document.createElement("div");
  bubble.className = `chat-msg ${role}`;
  bubble.textContent = text;
  el.chatMessages.appendChild(bubble);
  el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
}

function setChatTyping(show) {
  el.chatTyping.style.display = show ? "block" : "none";
}

async function sendChat(message) {
  if (!message.trim()) return;
  appendChatMessage("user", message.trim());
  el.chatInput.value = "";
  setChatTyping(true);
  try {
    const res = await api(
      "/chat/query",
      {
        method: "POST",
        body: JSON.stringify({ message: message.trim(), session_id: state.chatSessionId }),
      },
      state.token
    );
    appendChatMessage("assistant", res.answer || "I could not generate a response right now.");
    logEvent(`Chat response source: ${res.source}`);
    if (res.navigate_to) {
      const path = String(res.navigate_to).toLowerCase();
      const routeMap = {
        "/app/": "overview",
        "/app/#overview": "overview",
        "/app/#appliances": "appliances",
        "/app/#billing": "billing",
        "/app/#payments": "payments",
        "/app/#solar": "solar",
        "/app/#service": "service",
        "/app/#analytics": "analytics",
        "/app/#settings": "settings",
      };
      const page = routeMap[path];
      if (page) switchPage(page);
    }
    if (res.action && res.action.ui_hints) {
      const hints = Array.isArray(res.action.ui_hints) ? res.action.ui_hints : [];
      if (hints.includes("appliances")) await loadAppliances();
      if (hints.includes("billing")) await loadBilling();
      if (hints.includes("payments")) await loadPayments();
      if (hints.includes("service")) await loadService();
      if (hints.includes("overview")) await loadOverview();
      if (hints.includes("solar")) await loadSolar();
      if (hints.includes("analytics")) await loadAnalytics();
      const firstPageHint = hints.find((h) =>
        ["overview", "appliances", "billing", "payments", "analytics", "service", "solar", "calculator", "help", "settings"].includes(h)
      );
      if (firstPageHint) {
        switchPage(firstPageHint);
      }
    }
  } catch (err) {
    appendChatMessage(
      "assistant",
      "I am currently unable to fetch AI response. Please try again in a moment."
    );
    logEvent(`Chat error: ${err.message}`, true);
  } finally {
    setChatTyping(false);
  }
}

async function loadChatHistory() {
  try {
    const res = await api(`/chat/history?session_id=${encodeURIComponent(state.chatSessionId)}`, {}, state.token);
    const history = res.history || [];
    el.chatMessages.innerHTML = "";
    if (!history.length) {
      appendChatMessage(
        "assistant",
        "Hi, I am your energy assistant. Ask me about your bill, tariffs, appliance usage, service requests, or solar generation."
      );
      return;
    }
    history.forEach((item) => {
      if (item.role === "user" || item.role === "assistant") {
        appendChatMessage(item.role, item.text);
      }
    });
  } catch {
    appendChatMessage(
      "assistant",
      "Hi, I am your energy assistant. Ask me about your bill, tariffs, appliance usage, service requests, or solar generation."
    );
  }
}

function setTariffBadge(type, price) {
  const klass = type === "off_peak" ? "off-peak" : type === "peak" ? "peak" : "normal";
  el.tariffBadge.className = `badge ${klass}`;
  el.tariffBadge.textContent = `Tariff: ${type.replace("_", " ")} (Rs ${rs(price)})`;
}

function setBalanceCard(data) {
  const days = Number(data.estimated_days_remaining || 0);
  const meterType = String(data.meter_type || "PREPAID").toUpperCase();

  el.energyBalanceCard?.classList.remove("balance-safe", "balance-warning", "balance-critical");
  if (meterType === "POSTPAID") {
    if (Number(data.outstanding_amount || 0) > 1800) el.energyBalanceCard?.classList.add("balance-critical");
    else if (Number(data.outstanding_amount || 0) > 900) el.energyBalanceCard?.classList.add("balance-warning");
    else el.energyBalanceCard?.classList.add("balance-safe");
  } else {
    if (days <= 2) el.energyBalanceCard?.classList.add("balance-critical");
    else if (days <= 5) el.energyBalanceCard?.classList.add("balance-warning");
    else el.energyBalanceCard?.classList.add("balance-safe");
  }

  setText(el.balanceMeterType, `Meter: ${meterType}`);
  setText(el.balanceCurrent, rs(data.current_balance));
  setText(el.balanceDaily, rs(data.estimated_daily_cost));
  setText(el.balanceDays, Number(data.estimated_days_remaining || 0).toFixed(1));
  setText(el.balanceNextBill, rs(data.next_bill_estimate));
  if (meterType === "POSTPAID") {
    setText(el.balanceInsight, [
      `Outstanding: Rs ${rs(data.outstanding_amount)}`,
      `Estimated daily spending: Rs ${rs(data.estimated_daily_cost)}`,
      `Projected next bill: Rs ${rs(data.next_bill_estimate)}`,
    ].join("\n"));
    setText(el.balanceActionBtn, "Pay Bill");
  } else {
    setText(el.balanceInsight, [
      `Balance can last approx ${Number(data.estimated_days_remaining || 0).toFixed(1)} days based on last 7-day usage.`,
      `Last recharge: ${data.last_topup ? new Date(data.last_topup).toLocaleString() : "-"}`,
    ].join("\n"));
    setText(el.balanceActionBtn, "Recharge");
  }
}

function buildNav() {
  el.nav.innerHTML = "";
  pages.forEach(([id, title, icon]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.page = id;
    btn.innerHTML = `<span class="nav-ico material-icons" aria-hidden="true">${icon}</span><span class="nav-label">${title}</span>`;
    btn.addEventListener("click", () => {
      switchPage(id);
      if (window.innerWidth < MOBILE_WIDTH) closeSidebar();
    });
    el.nav.appendChild(btn);
  });
}

function scheduleKey(deviceId, runTime, idx) {
  return `${deviceId}|${runTime}|${idx}`;
}

function saveScheduleMeta() {
  localStorage.setItem(`sm_schedule_meta_${state.user?.user_id || "user"}`, JSON.stringify(state.scheduleMeta));
}

function loadScheduleMeta() {
  try {
    const raw = localStorage.getItem(`sm_schedule_meta_${state.user?.user_id || "user"}`);
    state.scheduleMeta = raw ? JSON.parse(raw) : {};
  } catch {
    state.scheduleMeta = {};
  }
}

function switchPage(id) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  document.getElementById(id)?.classList.add("active");
  document.querySelectorAll(".nav button").forEach((b) => b.classList.toggle("active", b.dataset.page === id));
  const selected = pages.find((p) => p[0] === id);
  if (selected) el.pageTitle.textContent = selected[1];
  refreshPage(id).catch((err) => logEvent(err.message, true));
}

function setBillingEstimate(data) {
  el.billingEstimate.textContent = [
    `Projected Monthly kWh: ${data.projected_monthly_kwh}`,
    `Estimated Bill: Rs ${rs(data.estimated_monthly_bill)}`,
    `Flat Tariff Bill: Rs ${rs(data.baseline_flat_tariff_bill)}`,
    `Savings vs Flat: Rs ${rs(data.savings_vs_flat_tariff)}`,
  ].join("\n");
}

async function loadOverview() {
  const [meter, tariffRes, costRes, optimizeRes, plans, subStatus, balance, system, dailyUsage, billingEstimate] = await Promise.all([
    api("/meter/live", {}, state.token).catch(() => ({ data: { units_kwh: 0 } })),
    api("/tariff/current", {}, state.token).catch(() => ({ data: { type: "normal", effective_tariff: 6 } })),
    api("/cost/current", {}, state.token).catch(() => ({ data: { cost_per_hour: 0 } })),
    api("/optimize", {}, state.token).catch(() => ({ data: { savings_per_hour: 0 } })),
    api("/subscriptions/plans", {}, state.token).catch(() => ({ data: [] })),
    api("/subscriptions/status", {}, state.token).catch(() => ({ data: null })),
    api("/balance/status", {}, state.token).catch(() => ({ data: null })),
    api("/system/status", {}, state.token).catch(() => ({ data: { devices: {} } })),
    api("/consumption/daily", {}, state.token).catch(() => ({ data: [] })),
    api("/billing/estimate", {}, state.token).catch(() => ({ data: { projected_monthly_kwh: 0 } })),
  ]);

  const liveLoad = asNumber(meter?.data?.units_kwh);
  const costPerHour = asNumber(costRes?.data?.cost_per_hour);
  const savingsPerHour = asNumber(optimizeRes?.data?.savings_per_hour);
  const devices = system?.data?.devices || {};
  state.appliances = devices;

  setText(el.kpiLoad, liveLoad.toFixed(2));
  setText(el.kpiCost, rs(costPerHour));
  updateSavingsGauge(savingsPerHour, costPerHour);
  updateCarbonFootprintCard({
    liveLoad,
    devices,
    dailySeries: dailyUsage?.data || [],
    monthlyEstimateKwh: billingEstimate?.data?.projected_monthly_kwh,
  });

  setTariffBadge(tariffRes?.data?.type || "normal", tariffRes?.data?.effective_tariff || 6);

  el.subStatus?.classList.remove("skeleton");
  setText(el.subStatus, subStatus?.data ? `Active: ${subStatus.data.plan_name} (until ${subStatus.data.end_date || "-"})` : "No active subscription");
  if (balance?.data) setBalanceCard(balance.data);

  if (el.planActions) el.planActions.innerHTML = "";
  (plans?.data || []).forEach((plan) => {
    const wrapper = document.createElement("div");
    wrapper.className = "row";
    wrapper.innerHTML = `<div><strong>${plan.plan_name}</strong><div style="font-size:0.85rem;color:#5b7287">${plan.description}</div></div>`;
    const button = document.createElement("button");
    button.className = "btn btn-outline";
    button.textContent = `Activate (${plan.price_monthly === 0 ? "Free" : `Rs ${plan.price_monthly}/mo`})`;
    button.addEventListener("click", async () => {
      await api("/subscriptions/activate", { method: "POST", body: JSON.stringify({ plan_name: plan.plan_name }) }, state.token);
      logEvent(`Activated plan: ${plan.plan_name}`);
      await loadOverview();
    });
    wrapper.appendChild(button);
    el.planActions?.appendChild(wrapper);
  });
}

async function runAi() {
  try {
    el.aiText.textContent = "Generating recommendation...";
    const out = await api("/ai/auto-recommend", {}, state.token);
    el.aiText.textContent = out.ai_recommendation || "AI service unavailable.";
    logEvent("AI recommendation refreshed");
  } catch (err) {
    el.aiText.textContent = err.message;
  }
}

async function loadAppliances() {
  const [system, schedules, meter] = await Promise.all([
    api("/system/status", {}, state.token),
    api("/schedule", {}, state.token),
    api("/meter/live", {}, state.token).catch(() => ({ data: { units_kwh: 0 } })),
  ]);

  const devices = system.data.devices;
  state.appliances = devices;
  el.applianceList.innerHTML = "";
  el.scheduleDevice.innerHTML = "";
  el.whatIfDevices.innerHTML = "";

  Object.entries(devices).forEach(([id, device]) => {
    const article = document.createElement("article");
    article.className = "appliance-item";
    article.setAttribute("data-interactive", "true");
    const icon = DEVICE_ICONS[device.name.toLowerCase()] || "DV";
    article.innerHTML = `
      <div class="device-icon">${icon}</div>
      <div class="device-meta">
        <strong>${device.name}</strong>
        <div class="device-sub">${device.flexible ? "Flexible load" : "Essential load"}</div>
        <div class="device-power">${device.units_per_hour} kWh/h</div>
      </div>
      <div class="toggle-wrap">
        <span class="state-pill ${device.state ? "state-on" : "state-off"}">${device.state ? "ON" : "OFF"}</span>
        <label class="toggle-switch">
          <input type="checkbox" ${device.state ? "checked" : ""} />
          <span class="toggle-slider"></span>
        </label>
      </div>
    `;

    const toggle = article.querySelector("input[type='checkbox']");
    toggle.addEventListener("change", async () => {
      try {
        await api(`/appliance/toggle/${id}`, {
          method: "POST",
          body: JSON.stringify({ state: toggle.checked }),
        }, state.token);
        logEvent(`${device.name} turned ${toggle.checked ? "ON" : "OFF"}`);
        await Promise.all([loadOverview(), loadAppliances()]);
      } catch (err) {
        toggle.checked = !toggle.checked;
        logEvent(err.message, true);
      }
    });
    el.applianceList.appendChild(article);

    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = device.name;
    el.scheduleDevice.appendChild(opt);

    if (device.flexible) {
      const label = document.createElement("label");
      label.className = "badge normal";
      label.innerHTML = `<input type="checkbox" value="${id}" /> ${device.name}`;
      el.whatIfDevices.appendChild(label);
    }
  });

  el.scheduleList.innerHTML = "";
  const visibleRules = schedules
    .map((sch, idx) => {
      const key = scheduleKey(sch.device_id, sch.run_time, idx);
      const meta = state.scheduleMeta[key] || { enabled: true, repeat: "daily", hidden: false };
      return { ...sch, idx, key, meta };
    })
    .filter((rule) => !rule.meta.hidden);

  if (!visibleRules.length) {
    el.scheduleList.innerHTML = "<li class='schedule-row'>No schedule yet.</li>";
  } else {
    visibleRules.forEach((sch) => {
      const li = document.createElement("li");
      li.className = `schedule-item ${sch.meta.enabled ? "" : "disabled"}`;
      li.innerHTML = `
        <div class="schedule-dot"></div>
        <div class="schedule-card">
          <div class="schedule-title-row">
            <strong>${state.appliances[sch.device_id]?.name || sch.device_id}</strong>
            <span class="badge normal">${sch.run_time} IST</span>
          </div>
          <div class="schedule-meta-row">
            <span class="badge off-peak">Repeat: ${sch.meta.repeat}</span>
            <label class="toggle-switch">
              <input type="checkbox" ${sch.meta.enabled ? "checked" : ""} data-act="toggle" data-key="${sch.key}" />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="schedule-actions">
            <button type="button" class="btn btn-outline" data-act="edit" data-key="${sch.key}" data-device="${sch.device_id}">Edit</button>
            <button type="button" class="btn btn-outline" data-act="delete" data-key="${sch.key}">Delete</button>
          </div>
        </div>
      `;
      el.scheduleList.appendChild(li);
    });

    el.scheduleList.querySelectorAll("[data-act='toggle']").forEach((node) => {
      node.addEventListener("change", () => {
        const key = node.dataset.key;
        const curr = state.scheduleMeta[key] || { enabled: true, repeat: "daily", hidden: false };
        state.scheduleMeta[key] = { ...curr, enabled: !!node.checked };
        saveScheduleMeta();
        loadAppliances().catch(() => {});
      });
    });

    el.scheduleList.querySelectorAll("[data-act='delete']").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.key;
        const curr = state.scheduleMeta[key] || { enabled: true, repeat: "daily", hidden: false };
        state.scheduleMeta[key] = { ...curr, hidden: true };
        saveScheduleMeta();
        loadAppliances().catch(() => {});
      });
    });

    el.scheduleList.querySelectorAll("[data-act='edit']").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const key = btn.dataset.key;
        const deviceId = btn.dataset.device;
        const existing = schedules.find((x, idx) => scheduleKey(x.device_id, x.run_time, idx) === key);
        const newTime = window.prompt("Enter new schedule time (HH:MM)", existing?.run_time || "04:00");
        if (!newTime) return;
        await api("/schedule", { method: "POST", body: JSON.stringify({ device_id: deviceId, run_time: newTime }) }, state.token);
        const curr = state.scheduleMeta[key] || { enabled: true, repeat: "daily", hidden: false };
        state.scheduleMeta[key] = { ...curr, hidden: true };
        saveScheduleMeta();
        logEvent(`Schedule updated for ${state.appliances[deviceId]?.name || deviceId} at ${newTime}`);
        await loadAppliances();
      });
    });
  }

  renderApplianceMixChart(devices, meter?.data?.units_kwh || 0);
}

async function loadBilling() {
  const [current, history, estimate] = await Promise.all([
    api("/billing/current", {}, state.token),
    api("/billing/history", {}, state.token),
    api("/billing/estimate", {}, state.token),
  ]);

  el.currentBill.classList.remove("skeleton");
  el.currentBill.textContent = [
    `Bill ID: ${current.data.bill_id}`,
    `Billing Month: ${current.data.billing_month}`,
    `Units: ${current.data.units_consumed}`,
    `Amount: Rs ${rs(current.data.amount)}`,
    `Due Date: ${current.data.due_date}`,
    `Status: ${current.data.status}`,
  ].join("\n");

  setBillingEstimate(estimate.data);

  el.billHistory.innerHTML = "";
  history.data.forEach((bill) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${bill.billing_month}</td>
      <td>${bill.units_consumed}</td>
      <td>Rs ${rs(bill.amount)}</td>
      <td>${bill.status}</td>
      <td><a href="#" data-download="${bill.bill_id}">Download</a></td>
      <td>${bill.status === "UNPAID" ? `<button data-pay="${bill.bill_id}" data-amount="${bill.amount}">Pay</button>` : "-"}</td>
    `;
    el.billHistory.appendChild(tr);
  });

  el.billHistory.querySelectorAll("button[data-pay]").forEach((button) => {
    button.addEventListener("click", () => {
      el.payBillId.value = button.dataset.pay;
      el.payAmount.value = button.dataset.amount;
      switchPage("payments");
    });
  });

  el.billHistory.querySelectorAll("a[data-download]").forEach((anchor) => {
    anchor.addEventListener("click", async (event) => {
      event.preventDefault();
      const download = await api(`/billing/${anchor.dataset.download}/download`, {}, state.token);
      logEvent(`Mock PDF link: ${download.data.download_url}`);
    });
  });
}

async function loadPayments() {
  const data = await api("/payment/history", {}, state.token);
  el.paymentHistory.innerHTML = "";
  data.data.forEach((p) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${new Date(p.payment_date).toLocaleString()}</td><td>${p.transaction_id}</td><td>${p.bill_id}</td><td>Rs ${rs(p.amount)}</td><td>${p.payment_method}</td><td>${p.payment_status}</td>`;
    el.paymentHistory.appendChild(tr);
  });
}

async function loadAnalytics() {
  const [daily, monthly, yearly] = await Promise.all([
    api("/consumption/daily", {}, state.token),
    api("/consumption/monthly", {}, state.token),
    api("/consumption/yearly", {}, state.token),
  ]);

  renderChart("chartDaily", barConfig(daily.data.map((x) => x.hour), daily.data.map((x) => x.units), "rgba(31,111,255,0.65)", "Hourly Usage"));
  renderChart("chartMonthly", barConfig(monthly.data.map((x) => x.day), monthly.data.map((x) => x.units), "rgba(21,178,211,0.65)", "Daily Usage"));
  renderChart("chartYearly", barConfig(yearly.data.map((x) => x.month), yearly.data.map((x) => x.units), "rgba(31,157,98,0.65)", "Monthly Usage"));
}

async function loadService() {
  const history = await api("/service/history", {}, state.token);
  el.serviceHistory.innerHTML = "";

  if (!history.data.length) {
    el.serviceHistory.innerHTML = "<li>No service requests yet.</li>";
    return;
  }

  history.data.forEach((req) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-outline";
    btn.textContent = `${req.request_id} � ${req.request_type} � ${req.status}`;
    btn.addEventListener("click", async () => {
      const detail = await api(`/service/${req.request_id}`, {}, state.token);
      const lines = detail.data.timeline.map((item) => `- ${item.status} | ${new Date(item.at).toLocaleString()} | ${item.note}`);
      el.serviceTimeline.textContent = `Request: ${detail.data.request_id}\nCurrent Status: ${detail.data.status}\n\nTimeline:\n${lines.join("\n")}`;
    });
    li.appendChild(btn);
    el.serviceHistory.appendChild(li);
  });
}

async function loadSolar() {
  const [production, net] = await Promise.all([
    api("/solar/production", {}, state.token),
    api("/solar/net-metering", {}, state.token),
  ]);

  renderSolarContributionChart(net?.data || {});

  if (!production.data) {
    el.solarSummary.textContent = production.message || "No solar system found.";
    return;
  }

  el.solarSummary.textContent = [
    `System ID: ${production.data.system.system_id}`,
    `Capacity: ${production.data.system.capacity_kw} kW`,
    `Total Generated Today: ${production.data.total_generated_today} kWh`,
  ].join("\n");

  renderChart("chartSolar", barConfig(production.data.hourly.map((x) => x.hour), production.data.hourly.map((x) => x.units_generated), "rgba(217,138,31,0.65)", "Solar Output"));
}

async function loadHelp() {
  const faq = await api("/help/faqs", {}, state.token);
  el.faqList.innerHTML = "";
  faq.data.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${item.question}</strong><div style="color:#5b7288">${item.answer}</div>`;
    el.faqList.appendChild(li);
  });
}

async function refreshPage(pageId) {
  const page = pageId || document.querySelector(".page.active")?.id || "overview";
  const handlers = {
    overview: loadOverview,
    appliances: loadAppliances,
    billing: loadBilling,
    payments: loadPayments,
    analytics: loadAnalytics,
    service: loadService,
    solar: loadSolar,
    calculator: async () => {},
    help: loadHelp,
    settings: async () => {},
  };

  if (handlers[page]) await handlers[page]();
  setLastSync();
}

function applyAutoRefresh() {
  if (state.autoRefreshTimer) {
    clearInterval(state.autoRefreshTimer);
    state.autoRefreshTimer = null;
  }

  if (!state.autoRefreshEnabled) return;

  state.autoRefreshTimer = setInterval(() => {
    if (document.getElementById("overview").classList.contains("active")) {
      loadOverview().catch(() => {});
    }
  }, state.autoRefreshSeconds * 1000);
}

function bindEvents() {
  el.apiBase.value = appState.apiBase || window.location.origin;
  el.settingsApiBase.value = appState.apiBase || window.location.origin;

  if (el.apiBase) el.apiBase.style.display = "none";
  const apiSettingsGroup = el.settingsApiBase?.closest(".form-grid");
  if (apiSettingsGroup) apiSettingsGroup.style.display = "none";

  el.settingsBtn.addEventListener("click", () => switchPage("settings"));

  el.refreshBtn.addEventListener("click", () => refreshPage().catch((err) => logEvent(err.message, true)));

  el.logoutBtn.addEventListener("click", () => {
    clearSession();
    window.location.href = "/";
  });

  el.runAi.addEventListener("click", runAi);

  el.scheduleForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await api("/schedule", {
      method: "POST",
      body: JSON.stringify({ device_id: el.scheduleDevice.value, run_time: el.scheduleTime.value }),
    }, state.token);
    const currentSchedules = await api("/schedule", {}, state.token);
    const idx = Math.max(0, currentSchedules.length - 1);
    const key = scheduleKey(el.scheduleDevice.value, el.scheduleTime.value, idx);
    state.scheduleMeta[key] = { enabled: true, repeat: el.scheduleRepeat.value || "daily", hidden: false };
    saveScheduleMeta();
    logEvent("Schedule added");
    await loadAppliances();
  });

  el.simulateTimeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const result = await api("/simulate/time", { method: "POST", body: JSON.stringify({ time_str: el.simulateTime.value }) }, state.token);
    el.simulateMsg.textContent = result.message || "Simulation updated";
    await loadOverview();
  });

  el.whatIfForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const selected = [...el.whatIfDevices.querySelectorAll("input:checked")].map((x) => x.value);
    if (!selected.length) {
      el.whatIfResult.textContent = "Select at least one flexible appliance.";
      return;
    }
    const output = await api("/simulate/what-if", {
      method: "POST",
      body: JSON.stringify({ device_ids: selected, target_time: el.whatIfTime.value }),
    }, state.token);
    if (output.status !== "success") {
      el.whatIfResult.textContent = output.message || "Simulation failed";
      return;
    }

    el.whatIfResult.textContent = [
      `Devices: ${output.devices.join(", ")}`,
      `Savings/hour: Rs ${rs(output.savings_per_hour)}`,
      `Cost at ${el.whatIfTime.value}: Rs ${rs(output.cost_at_target_time_per_hour)}`,
      `CO2 Saved/hour: ${output.co2_saved_kg_per_hour} kg`,
    ].join("\n");
  });

  el.billingEstimateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const units = el.billingUnits.value.trim();
    const query = units ? `?monthly_kwh=${encodeURIComponent(units)}` : "";
    const res = await api(`/billing/estimate${query}`, {}, state.token);
    setBillingEstimate(res.data);
  });

  el.payForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const res = await api("/payment/pay", {
        method: "POST",
        body: JSON.stringify({
          bill_id: el.payBillId.value.trim(),
          amount: Number(el.payAmount.value),
          payment_method: el.payMethod.value,
        }),
      }, state.token);
      el.payMessage.textContent = `${res.data.payment_status} � ${res.data.transaction_id}`;
      logEvent("Payment processed");
      await Promise.all([loadPayments(), loadBilling(), loadOverview()]);
    } catch (err) {
      el.payMessage.textContent = err.message;
      logEvent(err.message, true);
    }
  });

  el.serviceForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await api("/service/request", {
      method: "POST",
      body: JSON.stringify({ request_type: el.serviceType.value, description: el.serviceDesc.value.trim() }),
    }, state.token);
    el.serviceDesc.value = "";
    logEvent("Service request submitted");
    await loadService();
  });

  el.calcForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const out = await api("/calculator/consumption", {
      method: "POST",
      body: JSON.stringify({
        appliance_type: el.calcType.value,
        power_rating_watts: Number(el.calcPower.value),
        usage_hours_per_day: Number(el.calcHours.value),
      }),
    }, state.token);
    el.calcResult.textContent = [
      `Daily Consumption: ${out.data.daily_consumption_kwh} kWh`,
      `Monthly Consumption: ${out.data.monthly_consumption_kwh} kWh`,
      `Estimated Monthly Cost: Rs ${rs(out.data.monthly_cost)}`,
    ].join("\n");
  });

  el.helpForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const out = await api("/help/contact", {
      method: "POST",
      body: JSON.stringify({ subject: el.helpSubject.value.trim(), message: el.helpMessage.value.trim() }),
    }, state.token);
    el.helpResult.textContent = out.message;
    el.helpSubject.value = "";
    el.helpMessage.value = "";
  });

  el.balanceActionBtn.addEventListener("click", async () => {
    try {
      const status = await api("/balance/status", {}, state.token);
      const meterType = String(status.data.meter_type || "PREPAID").toUpperCase();
      if (meterType === "POSTPAID") {
        switchPage("payments");
        return;
      }
      const amountInput = window.prompt("Enter recharge amount (Rs):", "500");
      if (!amountInput) return;
      const amount = Number(amountInput);
      if (!Number.isFinite(amount) || amount <= 0) {
        logEvent("Invalid recharge amount.", true);
        return;
      }
      const out = await api(
        "/balance/topup",
        { method: "POST", body: JSON.stringify({ amount, payment_method: "UPI" }) },
        state.token
      );
      logEvent(out.message || "Balance recharged");
      await loadOverview();
    } catch (err) {
      logEvent(err.message, true);
    }
  });

  el.balanceForecastBtn.addEventListener("click", async () => {
    try {
      const amountInput = window.prompt("Forecast with optional extra recharge amount (Rs):", "500");
      const recharge_amount = amountInput ? Number(amountInput) : 0;
      const out = await api(
        "/balance/forecast",
        { method: "POST", body: JSON.stringify({ recharge_amount: Number.isFinite(recharge_amount) ? recharge_amount : 0 }) },
        state.token
      );
      const data = out.data;
      el.balanceInsight.textContent = [
        `Predicted zero-balance date: ${data.predicted_zero_date}`,
        `Avg daily usage: ${data.avg_daily_units} kWh/day`,
        `Avg tariff: Rs ${rs(data.avg_tariff)}/kWh`,
        `Projected days with recharge: ${Number(data.projected_days_with_amount || 0).toFixed(1)} days`,
        `Recommended recharge: Rs ${rs(data.recommended_recharge_amount)}`,
      ].join("\n");
      logEvent("Balance forecast updated");
    } catch (err) {
      logEvent(err.message, true);
    }
  });

  el.darkModeToggle?.addEventListener("change", () => {
    state.prefs.darkMode = !!el.darkModeToggle.checked;
    localStorage.setItem("sm_theme_mode", state.prefs.darkMode ? "dark" : "light");
    applyTheme();
    refreshVisibleCharts();
    el.settingsStatus.textContent = `Theme updated to ${state.prefs.darkMode ? "Dark" : "Light"} mode.`;
  });

  el.accentTheme?.addEventListener("change", () => {
    state.prefs.accentTheme = el.accentTheme.value;
    localStorage.setItem("sm_accent_theme", state.prefs.accentTheme);
    applyTheme();
    el.settingsStatus.textContent = `Accent changed to ${state.prefs.accentTheme}.`;
  });

  el.languageSelect?.addEventListener("change", () => {
    state.prefs.language = el.languageSelect.value;
    localStorage.setItem("sm_language", state.prefs.language);
    el.settingsStatus.textContent = `Language preference saved (${state.prefs.language}).`;
  });

  el.notifToggle?.addEventListener("change", () => {
    state.prefs.notifications = !!el.notifToggle.checked;
    localStorage.setItem("sm_notifications", state.prefs.notifications ? "1" : "0");
  });

  el.energyAlertToggle?.addEventListener("change", () => {
    state.prefs.energyAlerts = !!el.energyAlertToggle.checked;
    localStorage.setItem("sm_energy_alerts", state.prefs.energyAlerts ? "1" : "0");
  });

  el.energyAlertThreshold?.addEventListener("change", () => {
    state.prefs.alertThreshold = Math.max(1, Number(el.energyAlertThreshold.value || 18));
    localStorage.setItem("sm_energy_threshold", String(state.prefs.alertThreshold));
  });

  el.aiAssistantToggle?.addEventListener("change", () => {
    state.prefs.aiEnabled = !!el.aiAssistantToggle.checked;
    localStorage.setItem("sm_ai_enabled", state.prefs.aiEnabled ? "1" : "0");
    if (!state.prefs.aiEnabled) {
      closeChatWidget();
      el.chatToggle.style.opacity = "0.6";
    } else {
      el.chatToggle.style.opacity = "1";
      el.chatToggle.removeAttribute("aria-hidden");
    }
  });

  el.aiStyleSelect?.addEventListener("change", () => {
    state.prefs.aiStyle = el.aiStyleSelect.value;
    localStorage.setItem("sm_ai_style", state.prefs.aiStyle);
  });

  el.defaultApplianceBehavior?.addEventListener("change", () => {
    state.prefs.defaultApplianceBehavior = el.defaultApplianceBehavior.value;
    localStorage.setItem("sm_appliance_behavior", state.prefs.defaultApplianceBehavior);
  });

  el.profileVisibility?.addEventListener("change", () => {
    state.prefs.profileVisibility = el.profileVisibility.value;
    localStorage.setItem("sm_profile_visibility", state.prefs.profileVisibility);
  });

  el.applyRefreshSettings.addEventListener("click", () => {
    state.autoRefreshEnabled = !!el.autoRefreshEnabled.checked;
    state.autoRefreshSeconds = Math.max(3, Number(el.autoRefreshSeconds.value || 6));
    el.autoRefreshSeconds.value = String(state.autoRefreshSeconds);
    applyAutoRefresh();
    el.settingsStatus.textContent = state.autoRefreshEnabled
      ? `Auto refresh enabled every ${state.autoRefreshSeconds}s`
      : "Auto refresh disabled";
  });

  el.clearLogsBtn.addEventListener("click", () => {
    el.events.innerHTML = "";
    el.settingsStatus.textContent = "Activity log cleared.";
  });

  el.resetSettingsBtn.addEventListener("click", () => {
    state.autoRefreshEnabled = true;
    state.autoRefreshSeconds = 6;
    el.autoRefreshEnabled.checked = true;
    el.autoRefreshSeconds.value = "6";
    el.settingsApiBase.value = appState.apiBase;
    el.apiBase.value = appState.apiBase;
    state.prefs = {
      darkMode: false,
      accentTheme: "blue",
      language: "en",
      notifications: true,
      energyAlerts: true,
      alertThreshold: 18,
      aiEnabled: true,
      aiStyle: "balanced",
      defaultApplianceBehavior: "retain",
      profileVisibility: "private",
    };
    localStorage.setItem("sm_theme_mode", "light");
    localStorage.setItem("sm_accent_theme", "blue");
    localStorage.setItem("sm_language", "en");
    localStorage.setItem("sm_notifications", "1");
    localStorage.setItem("sm_energy_alerts", "1");
    localStorage.setItem("sm_energy_threshold", "18");
    localStorage.setItem("sm_ai_enabled", "1");
    localStorage.setItem("sm_ai_style", "balanced");
    localStorage.setItem("sm_appliance_behavior", "retain");
    localStorage.setItem("sm_profile_visibility", "private");
    applyTheme();
    applySettingsUI();
    applyAutoRefresh();
    el.settingsStatus.textContent = "Settings reset to defaults.";
  });

  el.chatToggle.addEventListener("click", () => {
    if (!state.prefs.aiEnabled) {
      el.settingsStatus.textContent = "AI Assistant is disabled in Settings.";
      return;
    }
    openChatWidget();
    el.chatInput.focus();
  });

  el.chatClose.addEventListener("click", () => {
    closeChatWidget();
  });

  el.chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await sendChat(el.chatInput.value);
  });

  el.chatQuickActions.querySelectorAll("button[data-q]").forEach((button) => {
    button.addEventListener("click", async () => {
      await sendChat(button.dataset.q || "");
    });
  });

  document.querySelectorAll(".ai-options button[data-q]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!state.prefs.aiEnabled) {
        el.settingsStatus.textContent = "AI Assistant is disabled in Settings.";
        return;
      }
      openChatWidget();
      await sendChat(button.dataset.q || "");
    });
  });
  el.sidebarToggle?.addEventListener("click", () => {
    if (document.body.classList.contains("sidebar-open")) closeSidebar();
    else openSidebar();
  });

  el.sidebarBackdrop?.addEventListener("click", closeSidebar);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSidebar();
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth >= MOBILE_WIDTH) closeSidebar();
  });
}

function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.prefs.darkMode ? "dark" : "light");
  const accent = state.prefs.accentTheme;
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

function applySettingsUI() {
  el.darkModeToggle.checked = state.prefs.darkMode;
  el.accentTheme.value = state.prefs.accentTheme;
  el.languageSelect.value = state.prefs.language;
  el.notifToggle.checked = state.prefs.notifications;
  el.energyAlertToggle.checked = state.prefs.energyAlerts;
  el.energyAlertThreshold.value = String(state.prefs.alertThreshold);
  el.aiAssistantToggle.checked = state.prefs.aiEnabled;
  el.aiStyleSelect.value = state.prefs.aiStyle;
  el.defaultApplianceBehavior.value = state.prefs.defaultApplianceBehavior;
  el.profileVisibility.value = state.prefs.profileVisibility;
}

function closeSidebar() {
  document.body.classList.remove("sidebar-open");
}

function openSidebar() {
  document.body.classList.add("sidebar-open");
}

function openChatWidget() {
  el.chatWidget.classList.add("open");
  document.body.classList.add("chat-open");
  el.chatToggle.setAttribute("aria-hidden", "true");
}

function closeChatWidget() {
  el.chatWidget.classList.remove("open");
  document.body.classList.remove("chat-open");
  el.chatToggle.removeAttribute("aria-hidden");
}

async function refreshVisibleCharts() {
  const active = document.querySelector(".page.active")?.id || "overview";
  if (active === "appliances") await loadAppliances();
  if (active === "analytics") await loadAnalytics();
  if (active === "solar") await loadSolar();
}

async function init() {
  applyTheme();
  loadScheduleMeta();
  buildNav();
  bindEvents();
  el.whoami.textContent = `${state.user?.full_name || "Consumer"} (${state.role})`;
  el.autoRefreshEnabled.checked = state.autoRefreshEnabled;
  el.autoRefreshSeconds.value = String(state.autoRefreshSeconds);
  state.chatSessionId =
    localStorage.getItem(`sm_chat_session_${state.user?.user_id || "user"}`) ||
    `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  localStorage.setItem(`sm_chat_session_${state.user?.user_id || "user"}`, state.chatSessionId);
  applySettingsUI();
  el.appInfo.textContent = [
    "Version: 1.4.0 (Demo Build)",
    `System status: Connected`,
    `Connected meter: ${state.user?.smart_meter_id || "-"}`,
    `Consumer: ${state.user?.full_name || "-"}`,
    "Developer: Brainstorm Brigades",
    "Support: support@intellismart.demo",
  ].join("\n");
  switchPage("overview");
  applyAutoRefresh();
  await loadChatHistory();
  await Promise.all([loadHelp(), loadPayments()]);
}

init().catch((err) => logEvent(err.message, true));








