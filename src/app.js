import {
  accountedSystemMetrics,
  generateParticles,
  magnitude,
  momentumError,
  stepWorld,
  systemMetrics,
} from "./physics.js";

const canvas = document.querySelector("#simulationCanvas");
const context = canvas.getContext("2d");
const controls = {
  particleCount: document.querySelector("#particleCount"),
  restitution: document.querySelector("#restitution"),
  timeScale: document.querySelector("#timeScale"),
  seed: document.querySelector("#seed"),
  particleCountValue: document.querySelector("#particleCountValue"),
  restitutionValue: document.querySelector("#restitutionValue"),
  timeScaleValue: document.querySelector("#timeScaleValue"),
};
const buttons = {
  run: document.querySelector("#runButton"),
  step: document.querySelector("#stepButton"),
  reset: document.querySelector("#resetButton"),
  add: document.querySelector("#addParticleButton"),
  export: document.querySelector("#exportButton"),
};
const metrics = {
  energy: document.querySelector("#energyMetric"),
  momentum: document.querySelector("#momentumMetric"),
  collisions: document.querySelector("#collisionMetric"),
  drift: document.querySelector("#driftMetric"),
  status: document.querySelector("#statusText"),
};
const particleEditor = {
  panel: document.querySelector("#particleEditor"),
  name: document.querySelector("#selectedParticleName"),
  mass: document.querySelector("#selectedMass"),
  charge: document.querySelector("#selectedCharge"),
  vx: document.querySelector("#selectedVx"),
  vy: document.querySelector("#selectedVy"),
  apply: document.querySelector("#applyParticleButton"),
  remove: document.querySelector("#removeParticleButton"),
};

const state = {
  world: {
    width: 900,
    height: 500,
    particles: [],
    restitution: 1,
    boundaryMomentum: { x: 0, y: 0 },
  },
  running: false,
  lastTime: null,
  collisions: 0,
  initialMetrics: null,
  selectedParticle: null,
  dragOffset: null,
  trails: new Map(),
};

function resizeCanvas() {
  const bounds = canvas.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.round(bounds.width * pixelRatio);
  canvas.height = Math.round((bounds.width * 0.56) * pixelRatio);
  canvas.style.height = `${Math.round(bounds.width * 0.56)}px`;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  state.world.width = bounds.width;
  state.world.height = bounds.width * 0.56;
}

function themeColor(variable, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value || fallback;
}

function particleColor(particle) {
  if (particle.charge > 0) return themeColor("--viz-series-2", "#7c3aed");
  if (particle.charge < 0) return themeColor("--viz-series-3", "#0284c7");
  return themeColor("--viz-series-1", "#2563eb");
}

function drawGrid(width, height) {
  context.save();
  context.strokeStyle = themeColor("--viz-border", "#d1d5db");
  context.globalAlpha = 0.35;
  context.lineWidth = 1;
  const spacing = 40;
  for (let x = spacing; x < width; x += spacing) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = spacing; y < height; y += spacing) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
  context.restore();
}

function drawTrail(particle) {
  const trail = state.trails.get(particle.id) || [];
  if (trail.length < 2) return;
  context.save();
  context.strokeStyle = particleColor(particle);
  context.globalAlpha = 0.22;
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(trail[0].x, trail[0].y);
  for (const point of trail.slice(1)) context.lineTo(point.x, point.y);
  context.stroke();
  context.restore();
}

function drawVelocityVector(particle) {
  const factor = 0.22;
  const endX = particle.x + particle.vx * factor;
  const endY = particle.y + particle.vy * factor;
  const angle = Math.atan2(endY - particle.y, endX - particle.x);
  context.save();
  context.strokeStyle = themeColor("--viz-text", "#111827");
  context.fillStyle = context.strokeStyle;
  context.globalAlpha = 0.68;
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(particle.x, particle.y);
  context.lineTo(endX, endY);
  context.stroke();
  context.beginPath();
  context.moveTo(endX, endY);
  context.lineTo(endX - 7 * Math.cos(angle - Math.PI / 6), endY - 7 * Math.sin(angle - Math.PI / 6));
  context.lineTo(endX - 7 * Math.cos(angle + Math.PI / 6), endY - 7 * Math.sin(angle + Math.PI / 6));
  context.closePath();
  context.fill();
  context.restore();
}

function drawParticle(particle) {
  const selected = state.selectedParticle?.id === particle.id;
  context.save();
  context.beginPath();
  context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
  context.fillStyle = particleColor(particle);
  context.globalAlpha = selected ? 1 : 0.82;
  context.fill();
  context.lineWidth = selected ? 4 : 1.5;
  context.strokeStyle = selected
    ? themeColor("--viz-accent", "#2563eb")
    : themeColor("--viz-panel", "#ffffff");
  context.stroke();
  context.globalAlpha = 1;
  context.fillStyle = themeColor("--viz-accent-text", "#ffffff");
  context.font = "600 12px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(particle.id, particle.x, particle.y);
  context.restore();
  drawVelocityVector(particle);
}

function draw() {
  const { width, height, particles } = state.world;
  context.clearRect(0, 0, width, height);
  context.fillStyle = themeColor("--viz-panel", "#ffffff");
  context.fillRect(0, 0, width, height);
  drawGrid(width, height);
  for (const particle of particles) drawTrail(particle);
  for (const particle of particles) drawParticle(particle);
}

function updateTrails() {
  for (const particle of state.world.particles) {
    const trail = state.trails.get(particle.id) || [];
    trail.push({ x: particle.x, y: particle.y });
    if (trail.length > 55) trail.shift();
    state.trails.set(particle.id, trail);
  }
}

function updateMetrics() {
  const current = accountedSystemMetrics(state.world);
  const initial = state.initialMetrics || current;
  const drift = momentumError(initial, current);
  metrics.energy.textContent = current.kineticEnergy.toFixed(2);
  metrics.momentum.textContent = magnitude(current.momentum).toFixed(2);
  metrics.collisions.textContent = String(state.collisions);
  metrics.drift.textContent = drift.toExponential(2);
  const tolerance = 1e-6 * Math.max(1, magnitude(initial.momentum));
  const valid = drift <= tolerance;
  metrics.status.textContent = valid
    ? "Закони збереження виконуються в межах чисельної похибки."
    : "Зафіксовано відхилення імпульсу — експеримент потребує перевірки.";
  metrics.status.dataset.state = valid ? "ok" : "warning";
}

function updateControlLabels() {
  controls.particleCountValue.textContent = controls.particleCount.value;
  controls.restitutionValue.textContent = Number(controls.restitution.value).toFixed(2);
  controls.timeScaleValue.textContent = `${Number(controls.timeScale.value).toFixed(1)}×`;
  state.world.restitution = Number(controls.restitution.value);
}

function resetWorld() {
  state.running = false;
  buttons.run.textContent = "Запустити";
  state.lastTime = null;
  state.collisions = 0;
  state.selectedParticle = null;
  state.trails.clear();
  state.world.boundaryMomentum = { x: 0, y: 0 };
  state.world.particles = generateParticles({
    count: Number(controls.particleCount.value),
    width: state.world.width,
    height: state.world.height,
    seed: Number(controls.seed.value),
  });
  state.initialMetrics = accountedSystemMetrics(state.world);
  hideParticleEditor();
  updateMetrics();
  draw();
}

function advance(seconds) {
  const maxSubstep = 1 / 180;
  let remaining = seconds;
  while (remaining > 0) {
    const dt = Math.min(maxSubstep, remaining);
    state.collisions += stepWorld(state.world, dt);
    remaining -= dt;
  }
  updateTrails();
  updateMetrics();
}

function animationFrame(timestamp) {
  if (state.running) {
    if (state.lastTime === null) state.lastTime = timestamp;
    const elapsed = Math.min(0.05, (timestamp - state.lastTime) / 1000);
    state.lastTime = timestamp;
    advance(elapsed * Number(controls.timeScale.value));
  } else {
    state.lastTime = null;
  }
  draw();
  requestAnimationFrame(animationFrame);
}

function canvasPoint(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: event.clientX - bounds.left,
    y: event.clientY - bounds.top,
  };
}

function findParticleAt(point) {
  return [...state.world.particles]
    .reverse()
    .find((particle) => Math.hypot(point.x - particle.x, point.y - particle.y) <= particle.radius);
}

function showParticleEditor(particle) {
  state.selectedParticle = particle;
  particleEditor.panel.hidden = false;
  particleEditor.name.textContent = particle.id;
  particleEditor.mass.value = particle.mass.toFixed(2);
  particleEditor.charge.value = String(particle.charge);
  particleEditor.vx.value = particle.vx.toFixed(1);
  particleEditor.vy.value = particle.vy.toFixed(1);
}

function hideParticleEditor() {
  particleEditor.panel.hidden = true;
}

function exportExperiment() {
  const payload = {
    version: "0.2.0",
    createdAt: new Date().toISOString(),
    seed: Number(controls.seed.value),
    restitution: state.world.restitution,
    collisions: state.collisions,
    metrics: accountedSystemMetrics(state.world),
    particles: state.world.particles,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `algorithmic-universe-${payload.seed}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

controls.particleCount.addEventListener("input", updateControlLabels);
controls.restitution.addEventListener("input", updateControlLabels);
controls.timeScale.addEventListener("input", updateControlLabels);
buttons.run.addEventListener("click", () => {
  state.running = !state.running;
  buttons.run.textContent = state.running ? "Пауза" : "Запустити";
});
buttons.step.addEventListener("click", () => {
  state.running = false;
  buttons.run.textContent = "Запустити";
  advance(1 / 30);
  draw();
});
buttons.reset.addEventListener("click", resetWorld);
buttons.add.addEventListener("click", () => {
  controls.particleCount.value = Math.min(30, Number(controls.particleCount.value) + 1);
  updateControlLabels();
  resetWorld();
});
buttons.export.addEventListener("click", exportExperiment);

particleEditor.apply.addEventListener("click", () => {
  const particle = state.selectedParticle;
  if (!particle) return;
  const mass = Number(particleEditor.mass.value);
  if (!(mass > 0)) return;
  particle.mass = mass;
  particle.radius = 9 + Math.sqrt(mass) * 5;
  particle.charge = Number(particleEditor.charge.value);
  particle.vx = Number(particleEditor.vx.value);
  particle.vy = Number(particleEditor.vy.value);
  state.initialMetrics = accountedSystemMetrics(state.world);
  state.trails.clear();
  updateMetrics();
  draw();
});
particleEditor.remove.addEventListener("click", () => {
  if (!state.selectedParticle || state.world.particles.length <= 2) return;
  state.world.particles = state.world.particles.filter(
    (particle) => particle.id !== state.selectedParticle.id,
  );
  controls.particleCount.value = String(state.world.particles.length);
  updateControlLabels();
  state.selectedParticle = null;
  state.initialMetrics = accountedSystemMetrics(state.world);
  hideParticleEditor();
  updateMetrics();
});

canvas.addEventListener("pointerdown", (event) => {
  const point = canvasPoint(event);
  const particle = findParticleAt(point);
  if (!particle) {
    state.selectedParticle = null;
    hideParticleEditor();
    return;
  }
  showParticleEditor(particle);
  state.dragOffset = { x: point.x - particle.x, y: point.y - particle.y };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", (event) => {
  if (!state.selectedParticle || !state.dragOffset || !canvas.hasPointerCapture(event.pointerId)) return;
  const point = canvasPoint(event);
  const particle = state.selectedParticle;
  particle.x = Math.max(particle.radius, Math.min(state.world.width - particle.radius, point.x - state.dragOffset.x));
  particle.y = Math.max(particle.radius, Math.min(state.world.height - particle.radius, point.y - state.dragOffset.y));
  particle.vx = 0;
  particle.vy = 0;
  state.trails.set(particle.id, []);
  draw();
});
canvas.addEventListener("pointerup", (event) => {
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  state.dragOffset = null;
  state.initialMetrics = accountedSystemMetrics(state.world);
  updateMetrics();
});

window.addEventListener("resize", () => {
  resizeCanvas();
  resetWorld();
});

resizeCanvas();
updateControlLabels();
resetWorld();
requestAnimationFrame(animationFrame);
