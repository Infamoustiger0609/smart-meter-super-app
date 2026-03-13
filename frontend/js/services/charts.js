const charts = {};

function cssVar(name, fallback = "") {
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return val || fallback;
}

function ensureChartFrame(canvas) {
  let frame = canvas.parentElement;

  if (!frame || !frame.classList.contains("chart-frame")) {
    frame = document.createElement("div");
    frame.className = "chart-frame";
    canvas.parentElement?.insertBefore(frame, canvas);
    frame.appendChild(canvas);
  }

  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.maxHeight = "100%";
}

export function renderChart(canvasId, config) {
  if (charts[canvasId]) charts[canvasId].destroy();
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  ensureChartFrame(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  charts[canvasId] = new Chart(ctx, config);
}

export function barConfig(labels, values, color, label) {
  const grid = cssVar("--line", "rgba(140,160,180,0.2)");
  const text = cssVar("--muted", "#5e768f");

  return {
    type: "bar",
    data: {
      labels,
      datasets: [{ label, data: values, borderRadius: 8, backgroundColor: color }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      resizeDelay: 150,
      animation: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: text } },
        y: { beginAtZero: true, grid: { color: grid }, ticks: { color: text } },
      },
    },
  };
}

export function doughnutConfig(labels, values, colors) {
  const text = cssVar("--text", "#122238");
  const line = cssVar("--line", "rgba(140,160,180,0.2)");

  return {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: line,
        borderWidth: 1,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      resizeDelay: 150,
      cutout: "66%",
      animation: {
        duration: 650,
        easing: "easeOutCubic",
      },
      plugins: { legend: { position: "bottom", labels: { color: text, boxWidth: 10, boxHeight: 10 } } },
    },
  };
}
