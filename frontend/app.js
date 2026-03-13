const state = {
  apiBase: "http://127.0.0.1:8000",
  appliances: {}
};

const el = {
  apiBase: document.getElementById("apiBase"),
  applyApiBase: document.getElementById("applyApiBase"),
  refreshAll: document.getElementById("refreshAll"),
  kpiLoad: document.getElementById("kpiLoad"),
  kpiTariff: document.getElementById("kpiTariff"),
  kpiCost: document.getElementById("kpiCost"),
  kpiSavings: document.getElementById("kpiSavings"),
  statusTime: document.getElementById("statusTime"),
  applianceList: document.getElementById("applianceList"),
  scheduleDevice: document.getElementById("scheduleDevice"),
  scheduleTime: document.getElementById("scheduleTime"),
  scheduleForm: document.getElementById("scheduleForm"),
  scheduleList: document.getElementById("scheduleList"),
  simulateTimeForm: document.getElementById("simulateTimeForm"),
  simulateTime: document.getElementById("simulateTime"),
  simulateMsg: document.getElementById("simulateMsg"),
  whatIfDevices: document.getElementById("whatIfDevices"),
  whatIfTime: document.getElementById("whatIfTime"),
  whatIfForm: document.getElementById("whatIfForm"),
  whatIfResult: document.getElementById("whatIfResult"),
  billingForm: document.getElementById("billingForm"),
  billingUnits: document.getElementById("billingUnits"),
  billingResult: document.getElementById("billingResult"),
  runAi: document.getElementById("runAi"),
  aiText: document.getElementById("aiText"),
  events: document.getElementById("events")
};

function logEvent(text, isError = false) {
  const li = document.createElement("li");
  li.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  if (isError) {
    li.classList.add("error");
  }
  el.events.prepend(li);
  while (el.events.children.length > 12) {
    el.events.lastChild.remove();
  }
}

function setButtonBusy(button, isBusy, busyLabel) {
  if (!button) return;
  if (!button.dataset.defaultLabel) {
    button.dataset.defaultLabel = button.textContent;
  }
  button.disabled = isBusy;
  button.textContent = isBusy ? busyLabel : button.dataset.defaultLabel;
}

async function api(path, options = {}) {
  const res = await fetch(`${state.apiBase}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }

  return res.json();
}

function toRs(value) {
  return Number(value ?? 0).toFixed(2);
}

function renderAppliances(appliances) {
  state.appliances = appliances;
  el.applianceList.innerHTML = "";
  el.scheduleDevice.innerHTML = "";
  el.whatIfDevices.innerHTML = "";

  Object.entries(appliances).forEach(([id, device]) => {
    const wrapper = document.createElement("article");
    wrapper.className = "appliance";

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML = `<strong>${device.name}</strong><div>${device.units_per_hour} kWh/h</div>${device.flexible ? '<span class="badge">Flexible</span>' : ""}`;

    const toggleLabel = document.createElement("label");
    toggleLabel.className = "toggle";
    toggleLabel.innerHTML = `<input type="checkbox" ${device.state ? "checked" : ""} /><span class="slider"></span>`;

    toggleLabel.querySelector("input").addEventListener("change", async (ev) => {
      try {
        await api(`/appliance/toggle/${id}`, {
          method: "POST",
          body: JSON.stringify({ state: ev.target.checked })
        });
        logEvent(`${device.name} turned ${ev.target.checked ? "ON" : "OFF"}`);
        await refreshOverview();
      } catch (err) {
        ev.target.checked = !ev.target.checked;
        logEvent(`Toggle failed for ${device.name}: ${err.message}`, true);
      }
    });

    wrapper.append(meta, toggleLabel);
    el.applianceList.appendChild(wrapper);

    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = device.name;
    el.scheduleDevice.appendChild(opt);

    if (device.flexible) {
      const chip = document.createElement("label");
      chip.innerHTML = `<input type="checkbox" value="${id}" /> ${device.name}`;
      el.whatIfDevices.appendChild(chip);
    }
  });
}

function renderSchedules(schedules) {
  el.scheduleList.innerHTML = "";
  if (!schedules.length) {
    const li = document.createElement("li");
    li.textContent = "No schedules yet.";
    el.scheduleList.appendChild(li);
    return;
  }

  schedules.forEach((task) => {
    const name = state.appliances[task.device_id]?.name || task.device_id;
    const li = document.createElement("li");
    li.textContent = `${name} -> ${task.run_time}`;
    el.scheduleList.appendChild(li);
  });
}

function renderBilling(result) {
  const data = result.data;
  el.billingResult.innerHTML = `
    <p><strong>Projected Monthly Units:</strong> ${data.projected_monthly_kwh} kWh</p>
    <p><strong>Estimated Bill:</strong> Rs ${toRs(data.estimated_monthly_bill)}</p>
    <p><strong>Flat Tariff Bill:</strong> Rs ${toRs(data.baseline_flat_tariff_bill)}</p>
    <p><strong>Savings vs Flat Tariff:</strong> Rs ${toRs(data.savings_vs_flat_tariff)}</p>
  `;
}

async function refreshOverview() {
  const [system, meter] = await Promise.all([
    api("/system/status"),
    api("/meter/live")
  ]);

  const d = system.data;
  const load = meter.data.units_kwh;
  const tariff = d.tariff.data.effective_tariff;
  const cost = d.cost.data.cost_per_hour;
  const savings = d.optimization.data.savings_per_hour;

  el.kpiLoad.textContent = load.toFixed(2);
  el.kpiTariff.textContent = toRs(tariff);
  el.kpiCost.textContent = toRs(cost);
  el.kpiSavings.textContent = toRs(savings);
  el.statusTime.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;

  renderAppliances(d.devices);
  renderBilling(d.billing);
  renderSchedules(await api("/schedule"));
}

async function runWhatIf(ev) {
  ev.preventDefault();

  const selected = Array.from(el.whatIfDevices.querySelectorAll("input:checked")).map((x) => x.value);
  const targetTime = el.whatIfTime.value;

  if (!selected.length) {
    el.whatIfResult.textContent = "Select at least one flexible appliance.";
    return;
  }

  try {
    const result = await api("/simulate/what-if", {
      method: "POST",
      body: JSON.stringify({
        device_ids: selected,
        target_time: targetTime
      })
    });

    if (result.status !== "success") {
      throw new Error(result.message || "Failed what-if simulation");
    }

    el.whatIfResult.textContent = `Devices: ${result.devices.join(", ")}\nSavings/hour: Rs ${toRs(result.savings_per_hour)}\nCO2 Saved/hour: ${result.co2_saved_kg_per_hour} kg\nCost at ${targetTime}: Rs ${toRs(result.cost_at_target_time_per_hour)}`;
    logEvent(`What-if simulation completed for ${targetTime}`);
  } catch (err) {
    el.whatIfResult.textContent = err.message;
    logEvent(`What-if failed: ${err.message}`, true);
  }
}

async function setSimulatedTime(ev) {
  ev.preventDefault();
  try {
    const result = await api("/simulate/time", {
      method: "POST",
      body: JSON.stringify({ time_str: el.simulateTime.value })
    });

    el.simulateMsg.textContent = result.message || "Simulation updated.";
    logEvent(`Simulation time set to ${el.simulateTime.value}`);
    await refreshOverview();
  } catch (err) {
    el.simulateMsg.textContent = err.message;
    logEvent(`Simulation update failed: ${err.message}`, true);
  }
}

async function addSchedule(ev) {
  ev.preventDefault();
  try {
    await api("/schedule", {
      method: "POST",
      body: JSON.stringify({
        device_id: el.scheduleDevice.value,
        run_time: el.scheduleTime.value
      })
    });

    renderSchedules(await api("/schedule"));
    const deviceName = state.appliances[el.scheduleDevice.value]?.name || el.scheduleDevice.value;
    logEvent(`Schedule added: ${deviceName} at ${el.scheduleTime.value}`);
  } catch (err) {
    logEvent(`Schedule failed: ${err.message}`, true);
  }
}

async function estimateBill(ev) {
  ev.preventDefault();
  try {
    const units = el.billingUnits.value.trim();
    const qs = units ? `?monthly_kwh=${encodeURIComponent(units)}` : "";
    const result = await api(`/billing/estimate${qs}`);
    renderBilling(result);
    logEvent("Billing estimate refreshed");
  } catch (err) {
    logEvent(`Billing estimate failed: ${err.message}`, true);
  }
}

async function runAiRecommendation() {
  setButtonBusy(el.runAi, true, "Generating...");
  try {
    const result = await api("/ai/auto-recommend");
    el.aiText.textContent = result.ai_recommendation || "AI response unavailable.";
    logEvent("AI recommendation generated");
  } catch (err) {
    el.aiText.textContent = err.message;
    logEvent(`AI recommendation failed: ${err.message}`, true);
  } finally {
    setButtonBusy(el.runAi, false, "");
  }
}

function attachEvents() {
  el.applyApiBase.addEventListener("click", async () => {
    setButtonBusy(el.applyApiBase, true, "Applying...");
    state.apiBase = el.apiBase.value.trim().replace(/\/$/, "");
    logEvent(`Backend switched to ${state.apiBase}`);
    try {
      await initLoad();
    } finally {
      setButtonBusy(el.applyApiBase, false, "");
    }
  });

  el.refreshAll.addEventListener("click", async () => {
    setButtonBusy(el.refreshAll, true, "Refreshing...");
    try {
      await initLoad();
    } finally {
      setButtonBusy(el.refreshAll, false, "");
    }
  });
  el.scheduleForm.addEventListener("submit", addSchedule);
  el.simulateTimeForm.addEventListener("submit", setSimulatedTime);
  el.whatIfForm.addEventListener("submit", runWhatIf);
  el.billingForm.addEventListener("submit", estimateBill);
  el.runAi.addEventListener("click", runAiRecommendation);
}

async function initLoad() {
  try {
    await refreshOverview();
    await runAiRecommendation();
  } catch (err) {
    logEvent(`Initialization failed: ${err.message}`, true);
  }
}

attachEvents();
initLoad();
setInterval(() => {
  refreshOverview().catch(() => {});
}, 6000);
