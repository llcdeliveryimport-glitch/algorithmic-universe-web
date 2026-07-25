import {
  COLLISION_SYSTEMS,
  PROFILE_CATALOG,
  generateAcceptedGlauberEvent,
  generateGlauberEvent,
  serializeEvent,
} from "./glauber.js";
import {
  centralityLabel,
  geometricCentralityPercent,
  validateGlauberEvent,
} from "./collider.js";
import { normalizeGlauberEvent } from "./model-v06.js";

const canvas = document.querySelector("#nuclearCanvas");
const context = canvas.getContext("2d");
const controls = {
  system: document.querySelector("#systemSelect"),
  geometry: document.querySelector("#geometrySelect"),
  impact: document.querySelector("#impactParameter"),
  impactValue: document.querySelector("#impactValue"),
  impactControl: document.querySelector("#impactControl"),
  acceptedOnly: document.querySelector("#acceptedOnly"),
  sigma: document.querySelector("#sigmaMb"),
  seed: document.querySelector("#nuclearSeed"),
  trial: document.querySelector("#trialId"),
};
const buttons = {
  generate: document.querySelector("#generateEvent"),
  next: document.querySelector("#nextEvent"),
  replay: document.querySelector("#replayEvent"),
  export: document.querySelector("#exportNuclearEvent"),
};
const text = {
  status: document.querySelector("#nuclearStatus"),
  systemDescription: document.querySelector("#systemDescription"),
  plainSummary: document.querySelector("#plainSummary"),
  eventIdentity: document.querySelector("#eventIdentity"),
  eventBadge: document.querySelector("#eventBadge"),
  searchInfo: document.querySelector("#searchInfo"),
};
const metrics = {
  nPart: document.querySelector("#nPartMetric"),
  nColl: document.querySelector("#nCollMetric"),
  spectators: document.querySelector("#spectatorMetric"),
  epsilon2: document.querySelector("#epsilon2Metric"),
  epsilon3: document.querySelector("#epsilon3Metric"),
  area: document.querySelector("#areaMetric"),
  b: document.querySelector("#bMetric"),
  channels: document.querySelector("#channelsMetric"),
  centrality: document.querySelector("#centralityMetric"),
  validation: document.querySelector("#validationMetric"),
};
const stageItems = [...document.querySelectorAll(".stage-item")];

let currentEvent = null;
let animationStart = 0;
let animationProgress = 1;
let animationFrameId = null;
let lastTransform = null;
const tooltip = document.querySelector("#nucleonTooltip");

function fillSystems() {
  for (const system of Object.values(COLLISION_SYSTEMS)) {
    const option = document.createElement("option");
    option.value = system.key;
    option.textContent = `${system.label} · √sNN ${(system.sqrtSnnGev / 1000).toFixed(2)} TeV`;
    controls.system.append(option);
  }
  controls.system.value = "OO";
}

function updateSystemControls() {
  const system = COLLISION_SYSTEMS[controls.system.value];
  controls.impact.max = String(system.bMaxFm);
  controls.sigma.value = String(system.defaultSigmaMb);
  const projectile = PROFILE_CATALOG[system.projectile];
  const target = PROFILE_CATALOG[system.target];
  text.systemDescription.textContent = `${projectile.label}: ${projectile.Z} протонів + ${projectile.A - projectile.Z} нейтронів. ${target.label}: ${target.Z} протонів + ${target.A - target.Z} нейтронів.`;
  updateGeometryControls();
}

function geometryImpact(system) {
  const mode = controls.geometry.value;
  if (mode === "random") return null;
  if (mode === "manual") return Number(controls.impact.value);
  return system.geometryPresetsFm[mode];
}

function updateGeometryControls() {
  const system = COLLISION_SYSTEMS[controls.system.value];
  const isManual = controls.geometry.value === "manual";
  controls.impactControl.hidden = !isManual;
  if (!isManual) {
    const value = geometryImpact(system);
    controls.impactValue.textContent = value === null ? "випадково" : `${value.toFixed(2)} fm`;
  } else {
    controls.impactValue.textContent = `${Number(controls.impact.value).toFixed(2)} fm`;
  }
}

function resizeCanvas() {
  const bounds = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const logicalWidth = bounds.width;
  const logicalHeight = Math.max(510, Math.min(720, logicalWidth * 0.70));
  canvas.width = Math.round(logicalWidth * ratio);
  canvas.height = Math.round(logicalHeight * ratio);
  canvas.style.height = `${logicalHeight}px`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  draw();
}

function theme(variable, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || fallback;
}

function nucleusColor(nucleon) {
  return nucleon.nucleus === "projectile"
    ? theme("--projectile", "#2563eb")
    : theme("--target", "#7c3aed");
}

function computeBounds(event) {
  const all = [...event.projectile, ...event.target];
  const maxCoordinate = Math.max(2, ...all.flatMap((n) => [Math.abs(n.x), Math.abs(n.y)]));
  const maxProfileRadius = Math.max(
    PROFILE_CATALOG[event.system.projectile].maxRadiusFm,
    PROFILE_CATALOG[event.system.target].maxRadiusFm,
  );
  return Math.max(maxCoordinate + 2, maxProfileRadius + event.impactParameterFm / 2 + 1);
}

function drawGrid(width, height, scale, centerX, centerY) {
  context.save();
  context.strokeStyle = theme("--viz-border", "#cbd5e1");
  context.globalAlpha = 0.26;
  context.lineWidth = 1;
  const fmStep = scale > 35 ? 1 : 2;
  for (let fm = -30; fm <= 30; fm += fmStep) {
    const x = centerX + fm * scale;
    const y = centerY + fm * scale;
    if (x >= 0 && x <= width) {
      context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
    }
    if (y >= 0 && y <= height) {
      context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
    }
  }
  context.restore();
}

function envelopeRadius(profileKey) {
  const profile = PROFILE_CATALOG[profileKey];
  if (profile.type === "point") return 0.8;
  if (profile.type === "woods-saxon") return profile.radiusFm + 2 * profile.diffusenessFm;
  return profile.aFm * 2.1;
}

function drawEnvelope(centerFm, profileKey, scale, centerX, centerY, side) {
  const radius = envelopeRadius(profileKey) * scale;
  const x = centerX + centerFm * scale;
  const color = side === "projectile" ? theme("--projectile", "#2563eb") : theme("--target", "#7c3aed");
  const soft = side === "projectile" ? theme("--projectile-soft", "rgba(37,99,235,.1)") : theme("--target-soft", "rgba(124,58,237,.1)");
  context.save();
  context.beginPath(); context.arc(x, centerY, radius, 0, Math.PI * 2);
  context.fillStyle = soft; context.strokeStyle = color; context.lineWidth = 2;
  context.setLineDash([7, 6]); context.fill(); context.stroke(); context.setLineDash([]);
  context.fillStyle = color; context.font = "700 13px system-ui"; context.textAlign = "center";
  context.fillText(side === "projectile" ? "Ядро 1" : "Ядро 2", x, centerY - radius - 12);
  context.restore();
}

function drawImpactArrow(event, scale, centerX, centerY) {
  const x1 = centerX - event.impactParameterFm * scale / 2;
  const x2 = centerX + event.impactParameterFm * scale / 2;
  const y = 42;
  context.save();
  context.strokeStyle = theme("--viz-text", "#334155");
  context.fillStyle = context.strokeStyle;
  context.globalAlpha = 0.8;
  context.lineWidth = 1.5;
  context.beginPath(); context.moveTo(x1, y); context.lineTo(x2, y); context.stroke();
  for (const [x, direction] of [[x1, 1], [x2, -1]]) {
    context.beginPath(); context.moveTo(x, y); context.lineTo(x + 7 * direction, y - 4); context.lineTo(x + 7 * direction, y + 4); context.closePath(); context.fill();
  }
  context.font = "700 12px system-ui"; context.textAlign = "center";
  context.fillText(`b = ${event.impactParameterFm.toFixed(2)} fm`, (x1 + x2) / 2, y - 9);
  context.restore();
}

function drawCollisionRegion(event, scale, centerX, centerY, progress) {
  if (!event.accepted || progress < 0.35) return;
  const points = event.collisions.map((c) => ({ x: centerX + c.x * scale, y: centerY + c.y * scale }));
  const mean = points.reduce((s, p) => ({ x: s.x + p.x, y: s.y + p.y }), { x: 0, y: 0 });
  mean.x /= points.length; mean.y /= points.length;
  const radius = Math.max(28, ...points.map((p) => Math.hypot(p.x - mean.x, p.y - mean.y)) + 18);
  context.save();
  const gradient = context.createRadialGradient(mean.x, mean.y, 0, mean.x, mean.y, radius);
  gradient.addColorStop(0, `rgba(249,115,22,${0.18 * progress})`);
  gradient.addColorStop(1, "rgba(249,115,22,0)");
  context.fillStyle = gradient; context.beginPath(); context.arc(mean.x, mean.y, radius, 0, Math.PI * 2); context.fill();
  context.restore();
}

function drawCollisionLines(event, scale, centerX, centerY, progress) {
  if (progress < 0.32) return;
  const reveal = Math.min(1, (progress - 0.32) / 0.38);
  const visibleCount = Math.ceil(event.collisions.length * reveal);
  context.save();
  context.strokeStyle = theme("--collision-line", "#f97316");
  context.globalAlpha = 0.28 + 0.45 * reveal;
  context.lineWidth = 1.5;
  for (const collision of event.collisions.slice(0, visibleCount)) {
    const first = event.projectile[collision.projectileIndex];
    const second = event.target[collision.targetIndex];
    context.beginPath();
    context.moveTo(centerX + first.x * scale, centerY + first.y * scale);
    context.lineTo(centerX + second.x * scale, centerY + second.y * scale);
    context.stroke();
  }
  context.restore();
}

function roundedSquare(x, y, radius) {
  const r = radius * 0.34;
  context.beginPath();
  context.roundRect(x - radius, y - radius, radius * 2, radius * 2, r);
}

function drawNucleon(nucleon, scale, centerX, centerY, progress) {
  const x = centerX + nucleon.x * scale;
  const y = centerY + nucleon.y * scale;
  const radius = Math.max(3.4, Math.min(7.2, scale * 0.17));
  const participantReveal = Math.max(0, Math.min(1, (progress - 0.62) / 0.28));
  const isParticipant = nucleon.collisions > 0;
  context.save();
  if (nucleon.type === "proton") {
    context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2);
  } else {
    roundedSquare(x, y, radius * 0.88);
  }
  context.fillStyle = nucleusColor(nucleon);
  context.globalAlpha = isParticipant ? 0.96 : 0.66;
  context.fill();
  context.globalAlpha = 1;
  context.strokeStyle = nucleusColor(nucleon); context.lineWidth = 0.8; context.stroke();
  if (isParticipant && participantReveal > 0) {
    context.shadowColor = theme("--participant", "#dc2626");
    context.shadowBlur = 8 * participantReveal;
    context.strokeStyle = theme("--participant", "#dc2626");
    context.lineWidth = 2.5 * participantReveal + 1;
    context.beginPath(); context.arc(x, y, radius + 3, 0, Math.PI * 2); context.stroke();
    context.shadowBlur = 0;
  }
  if (isParticipant && nucleon.collisions > 1 && radius >= 5 && participantReveal > 0.75) {
    context.fillStyle = "#fff"; context.font = "700 8px system-ui"; context.textAlign = "center"; context.textBaseline = "middle";
    context.fillText(String(nucleon.collisions), x, y);
  }
  context.restore();
}

function drawNoCollisionMessage(width, height) {
  context.save();
  context.fillStyle = theme("--warning", "#a35a00");
  context.font = "800 19px system-ui"; context.textAlign = "center";
  context.fillText("Ядра пролетіли повз — взаємодій немає", width / 2, height - 35);
  context.restore();
}

function draw() {
  const width = canvas.clientWidth || 900;
  const height = Number.parseFloat(canvas.style.height) || 560;
  context.clearRect(0, 0, width, height);
  context.fillStyle = theme("--viz-panel", "#fff"); context.fillRect(0, 0, width, height);
  const centerX = width / 2; const centerY = height / 2 + 18;
  if (!currentEvent) return;
  const maxFm = computeBounds(currentEvent);
  const scale = Math.min((width * 0.43) / maxFm, (height * 0.39) / maxFm);
  lastTransform = { scale, centerX, centerY };
  drawGrid(width, height, scale, centerX, centerY);
  drawImpactArrow(currentEvent, scale, centerX, centerY);
  drawEnvelope(-currentEvent.impactParameterFm / 2, currentEvent.system.projectile, scale, centerX, centerY, "projectile");
  drawEnvelope(currentEvent.impactParameterFm / 2, currentEvent.system.target, scale, centerX, centerY, "target");
  drawCollisionRegion(currentEvent, scale, centerX, centerY, animationProgress);
  drawCollisionLines(currentEvent, scale, centerX, centerY, animationProgress);
  for (const nucleon of currentEvent.projectile) drawNucleon(nucleon, scale, centerX, centerY, animationProgress);
  for (const nucleon of currentEvent.target) drawNucleon(nucleon, scale, centerX, centerY, animationProgress);
  if (!currentEvent.accepted && animationProgress > 0.8) drawNoCollisionMessage(width, height);
}

function setStage(stage) {
  for (const item of stageItems) {
    const number = Number(item.dataset.stage);
    item.classList.toggle("active", number === stage);
    item.classList.toggle("done", number < stage);
  }
}

function animate(timestamp) {
  const duration = 1500;
  animationProgress = Math.min(1, (timestamp - animationStart) / duration);
  setStage(animationProgress < 0.32 ? 1 : animationProgress < 0.72 ? 2 : 3);
  draw();
  window.dispatchEvent(new CustomEvent("glauber:animation", { detail: { progress: animationProgress } }));
  if (animationProgress < 1) animationFrameId = requestAnimationFrame(animate);
}

function replayAnimation() {
  if (!currentEvent) return;
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  animationProgress = 0;
  animationStart = performance.now();
  setStage(1);
  animationFrameId = requestAnimationFrame(animate);
}

function updateResults() {
  const m = currentEvent.metrics;
  metrics.nPart.textContent = String(m.nPart);
  metrics.nColl.textContent = String(m.nColl);
  metrics.spectators.textContent = String(m.nSpectators);
  metrics.epsilon2.textContent = m.epsilon2 === null ? "—" : m.epsilon2.toFixed(3);
  metrics.epsilon3.textContent = m.epsilon3 === null ? "—" : m.epsilon3.toFixed(3);
  metrics.area.textContent = m.participantAreaFm2 === null ? "—" : `${m.participantAreaFm2.toFixed(2)} fm²`;
  metrics.b.textContent = `${currentEvent.impactParameterFm.toFixed(2)} fm`;
  metrics.channels.textContent = `${m.nCollPP}/${m.nCollPN}/${m.nCollNN}`;
  const centrality = geometricCentralityPercent(currentEvent);
  metrics.centrality.textContent = centrality === null ? "—" : `${centrality.toFixed(1)}% · ${centralityLabel(centrality)}`;
  const validation = validateGlauberEvent(currentEvent);
  metrics.validation.textContent = validation.valid ? "Пройдено" : `${validation.errors.length} помилок`;
  metrics.validation.className = validation.valid ? "ok" : "warning";
  text.eventIdentity.textContent = `${currentEvent.system.label}, seed ${currentEvent.seed}, подія ${currentEvent.trialId}`;
  text.eventBadge.dataset.state = currentEvent.accepted ? "ok" : "warning";
  text.eventBadge.textContent = currentEvent.accepted ? "ЗІТКНЕННЯ" : "ПРОЛІТ ПОВЗ";
  text.status.dataset.state = currentEvent.accepted ? "ok" : "warning";
  if (currentEvent.accepted) {
    text.plainSummary.innerHTML = `<strong>${m.nPart} із ${currentEvent.projectile.length + currentEvent.target.length}</strong> нуклонів стали учасниками. Вони утворили <strong>${m.nColl}</strong> парних взаємодій, а <strong>${m.nSpectators}</strong> нуклонів пролетіли повз.`;
    text.status.textContent = `Зіткнення відбулося при b = ${currentEvent.impactParameterFm.toFixed(2)} fm.`;
  } else {
    text.plainSummary.innerHTML = `За такого розташування центри ядер були зміщені настільки, що жодна пара нуклонів не підійшла достатньо близько.`;
    text.status.textContent = "Зменште b, виберіть центральну геометрію або увімкніть режим зіткнення.";
  }
  const attempts = currentEvent.searchAttempts || 1;
  text.searchInfo.textContent = attempts > 1
    ? `Щоб знайти цю подію зі зіткненням, алгоритм перевірив ${attempts} послідовних конфігурацій.`
    : "Подію отримано з першої згенерованої конфігурації.";
}

function buildEvent(startTrial) {
  const system = COLLISION_SYSTEMS[controls.system.value];
  const impact = geometryImpact(system);
  const common = {
    systemKey: system.key,
    seed: Number(controls.seed.value),
    trialId: Number(startTrial),
    impactParameterFm: impact,
    sigmaMb: Number(controls.sigma.value),
  };
  return controls.acceptedOnly.checked
    ? generateAcceptedGlauberEvent({ ...common, maxAttempts: 5000 })
    : generateGlauberEvent(common);
}

function generate(startTrial = Number(controls.trial.value)) {
  buttons.generate.disabled = true;
  try {
    currentEvent = normalizeGlauberEvent(buildEvent(startTrial));
    controls.trial.value = String(currentEvent.trialId);
    controls.impact.value = String(currentEvent.impactParameterFm);
    updateGeometryControls();
    updateResults();
    replayAnimation();
    window.dispatchEvent(new CustomEvent("glauber:event", { detail: { event: currentEvent } }));
  } catch (error) {
    text.status.dataset.state = "warning";
    text.status.textContent = `Не вдалося знайти подію: ${error.message}`;
  } finally {
    buttons.generate.disabled = false;
  }
}

function nextEvent() {
  const nextTrial = currentEvent ? currentEvent.trialId + 1 : Number(controls.trial.value) + 1;
  controls.trial.value = String(nextTrial);
  generate(nextTrial);
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

function closestNucleon(clientX, clientY) {
  if (!currentEvent || !lastTransform) return null;
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  let best = null;
  for (const nucleon of [...currentEvent.projectile, ...currentEvent.target]) {
    const px = lastTransform.centerX + nucleon.x * lastTransform.scale;
    const py = lastTransform.centerY + nucleon.y * lastTransform.scale;
    const distance = Math.hypot(px - x, py - y);
    if (distance <= 12 && (!best || distance < best.distance)) best = { nucleon, distance, px, py };
  }
  return best;
}

function showTooltip(event) {
  const hit = closestNucleon(event.clientX, event.clientY);
  if (!hit) { tooltip.hidden = true; return; }
  const { nucleon } = hit;
  const nucleus = nucleon.nucleus === "projectile" ? "перше ядро" : "друге ядро";
  const type = nucleon.type === "proton" ? "протон" : "нейтрон";
  tooltip.innerHTML = `<strong>${type}</strong> · ${nucleus}<br>зіткнень: <strong>${nucleon.collisions}</strong><br>x=${nucleon.x.toFixed(2)} fm, y=${nucleon.y.toFixed(2)} fm`;
  const rect = canvas.parentElement.getBoundingClientRect();
  tooltip.style.left = `${event.clientX - rect.left + 14}px`;
  tooltip.style.top = `${event.clientY - rect.top + 14}px`;
  tooltip.hidden = false;
}

fillSystems();
updateSystemControls();
controls.geometry.addEventListener("change", () => { updateGeometryControls(); controls.trial.value = "0"; generate(0); });
controls.impact.addEventListener("input", updateGeometryControls);
controls.system.addEventListener("change", () => { controls.trial.value = "0"; updateSystemControls(); generate(0); });
controls.acceptedOnly.addEventListener("change", () => generate(Number(controls.trial.value)));
buttons.generate.addEventListener("click", () => generate(Number(controls.trial.value)));
buttons.next.addEventListener("click", nextEvent);
buttons.replay.addEventListener("click", replayAnimation);
buttons.export.addEventListener("click", exportEvent);
window.addEventListener("resize", resizeCanvas);
canvas.addEventListener("pointermove", showTooltip);
canvas.addEventListener("pointerleave", () => { tooltip.hidden = true; });
resizeCanvas();
generate(0);
