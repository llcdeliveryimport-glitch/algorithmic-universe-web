import { COLLISION_SYSTEMS } from "./glauber.js";
import {
  MODEL_REFERENCES,
  createMinimumBiasAccumulator,
} from "./collider.js";

const tabs = [...document.querySelectorAll(".mode-tab")];
const panels = {
  event: document.querySelector("#eventMode"),
  batch: document.querySelector("#batchMode"),
  model: document.querySelector("#modelMode"),
};

function activateMode(mode) {
  for (const tab of tabs) tab.classList.toggle("active", tab.dataset.mode === mode);
  for (const [key, panel] of Object.entries(panels)) panel.hidden = key !== mode;
  if (mode === "event") window.dispatchEvent(new Event("resize"));
  if (mode === "batch") resizeBatchChart();
}

for (const tab of tabs) tab.addEventListener("click", () => activateMode(tab.dataset.mode));

const beamA = document.querySelector("#beamA");
const beamB = document.querySelector("#beamB");
window.addEventListener("glauber:animation", (event) => {
  const progress = Math.max(0, Math.min(1, event.detail.progress));
  const approach = Math.min(1, progress / 0.38);
  const rebound = progress > 0.72 ? (progress - 0.72) / 0.28 : 0;
  const offset = 70 * (1 - approach) + 18 * rebound;
  beamA.style.transform = `translateX(${-offset}%)`;
  beamB.style.transform = `translateX(${offset}%)`;
});

const sourceList = document.querySelector("#sourceList");
for (const source of MODEL_REFERENCES) {
  const anchor = document.createElement("a");
  anchor.className = "source-item";
  anchor.href = source.url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.innerHTML = `<strong>${source.label}</strong><small>${source.role}</small>`;
  sourceList.append(anchor);
}

const batch = {
  system: document.querySelector("#batchSystem"),
  count: document.querySelector("#batchCount"),
  seed: document.querySelector("#batchSeed"),
  run: document.querySelector("#runBatch"),
  progress: document.querySelector("#batchProgress"),
  progressText: document.querySelector("#batchProgressText"),
  identity: document.querySelector("#batchIdentity"),
  accepted: document.querySelector("#batchAccepted"),
  acceptance: document.querySelector("#batchAcceptance"),
  crossSection: document.querySelector("#batchCrossSection"),
  meanNpart: document.querySelector("#batchMeanNpart"),
  meanNcoll: document.querySelector("#batchMeanNcoll"),
  table: document.querySelector("#centralityTable"),
  chart: document.querySelector("#batchChart"),
};

for (const system of Object.values(COLLISION_SYSTEMS)) {
  const option = document.createElement("option");
  option.value = system.key;
  option.textContent = `${system.label} · √sNN ${(system.sqrtSnnGev / 1000).toFixed(2)} TeV`;
  batch.system.append(option);
}
batch.system.value = "OO";

let lastBatchSummary = null;
let batchRunning = false;

function numberOrDash(value, digits = 2) {
  return value === null || !Number.isFinite(value) ? "—" : value.toFixed(digits);
}

function renderBatchTable(summary) {
  batch.table.replaceChildren();
  for (const bin of summary.centralityBins) {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${bin.key}%</td><td>${bin.trials}</td><td>${bin.accepted}</td><td>${numberOrDash(bin.meanNPart, 2)}</td><td>${numberOrDash(bin.meanNColl, 2)}</td>`;
    batch.table.append(row);
  }
}

function chartTheme(variable, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || fallback;
}

function resizeBatchChart() {
  const canvas = batch.chart;
  if (!canvas || canvas.closest("[hidden]")) return;
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(420, rect.width || 700);
  const height = 320;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.style.height = `${height}px`;
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  drawBatchChart(lastBatchSummary, context, width, height);
}

function drawBatchChart(summary, context = batch.chart.getContext("2d"), width = batch.chart.clientWidth || 700, height = 320) {
  context.clearRect(0, 0, width, height);
  context.fillStyle = chartTheme("--card", "#fff");
  context.fillRect(0, 0, width, height);
  const padding = { left: 52, right: 26, top: 22, bottom: 44 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const textColor = chartTheme("--muted", "#64748b");
  const gridColor = chartTheme("--border", "#cbd5e1");
  context.font = "12px system-ui";
  context.fillStyle = textColor;

  if (!summary) {
    context.textAlign = "center";
    context.fillText("Запусти серію подій, щоб побачити статистику", width / 2, height / 2);
    return;
  }

  const bins = summary.centralityBins;
  const maxima = bins.flatMap((bin) => [bin.meanNPart || 0, bin.meanNColl || 0]);
  const maxValue = Math.max(1, ...maxima) * 1.12;

  context.strokeStyle = gridColor;
  context.lineWidth = 1;
  context.globalAlpha = 0.45;
  for (let tick = 0; tick <= 4; tick += 1) {
    const y = padding.top + plotHeight * (1 - tick / 4);
    context.beginPath(); context.moveTo(padding.left, y); context.lineTo(width - padding.right, y); context.stroke();
    context.globalAlpha = 1;
    context.textAlign = "right";
    context.fillText((maxValue * tick / 4).toFixed(0), padding.left - 8, y + 4);
    context.globalAlpha = 0.45;
  }
  context.globalAlpha = 1;

  const groupWidth = plotWidth / bins.length;
  const barWidth = Math.min(32, groupWidth * 0.28);
  const colors = [chartTheme("--projectile", "#2563eb"), chartTheme("--collision-line", "#f97316")];
  bins.forEach((bin, index) => {
    const center = padding.left + groupWidth * (index + 0.5);
    const values = [bin.meanNPart || 0, bin.meanNColl || 0];
    values.forEach((value, series) => {
      const barHeight = plotHeight * value / maxValue;
      const x = center + (series === 0 ? -barWidth - 2 : 2);
      const y = padding.top + plotHeight - barHeight;
      context.fillStyle = colors[series];
      context.fillRect(x, y, barWidth, barHeight);
    });
    context.fillStyle = textColor;
    context.textAlign = "center";
    context.fillText(`${bin.key}%`, center, height - 18);
  });
}

function renderBatch(summary) {
  lastBatchSummary = summary;
  batch.identity.textContent = `${summary.system.label}, ${summary.trials} trial-подій, seed ${summary.seed}`;
  batch.accepted.textContent = `${summary.accepted}/${summary.trials}`;
  batch.acceptance.textContent = `${(summary.acceptance * 100).toFixed(1)}%`;
  batch.crossSection.textContent = `${summary.crossSectionBarn.toFixed(3)} ± ${summary.crossSectionErrorBarn.toFixed(3)} b`;
  batch.meanNpart.textContent = numberOrDash(summary.means.nPart, 2);
  batch.meanNcoll.textContent = numberOrDash(summary.means.nColl, 2);
  renderBatchTable(summary);
  resizeBatchChart();
}

async function runBatch() {
  if (batchRunning) return;
  const events = Math.max(50, Math.min(5000, Number(batch.count.value) || 500));
  const systemKey = batch.system.value;
  const seed = Number(batch.seed.value) || 0;
  const recommendedMax = systemKey === "PbPb" ? 1000 : 5000;
  const effectiveEvents = Math.min(events, recommendedMax);
  if (effectiveEvents !== events) batch.count.value = String(effectiveEvents);

  batchRunning = true;
  batch.run.disabled = true;
  batch.progress.value = 0;
  batch.progressText.textContent = "Створення minimum-bias ансамблю…";
  const accumulator = createMinimumBiasAccumulator({ systemKey, seed });
  const chunk = systemKey === "PbPb" ? 10 : 25;

  try {
    for (let completed = 0; completed < effectiveEvents; completed += chunk) {
      const count = Math.min(chunk, effectiveEvents - completed);
      accumulator.add(count);
      const done = completed + count;
      batch.progress.value = 100 * done / effectiveEvents;
      batch.progressText.textContent = `${done} із ${effectiveEvents} trial-подій`;
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    const summary = accumulator.summary();
    renderBatch(summary);
    batch.progressText.textContent = `Готово: ${summary.accepted} зіткнень із ${summary.trials} trial-подій.`;
  } catch (error) {
    batch.progressText.textContent = `Помилка: ${error.message}`;
  } finally {
    batchRunning = false;
    batch.run.disabled = false;
  }
}

batch.run.addEventListener("click", runBatch);
window.addEventListener("resize", resizeBatchChart);
resizeBatchChart();
