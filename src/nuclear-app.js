import {
  COLLISION_SYSTEMS,
  PROFILE_CATALOG,
  generateGlauberEvent,
  serializeEvent,
} from "./glauber.js";

const canvas = document.querySelector("#nuclearCanvas");
const context = canvas.getContext("2d");
const systemSelect = document.querySelector("#systemSelect");
const impactSlider = document.querySelector("#impactParameter");
const impactValue = document.querySelector("#impactValue");
const randomImpact = document.querySelector("#randomImpact");
const sigmaInput = document.querySelector("#sigmaMb");
const seedInput = document.querySelector("#nuclearSeed");
const trialInput = document.querySelector("#trialId");
const generateButton = document.querySelector("#generateEvent");
const nextButton = document.querySelector("#nextEvent");
const exportButton = document.querySelector("#exportNuclearEvent");
const statusBox = document.querySelector("#nuclearStatus");
const systemDescription = document.querySelector("#systemDescription");

const metricElements = {
  nPart: document.querySelector("#nPartMetric"),
  nColl: document.querySelector("#nCollMetric"),
  spectators: document.querySelector("#spectatorMetric"),
  epsilon2: document.querySelector("#epsilon2Metric"),
  epsilon3: document.querySelector("#epsilon3Metric"),
  area: document.querySelector("#areaMetric"),
  b: document.querySelector("#bMetric"),
  channels: document.querySelector("#channelsMetric"),
};

let currentEvent = null;

function fillSystems() {
  for (const system of Object.values(COLLISION_SYSTEMS)) {
    const option = document.createElement("option");
    option.value = system.key;
    option.textContent = `${system.label} · √sNN ${system.sqrtSnnGev / 1000} TeV`;
    systemSelect.append(option);
  }
  systemSelect.value = "OO";
}

function updateSystemControls() {
  const system = COLLISION_SYSTEMS[systemSelect.value];
  impactSlider.max = String(system.bMaxFm);
  impactSlider.value = String(Math.min(Number(impactSlider.value), system.bMaxFm));
  sigmaInput.value = String(system.defaultSigmaMb);
  const projectile = PROFILE_CATALOG[system.projectile];
  const target = PROFILE_CATALOG[system.target];
  systemDescription.textContent = `${projectile.label}: ${projectile.Z} p + ${projectile.A - projectile.Z} n; ${target.label}: ${target.Z} p + ${target.A - target.Z} n. Поперечний переріз у момент найближчого проходження.`;
  updateImpactLabel();
}

function updateImpactLabel() {
  impactValue.textContent = randomImpact.checked
    ? "випадково"
    : `${Number(impactSlider.value).toFixed(2)} fm`;
  impactSlider.disabled = randomImpact.checked;
}

function resizeCanvas() {
  const bounds = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const logicalWidth = bounds.width;
  const logicalHeight = Math.max(460, Math.min(660, logicalWidth * 0.68));
  canvas.width = Math.round(logicalWidth * ratio);
  canvas.height = Math.round(logicalHeight * ratio);
  canvas.style.height = `${logicalHeight}px`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  draw();
}

function theme(variable, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || fallback;
}

function participantColor(nucleon) {
  if (nucleon.collisions > 0) return theme("--participant", "#ef4444");
  if (nucleon.type === "proton") return theme("--proton", "#2563eb");
  return theme("--neutron", "#64748b");
}

function computeBounds(event) {
  const all = [...event.projectile, ...event.target];
  const maxCoordinate = Math.max(
    2,
    ...all.flatMap((nucleon) => [Math.abs(nucleon.x), Math.abs(nucleon.y)]),
  );
  const system = event.system;
  const maxProfileRadius = Math.max(
    PROFILE_CATALOG[system.projectile].maxRadiusFm,
    PROFILE_CATALOG[system.target].maxRadiusFm,
  );
  return Math.max(maxCoordinate + 2, maxProfileRadius + event.impactParameterFm / 2 + 1);
}

function drawGrid(width, height, scale, centerX, centerY) {
  context.save();
  context.strokeStyle = theme("--viz-border", "#cbd5e1");
  context.globalAlpha = 0.35;
  context.lineWidth = 1;
  const fmStep = scale > 35 ? 1 : 2;
  for (let fm = -30; fm <= 30; fm += fmStep) {
    const x = centerX + fm * scale;
    const y = centerY + fm * scale;
    if (x >= 0 && x <= width) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    if (y >= 0 && y <= height) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
  }
  context.globalAlpha = 0.75;
  context.strokeStyle = theme("--viz-text", "#334155");
  context.beginPath();
  context.moveTo(centerX, 0);
  context.lineTo(centerX, height);
  context.moveTo(0, centerY);
  context.lineTo(width, centerY);
  context.stroke();
  context.restore();
}

function drawNucleusEnvelope(centerFm, profileKey, scale, centerX, centerY, side) {
  const profile = PROFILE_CATALOG[profileKey];
  const radiusFm = profile.type === "point"
    ? 0.8
    : profile.type === "woods-saxon"
      ? profile.radiusFm + 2 * profile.diffusenessFm
      : profile.aFm * 2.1;
  context.save();
  context.beginPath();
  context.arc(centerX + centerFm * scale, centerY, radiusFm * scale, 0, Math.PI * 2);
  context.fillStyle = side === "projectile"
    ? theme("--projectile-soft", "rgba(37,99,235,.08)")
    : theme("--target-soft", "rgba(124,58,237,.08)");
  context.strokeStyle = side === "projectile"
    ? theme("--projectile-line", "#2563eb")
    : theme("--target-line", "#7c3aed");
  context.lineWidth = 2;
  context.setLineDash([7, 6]);
  context.fill();
  context.stroke();
  context.restore();
}

function drawCollisionLines(event, scale, centerX, centerY) {
  context.save();
  context.strokeStyle = theme("--collision-line", "#f97316");
  context.globalAlpha = 0.35;
  context.lineWidth = 1;
  for (const collision of event.collisions.slice(0, 800)) {
    const first = event.projectile[collision.projectileIndex];
    const second = event.target[collision.targetIndex];
    context.beginPath();
    context.moveTo(centerX + first.x * scale, centerY + first.y * scale);
    context.lineTo(centerX + second.x * scale, centerY + second.y * scale);
    context.stroke();
  }
  context.restore();
}

function drawNucleon(nucleon, scale, centerX, centerY) {
  const x = centerX + nucleon.x * scale;
  const y = centerY + nucleon.y * scale;
  const radius = Math.max(3.2, Math.min(7.5, scale * 0.16));
  context.save();
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fillStyle = participantColor(nucleon);
  context.globalAlpha = nucleon.collisions > 0 ? 0.96 : 0.78;
  context.fill();
  context.lineWidth = nucleon.collisions > 0 ? 1.6 : 0.8;
  context.strokeStyle = nucleon.nucleus === "projectile"
    ? theme("--projectile-line", "#1d4ed8")
    : theme("--target-line", "#6d28d9");
  context.stroke();
  if (nucleon.collisions > 1 && radius >= 5) {
    context.fillStyle = "#fff";
    context.font = "600 8px system-ui";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(String(nucleon.collisions), x, y);
  }
  context.restore();
}

function draw() {
  const width = canvas.clientWidth || 900;
  const height = Number.parseFloat(canvas.style.height) || 560;
  context.clearRect(0, 0, width, height);
  context.fillStyle = theme("--viz-panel", "#fff");
  context.fillRect(0, 0, width, height);
  const centerX = width / 2;
  const centerY = height / 2;

  if (!currentEvent) {
    context.fillStyle = theme("--viz-muted", "#64748b");
    context.font = "500 17px system-ui";
    context.textAlign = "center";
    context.fillText("Згенеруйте першу ядерну подію", centerX, centerY);
    return;
  }

  const maxFm = computeBounds(currentEvent);
  const scale = Math.min((width * 0.43) / maxFm, (height * 0.43) / maxFm);
  drawGrid(width, height, scale, centerX, centerY);
  drawNucleusEnvelope(-currentEvent.impactParameterFm / 2, currentEvent.system.projectile, scale, centerX, centerY, "projectile");
  drawNucleusEnvelope(currentEvent.impactParameterFm / 2, currentEvent.system.target, scale, centerX, centerY, "target");
  drawCollisionLines(currentEvent, scale, centerX, centerY);
  for (const nucleon of currentEvent.projectile) drawNucleon(nucleon, scale, centerX, centerY);
  for (const nucleon of currentEvent.target) drawNucleon(nucleon, scale, centerX, centerY);

  context.save();
  context.fillStyle = theme("--viz-text", "#334155");
  context.font = "600 13px system-ui";
  context.textAlign = "left";
  context.fillText(`b = ${currentEvent.impactParameterFm.toFixed(2)} fm`, 14, 22);
  context.textAlign = "right";
  context.fillText(`σNN = ${currentEvent.sigmaMb.toFixed(1)} mb`, width - 14, 22);
  context.restore();
}

function updateMetrics() {
  const metrics = currentEvent.metrics;
  metricElements.nPart.textContent = String(metrics.nPart);
  metricElements.nColl.textContent = String(metrics.nColl);
  metricElements.spectators.textContent = String(metrics.nSpectators);
  metricElements.epsilon2.textContent = metrics.epsilon2.toFixed(3);
  metricElements.epsilon3.textContent = metrics.epsilon3.toFixed(3);
  metricElements.area.textContent = `${metrics.participantAreaFm2.toFixed(2)} fm²`;
  metricElements.b.textContent = `${currentEvent.impactParameterFm.toFixed(2)} fm`;
  metricElements.channels.textContent = `${metrics.nCollPP}/${metrics.nCollPN}/${metrics.nCollNN}`;
  statusBox.dataset.state = currentEvent.accepted ? "ok" : "warning";
  statusBox.textContent = currentEvent.accepted
    ? `Подія прийнята: ${metrics.nPart} нуклонів-учасників утворили ${metrics.nColl} бінарних зіткнень.`
    : "У цій геометричній конфігурації нуклон-нуклонних зіткнень не виникло. Зменште b або згенеруйте іншу подію.";
}

function generate() {
  const system = COLLISION_SYSTEMS[systemSelect.value];
  const manualB = randomImpact.checked ? null : Number(impactSlider.value);
  currentEvent = generateGlauberEvent({
    systemKey: system.key,
    seed: Number(seedInput.value),
    trialId: Number(trialInput.value),
    impactParameterFm: manualB,
    sigmaMb: Number(sigmaInput.value),
  });
  if (randomImpact.checked) {
    impactSlider.value = String(Math.min(system.bMaxFm, currentEvent.impactParameterFm));
  }
  updateImpactLabel();
  updateMetrics();
  draw();
}

function nextEvent() {
  trialInput.value = String(Number(trialInput.value) + 1);
  generate();
}

function exportEvent() {
  if (!currentEvent) return;
  const blob = new Blob([serializeEvent(currentEvent)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `glauber-${currentEvent.system.key}-${currentEvent.seed}-${currentEvent.trialId}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

fillSystems();
updateSystemControls();
randomImpact.addEventListener("change", updateImpactLabel);
impactSlider.addEventListener("input", updateImpactLabel);
systemSelect.addEventListener("change", () => {
  updateSystemControls();
  trialInput.value = "0";
  generate();
});
generateButton.addEventListener("click", generate);
nextButton.addEventListener("click", nextEvent);
exportButton.addEventListener("click", exportEvent);
window.addEventListener("resize", resizeCanvas);
resizeCanvas();
generate();
