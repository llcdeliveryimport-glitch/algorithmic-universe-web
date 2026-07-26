import {
  CATEGORY_META,
  buildTruthLog,
  etaPhiPoint,
  expandCompactTruthDataset,
  filterParticles,
  speciesRows,
  summarizeVisible,
  transversePoint,
  validateTruthDataset,
} from "./truth-event.js";

const CATEGORY_COLORS = {
  photon: "#f59e0b",
  charged_hadron: "#2563eb",
  neutral_hadron: "#14b8a6",
  baryon: "#7c3aed",
  lepton: "#dc2626",
  nuclear_remnant: "#475569",
  other: "#64748b",
};

const ui = {
  canvas: document.querySelector("#truthCanvas"),
  view: document.querySelector("#viewMode"),
  minPt: document.querySelector("#minPt"),
  minPtValue: document.querySelector("#minPtValue"),
  maxEta: document.querySelector("#maxEta"),
  maxEtaValue: document.querySelector("#maxEtaValue"),
  charge: document.querySelector("#chargeFilter"),
  categories: document.querySelector("#categoryFilters"),
  visible: document.querySelector("#visibleMetric"),
  charged: document.querySelector("#chargedMetric"),
  neutral: document.querySelector("#neutralMetric"),
  maxPt: document.querySelector("#maxPtMetric"),
  tooltip: document.querySelector("#truthTooltip"),
  species: document.querySelector("#speciesTable"),
  log: document.querySelector("#truthLog"),
  logMode: document.querySelector("#logMode"),
  validation: document.querySelector("#datasetValidation"),
  reset: document.querySelector("#resetFilters"),
};

let dataset = null;
let visibleParticles = [];
let hitPoints = [];

function installCategoryFilters() {
  for (const [key, meta] of Object.entries(CATEGORY_META)) {
    if (key === "other") continue;
    const label = document.createElement("label");
    label.className = "truth-filter-chip";
    label.innerHTML = `<input type="checkbox" value="${key}" checked><i style="--chip:${CATEGORY_COLORS[key]}"></i><span>${meta.label}</span>`;
    ui.categories.append(label);
  }
}

function selectedCategories() {
  return new Set([...ui.categories.querySelectorAll("input:checked")].map((input) => input.value));
}

function options() {
  return {
    categories: selectedCategories(),
    minPt: Number(ui.minPt.value),
    maxAbsEta: Number(ui.maxEta.value),
    charge: ui.charge.value,
  };
}

function resizeCanvas() {
  const rect = ui.canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(540, rect.width || 900);
  const height = Math.max(500, Math.min(720, width * 0.62));
  ui.canvas.width = Math.round(width * ratio);
  ui.canvas.height = Math.round(height * ratio);
  ui.canvas.style.height = `${height}px`;
  const context = ui.canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  draw(context, width, height);
}

function canvasTheme(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function drawTransverse(context, width, height) {
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.41;
  context.strokeStyle = canvasTheme("--border", "#cbd5e1");
  context.fillStyle = canvasTheme("--muted", "#64748b");
  context.lineWidth = 1;
  context.globalAlpha = 0.45;
  for (const fraction of [0.25, 0.5, 0.75, 1]) {
    context.beginPath(); context.arc(centerX, centerY, radius * fraction, 0, Math.PI * 2); context.stroke();
  }
  context.beginPath(); context.moveTo(centerX - radius, centerY); context.lineTo(centerX + radius, centerY); context.stroke();
  context.beginPath(); context.moveTo(centerX, centerY - radius); context.lineTo(centerX, centerY + radius); context.stroke();
  context.globalAlpha = 1;
  context.font = "12px system-ui";
  context.fillText("довжина ∝ log(1+pT)", 18, 24);

  hitPoints = [];
  const ordered = [...visibleParticles].sort((a, b) => a.pt - b.pt);
  for (const particle of ordered) {
    const point = transversePoint(particle, centerX, centerY, radius);
    const color = CATEGORY_COLORS[particle.category] || CATEGORY_COLORS.other;
    const opacity = Math.max(0.18, Math.min(0.92, 1 - Math.abs(particle.eta) / 12));
    context.strokeStyle = color;
    context.globalAlpha = opacity;
    context.lineWidth = 0.65 + Math.min(3.2, Math.log1p(particle.pt) * 1.5);
    context.beginPath(); context.moveTo(centerX, centerY); context.lineTo(point.x, point.y); context.stroke();
    context.fillStyle = color;
    context.beginPath(); context.arc(point.x, point.y, 1.7 + Math.min(3, Math.sqrt(particle.pt)), 0, Math.PI * 2); context.fill();
    hitPoints.push({ x: point.x, y: point.y, particle });
  }
  context.globalAlpha = 1;
  context.fillStyle = "#ef4444";
  context.beginPath(); context.arc(centerX, centerY, 5, 0, Math.PI * 2); context.fill();
  context.fillStyle = canvasTheme("--text", "#0f172a");
  context.fillText("точка взаємодії", centerX + 10, centerY - 9);
}

function drawEtaPhi(context, width, height) {
  const padding = 44;
  const etaLimit = Number(ui.maxEta.value);
  context.strokeStyle = canvasTheme("--border", "#cbd5e1");
  context.fillStyle = canvasTheme("--muted", "#64748b");
  context.lineWidth = 1;
  context.font = "11px system-ui";
  for (let i = 0; i <= 4; i += 1) {
    const x = padding + (width - 2 * padding) * i / 4;
    context.beginPath(); context.moveTo(x, padding); context.lineTo(x, height - padding); context.stroke();
    context.fillText(`${(-Math.PI + Math.PI * i / 2).toFixed(1)}`, x - 12, height - 18);
  }
  for (let i = 0; i <= 4; i += 1) {
    const y = padding + (height - 2 * padding) * i / 4;
    context.beginPath(); context.moveTo(padding, y); context.lineTo(width - padding, y); context.stroke();
    context.fillText(`${(etaLimit - etaLimit * i / 2).toFixed(1)}`, 8, y + 4);
  }
  context.fillText("φ", width - 26, height - 18);
  context.fillText("η", 10, 20);
  hitPoints = [];
  for (const particle of visibleParticles) {
    const point = etaPhiPoint(particle, width, height, padding, etaLimit);
    const color = CATEGORY_COLORS[particle.category] || CATEGORY_COLORS.other;
    context.globalAlpha = 0.75;
    context.fillStyle = color;
    const size = 2 + Math.min(7, Math.sqrt(particle.pt) * 2.5);
    context.beginPath(); context.arc(point.x, point.y, size, 0, Math.PI * 2); context.fill();
    hitPoints.push({ x: point.x, y: point.y, particle });
  }
  context.globalAlpha = 1;
}

function draw(context = ui.canvas.getContext("2d"), width = ui.canvas.clientWidth, height = ui.canvas.clientHeight) {
  context.clearRect(0, 0, width, height);
  context.fillStyle = canvasTheme("--card", "#fff");
  context.fillRect(0, 0, width, height);
  if (!dataset) return;
  if (ui.view.value === "etaPhi") drawEtaPhi(context, width, height);
  else drawTransverse(context, width, height);
}

function renderMetrics() {
  const summary = summarizeVisible(visibleParticles);
  ui.visible.textContent = summary.total;
  ui.charged.textContent = summary.charged;
  ui.neutral.textContent = summary.neutral;
  ui.maxPt.textContent = `${summary.maxPt.toFixed(2)} GeV`;
}

function renderSpecies() {
  ui.species.replaceChildren();
  for (const row of speciesRows(visibleParticles).slice(0, 12)) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${row.name}</td><td>${row.pdg}</td><td>${row.count}</td><td>${row.meanPt.toFixed(3)}</td>`;
    ui.species.append(tr);
  }
}

function renderLog() {
  const technical = ui.logMode.value === "technical";
  ui.log.replaceChildren();
  for (const entry of buildTruthLog(dataset, visibleParticles)) {
    const article = document.createElement("article");
    article.className = "truth-log-entry";
    article.innerHTML = `<h3>${entry.title}</h3><p></p>`;
    article.querySelector("p").textContent = technical ? entry.technical : entry.plain;
    ui.log.append(article);
  }
}

function update() {
  if (!dataset) return;
  ui.minPtValue.textContent = `${Number(ui.minPt.value).toFixed(2)} GeV`;
  ui.maxEtaValue.textContent = `|η| ≤ ${Number(ui.maxEta.value).toFixed(1)}`;
  visibleParticles = filterParticles(dataset.particles, options());
  renderMetrics(); renderSpecies(); renderLog(); resizeCanvas();
}

function particleText(particle) {
  return `${particle.name} (PDG ${particle.pdg})\npT ${particle.pt.toFixed(3)} GeV · η ${particle.eta.toFixed(3)} · φ ${particle.phi.toFixed(3)}\nE ${particle.energy.toFixed(3)} GeV · заряд ${particle.charge > 0 ? "+" : ""}${particle.charge}`;
}

ui.canvas.addEventListener("pointermove", (event) => {
  const rect = ui.canvas.getBoundingClientRect();
  const x = event.clientX - rect.left; const y = event.clientY - rect.top;
  let nearest = null; let distance = 12;
  for (const point of hitPoints) {
    const d = Math.hypot(point.x - x, point.y - y);
    if (d < distance) { distance = d; nearest = point; }
  }
  if (!nearest) { ui.tooltip.hidden = true; return; }
  ui.tooltip.hidden = false;
  ui.tooltip.textContent = particleText(nearest.particle);
  ui.tooltip.style.left = `${Math.min(rect.width - 230, x + 14)}px`;
  ui.tooltip.style.top = `${Math.max(8, y - 30)}px`;
});
ui.canvas.addEventListener("pointerleave", () => { ui.tooltip.hidden = true; });

for (const element of [ui.view, ui.minPt, ui.maxEta, ui.charge, ui.categories, ui.logMode]) element.addEventListener("input", update);
ui.reset.addEventListener("click", () => {
  ui.view.value = "transverse"; ui.minPt.value = "0"; ui.maxEta.value = "32"; ui.charge.value = "all";
  for (const box of ui.categories.querySelectorAll("input")) box.checked = true;
  update();
});
window.addEventListener("resize", resizeCanvas);

installCategoryFilters();
fetch("./data/angantyr-po-9.62tev-event0-compact.json")
  .then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
  .then((payload) => {
    const expanded = expandCompactTruthDataset(payload);
    const validation = validateTruthDataset(expanded);
    if (!validation.valid) throw new Error(validation.errors.join("; "));
    dataset = expanded;
    ui.validation.textContent = `Dataset PASS · ${dataset.audit.stable_final_count} status-1 частинок · closure ${dataset.audit.momentum_closure_relative.toExponential(2)}`;
    ui.validation.dataset.state = "ok";
    update();
  })
  .catch((error) => {
    ui.validation.textContent = `Не вдалося прочитати подію: ${error.message}`;
    ui.validation.dataset.state = "error";
  });
