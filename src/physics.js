/**
 * Browser-safe deterministic 2D collision engine.
 * No framework or external dependency is required.
 */

export const EPSILON = 1e-9;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function magnitude(vector) {
  return Math.hypot(vector.x, vector.y);
}

export function dot(a, b) {
  return a.x * b.x + a.y * b.y;
}

export function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(vector, scalar) {
  return { x: vector.x * scalar, y: vector.y * scalar };
}

export function normalize(vector) {
  const length = magnitude(vector);
  if (length <= EPSILON) return { x: 1, y: 0 };
  return scale(vector, 1 / length);
}

export function createParticle({
  id,
  x,
  y,
  vx,
  vy,
  mass = 1,
  radius = 14,
  charge = 0,
}) {
  if (!id) throw new Error("Particle id is required.");
  if (!(mass > 0) || !Number.isFinite(mass)) {
    throw new Error("Particle mass must be finite and greater than zero.");
  }
  const numericValues = [x, y, vx, vy, radius, charge];
  if (!numericValues.every(Number.isFinite)) {
    throw new Error("Particle values must be finite numbers.");
  }
  if (!(radius > 0)) throw new Error("Particle radius must be positive.");

  return { id, x, y, vx, vy, mass, radius, charge };
}

export function momentumOf(particle) {
  return { x: particle.mass * particle.vx, y: particle.mass * particle.vy };
}

export function kineticEnergyOf(particle) {
  return 0.5 * particle.mass * (particle.vx ** 2 + particle.vy ** 2);
}

export function systemMetrics(particles) {
  return particles.reduce(
    (totals, particle) => {
      const momentum = momentumOf(particle);
      totals.momentum.x += momentum.x;
      totals.momentum.y += momentum.y;
      totals.kineticEnergy += kineticEnergyOf(particle);
      totals.charge += particle.charge;
      return totals;
    },
    { momentum: { x: 0, y: 0 }, kineticEnergy: 0, charge: 0 },
  );
}

export function momentumError(before, after) {
  return magnitude(subtract(after.momentum, before.momentum));
}

/** Resolve a smooth-sphere collision while preserving linear momentum. */
export function resolveCollision(first, second, restitution = 1) {
  restitution = clamp(restitution, 0, 1);

  const displacement = { x: second.x - first.x, y: second.y - first.y };
  const distance = magnitude(displacement);
  const minimumDistance = first.radius + second.radius;
  if (distance > minimumDistance + EPSILON) return false;

  const normal = normalize(displacement);
  const relativeVelocity = {
    x: first.vx - second.vx,
    y: first.vy - second.vy,
  };
  const approachingSpeed = dot(relativeVelocity, normal);

  // Positional correction prevents repeated collision impulses caused by overlap.
  const overlap = Math.max(0, minimumDistance - distance);
  if (overlap > 0) {
    const totalMass = first.mass + second.mass;
    const firstShare = second.mass / totalMass;
    const secondShare = first.mass / totalMass;
    first.x -= normal.x * overlap * firstShare;
    first.y -= normal.y * overlap * firstShare;
    second.x += normal.x * overlap * secondShare;
    second.y += normal.y * overlap * secondShare;
  }

  if (approachingSpeed <= 0) return false;

  const impulseMagnitude =
    ((1 + restitution) * approachingSpeed) /
    (1 / first.mass + 1 / second.mass);
  const impulse = scale(normal, impulseMagnitude);

  first.vx -= impulse.x / first.mass;
  first.vy -= impulse.y / first.mass;
  second.vx += impulse.x / second.mass;
  second.vy += impulse.y / second.mass;
  return true;
}

export function applyBoundaryCollision(particle, width, height, restitution = 1) {
  let collided = false;
  restitution = clamp(restitution, 0, 1);
  const momentumBefore = momentumOf(particle);

  if (particle.x - particle.radius < 0) {
    particle.x = particle.radius;
    particle.vx = Math.abs(particle.vx) * restitution;
    collided = true;
  } else if (particle.x + particle.radius > width) {
    particle.x = width - particle.radius;
    particle.vx = -Math.abs(particle.vx) * restitution;
    collided = true;
  }

  if (particle.y - particle.radius < 0) {
    particle.y = particle.radius;
    particle.vy = Math.abs(particle.vy) * restitution;
    collided = true;
  } else if (particle.y + particle.radius > height) {
    particle.y = height - particle.radius;
    particle.vy = -Math.abs(particle.vy) * restitution;
    collided = true;
  }

  const momentumAfter = momentumOf(particle);
  return {
    collided,
    impulseOnParticle: subtract(momentumAfter, momentumBefore),
  };
}

export function accountedSystemMetrics(world) {
  const particleMetrics = systemMetrics(world.particles);
  const boundaryMomentum = world.boundaryMomentum || { x: 0, y: 0 };
  return {
    ...particleMetrics,
    momentum: add(particleMetrics.momentum, boundaryMomentum),
  };
}

export function stepWorld(world, dt) {
  const { particles, width, height, restitution } = world;
  if (!world.boundaryMomentum) world.boundaryMomentum = { x: 0, y: 0 };
  for (const particle of particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    const boundary = applyBoundaryCollision(particle, width, height, restitution);
    // The wall receives the equal and opposite impulse.
    world.boundaryMomentum.x -= boundary.impulseOnParticle.x;
    world.boundaryMomentum.y -= boundary.impulseOnParticle.y;
  }

  let collisionCount = 0;
  for (let i = 0; i < particles.length; i += 1) {
    for (let j = i + 1; j < particles.length; j += 1) {
      if (resolveCollision(particles[i], particles[j], restitution)) {
        collisionCount += 1;
      }
    }
  }
  return collisionCount;
}

/** Small deterministic pseudo-random generator for reproducible experiments. */
export function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateParticles({ count, width, height, seed }) {
  const random = mulberry32(seed);
  const particles = [];
  const maxAttempts = count * 100;
  let attempts = 0;

  while (particles.length < count && attempts < maxAttempts) {
    attempts += 1;
    const mass = 0.6 + random() * 3.4;
    const radius = 9 + Math.sqrt(mass) * 5;
    const angle = random() * Math.PI * 2;
    const speed = 35 + random() * 95;
    const candidate = createParticle({
      id: `P${particles.length + 1}`,
      x: radius + random() * Math.max(1, width - radius * 2),
      y: radius + random() * Math.max(1, height - radius * 2),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      mass,
      radius,
      charge: Math.round(random() * 2 - 1),
    });

    const overlaps = particles.some((particle) => {
      const distance = Math.hypot(candidate.x - particle.x, candidate.y - particle.y);
      return distance < candidate.radius + particle.radius + 4;
    });
    if (!overlaps) particles.push(candidate);
  }

  if (particles.length !== count) {
    throw new Error("Could not place all particles without overlap.");
  }
  return particles;
}
