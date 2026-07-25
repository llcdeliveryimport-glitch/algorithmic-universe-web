/**
 * Educational browser implementation of classical Monte Carlo Glauber geometry.
 * It models transverse nucleon overlap only. It does not model partons, QGP,
 * hadronisation, decays, or detector response.
 */

export const PROFILE_CATALOG = Object.freeze({
  p: {
    key: "p",
    label: "proton",
    symbol: "p",
    Z: 1,
    A: 1,
    type: "point",
    maxRadiusFm: 0,
    minimumSeparationFm: 0,
  },
  O16: {
    key: "O16",
    label: "O-16",
    symbol: "O",
    Z: 8,
    A: 16,
    type: "mho",
    alpha: 1.506,
    aFm: 1.819,
    maxRadiusFm: 8,
    minimumSeparationFm: 0.4,
  },
  Ne20: {
    key: "Ne20",
    label: "Ne-20",
    symbol: "Ne",
    Z: 10,
    A: 20,
    type: "woods-saxon",
    radiusFm: 2.805,
    diffusenessFm: 0.571,
    maxRadiusFm: 10,
    minimumSeparationFm: 0.4,
  },
  Pb208: {
    key: "Pb208",
    label: "Pb-208",
    symbol: "Pb",
    Z: 82,
    A: 208,
    type: "woods-saxon",
    radiusFm: 6.624,
    diffusenessFm: 0.549,
    maxRadiusFm: 15,
    minimumSeparationFm: 0.4,
  },
});

export const COLLISION_SYSTEMS = Object.freeze({
  pO: {
    key: "pO",
    label: "p–O",
    projectile: "p",
    target: "O16",
    sqrtSnnGev: 9620,
    defaultSigmaMb: 72,
    bMaxFm: 12,
    geometryPresetsFm: { central: 0, mid: 2.8, edge: 5.2 },
  },
  OO: {
    key: "OO",
    label: "O–O",
    projectile: "O16",
    target: "O16",
    sqrtSnnGev: 5360,
    defaultSigmaMb: 68,
    bMaxFm: 15,
    geometryPresetsFm: { central: 0, mid: 4.0, edge: 7.0 },
  },
  NeNe: {
    key: "NeNe",
    label: "Ne–Ne",
    projectile: "Ne20",
    target: "Ne20",
    sqrtSnnGev: 5360,
    defaultSigmaMb: 68,
    bMaxFm: 16,
    geometryPresetsFm: { central: 0, mid: 4.5, edge: 8.0 },
  },
  PbPb: {
    key: "PbPb",
    label: "Pb–Pb",
    projectile: "Pb208",
    target: "Pb208",
    sqrtSnnGev: 5360,
    defaultSigmaMb: 68,
    bMaxFm: 25,
    geometryPresetsFm: { central: 0, mid: 7.0, edge: 13.0 },
  },
});

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

function density(profile, radiusFm) {
  if (profile.type === "point") return radiusFm === 0 ? 1 : 0;
  if (profile.type === "mho") {
    const scaledSquared = (radiusFm / profile.aFm) ** 2;
    return (1 + profile.alpha * scaledSquared) * Math.exp(-scaledSquared);
  }
  if (profile.type === "woods-saxon") {
    return 1 / (1 + Math.exp((radiusFm - profile.radiusFm) / profile.diffusenessFm));
  }
  throw new Error(`Unknown profile type: ${profile.type}`);
}

function radialWeight(profile, radiusFm) {
  return radiusFm * radiusFm * density(profile, radiusFm);
}

function estimateWeightMaximum(profile) {
  if (profile.type === "point") return 1;
  let maximum = 0;
  const samples = 2048;
  for (let i = 0; i <= samples; i += 1) {
    const radius = (profile.maxRadiusFm * i) / samples;
    maximum = Math.max(maximum, radialWeight(profile, radius));
  }
  return maximum * 1.001;
}

function sampleRadius(profile, random, maximumWeight) {
  if (profile.type === "point") return 0;
  for (let attempt = 0; attempt < 100000; attempt += 1) {
    const radius = random() * profile.maxRadiusFm;
    if (random() * maximumWeight <= radialWeight(profile, radius)) return radius;
  }
  throw new Error(`Could not sample radius for ${profile.label}`);
}

function sampleIsotropicPoint(profile, random, maximumWeight) {
  const radius = sampleRadius(profile, random, maximumWeight);
  if (radius === 0) return { x: 0, y: 0, z: 0 };
  const cosTheta = 2 * random() - 1;
  const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
  const phi = 2 * Math.PI * random();
  return {
    x: radius * sinTheta * Math.cos(phi),
    y: radius * sinTheta * Math.sin(phi),
    z: radius * cosTheta,
  };
}

function distance3d(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y, first.z - second.z);
}

function recenterShiftAll(nucleons) {
  if (nucleons.length <= 1) return nucleons;
  const center = nucleons.reduce(
    (sum, nucleon) => ({
      x: sum.x + nucleon.x,
      y: sum.y + nucleon.y,
      z: sum.z + nucleon.z,
    }),
    { x: 0, y: 0, z: 0 },
  );
  center.x /= nucleons.length;
  center.y /= nucleons.length;
  center.z /= nucleons.length;
  return nucleons.map((nucleon) => ({
    ...nucleon,
    x: nucleon.x - center.x,
    y: nucleon.y - center.y,
    z: nucleon.z - center.z,
  }));
}

export function sampleNucleus(profileKey, random) {
  const profile = PROFILE_CATALOG[profileKey];
  if (!profile) throw new Error(`Unknown nucleus profile: ${profileKey}`);
  if (profile.A === 1) {
    return [{
      id: `${profile.label}-1`,
      type: "proton",
      index: 0,
      x: 0,
      y: 0,
      z: 0,
      collisions: 0,
    }];
  }

  const maximumWeight = estimateWeightMaximum(profile);
  const nucleons = [];
  const minimumDistance = profile.minimumSeparationFm;
  const maxAttempts = profile.A * 25000;
  let attempts = 0;

  while (nucleons.length < profile.A && attempts < maxAttempts) {
    attempts += 1;
    const point = sampleIsotropicPoint(profile, random, maximumWeight);
    const overlaps = minimumDistance > 0 && nucleons.some(
      (existing) => distance3d(existing, point) < minimumDistance,
    );
    if (overlaps) continue;
    const index = nucleons.length;
    nucleons.push({
      id: `${profile.label}-${index + 1}`,
      type: index < profile.Z ? "proton" : "neutron",
      index,
      ...point,
      collisions: 0,
    });
  }

  if (nucleons.length !== profile.A) {
    throw new Error(`Could not place all nucleons for ${profile.label}`);
  }
  return recenterShiftAll(nucleons);
}

export function sampleImpactParameter(random, bMaxFm) {
  if (!(bMaxFm > 0)) throw new Error("bMaxFm must be positive");
  return bMaxFm * Math.sqrt(random());
}

export function mbToFm2(sigmaMb) {
  if (!(sigmaMb > 0) || !Number.isFinite(sigmaMb)) {
    throw new Error("sigmaMb must be finite and positive");
  }
  return sigmaMb * 0.1;
}

function eccentricity(participants, harmonic) {
  if (participants.length < 2) return { magnitude: 0, plane: 0 };
  const center = participants.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
    { x: 0, y: 0 },
  );
  center.x /= participants.length;
  center.y /= participants.length;

  let real = 0;
  let imaginary = 0;
  let denominator = 0;
  for (const point of participants) {
    const x = point.x - center.x;
    const y = point.y - center.y;
    const radius = Math.hypot(x, y);
    const weight = radius ** harmonic;
    const angle = Math.atan2(y, x);
    real += weight * Math.cos(harmonic * angle);
    imaginary += weight * Math.sin(harmonic * angle);
    denominator += weight;
  }
  if (denominator <= 1e-12) return { magnitude: 0, plane: 0 };
  return {
    magnitude: Math.hypot(real, imaginary) / denominator,
    plane: Math.atan2(imaginary, real) / harmonic,
  };
}

function participantArea(participants) {
  if (participants.length < 2) return 0;
  const mean = participants.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
    { x: 0, y: 0 },
  );
  mean.x /= participants.length;
  mean.y /= participants.length;
  let xx = 0;
  let yy = 0;
  let xy = 0;
  for (const point of participants) {
    const x = point.x - mean.x;
    const y = point.y - mean.y;
    xx += x * x;
    yy += y * y;
    xy += x * y;
  }
  xx /= participants.length;
  yy /= participants.length;
  xy /= participants.length;
  return 4 * Math.PI * Math.sqrt(Math.max(0, xx * yy - xy * xy));
}

function shiftNucleus(nucleons, centerX, centerY, side) {
  return nucleons.map((nucleon) => ({
    ...nucleon,
    nucleus: side,
    x: nucleon.x + centerX,
    y: nucleon.y + centerY,
    collisions: 0,
  }));
}

export function generateGlauberEvent({
  systemKey = "OO",
  seed = 20260725,
  trialId = 0,
  impactParameterFm = null,
  sigmaMb = null,
} = {}) {
  const system = COLLISION_SYSTEMS[systemKey];
  if (!system) throw new Error(`Unknown collision system: ${systemKey}`);
  const combinedSeed = (Number(seed) + Math.imul(Number(trialId) + 1, 0x9e3779b1)) >>> 0;
  const random = mulberry32(combinedSeed);
  const sigma = sigmaMb ?? system.defaultSigmaMb;
  const b = impactParameterFm ?? sampleImpactParameter(random, system.bMaxFm);
  if (!(b >= 0) || !Number.isFinite(b)) throw new Error("Impact parameter must be finite and non-negative");
  const interactionRadius = Math.sqrt(mbToFm2(sigma) / Math.PI);

  const projectile = shiftNucleus(
    sampleNucleus(system.projectile, random),
    -b / 2,
    0,
    "projectile",
  );
  const target = shiftNucleus(
    sampleNucleus(system.target, random),
    b / 2,
    0,
    "target",
  );

  const collisions = [];
  for (let i = 0; i < projectile.length; i += 1) {
    for (let j = 0; j < target.length; j += 1) {
      const transverseDistance = Math.hypot(
        projectile[i].x - target[j].x,
        projectile[i].y - target[j].y,
      );
      if (transverseDistance < interactionRadius) {
        projectile[i].collisions += 1;
        target[j].collisions += 1;
        collisions.push({
          projectileIndex: i,
          targetIndex: j,
          distanceFm: transverseDistance,
          x: (projectile[i].x + target[j].x) / 2,
          y: (projectile[i].y + target[j].y) / 2,
          type: `${projectile[i].type[0]}${target[j].type[0]}`,
        });
      }
    }
  }

  const participants = [...projectile, ...target].filter((nucleon) => nucleon.collisions > 0);
  const epsilon2 = eccentricity(participants, 2);
  const epsilon3 = eccentricity(participants, 3);
  const nPartProjectile = projectile.filter((nucleon) => nucleon.collisions > 0).length;
  const nPartTarget = target.filter((nucleon) => nucleon.collisions > 0).length;

  return {
    model: "classical-monte-carlo-glauber-browser-baseline",
    version: "0.5-web-preview",
    system,
    seed: Number(seed),
    trialId: Number(trialId),
    impactParameterFm: b,
    sigmaMb: sigma,
    interactionRadiusFm: interactionRadius,
    accepted: collisions.length > 0,
    projectile,
    target,
    collisions,
    metrics: {
      nPart: participants.length,
      nPartProjectile,
      nPartTarget,
      nSpectators: projectile.length + target.length - participants.length,
      nColl: collisions.length,
      nCollPP: collisions.filter((collision) => collision.type === "pp").length,
      nCollPN: collisions.filter((collision) => collision.type === "pn" || collision.type === "np").length,
      nCollNN: collisions.filter((collision) => collision.type === "nn").length,
      epsilon2: epsilon2.magnitude,
      epsilon3: epsilon3.magnitude,
      psi2: epsilon2.plane,
      psi3: epsilon3.plane,
      participantAreaFm2: participantArea(participants),
    },
  };
}

export function generateAcceptedGlauberEvent({
  systemKey = "OO",
  seed = 20260725,
  trialId = 0,
  impactParameterFm = null,
  sigmaMb = null,
  maxAttempts = 5000,
} = {}) {
  if (!Number.isInteger(maxAttempts) || maxAttempts <= 0) {
    throw new Error("maxAttempts must be a positive integer");
  }
  const startTrialId = Number(trialId);
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const event = generateGlauberEvent({
      systemKey,
      seed,
      trialId: startTrialId + attempt,
      impactParameterFm,
      sigmaMb,
    });
    if (event.accepted) {
      return {
        ...event,
        searchAttempts: attempt + 1,
        searchStartTrialId: startTrialId,
      };
    }
  }
  throw new Error(`No accepted event found in ${maxAttempts} attempts`);
}

export function serializeEvent(event) {
  return JSON.stringify(event, null, 2);
}
