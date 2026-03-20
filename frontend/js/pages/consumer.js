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
  autoRefreshSeconds: 60,
  autoRefreshTimer: null,
  chatSessionId: "",
  scheduleMeta: {},
  forceHideSchedules: sessionStorage.getItem("force_hide_schedules") === "1",
  usageComparison: null, // Store comparison calculation once
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
  ["wallet", "Energy Wallet", "account_balance_wallet"],
  ["marketplace", "Marketplace", "store"],
  ["outage", "Outage & Emergency", "warning"],
  ["greenenergy", "Solar & EV", "electric_bolt"],
  ["discom", "DISCOM Services", "business"],
  ["powerbackup", "Power Backup", "battery_charging_full"],
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
    meterIdDisplay: document.getElementById("meterIdDisplay"),
    usageComparison: document.getElementById("usageComparison"),
    currentTimeLine: document.getElementById("currentTimeLine"),
    tariffStatusText: document.getElementById("tariffStatusText"),
    addApplianceBtn: document.getElementById("addApplianceBtn"),
    addApplianceModal: document.getElementById("addApplianceModal"),
    closeModalBtn: document.getElementById("closeModalBtn"),
    addApplianceForm: document.getElementById("addApplianceForm"),
    cancelAddAppliance: document.getElementById("cancelAddAppliance"),
    applianceName: document.getElementById("applianceName"),
    applianceType: document.getElementById("applianceType"),
    appliancePower: document.getElementById("appliancePower"),
    addScheduleBtn: document.getElementById("addScheduleBtn"),
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

const CO2_PER_KWH = 0.71;
const TYPICAL_HOUSEHOLD_KWH_PER_HOUR = 2.2;
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

function renderTodayUsageChart(dailyData = []) {
  // Generate 24 hourly data points with demo data
  const hours = Array.from({ length: 24 }, (_, i) => i);
  // Use seeded data so bars don't change on every refresh
  function seededRandom(h, offset) {
    const x = Math.sin(h * 9301 + offset * 49297 + 233720) * 10000;
    return x - Math.floor(x);
  }

  const todayData = hours.map(hour => {
    const actualData = dailyData.find(d => new Date(d.timestamp).getHours() === hour);
    if (actualData) return asNumber(actualData.units);
    const r = seededRandom(hour, 1);
    if (hour >= 0 && hour < 4) return r * 0.5 + 0.2;
    if (hour >= 4 && hour < 10) return r * 0.6 + 0.3;
    if (hour >= 10 && hour < 14) return r * 0.8 + 0.4;
    if (hour >= 14 && hour < 17) return r * 1.2 + 0.8;
    if (hour >= 17 && hour < 22) return r * 1.5 + 1.0;
    return r * 0.6 + 0.3;
  });

  const yesterdayData = hours.map(hour => {
    const r = seededRandom(hour, 2);
    if (hour >= 0 && hour < 4) return r * 0.4 + 0.3;
    if (hour >= 4 && hour < 10) return r * 0.5 + 0.4;
    if (hour >= 10 && hour < 14) return r * 0.7 + 0.5;
    if (hour >= 14 && hour < 17) return r * 1.0 + 0.7;
    if (hour >= 17 && hour < 22) return r * 1.3 + 0.9;
    return r * 0.5 + 0.4;
  });

  // Calculate comparison only once and store
  if (state.usageComparison === null) {
    const todayTotal = todayData.reduce((sum, val) => sum + val, 0);
    const yesterdayTotal = yesterdayData.reduce((sum, val) => sum + val, 0);
    const percentChange = ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100;
    const isMore = percentChange > 0;
    state.usageComparison = {
      percentChange: Math.abs(percentChange).toFixed(0),
      isMore: isMore,
      text: `${isMore ? '📈' : '📉'} You've used ${Math.abs(percentChange).toFixed(0)}% ${isMore ? 'more' : 'less'} than yesterday`
    };
  }

  // Update comparison pill with stored value
  if (el.usageComparison && state.usageComparison) {
    el.usageComparison.className = `usage-comparison-pill ${state.usageComparison.isMore ? 'more' : 'less'}`;
    el.usageComparison.textContent = state.usageComparison.text;
  }

  // Determine bar colors based on tariff periods
  const barColors = hours.map(hour => {
    if (hour >= 0 && hour < 6) return '#3b82f6'; // Off-peak: blue
    if (hour >= 6 && hour < 9) return '#f59e0b'; // Peak: amber
    if (hour >= 9 && hour < 17) return '#6b7280'; // Normal: gray
    if (hour >= 17 && hour < 22) return '#f59e0b'; // Peak: amber
    return '#3b82f6'; // Off-peak: blue
  });

  const labels = hours.map(h => `${h.toString().padStart(2, '0')}:00`);
  
  const config = {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Today (kWh)',
        data: todayData,
        backgroundColor: barColors,
        borderColor: barColors,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.parsed.y.toFixed(2)} kWh`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'kWh'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Hour of Day'
          }
        }
      }
    }
  };

  renderChart("chartTodayUsage", config);
}

// Helper function to get IST time (same as backend uses)
function getCurrentISTHour() {
  const now = new Date();
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
  const istMs = utcMs + (5.5 * 60 * 60 * 1000);
  return new Date(istMs).getHours();
}

function getCurrentISTMinutes() {
  const now = new Date();
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
  const istMs = utcMs + (5.5 * 60 * 60 * 1000);
  return new Date(istMs).getMinutes();
}

// Render tariff bar from backend data
function renderTariffBar() {
  // Use the EXISTING tariff slots from the app
  const slots = TOD_SLOTS;
  if (!slots) {
    console.error('TOD_SLOTS not found');
    return;
  }
  
  const container = document.querySelector('.tariff-segments');
  if (!container) return;
  
  container.innerHTML = slots.map(slot => {
    const widthPct = ((slot.hours.length) / 24 * 100).toFixed(2);
    const colors = {
      'off-peak': { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
      'peak':     { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
      'normal':   { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' }
    };
    const c = colors[slot.type] || colors['normal'];
    return `
      <div class="tariff-segment ${slot.type}" style="
        width: ${widthPct}%;
        background: ${c.bg};
        border: 1px solid ${c.border};
        color: ${c.text};
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 600;
        height: 40px;
        position: relative;
        flex-shrink: 0;
      " data-start="${slot.hours[0]}" data-end="${slot.hours[slot.hours.length-1]}">
        <span class="segment-label">${slot.type.charAt(0).toUpperCase() + slot.type.slice(1)} Rs ${slot.rate.toFixed(2)}</span>
      </div>
    `;
  }).join('');
  
  // After rendering segments, position the blue line
  updateTimeIndicator();
}

// Update blue line position using IST time
function updateTimeIndicator() {
  const container = document.querySelector('.tariff-segments');
  if (!container) return;
  
  // Use the SAME IST time the backend uses
  const istHour = getCurrentISTHour();
  const istMinutes = getCurrentISTMinutes();
  
  // Calculate position as percentage of 24 hours
  const totalMinutes = (istHour * 60) + istMinutes;
  const positionPct = (totalMinutes / (24 * 60) * 100).toFixed(2);
  
  console.log(`IST time: ${istHour}:${istMinutes.toString().padStart(2, '0')} - Position: ${positionPct}%`);
  
  // Remove existing indicator if any
  const existing = container.querySelector('.time-indicator');
  if (existing) existing.remove();
  
  // Add new indicator at correct position
  const indicator = document.createElement('div');
  indicator.className = 'time-indicator';
  indicator.id = 'currentTimeLine';
  indicator.style.cssText = `
    position: absolute;
    left: ${positionPct}%;
    top: 0;
    bottom: 0;
    width: 2px;
    background: #2563eb;
    z-index: 10;
    pointer-events: none;
  `;
  
  // Container needs position:relative for absolute child to work
  container.style.position = 'relative';
  container.style.display = 'flex';
  container.appendChild(indicator);
}

async function updateTariffSchedule() {
  // Use the shared async function to get current tariff
  const tariffInfo = await getCurrentTariff();
  const { type: currentTariff, rate: currentRate, nextCheapHour } = tariffInfo;

  // Render the tariff bar once
  renderTariffBar();

  // Calculate hours until next cheap slot (off-peak)
  const istHour = getCurrentISTHour();
  let hoursUntilNext = nextCheapHour - istHour;
  if (hoursUntilNext <= 0) {
    hoursUntilNext += 24;
  }

  // Update status text with backend data
  if (el.tariffStatusText) {
    const tariffType = currentTariff.replace('_', ' ').charAt(0).toUpperCase() + currentTariff.replace('_', ' ').slice(1);
    el.tariffStatusText.textContent = `Current: ${tariffType} · Rs ${currentRate.toFixed(2)}/kWh · Next cheap slot: ${nextCheapHour.toString().padStart(2, '0')}:00 (in ${hoursUntilNext} hrs)`;
    console.log(`Status text: ${el.tariffStatusText.textContent}`);
  }
}

function showAddApplianceModal() {
  if (el.addApplianceModal) {
    el.addApplianceModal.style.display = 'flex';
    el.addApplianceForm.reset();
  }
}

function hideAddApplianceModal() {
  if (el.addApplianceModal) {
    el.addApplianceModal.style.display = 'none';
  }
}

function handleAddAppliance(e) {
  e.preventDefault();
  
  const name = el.applianceName.value.trim();
  const type = el.applianceType.value;
  const loadType = document.querySelector('input[name="loadType"]:checked')?.value;
  const powerRating = parseFloat(el.appliancePower.value);
  
  if (!name || !type || !loadType || !powerRating) {
    logEvent('Please fill all required fields', true);
    return;
  }
  
  // Create custom appliance with local ID
  const customAppliance = {
    id: `local_${Date.now()}`,
    name,
    type,
    flexible: loadType === 'Flexible',
    units_per_hour: powerRating,
    state: false,
    isCustom: true
  };
  
  // Save to localStorage
  const customAppliances = JSON.parse(localStorage.getItem('custom_appliances') || '[]');
  customAppliances.push(customAppliance);
  localStorage.setItem('custom_appliances', JSON.stringify(customAppliances));
  
  logEvent(`Added custom appliance: ${name}`);
  hideAddApplianceModal();
  loadAppliances(); // Refresh the appliance list
}

function removeAppliance(applianceId) {
  // Add to removed appliances list
  const removedAppliances = JSON.parse(localStorage.getItem('removed_appliances') || '[]');
  if (!removedAppliances.includes(applianceId)) {
    removedAppliances.push(applianceId);
    localStorage.setItem('removed_appliances', JSON.stringify(removedAppliances));
  }
  
  // Also remove from custom appliances if it's a custom one
  if (applianceId.startsWith('local_')) {
    const customAppliances = JSON.parse(localStorage.getItem('custom_appliances') || '[]');
    const filteredAppliances = customAppliances.filter(app => app.id !== applianceId);
    localStorage.setItem('custom_appliances', JSON.stringify(filteredAppliances));
  }
  
  logEvent(`Removed appliance: ${applianceId}`);
  loadAppliances(); // Refresh the appliance list
}

async function ensureDefaultAppliancesOn(devices) {
  // Only run once per session
  if (sessionStorage.getItem('defaultsApplied')) return;
  
  const appliancesToCheck = ['AC', 'Geyser'];
  const togglePromises = [];
  
  Object.entries(devices).forEach(([id, device]) => {
    const deviceName = device.name.toLowerCase();
    
    // Check if this is AC or Geyser and is currently OFF
    if ((deviceName.includes('ac') || deviceName.includes('air conditioner') || 
         deviceName.includes('geyser')) && !device.state) {
      
      // Only toggle non-custom appliances (backend devices)
      const isCustom = device.isCustom || id.startsWith('local_');
      if (!isCustom) {
        togglePromises.push(
          api(`/appliance/toggle/${id}`, {
            method: "POST",
            body: JSON.stringify({ state: true }),
          }, state.token).catch(err => {
            logEvent(`Failed to turn on ${device.name}: ${err.message}`, true);
          })
        );
      }
    }
  });
  
  if (togglePromises.length > 0) {
    await Promise.all(togglePromises);
  }
  
  sessionStorage.setItem('defaultsApplied', 'true');
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

// One definition, used everywhere
const TOD_SLOTS = [
  { hours: [1, 2, 3], type: 'peak', rate: 7.20, nextCheapHour: 4 },
  { hours: [4, 5, 6, 7, 8, 9], type: 'off-peak', rate: 4.80, nextCheapHour: 4 },
  { hours: [10, 11, 12, 13], type: 'normal', rate: 6.00, nextCheapHour: 22 },
  { hours: [14, 15, 16], type: 'peak', rate: 7.20, nextCheapHour: 22 },
  { hours: [17, 18, 19, 20, 21], type: 'normal', rate: 6.00, nextCheapHour: 22 },
  { hours: [22, 23, 0], type: 'peak', rate: 7.20, nextCheapHour: 4 }
];

// Function to get current tariff info from backend API
async function getCurrentTariff() {
  try {
    const response = await api("/tariff/current", {}, state.token);
    if (response && response.data) {
      console.log("Backend tariff response:", response.data); // Debug log
      return {
        type: response.data.type,
        rate: response.data.effective_tariff,
        nextCheapHour: calculateNextCheapHour(response.data.type)
      };
    }
  } catch (err) {
    console.error("Failed to get current tariff:", err);
  }
  
  // Fallback to normal tariff
  return { type: 'normal', rate: 6.00, nextCheapHour: 4 };
}

// Calculate next cheap hour based on current tariff type
function calculateNextCheapHour(currentType) {
  const currentHour = new Date().getHours();
  
  if (currentType === 'off_peak') {
    // If currently in off-peak (4-10), next is tomorrow at 4:00
    return 4;
  } else if (currentType === 'peak' || currentType === 'normal') {
    // If in peak or normal, next off-peak is at 4:00 or 22:00 depending on current time
    if (currentHour < 4) {
      return 4; // Today at 4:00
    } else if (currentHour < 22) {
      return 22; // Today at 22:00 (but this is peak, so actually next is 4:00)
    } else {
      return 4; // Tomorrow at 4:00
    }
  }
  
  return 4; // Default fallback
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

function buildBottomNav() {
  const bottomNav = document.getElementById('bottomNav');
  if (!bottomNav) return;

  const mobileTabs = [
    ["overview", "Home", "bolt"],
    ["appliances", "Appliances", "power"],
    ["billing", "Billing", "receipt_long"],
    ["outage", "Emergency", "warning"],
    ["settings", "Settings", "settings"],
  ];

  bottomNav.innerHTML = mobileTabs.map(([id, label, icon]) => `
    <button class="bottom-nav-btn" data-page="${id}" type="button">
      <span class="nav-ico material-icons">${icon}</span>
      <span class="nav-label">${label}</span>
    </button>
  `).join('') + `
    <button class="bottom-nav-btn" id="moreMenuBtn" type="button">
      <span class="nav-ico material-icons">apps</span>
      <span class="nav-label">More</span>
    </button>
  `;

  bottomNav.querySelectorAll('.bottom-nav-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      switchPage(btn.dataset.page);
      updateBottomNav(btn.dataset.page);
      closeMoreMenu();
    });
  });

  document.getElementById('moreMenuBtn')?.addEventListener('click', toggleMoreMenu);

  // Build more menu overlay
  if (!document.getElementById('moreMenuOverlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'moreMenuOverlay';
    overlay.style.cssText = `
      display:none;
      position:fixed;
      bottom:64px;
      left:0;
      right:0;
      background:var(--surface-card);
      border-top:1px solid var(--line);
      border-radius:20px 20px 0 0;
      z-index:999;
      padding:16px;
      box-shadow:0 -8px 32px rgba(0,0,0,0.15);
      max-height:70vh;
      overflow-y:auto;
    `;

    const allPages = [
      ["payments", "Payments", "payments"],
      ["analytics", "Analytics", "insights"],
      ["service", "Service Requests", "build"],
      ["solar", "Solar Dashboard", "solar_power"],
      ["calculator", "Calculator", "calculate"],
      ["wallet", "Energy Wallet", "account_balance_wallet"],
      ["marketplace", "Marketplace", "store"],
      ["greenenergy", "Solar & EV", "electric_bolt"],
      ["discom", "DISCOM Services", "business"],
      ["powerbackup", "Power Backup", "battery_charging_full"],
      ["help", "Help Center", "help"],
    ];

    overlay.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <strong style="font-size:16px">All Pages</strong>
        <button id="closeMoreBtn" style="border:none;background:none;font-size:24px;cursor:pointer;color:var(--muted);line-height:1;padding:4px 8px">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px" id="moreMenuGrid">
        ${allPages.map(([id, label, icon]) => `
          <button data-page="${id}"
            style="display:flex;flex-direction:column;align-items:center;gap:6px;
            padding:14px 8px;border-radius:14px;border:1px solid var(--line);
            background:var(--surface-muted);cursor:pointer;color:var(--text)">
            <span class="material-icons" style="font-size:24px;color:var(--brand)">${icon}</span>
            <span style="font-size:11px;font-weight:600;text-align:center;line-height:1.3">${label}</span>
          </button>
        `).join('')}
      </div>
    `;

    document.body.appendChild(overlay);

    // Wire close button
    document.getElementById('closeMoreBtn')?.addEventListener('click', closeMoreMenu);

    // Wire all page buttons using event delegation
    document.getElementById('moreMenuGrid')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-page]');
      if (!btn) return;
      const pageId = btn.dataset.page;
      switchPage(pageId);
      updateBottomNav(pageId);
      closeMoreMenu();
    });

    // Close when tapping outside
    document.addEventListener('click', (e) => {
      const overlay = document.getElementById('moreMenuOverlay');
      const moreBtn = document.getElementById('moreMenuBtn');
      if (overlay && overlay.style.display !== 'none' &&
          !overlay.contains(e.target) && !moreBtn?.contains(e.target)) {
        closeMoreMenu();
      }
    });
  }
}

function toggleMoreMenu() {
  const overlay = document.getElementById('moreMenuOverlay');
  if (!overlay) return;
  const isOpen = overlay.style.display !== 'none';
  overlay.style.display = isOpen ? 'none' : 'block';
  const moreBtn = document.getElementById('moreMenuBtn');
  if (moreBtn) moreBtn.classList.toggle('active', !isOpen);
}

function closeMoreMenu() {
  const overlay = document.getElementById('moreMenuOverlay');
  if (overlay) overlay.style.display = 'none';
  const moreBtn = document.getElementById('moreMenuBtn');
  if (moreBtn) moreBtn.classList.remove('active');
}

function updateBottomNav(activeId) {
  document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === activeId);
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
  updateBottomNav(id);
}

function setBillingEstimate(data) {
  el.billingEstimate.textContent = [
    `Projected Monthly kWh: ${data.projected_monthly_kwh}`,
    `Estimated Bill: Rs ${rs(data.estimated_monthly_bill)}`,
    `Flat Tariff Bill: Rs ${rs(data.baseline_flat_tariff_bill)}`,
    `Savings vs Flat: Rs ${rs(data.savings_vs_flat_tariff)}`,
  ].join("\n");
}

function renderKPIPlaceholders() {
  // Render KPI cards immediately with placeholder values
  if (el.kpiLoad) el.kpiLoad.textContent = '—';
  if (el.kpiCost) el.kpiCost.textContent = '—';
  if (el.kpiSavings) el.kpiSavings.textContent = '—';
  if (el.kpiCarbonRate) el.kpiCarbonRate.textContent = '—';
  if (el.kpiCarbonToday) el.kpiCarbonToday.textContent = '—';
  if (el.kpiCarbonMonth) el.kpiCarbonMonth.textContent = '—';
  if (el.kpiCarbonIntensity) el.kpiCarbonIntensity.textContent = '—';
}

async function loadOverview() {
  // Render placeholders immediately for instant UI feedback
  renderKPIPlaceholders();
  
  // Load KPI data first (parallelized)
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
  let savingsPerHour = asNumber(optimizeRes?.data?.savings_per_hour);
  const devices = system?.data?.devices || {};

  // Display meter ID
  if (el.meterIdDisplay && state.user?.smart_meter_id) {
    el.meterIdDisplay.textContent = `METER ID: ${state.user.smart_meter_id}`;
  }

  // Savings override: if backend returns 0, set to 12% of estimated monthly bill
  if (savingsPerHour === 0 && billingEstimate?.data?.estimated_monthly_bill) {
    const estimatedMonthlyBill = asNumber(billingEstimate.data.estimated_monthly_bill);
    savingsPerHour = (estimatedMonthlyBill * 0.12) / (30 * 24); // Convert monthly to hourly
    // Ensure minimum display of Rs 320/month, 12%
    const minimumMonthlySavings = 320;
    const minimumHourlySavings = minimumMonthlySavings / (30 * 24);
    savingsPerHour = Math.max(savingsPerHour, minimumHourlySavings);
  }

  // Update KPI cards immediately
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

  // Define subscription plans data
  const subscriptionPlans = [
    { name: 'Free Plan', description: 'Core meter monitoring and billing views', price: null },
    { name: 'Pro Energy Insights', description: 'Advanced analytics, usage alerts, AI insights', price: 99 },
    { name: 'Smart Automation Plus', description: 'Automation bundles and optimization workflows', price: 199 }
  ];

  // Get current active plan
  const activePlanName = subStatus?.data?.plan_name || 'Free Plan';

  // Render subscription plans
  if (el.planActions) {
    el.planActions.innerHTML = '';
    el.planActions.style.display = 'flex';
    el.planActions.style.flexDirection = 'column';
    el.planActions.style.gap = '0';
    
    subscriptionPlans.forEach(plan => {
      const isActive = plan.name === activePlanName;
      const btnLabel = plan.price ? `Activate (Rs ${plan.price}/mo)` : 'Activate (Free)';
      
      const planRow = document.createElement('div');
      planRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f0f0f0;';
      
      planRow.innerHTML = `
        <div style="flex: 1; padding-right: 16px;">
          <div style="font-weight: 600; font-size: 15px; color: #1a1a2e;">${plan.name}</div>
          <div style="font-size: 13px; color: #888; margin-top: 2px;">${plan.description}</div>
        </div>
        <button 
          class="subscription-btn"
          data-plan="${plan.name}"
          style="
            width: 160px;
            padding: 10px 16px;
            border-radius: 8px;
            border: ${isActive ? 'none' : '1px solid #ddd'};
            background: ${isActive ? 'linear-gradient(135deg, #1f6fff 0%, #14b8c9 100%)' : '#fff'};
            color: ${isActive ? '#fff' : '#333'};
            font-weight: 600;
            font-size: 13px;
            cursor: pointer;
            white-space: nowrap;
            text-align: center;
            box-sizing: border-box;
          "
        >${isActive ? 'Current Plan' : btnLabel}</button>
      `;
      
      el.planActions.appendChild(planRow);
    });
    
    // Add event listeners to buttons
    el.planActions.querySelectorAll('.subscription-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const planName = this.dataset.plan;
        activateSubscriptionPlan(planName);
      });
    });
  }

  // Function to activate subscription plan
  function activateSubscriptionPlan(planName) {
    // Update subscription status display
    setText(el.subStatus, `Active: ${planName} (until -)`);
    
    // Re-render the plans to show new active plan
    const currentActivePlan = subStatus?.data?.plan_name || 'Free Plan';
    if (currentActivePlan !== planName) {
      // Update the subStatus data for consistency
      if (subStatus?.data) {
        subStatus.data.plan_name = planName;
      }
      
      // Re-render the subscription plans
      const subscriptionPlans = [
        { name: 'Free Plan', description: 'Core meter monitoring and billing views', price: null },
        { name: 'Pro Energy Insights', description: 'Advanced analytics, usage alerts, AI insights', price: 99 },
        { name: 'Smart Automation Plus', description: 'Automation bundles and optimization workflows', price: 199 }
      ];

      if (el.planActions) {
        el.planActions.innerHTML = '';
        el.planActions.style.display = 'flex';
        el.planActions.style.flexDirection = 'column';
        el.planActions.style.gap = '0';
        
        subscriptionPlans.forEach(plan => {
          const isActive = plan.name === planName;
          const btnLabel = plan.price ? `Activate (Rs ${plan.price}/mo)` : 'Activate (Free)';
          
          const planRow = document.createElement('div');
          planRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f0f0f0;';
          
          planRow.innerHTML = `
            <div style="flex: 1; padding-right: 16px;">
              <div style="font-weight: 600; font-size: 15px; color: #1a1a2e;">${plan.name}</div>
              <div style="font-size: 13px; color: #888; margin-top: 2px;">${plan.description}</div>
            </div>
            <button 
              class="subscription-btn"
              data-plan="${plan.name}"
              style="
                width: 160px;
                padding: 10px 16px;
                border-radius: 8px;
                border: ${isActive ? 'none' : '1px solid #ddd'};
                background: ${isActive ? 'linear-gradient(135deg, #1f6fff 0%, #14b8c9 100%)' : '#fff'};
                color: ${isActive ? '#fff' : '#333'};
                font-weight: 600;
                font-size: 13px;
                cursor: pointer;
                white-space: nowrap;
                text-align: center;
                box-sizing: border-box;
              "
            >${isActive ? 'Current Plan' : btnLabel}</button>
          `;
          
          el.planActions.appendChild(planRow);
        });
        
        // Re-attach event listeners
        el.planActions.querySelectorAll('.subscription-btn').forEach(btn => {
          btn.addEventListener('click', function() {
            const newPlanName = this.dataset.plan;
            activateSubscriptionPlan(newPlanName);
          });
        });
      }
    }
  }

  // Load secondary sections in background without blocking
  setTimeout(async () => {
    renderTodayUsageChart(dailyUsage?.data || []);
    await updateTariffSchedule();
  }, 0);
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

async function initDefaultSchedules() {
  // Use sessionStorage so defaults seed once per browser session
  // but reset if user clears all schedules
  if (sessionStorage.getItem('defaults_seeded')) return;
  
  try {
    const existing = await api("/schedule", {}, state.token)
      .catch(() => []);
    // Only seed if backend has no schedules at all
    if (Array.isArray(existing) && existing.length > 0) {
      sessionStorage.setItem('defaults_seeded', 'true');
      return;
    }
    
    // Add 2 default schedules to backend
    await api("/schedule", {
      method: "POST",
      body: JSON.stringify({ device_id: "plug_1", run_time: "22:00" })
    }, state.token).catch(() => {});
    
    await api("/schedule", {
      method: "POST",
      body: JSON.stringify({ device_id: "plug_3", run_time: "05:00" })
    }, state.token).catch(() => {});
    
    // Set default scheduleMeta for days display
    const key1 = scheduleKey("plug_1", "22:00", 0);
    const key2 = scheduleKey("plug_3", "05:00", 1);
    state.scheduleMeta[key1] = { enabled: true, repeat: "MWF", hidden: false };
    state.scheduleMeta[key2] = { enabled: true, repeat: "Daily", hidden: false };
    saveScheduleMeta();
    
    sessionStorage.setItem('defaults_seeded', 'true');
  } catch(e) {}
}
async function loadAppliances() {
  const [system, schedules, meter] = await Promise.all([
    api("/system/status", {}, state.token),
    api("/schedule", {}, state.token),
    api("/meter/live", {}, state.token).catch(() => ({ data: { units_kwh: 0 } })),
  ]);

  const devices = system.data.devices;
  
  // Get custom appliances from localStorage
  const customAppliances = JSON.parse(localStorage.getItem('custom_appliances') || '[]');
  const removedAppliances = JSON.parse(localStorage.getItem('removed_appliances') || '[]');
  
  // Merge custom appliances with system devices
  const allDevices = { ...devices };
  customAppliances.forEach(appliance => {
    if (!removedAppliances.includes(appliance.id)) {
      allDevices[appliance.id] = appliance;
    }
  });
  
  state.appliances = allDevices;
  el.applianceList.innerHTML = "";
  el.scheduleDevice.innerHTML = "";
  el.whatIfDevices.innerHTML = "";

  // Ensure AC and Geyser default ON on every page load
  await ensureDefaultAppliancesOn(allDevices);

  Object.entries(allDevices).forEach(([id, device]) => {
    // Skip if this appliance was removed
    if (removedAppliances.includes(id)) return;
    
    const article = document.createElement("article");
    article.className = "appliance-item";
    article.setAttribute("data-interactive", "true");
    const icon = DEVICE_ICONS[device.name.toLowerCase()] || "DV";
    const isCustom = device.isCustom || id.startsWith('local_');
    
    article.innerHTML = `
      <div class="device-icon">${icon}</div>
      <div class="device-meta">
        <strong>${device.name}</strong>
        <div class="device-sub">${device.flexible ? "Flexible load" : "Essential load"}${isCustom ? ' (Custom)' : ''}</div>
        <div class="device-power">${device.units_per_hour} kWh/h</div>
      </div>
      <div class="toggle-wrap">
        <span class="state-pill ${device.state ? "state-on" : "state-off"}">${device.state ? "ON" : "OFF"}</span>
        <label class="toggle-switch">
          <input type="checkbox" ${device.state ? "checked" : ""} />
          <span class="toggle-slider"></span>
        </label>
      </div>
      ${isCustom ? `<button class="remove-appliance-btn" data-id="${id}" title="Remove appliance">✕</button>` : ''}
    `;

    const toggle = article.querySelector("input[type='checkbox']");
    toggle.addEventListener("change", async () => {
      try {
        // Only call backend API for non-custom appliances
        if (!isCustom) {
          await api(`/appliance/toggle/${id}`, {
            method: "POST",
            body: JSON.stringify({ state: toggle.checked }),
          }, state.token);
        } else {
          // For custom appliances, update localStorage
          const customApps = JSON.parse(localStorage.getItem('custom_appliances') || '[]');
          const applianceIndex = customApps.findIndex(app => app.id === id);
          if (applianceIndex !== -1) {
            customApps[applianceIndex].state = toggle.checked;
            localStorage.setItem('custom_appliances', JSON.stringify(customApps));
          }
        }
        
        logEvent(`${device.name} turned ${toggle.checked ? "ON" : "OFF"}`);
        await Promise.all([loadOverview(), loadAppliances()]);
      } catch (err) {
        toggle.checked = !toggle.checked;
        logEvent(err.message, true);
      }
    });
    el.applianceList.appendChild(article);

    // Add removal event listener for custom appliances
    const removeBtn = article.querySelector('.remove-appliance-btn');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        if (confirm(`Remove ${device.name}?`)) {
          removeAppliance(id);
        }
      });
    }

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
  
  // SINGLE SOURCE OF TRUTH: backend schedules only
  const scheduleSource = state.forceHideSchedules ? [] : (Array.isArray(schedules) ? schedules : []);
  const visibleRules = scheduleSource
    .map((sch, idx) => {
      const key = scheduleKey(sch.device_id, sch.run_time, idx);
      const meta = state.scheduleMeta[key] || { 
        enabled: true, repeat: "Daily", hidden: false 
      };
      return { ...sch, idx, key, meta };
    })
    .filter(rule => !rule.meta.hidden);

  if (visibleRules.length === 0) {
    el.scheduleList.innerHTML = 
      '<div style="text-align:center;padding:20px;color:#999;font-size:13px;">No schedules yet.</div>';
  } else {
    visibleRules.forEach(sch => {
      const deviceName = state.appliances[sch.device_id]?.name || sch.device_id;
      const scheduleItem = document.createElement("div");
      scheduleItem.className = "schedule-item-new";
      scheduleItem.innerHTML = `
        <div class="schedule-info">
          <span class="schedule-icon">🕐</span>
          <div class="schedule-details">
            <div class="schedule-action">${deviceName} · ON</div>
            <div class="schedule-time">${sch.run_time}</div>
            <div class="schedule-days">${sch.meta.repeat}</div>
          </div>
        </div>
        <button class="remove-schedule-btn" data-id="${sch.key}">✕</button>
      `;
      
      const removeBtn = scheduleItem.querySelector('.remove-schedule-btn');
      removeBtn.addEventListener('click', async () => {
        if (!confirm(`Remove schedule for ${deviceName}?`)) return;
        try {
          // Delete from backend
          await api(
            `/schedule/${sch.device_id}?run_time=${encodeURIComponent(sch.run_time)}`,
            { method: "DELETE" },
            state.token
          );
          // Hide in scheduleMeta
          state.scheduleMeta[sch.key] = { 
            ...state.scheduleMeta[sch.key], hidden: true 
          };
          saveScheduleMeta();
          logEvent(`Removed schedule: ${deviceName}`);
          await loadAppliances();
        } catch(err) {
          logEvent(err.message, true);
        }
      });
      
      el.scheduleList.appendChild(scheduleItem);
    });
  }

  // Initialize schedule panel listeners after DOM is ready
  initSchedulePanel();

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
    btn.textContent = `${req.request_id}  \u00B7  ${req.request_type}  \u00B7  ${req.status}`;
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
    wallet: loadWallet,
    marketplace: loadMarketplace,
    outage: loadOutage,
    greenenergy: loadGreenEnergy,
    discom: loadDiscom,
    powerbackup: loadPowerBackup,
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
      refreshLiveValues().catch(() => {});
    }
  }, state.autoRefreshSeconds * 1000);
}

function initSchedulePanel() {
  // Action toggle buttons
  let selectedAction = 'ON';
  let selectedDays = [];

  const actionBtns = document.querySelectorAll('.action-btn');
  actionBtns.forEach(btn => {
    if (!btn.dataset.bound) {
      btn.dataset.bound = 'true';
      btn.addEventListener('click', () => {
        document.querySelectorAll('.action-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedAction = btn.dataset.action;
      });
    }
  });

  // Day chips
  const dayChips = document.querySelectorAll('.day-chip');
  dayChips.forEach(chip => {
    if (!chip.dataset.bound) {
      chip.dataset.bound = 'true';
      chip.addEventListener('click', () => {
        chip.classList.toggle('active');
        const day = chip.dataset.day;
        if (chip.classList.contains('active')) {
          selectedDays.push(day);
        } else {
          selectedDays = selectedDays.filter(d => d !== day);
        }
      });
    }
  });

  // Add schedule button
  const addScheduleBtn = document.getElementById('addScheduleBtn');
  if (addScheduleBtn && !addScheduleBtn.dataset.bound) {
    addScheduleBtn.dataset.bound = 'true';
    addScheduleBtn.addEventListener('click', async () => {
      const scheduleDevice = document.getElementById('scheduleDevice');
      const scheduleTime = document.getElementById('scheduleTime');
      const deviceId = scheduleDevice?.value;
      const time = scheduleTime?.value;
      
      if (!deviceId || !time) {
        logEvent('Please select an appliance and time', true);
        return;
      }
      
      const selectedDayChips = [...document.querySelectorAll('.day-chip.active')];
      if (selectedDayChips.length === 0) {
        logEvent('Please select at least one day', true);
        return;
      }
      
      const selectedDays = selectedDayChips.map(c => c.dataset.day);
      const daysText = selectedDays.length === 7 ? 'Daily' : selectedDays.join(',');
      
      try {
        // POST to backend
        await api("/schedule", {
          method: "POST",
          body: JSON.stringify({ device_id: deviceId, run_time: time }),
        }, state.token);
        state.forceHideSchedules = false;
        sessionStorage.removeItem("force_hide_schedules");
        
        // Get updated list to find index of new entry
        const currentSchedules = await api("/schedule", {}, state.token);
        const idx = Math.max(0, currentSchedules.length - 1);
        const key = scheduleKey(deviceId, time, idx);
        
        // Save days info to scheduleMeta
        state.scheduleMeta[key] = { enabled: true, repeat: daysText, hidden: false };
        saveScheduleMeta();
        
        // Reset form
        if (scheduleDevice) scheduleDevice.value = '';
        if (scheduleTime) scheduleTime.value = '';
        document.querySelectorAll('.day-chip').forEach(c => c.classList.remove('active'));
        
        logEvent("Schedule added");
        await loadAppliances();
      } catch(err) {
        logEvent(err.message, true);
      }
    });
  }

  const clearAllBtn = document.getElementById('clearAllSchedulesBtn');
  if (clearAllBtn && !clearAllBtn.dataset.bound) {
    clearAllBtn.dataset.bound = 'true';
    clearAllBtn.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!confirm('Remove all schedules? This cannot be undone.')) return;
      try {
        state.forceHideSchedules = true;
        sessionStorage.setItem("force_hide_schedules", "1");
        clearAllBtn.disabled = true;

        // Backend-side clear + verification endpoint.
        const clearResult = await api("/schedule/clear-confirm", { method: "POST" }, state.token);
        if (Number(clearResult?.remaining || 0) > 0) {
          logEvent(`Clear-all verification pending (${clearResult.remaining} remaining)`, true);
        }
        
        // Clear scheduleMeta so days info is wiped too
        state.scheduleMeta = {};
        saveScheduleMeta();
        
        // Keep defaults disabled after clear to avoid ghost re-seeding.
        sessionStorage.setItem('defaults_seeded', 'true');
        
        // Clear DOM immediately
        if (el.scheduleList) {
          el.scheduleList.innerHTML =
            '<div style="text-align:center;padding:20px;color:#999;font-size:13px;">No schedules yet.</div>';
        }
        
        logEvent('All schedules cleared');
        await loadAppliances();
      } catch(err) {
        logEvent(err.message, true);
      } finally {
        clearAllBtn.disabled = false;
      }
    });
  }
}

function bindEvents() {
  el.apiBase.value = appState.apiBase || window.location.origin;
  el.settingsApiBase.value = appState.apiBase || window.location.origin;

  if (el.apiBase) el.apiBase.style.display = "none";
  const apiSettingsGroup = el.settingsApiBase?.closest(".form-grid");
  if (apiSettingsGroup) apiSettingsGroup.style.display = "none";

  if (el.settingsBtn) el.settingsBtn.addEventListener("click", () => switchPage("settings"));

  if (el.refreshBtn) el.refreshBtn.addEventListener("click", () => refreshPage().catch((err) => logEvent(err.message, true)));

  if (el.logoutBtn) el.logoutBtn.addEventListener("click", () => {
    clearSession();
    window.location.href = "/";
  });

  if (el.runAi) el.runAi.addEventListener("click", runAi);

  if (el.scheduleForm) el.scheduleForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await api("/schedule", {
      method: "POST",
      body: JSON.stringify({ device_id: el.scheduleDevice.value, run_time: el.scheduleTime.value }),
    }, state.token);
    state.forceHideSchedules = false;
    sessionStorage.removeItem("force_hide_schedules");
    const currentSchedules = await api("/schedule", {}, state.token);
    const idx = Math.max(0, currentSchedules.length - 1);
    const key = scheduleKey(el.scheduleDevice.value, el.scheduleTime.value, idx);
    state.scheduleMeta[key] = { enabled: true, repeat: el.scheduleRepeat.value || "daily", hidden: false };
    saveScheduleMeta();
    logEvent("Schedule added");
    await loadAppliances();
  });

  if (el.simulateTimeForm) el.simulateTimeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const result = await api("/simulate/time", { method: "POST", body: JSON.stringify({ time_str: el.simulateTime.value }) }, state.token);
    el.simulateMsg.textContent = result.message || "Simulation updated";
    await loadOverview();
  });

  if (el.whatIfForm) el.whatIfForm.addEventListener("submit", async (event) => {
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

  if (el.billingEstimateForm) el.billingEstimateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const units = el.billingUnits.value.trim();
    const query = units ? `?monthly_kwh=${encodeURIComponent(units)}` : "";
    const res = await api(`/billing/estimate${query}`, {}, state.token);
    setBillingEstimate(res.data);
  });

  if (el.payForm) el.payForm.addEventListener("submit", async (event) => {
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

  if (el.serviceForm) el.serviceForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await api("/service/request", {
      method: "POST",
      body: JSON.stringify({ request_type: el.serviceType.value, description: el.serviceDesc.value.trim() }),
    }, state.token);
    el.serviceDesc.value = "";
    logEvent("Service request submitted");
    await loadService();
  });

  // Add appliance modal event listeners
  if (el.addApplianceBtn) el.addApplianceBtn.addEventListener("click", showAddApplianceModal);
  if (el.closeModalBtn) el.closeModalBtn.addEventListener("click", hideAddApplianceModal);
  if (el.cancelAddAppliance) el.cancelAddAppliance.addEventListener("click", hideAddApplianceModal);
  if (el.addApplianceForm) el.addApplianceForm.addEventListener("submit", handleAddAppliance);
  
  // Close modal when clicking outside
  if (el.addApplianceModal) el.addApplianceModal.addEventListener("click", (e) => {
    if (e.target === el.addApplianceModal) {
      hideAddApplianceModal();
    }
  });

  if (el.calcForm) el.calcForm.addEventListener("submit", async (event) => {
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
      `Daily consumption: ${out.daily_consumption_kwh} kWh`,
      `Monthly cost: Rs ${rs(out.monthly_cost)}`,
      `Monthly CO2: ${out.monthly_co2_kg} kg`,
    ].join("\n");
  });

  if (el.helpForm) el.helpForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const query = el.helpQuery.value.trim();
    if (!query) return;
    el.helpResult.textContent = "Searching...";
    try {
      const out = await api("/help/search", {
        method: "POST",
        body: JSON.stringify({ query }),
      }, state.token);
      el.helpResult.textContent = out.answer || "No relevant help found.";
    } catch (err) {
      el.helpResult.textContent = err.message;
    }
  });

  if (el.balanceActionBtn) el.balanceActionBtn.addEventListener("click", async () => {
    const current = await api("/balance/status", {}, state.token);
    if (!current.data) {
      logEvent("Balance service unavailable", true);
      return;
    }
    if (current.data.type === "prepaid") {
      switchPage("payments");
    } else {
      switchPage("billing");
    }
  });

  if (el.balanceForecastBtn) el.balanceForecastBtn.addEventListener("click", async () => {
    try {
      const forecast = await api("/balance/forecast", {}, state.token);
      logEvent(`30‑day forecast: Rs ${rs(forecast.projected_bill)} (based on current usage)`);
    } catch (err) {
      logEvent(err.message, true);
    }
  });

  if (el.balanceActionBtn) el.balanceActionBtn.addEventListener("click", async () => {
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

  if (el.darkModeToggle) el.darkModeToggle.addEventListener("change", () => {
    state.prefs.darkMode = !!el.darkModeToggle.checked;
    localStorage.setItem("sm_theme_mode", state.prefs.darkMode ? "dark" : "light");
    applyTheme();
    refreshVisibleCharts();
    el.settingsStatus.textContent = `Theme updated to ${state.prefs.darkMode ? "Dark" : "Light"} mode.`;
  });

  if (el.accentTheme) el.accentTheme.addEventListener("change", () => {
    state.prefs.accentTheme = el.accentTheme.value;
    localStorage.setItem("sm_accent_theme", state.prefs.accentTheme);
    applyTheme();
    el.settingsStatus.textContent = `Accent changed to ${state.prefs.accentTheme}.`;
  });

  if (el.languageSelect) el.languageSelect.addEventListener("change", () => {
    state.prefs.language = el.languageSelect.value;
    localStorage.setItem("sm_language", state.prefs.language);
    el.settingsStatus.textContent = `Language preference saved (${state.prefs.language}).`;
  });

  if (el.notifToggle) el.notifToggle.addEventListener("change", () => {
    state.prefs.notifications = !!el.notifToggle.checked;
    localStorage.setItem("sm_notifications", state.prefs.notifications ? "1" : "0");
  });

  if (el.energyAlertToggle) el.energyAlertToggle.addEventListener("change", () => {
    state.prefs.energyAlerts = !!el.energyAlertToggle.checked;
    localStorage.setItem("sm_energy_alerts", state.prefs.energyAlerts ? "1" : "0");
  });

  if (el.energyAlertThreshold) el.energyAlertThreshold.addEventListener("change", () => {
    state.prefs.alertThreshold = Math.max(1, Number(el.energyAlertThreshold.value || 18));
    localStorage.setItem("sm_energy_threshold", String(state.prefs.alertThreshold));
  });

  if (el.aiAssistantToggle) el.aiAssistantToggle.addEventListener("change", () => {
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

  if (el.aiStyleSelect) el.aiStyleSelect.addEventListener("change", () => {
    state.prefs.aiStyle = el.aiStyleSelect.value;
    localStorage.setItem("sm_ai_style", state.prefs.aiStyle);
  });

  if (el.defaultApplianceBehavior) el.defaultApplianceBehavior.addEventListener("change", () => {
    state.prefs.defaultApplianceBehavior = el.defaultApplianceBehavior.value;
    localStorage.setItem("sm_appliance_behavior", state.prefs.defaultApplianceBehavior);
  });

  if (el.profileVisibility) el.profileVisibility.addEventListener("change", () => {
    state.prefs.profileVisibility = el.profileVisibility.value;
    localStorage.setItem("sm_profile_visibility", state.prefs.profileVisibility);
  });

  if (el.applyRefreshSettings) el.applyRefreshSettings.addEventListener("click", () => {
    state.autoRefreshEnabled = !!el.autoRefreshEnabled.checked;
    state.autoRefreshSeconds = Math.max(60, Number(el.autoRefreshSeconds.value || 60));
    el.autoRefreshSeconds.value = String(state.autoRefreshSeconds);
    applyAutoRefresh();
    el.settingsStatus.textContent = state.autoRefreshEnabled
      ? `Auto refresh enabled every ${state.autoRefreshSeconds}s`
      : "Auto refresh disabled";
  });

  if (el.clearLogsBtn) el.clearLogsBtn.addEventListener("click", () => {
    el.events.innerHTML = "";
    el.settingsStatus.textContent = "Activity log cleared.";
  });

  if (el.resetSettingsBtn) el.resetSettingsBtn.addEventListener("click", () => {
    state.autoRefreshEnabled = true;
    state.autoRefreshSeconds = 60;
    el.autoRefreshEnabled.checked = true;
    el.autoRefreshSeconds.value = "60";
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

  if (el.chatToggle) el.chatToggle.addEventListener("click", () => {
    if (!state.prefs.aiEnabled) {
      el.settingsStatus.textContent = "AI Assistant is disabled in Settings.";
      return;
    }
    openChatWidget();
    el.chatInput.focus();
  });

  if (el.chatClose) el.chatClose.addEventListener("click", () => {
    closeChatWidget();
  });

  if (el.chatForm) el.chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await sendChat(el.chatInput.value);
  });

  if (el.chatQuickActions) {
    el.chatQuickActions.querySelectorAll("button[data-q]").forEach((button) => {
      button.addEventListener("click", async () => {
        await sendChat(button.dataset.q || "");
      });
    });
  }

  document.querySelectorAll(".ai-options button[data-q]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!state.prefs.aiEnabled) {
        el.settingsStatus.textContent = "AI Assistant is disabled in Settings.";
        return;
      }
      await sendChat(button.dataset.q || "");
    });
  });

  if (el.sidebarToggle) el.sidebarToggle.addEventListener("click", () => {
    document.body.classList.add("sidebar-open");
    el.sidebarBackdrop.setAttribute("aria-hidden", "false");
  });

  if (el.sidebarBackdrop) el.sidebarBackdrop.addEventListener("click", closeSidebar);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSidebar();
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth >= MOBILE_WIDTH) closeSidebar();
  });
  document.getElementById('scheduleWMBtn')?.addEventListener('click', scheduleWashingMachine);
  document.getElementById('scheduleACBtn')?.addEventListener('click', scheduleAC);
  document.getElementById('scheduleGeyserBtn')?.addEventListener('click', scheduleGeyser);
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

async function loadWallet() {
  const points = Math.floor(Math.random() * 2000) + 500;
  const earned = points + Math.floor(Math.random() * 500);
  const redeemed = earned - points;
  
  if (document.getElementById('walletBalance')) {
    document.getElementById('walletBalance').textContent = points;
    document.getElementById('walletEarned').textContent = earned;
    document.getElementById('walletRedeemed').textContent = redeemed;
    document.getElementById('walletCash').textContent = (points * 0.1).toFixed(0);
  }

  const tiers = [
    { name: 'Bronze', min: 0, max: 999, color: '#cd7f32' },
    { name: 'Silver', min: 1000, max: 2499, color: '#9e9e9e' },
    { name: 'Gold', min: 2500, max: 4999, color: '#ffc107' },
    { name: 'Platinum', min: 5000, max: 99999, color: '#00bcd4' },
  ];
  const currentTier = tiers.find(t => points >= t.min && points <= t.max) || tiers[0];
  const tiersEl = document.getElementById('walletTiers');
  if (tiersEl) {
    tiersEl.innerHTML = `
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${tiers.map(t => `
          <div style="flex:1;min-width:100px;padding:12px;border-radius:10px;border:2px solid ${t.name === currentTier.name ? t.color : 'var(--line)'};text-align:center;background:${t.name === currentTier.name ? t.color + '22' : 'var(--surface-muted)'}">
            <div style="font-weight:700;color:${t.color}">${t.name}</div>
            <div style="font-size:11px;color:var(--muted)">${t.min}–${t.max === 99999 ? '∞' : t.max} pts</div>
            ${t.name === currentTier.name ? '<div style="font-size:11px;font-weight:600;color:var(--ok)">✓ Current</div>' : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  const offersEl = document.getElementById('walletOffers');
  if (offersEl) {
    const offers = [
      { icon: '⚡', title: 'Shift load to off-peak', desc: 'Earn 50 pts per off-peak hour scheduled', action: 'Earn Now' },
      { icon: '🌱', title: 'Reduce consumption 10%', desc: 'Earn 200 pts this month', action: 'Track Progress' },
      { icon: '💰', title: 'Pay bill on time', desc: 'Earn 100 pts per on-time payment', action: 'Pay Bill' },
      { icon: '☀️', title: 'Solar generation bonus', desc: 'Earn 5 pts per kWh exported to grid', action: 'View Solar' },
    ];
    offersEl.innerHTML = offers.map(o => `
      <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--surface-muted);border-radius:10px">
        <span style="font-size:24px">${o.icon}</span>
        <div style="flex:1">
          <div style="font-weight:600;font-size:14px">${o.title}</div>
          <div style="font-size:12px;color:var(--muted)">${o.desc}</div>
        </div>
        <button class="btn btn-outline" style="font-size:12px;padding:6px 12px">${o.action}</button>
      </div>
    `).join('');
  }

  const historyEl = document.getElementById('walletHistory');
  if (historyEl) {
    const txns = [
      { date: '2026-03-18', action: 'Earned', points: '+50', reason: 'Off-peak scheduling' },
      { date: '2026-03-15', action: 'Earned', points: '+100', reason: 'On-time bill payment' },
      { date: '2026-03-10', action: 'Redeemed', points: '-200', reason: 'Bill discount' },
      { date: '2026-03-05', action: 'Earned', points: '+200', reason: 'Monthly reduction goal' },
    ];
    historyEl.innerHTML = txns.map(t => `
      <tr>
        <td>${t.date}</td>
        <td>${t.action}</td>
        <td style="color:${t.points.startsWith('+') ? 'var(--ok)' : 'var(--danger)'};font-weight:600">${t.points}</td>
        <td>${t.reason}</td>
      </tr>
    `).join('');
  }

  const redeemForm = document.getElementById('redeemForm');
  if (redeemForm && !redeemForm.dataset.bound) {
    redeemForm.dataset.bound = 'true';
    redeemForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const pts = parseInt(document.getElementById('redeemPoints').value);
      document.getElementById('redeemMsg').textContent = `✅ ${pts} points redeemed! Rs ${(pts * 0.1).toFixed(0)} credited to your bill.`;
    });
  }
}

async function loadMarketplace() {
  const recEl = document.getElementById('marketplaceRecommendation');
  if (recEl) {
    recEl.innerHTML = `
      <div class="row" style="gap:12px;align-items:flex-start">
        <span style="font-size:32px">🎯</span>
        <div>
          <h4 style="margin:0 0 4px">Based on your usage: Your AC runs 6+ hrs/day at peak tariff</h4>
          <p style="margin:0;color:var(--muted);font-size:13px">Upgrading to a 5-star inverter AC could save you <strong style="color:var(--ok)">₹4,200/year</strong> in electricity costs</p>
        </div>
      </div>
    `;
  }

  const products = [
    { icon: '❄️', name: 'Daikin 1.5T 5-Star Inverter AC', rating: '5★', price: '₹42,990', savings: 'Save ₹4,200/yr', tag: 'Top Pick', link: 'https://www.flipkart.com' },
    { icon: '🌀', name: 'Voltas 1.5T 4-Star Split AC', rating: '4★', price: '₹34,490', savings: 'Save ₹2,800/yr', tag: 'Budget Pick', link: 'https://www.amazon.in' },
    { icon: '👕', name: 'LG 7kg 5-Star Washing Machine', rating: '5★', price: '₹28,990', savings: 'Save ₹1,200/yr', tag: 'Recommended', link: 'https://www.flipkart.com' },
    { icon: '🚿', name: 'Racold 25L Solar Water Heater', rating: '5★', price: '₹18,500', savings: 'Save ₹3,600/yr', tag: 'Green Choice', link: 'https://www.amazon.in' },
    { icon: '☀️', name: 'Loom Solar 3kW Rooftop Kit', rating: '5★', price: '₹1,20,000', savings: 'Save ₹18,000/yr', tag: 'Solar', link: 'https://www.loomsolar.com' },
    { icon: '🔋', name: 'Luminous 150Ah Inverter Battery', rating: '4★', price: '₹12,800', savings: 'Backup: 8 hrs', tag: 'Backup Power', link: 'https://www.amazon.in' },
  ];

  const gridEl = document.getElementById('marketplaceGrid');
  if (gridEl) {
    gridEl.innerHTML = products.map(p => `
      <article class="card" style="padding:16px;position:relative">
        <div style="position:absolute;top:12px;right:12px;background:var(--brand);color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px">${p.tag}</div>
        <div style="font-size:36px;margin-bottom:8px">${p.icon}</div>
        <h4 style="margin:0 0 4px;font-size:14px">${p.name}</h4>
        <div style="font-size:13px;color:var(--muted)">${p.rating}</div>
        <div style="font-size:18px;font-weight:700;color:var(--text);margin:8px 0">${p.price}</div>
        <div style="font-size:12px;color:var(--ok);font-weight:600;margin-bottom:12px">${p.savings}</div>
        <a href="${p.link}" target="_blank" class="btn" style="display:block;text-align:center;text-decoration:none;font-size:13px">View Product →</a>
      </article>
    `).join('');
  }
}

async function loadOutage() {
  const outages = [
    { zone: 'Sector 62, Noida', status: 'ACTIVE', since: '14:30', eta: '17:00', type: 'Planned Maintenance' },
    { zone: 'Sector 18, Noida', status: 'RESOLVED', since: '10:00', eta: 'Restored at 12:30', type: 'Transformer Fault' },
    { zone: 'Greater Noida West', status: 'ACTIVE', since: '15:45', eta: '18:00', type: 'Cable Fault' },
  ];

  const mapEl = document.getElementById('outageMapContent');
  if (mapEl) {
    mapEl.innerHTML = `
      <div style="text-align:center;padding:20px">
        <div style="font-size:48px;margin-bottom:8px">🗺️</div>
        <div style="font-weight:600;margin-bottom:4px">Delhi NCR Grid Map</div>
        <div style="font-size:12px;color:var(--muted)">${outages.filter(o => o.status === 'ACTIVE').length} active outage(s) in your region</div>
        <div style="display:flex;gap:12px;justify-content:center;margin-top:12px;flex-wrap:wrap">
          ${outages.map(o => `
            <div style="padding:8px 14px;border-radius:20px;font-size:12px;font-weight:600;background:${o.status === 'ACTIVE' ? '#fee2e2' : '#d1fae5'};color:${o.status === 'ACTIVE' ? '#991b1b' : '#065f46'}">
              ${o.zone}: ${o.status}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  const badgeEl = document.getElementById('outageStatusBadge');
  const hasActive = outages.some(o => o.status === 'ACTIVE');
  if (badgeEl) {
    badgeEl.className = `badge ${hasActive ? 'peak' : 'off-peak'}`;
    badgeEl.textContent = hasActive ? `Grid: ${outages.filter(o => o.status === 'ACTIVE').length} Active Outage(s)` : 'Grid: Normal';
  }

  const listEl = document.getElementById('outageList');
  if (listEl) {
    listEl.innerHTML = outages.map(o => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:var(--surface-muted);border-radius:10px;border-left:4px solid ${o.status === 'ACTIVE' ? 'var(--danger)' : 'var(--ok)'}">
        <div>
          <div style="font-weight:600;font-size:14px">${o.zone}</div>
          <div style="font-size:12px;color:var(--muted)">${o.type} · Since ${o.since}</div>
        </div>
        <div style="text-align:right">
          <span class="badge ${o.status === 'ACTIVE' ? 'peak' : 'off-peak'}">${o.status}</span>
          <div style="font-size:11px;color:var(--muted);margin-top:4px">ETA: ${o.eta}</div>
        </div>
      </div>
    `).join('');
  }

  const emergencyForm = document.getElementById('emergencyForm');
  if (emergencyForm && !emergencyForm.dataset.bound) {
    emergencyForm.dataset.bound = 'true';
    emergencyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const type = document.getElementById('emergencyType').value;
      const desc = document.getElementById('emergencyDesc').value;
      const address = document.getElementById('emergencyAddress').value;
      const urgency = document.getElementById('emergencyUrgency').value;
      const msgEl = document.getElementById('emergencyMsg');
      try {
        await api('/service/emergency', {
          method: 'POST',
          body: JSON.stringify({
            request_type: type,
            description: `${desc} | Address: ${address} | Urgency: ${urgency}`
          })
        }, state.token);
        if (msgEl) msgEl.textContent = '✅ Electrician booked! You will receive a call within 30 minutes.';
        emergencyForm.reset();
        logEvent(`Emergency electrician booked: ${type}`);
      } catch(err) {
        if (msgEl) msgEl.textContent = '❌ Booking failed. Please try again.';
      }
    });
  }
}

async function loadGreenEnergy() {
  const vendors = [
    { name: 'Tata Power Solar', price: '₹38,000/kW', warranty: '25 years', rating: '4.8★' },
    { name: 'Adani Solar', price: '₹35,000/kW', warranty: '25 years', rating: '4.6★' },
    { name: 'Loom Solar', price: '₹32,000/kW', warranty: '10 years', rating: '4.4★' },
  ];

  const vendorsEl = document.getElementById('solarVendors');
  if (vendorsEl) {
    vendorsEl.innerHTML = vendors.map(v => `
      <tr>
        <td><strong>${v.name}</strong></td>
        <td>${v.price}</td>
        <td>${v.warranty}</td>
        <td>${v.rating}</td>
        <td><button class="btn btn-outline" style="font-size:12px;padding:6px 12px" onclick="logEvent('Vendor enquiry: ${v.name}')">Get Quote</button></td>
      </tr>
    `).join('');
  }

  const evStations = [
    { name: 'Tata Power EV Hub', location: 'Sector 18, Noida', slots: 3, price: '₹15/kWh', status: 'Available' },
    { name: 'Ather Grid', location: 'Sector 62, Noida', slots: 1, price: '₹12/kWh', status: 'Busy' },
    { name: 'BPCL Charge Zone', location: 'NH-24, Delhi', slots: 5, price: '₹18/kWh', status: 'Available' },
    { name: 'ChargePoint India', location: 'Connaught Place, Delhi', slots: 2, price: '₹14/kWh', status: 'Available' },
  ];

  const stationsEl = document.getElementById('evStations');
  if (stationsEl) {
    stationsEl.innerHTML = evStations.map(s => `
      <article class="card" style="padding:16px">
        <div class="row" style="justify-content:space-between;margin-bottom:8px">
          <strong style="font-size:14px">⚡ ${s.name}</strong>
          <span class="badge ${s.status === 'Available' ? 'off-peak' : 'peak'}">${s.status}</span>
        </div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:4px">📍 ${s.location}</div>
        <div style="font-size:12px;margin-bottom:8px">${s.slots} slots · ${s.price}</div>
        <button class="btn btn-outline" style="font-size:12px;padding:6px 12px;width:100%" ${s.status === 'Busy' ? 'disabled' : ''}>
          ${s.status === 'Available' ? 'Book Slot' : 'Join Waitlist'}
        </button>
      </article>
    `).join('');
  }

  const solarRoiForm = document.getElementById('solarRoiForm');
  if (solarRoiForm && !solarRoiForm.dataset.bound) {
    solarRoiForm.dataset.bound = 'true';
    solarRoiForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const capacity = parseFloat(document.getElementById('solarCapacity').value);
      const cost = parseFloat(document.getElementById('solarCost').value);
      const annualGeneration = capacity * 4.5 * 365;
      const annualSavings = annualGeneration * 6.0;
      const paybackYears = (cost / annualSavings).toFixed(1);
      const roi25yr = ((annualSavings * 25 - cost) / cost * 100).toFixed(0);
      document.getElementById('solarRoiResult').textContent = [
        `Annual Generation: ${annualGeneration.toFixed(0)} kWh`,
        `Annual Savings: Rs ${annualSavings.toFixed(0)}`,
        `Payback Period: ${paybackYears} years`,
        `25-Year ROI: ${roi25yr}%`,
        `Government Subsidy (30%): Rs ${(cost * 0.3).toFixed(0)}`,
        `Net Cost After Subsidy: Rs ${(cost * 0.7).toFixed(0)}`,
        `Revised Payback: ${(cost * 0.7 / annualSavings).toFixed(1)} years`,
      ].join('\n');
    });
  }

  const evCalcForm = document.getElementById('evCalcForm');
  if (evCalcForm && !evCalcForm.dataset.bound) {
    evCalcForm.dataset.bound = 'true';
    evCalcForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const battery = parseFloat(document.getElementById('evBatterySize').value);
      const percent = parseFloat(document.getElementById('evChargePercent').value);
      const kwhNeeded = battery * (percent / 100);
      const peakCost = (kwhNeeded * 7.20).toFixed(2);
      const offpeakCost = (kwhNeeded * 4.80).toFixed(2);
      const normalCost = (kwhNeeded * 6.00).toFixed(2);
      const saving = (kwhNeeded * (7.20 - 4.80)).toFixed(2);
      document.getElementById('evCalcResult').textContent = [
        `Energy needed: ${kwhNeeded.toFixed(2)} kWh`,
        `Peak tariff cost (14:00-17:00, 22:00-01:00): Rs ${peakCost}`,
        `Normal tariff cost: Rs ${normalCost}`,
        `Off-peak cost (04:00-10:00): Rs ${offpeakCost}`,
        `Savings by charging off-peak: Rs ${saving}`,
        `Best time to charge: 04:00 - 09:00`,
      ].join('\n');
    });
  }
}

async function loadDiscom() {
  const discomForm = document.getElementById('discomForm');
  if (discomForm && !discomForm.dataset.bound) {
    discomForm.dataset.bound = 'true';
    discomForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const type = document.getElementById('discomRequestType').value;
      const name = document.getElementById('discomName').value;
      const address = document.getElementById('discomAddress').value;
      const phone = document.getElementById('discomPhone').value;
      const details = document.getElementById('discomDetails').value;
      const msgEl = document.getElementById('discomMsg');
      try {
        const res = await api('/service/discom', {
          method: 'POST',
          body: JSON.stringify({
            request_type: type,
            description: `Name: ${name} | Address: ${address} | Phone: ${phone} | Details: ${details}`
          })
        }, state.token);
        if (msgEl) msgEl.textContent = `✅ Request submitted! ID: ${res.data.request_id}`;
        discomForm.reset();
        loadDiscom();
        logEvent(`DISCOM request submitted: ${type}`);
      } catch(err) {
        if (msgEl) msgEl.textContent = '❌ Submission failed. Please try again.';
      }
    });
  }

  try {
    const history = await api('/service/history', {}, state.token);
    const discomReqs = (history.data || []).filter(r => r.request_type.startsWith('DISCOM:'));
    const historyEl = document.getElementById('discomHistory');
    if (historyEl) {
      historyEl.innerHTML = discomReqs.length === 0
        ? '<tr><td colspan="4" style="text-align:center;color:var(--muted)">No DISCOM requests yet</td></tr>'
        : discomReqs.map(r => `
            <tr>
              <td>${r.request_id}</td>
              <td>${r.request_type.replace('DISCOM: ', '')}</td>
              <td><span class="badge normal">${r.status}</span></td>
              <td>${new Date(r.created_at).toLocaleDateString()}</td>
            </tr>
          `).join('');
    }
  } catch(err) {}
}

async function loadPowerBackup() {
  const products = [
    {
      icon: '🔌',
      name: 'Generator — 2 kW',
      desc: 'Ideal for home lighting, fans, and basic appliances',
      price: '₹800/day',
      capacity: '2 kW',
      runtime: '8 hrs on 2L fuel',
      tag: 'Most Popular',
      tagColor: 'var(--brand)',
      bestFor: 'Small homes',
    },
    {
      icon: '⚡',
      name: 'Generator — 5 kW',
      desc: 'Supports AC, refrigerator, and full home load',
      price: '₹1,500/day',
      capacity: '5 kW',
      runtime: '10 hrs on 4L fuel',
      tag: 'Recommended',
      tagColor: 'var(--ok)',
      bestFor: 'Medium homes',
    },
    {
      icon: '🏭',
      name: 'Generator — 10 kW',
      desc: 'Heavy duty — offices, shops, large homes',
      price: '₹2,800/day',
      capacity: '10 kW',
      runtime: '12 hrs on 8L fuel',
      tag: 'Heavy Duty',
      tagColor: '#7c3aed',
      bestFor: 'Offices & large homes',
    },
    {
      icon: '🔋',
      name: 'Portable Battery — 2 kWh',
      desc: 'Silent, clean power for lights, fans, phones, laptop',
      price: '₹500/day',
      capacity: '2 kWh',
      runtime: '6–8 hrs',
      tag: 'Silent & Clean',
      tagColor: 'var(--ok)',
      bestFor: 'Minimal backup',
    },
    {
      icon: '🗄️',
      name: 'Portable Battery — 5 kWh',
      desc: 'Powers fridge, fan, TV, and lights simultaneously',
      price: '₹900/day',
      capacity: '5 kWh',
      runtime: '10–12 hrs',
      tag: 'Best Value',
      tagColor: 'var(--warn)',
      bestFor: 'Full home backup',
    },
    {
      icon: '🔆',
      name: 'Solar Generator — 1 kW',
      desc: 'Self-charging solar unit — zero fuel cost',
      price: '₹700/day',
      capacity: '1 kW',
      runtime: 'Unlimited (daylight)',
      tag: 'Eco Friendly',
      tagColor: '#16a34a',
      bestFor: 'Daytime outages',
    },
  ];

  const gridEl = document.getElementById('backupProductsGrid');
  if (gridEl) {
    gridEl.innerHTML = products.map(p => `
      <article class="card" style="padding:16px;position:relative">
        <div style="position:absolute;top:12px;right:12px;background:${p.tagColor};color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px">${p.tag}</div>
        <div style="font-size:36px;margin-bottom:8px">${p.icon}</div>
        <h4 style="margin:0 0 4px;font-size:14px">${p.name}</h4>
        <div style="font-size:12px;color:var(--muted);margin-bottom:8px">${p.desc}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">
          <div style="background:var(--surface-muted);border-radius:8px;padding:6px;text-align:center">
            <div style="font-size:10px;color:var(--muted)">Capacity</div>
            <div style="font-size:13px;font-weight:600">${p.capacity}</div>
          </div>
          <div style="background:var(--surface-muted);border-radius:8px;padding:6px;text-align:center">
            <div style="font-size:10px;color:var(--muted)">Runtime</div>
            <div style="font-size:13px;font-weight:600">${p.runtime}</div>
          </div>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:10px">Best for: ${p.bestFor}</div>
        <div style="font-size:20px;font-weight:700;color:var(--text);margin-bottom:10px">${p.price}</div>
        <button class="btn" style="width:100%;font-size:13px" onclick="
          document.getElementById('backupProductType').value = '${p.name.toLowerCase().replace(/ —/,'').replace(/ /g,'_').replace(/\./g,'')}';
          document.getElementById('backupOrderForm').scrollIntoView({behavior:'smooth'});
        ">Rent Now</button>
      </article>
    `).join('');
  }

  const tips = [
    { icon: '🔦', title: 'Calculate your backup need', desc: 'Add up wattage of essential appliances: Fan (75W) + Lights (40W) + Phone charger (20W) + WiFi (10W) = 145W minimum' },
    { icon: '⛽', title: 'Generator fuel tip', desc: 'Keep 4–5 litres of petrol ready. A 2kW generator uses ~1L/hr at full load. Store fuel safely away from the unit.' },
    { icon: '🔇', title: 'Noise & safety', desc: 'Never run generators indoors. Place at least 2 metres from windows. Battery backups are silent and safe for indoor use.' },
    { icon: '📱', title: 'Prioritise essentials', desc: 'During cuts, turn off AC and geyser. Refrigerator, lights, fan, and phone chargers should be your primary loads.' },
  ];

  const tipsEl = document.getElementById('backupTips');
  if (tipsEl) {
    tipsEl.innerHTML = tips.map(t => `
      <div style="display:flex;gap:12px;align-items:flex-start;padding:12px;background:var(--surface-muted);border-radius:10px">
        <span style="font-size:24px;flex-shrink:0">${t.icon}</span>
        <div>
          <div style="font-weight:600;font-size:14px;margin-bottom:2px">${t.title}</div>
          <div style="font-size:12px;color:var(--muted);line-height:1.5">${t.desc}</div>
        </div>
      </div>
    `).join('');
  }

  const orderForm = document.getElementById('backupOrderForm');
  if (orderForm && !orderForm.dataset.bound) {
    orderForm.dataset.bound = 'true';

    // Set default start date to today
    const startDateEl = document.getElementById('backupStartDate');
    if (startDateEl && !startDateEl.value) {
      startDateEl.value = new Date().toISOString().split('T')[0];
    }

    orderForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const productType = document.getElementById('backupProductType').value;
      const days = parseInt(document.getElementById('backupDays').value);
      const address = document.getElementById('backupAddress').value;
      const phone = document.getElementById('backupPhone').value;
      const urgency = document.getElementById('backupUrgency').value;
      const startDate = document.getElementById('backupStartDate').value;
      const notes = document.getElementById('backupNotes').value;
      const msgEl = document.getElementById('backupOrderMsg');

      // Calculate price
      const prices = {
        'generator_2kw': 800, 'generator_5kw': 1500, 'generator_10kw': 2800,
        'battery_2kwh': 500, 'battery_5kwh': 900, 'inverter_battery': 600,
        'solar_generator': 700,
      };
      const dailyRate = prices[productType] || 800;
      const total = dailyRate * days;

      // Save order to localStorage
      const orders = JSON.parse(localStorage.getItem('backup_orders') || '[]');
      const orderId = `BKP-${Date.now().toString(36).toUpperCase()}`;
      const newOrder = {
        id: orderId,
        product: productType,
        days,
        total,
        status: urgency === 'emergency' ? 'Dispatched' : urgency === 'same_day' ? 'Confirmed' : 'Scheduled',
        delivery: urgency === 'emergency' ? 'Within 2 hrs' : urgency === 'same_day' ? 'Within 6 hrs' : startDate,
        date: new Date().toLocaleDateString(),
      };
      orders.unshift(newOrder);
      localStorage.setItem('backup_orders', JSON.stringify(orders));

      if (msgEl) {
        msgEl.textContent = `✅ Order ${orderId} confirmed! Total: ₹${total.toLocaleString()} for ${days} day(s). ${urgency === 'emergency' ? 'Our team will contact you within 15 minutes.' : 'You will receive a confirmation call shortly.'}`;
      }

      orderForm.reset();
      startDateEl.value = new Date().toISOString().split('T')[0];
      logEvent(`Power backup rented: ${productType} for ${days} days — ₹${total}`);
      renderBackupOrders();
    });
  }

  renderBackupOrders();
}

function renderBackupOrders() {
  const orders = JSON.parse(localStorage.getItem('backup_orders') || '[]');
  const historyEl = document.getElementById('backupOrderHistory');
  const totalEl = document.getElementById('backupTotalSpend');

  if (historyEl) {
    if (orders.length === 0) {
      historyEl.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted)">No rental orders yet</td></tr>';
    } else {
      historyEl.innerHTML = orders.map(o => `
        <tr>
          <td style="font-weight:600">${o.id}</td>
          <td>${o.product.replace(/_/g,' ')}</td>
          <td>${o.days} day(s)</td>
          <td style="font-weight:600">₹${o.total.toLocaleString()}</td>
          <td><span class="badge ${o.status === 'Dispatched' ? 'peak' : o.status === 'Confirmed' ? 'normal' : 'off-peak'}">${o.status}</span></td>
          <td style="font-size:12px;color:var(--muted)">${o.delivery}</td>
        </tr>
      `).join('');
    }
  }

  if (totalEl && orders.length > 0) {
    const total = orders.reduce((sum, o) => sum + o.total, 0);
    totalEl.textContent = `Total spent on rentals: ₹${total.toLocaleString()} across ${orders.length} order(s)`;
  }
}

async function init() {
  applyTheme();
  loadScheduleMeta();
  await initDefaultSchedules(); // Initialize default schedules
  buildNav();
  buildBottomNav();
  
  // Render UI first
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
  
  // Switch to overview page to render DOM elements
  switchPage("overview");
  
  // NOW bind events after DOM is ready
  bindEvents();
  
  applyAutoRefresh();
  
  // Update tariff schedule every minute - only move the blue line, don't re-render whole bar
  setInterval(updateTimeIndicator, 60000);
  
  // Load secondary sections in background without blocking
  loadChatHistory();
  loadHelp();
  loadPayments();
}
function scheduleWashingMachine() {
  switchPage('appliances');
  setTimeout(() => {
    const dropdown = document.getElementById('scheduleDevice');
    if (dropdown) {
      const opt = [...dropdown.options].find(o =>
        o.text.toLowerCase().includes('washing')
      );
      if (opt) dropdown.value = opt.value;
    }
    const timeInput = document.getElementById('scheduleTime');
    if (timeInput) timeInput.value = '22:00';
    document.querySelectorAll('.day-chip').forEach(chip => {
      chip.classList.remove('active');
      if (['Mon','Wed','Fri'].includes(chip.dataset.day)) {
        chip.classList.add('active');
      }
    });
    const panel = document.querySelector('[class*="schedule"]');
    if (panel) panel.scrollIntoView({ behavior: 'smooth' });
  }, 500);
}

function scheduleAC() {
  switchPage('appliances');
  setTimeout(() => {
    const dropdown = document.getElementById('scheduleDevice');
    if (dropdown) {
      const opt = [...dropdown.options].find(o =>
        o.text.toLowerCase().includes('air') || o.text.toLowerCase().includes('ac')
      );
      if (opt) dropdown.value = opt.value;
    }
    const timeInput = document.getElementById('scheduleTime');
    if (timeInput) timeInput.value = '16:30';
    document.querySelectorAll('.day-chip').forEach(chip => {
      chip.classList.add('active');
    });
    const panel = document.querySelector('[class*="schedule"]');
    if (panel) panel.scrollIntoView({ behavior: 'smooth' });
  }, 500);
}

function scheduleGeyser() {
  switchPage('appliances');
  setTimeout(() => {
    const dropdown = document.getElementById('scheduleDevice');
    if (dropdown) {
      const opt = [...dropdown.options].find(o =>
        o.text.toLowerCase().includes('geyser')
      );
      if (opt) dropdown.value = opt.value;
    }
    const timeInput = document.getElementById('scheduleTime');
    if (timeInput) timeInput.value = '00:00';
    document.querySelectorAll('.day-chip').forEach(chip => {
      chip.classList.add('active');
    });
    const panel = document.querySelector('[class*="schedule"]');
    if (panel) panel.scrollIntoView({ behavior: 'smooth' });
  }, 500);
}
init().catch((err) => logEvent(err.message, true));
