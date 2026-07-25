import {
  COLLISION_SYSTEMS,
  PROFILE_CATALOG,
  generateGlauberEvent,
} from "./glauber.js";

export const COLLIDER_PIPELINE = Object.freeze([
  {
    key: "beam",
    title: "Підготовка пучків",
    status: "context",
    description: "Тип іона, зарядовий стан, енергія на нуклон і шлях через інжекторний комплекс.",
  },
  {
    key: "geometry",
    title: "Геометрія ядер",
    status: "implemented",
    description: "Monte Carlo sampling протонів і нейтронів, impact parameter та орієнтація у поперечній площині.",
  },
  {
    key: "subcollisions",
    title: "Нуклонні субзіткнення",
    status: "implemented",
    description: "Hard-sphere NN overlap із заданим нееластичним перерізом σNN.",
  },
  {
    key: "final-state",
    title: "Кварки, глюони та адрони",
    status: "planned",
    description: "Має бути делеговано PYTHIA 8 / Angantyr або іншому валідованому генератору подій.",
  },
  {
    key: "detector",
    title: "Детектор і реконструкція",
    status: "planned",
    description: "Має бути делеговано Geant4 та окремому шару реконструкції треків, кластерів і джетів.",
  },
]);

export const CERN_ACCELERATOR_CONTEXT = Object.freeze({
  proton: {
    source: "hydrogen / H−",
    chain: ["Linac4", "PSB", "PS", "SPS", "LHC"],
    chargeState: 1,
    note: "Після Linac4 електрони H− видаляються, у подальший ланцюг надходять протони.",
  },
  ion: {
    source: "ion source",
    chain: ["Linac3", "LEIR", "PS", "SPS", "LHC"],
    note: "Іони проходять послідовне прискорення та stripping; у LHC використовують високо заряджені або повністю очищені ядра.",
  },
  sources: [
    "https://home.cern/science/accelerators/the-accelerator-complex/",
    "https://home.cern/how-accelerator-works/",
    "https://home.cern/first-ever-collisions-oxygen-lhc/",
  ],
});

export const MODEL_REFERENCES = Object.freeze([
  {
    label: "CERN accelerator complex",
    url: "https://home.cern/science/accelerators/the-accelerator-complex/",
    role: "інжекторний ланцюг і енергії пучків",
  },
  {
    label: "CERN oxygen/neon campaign",
    url: "https://home.cern/first-ever-collisions-oxygen-lhc/",
    role: "p–O, O–O та Ne–Ne у LHC",
  },
  {
    label: "PYTHIA 8 Heavy Ion / Angantyr",
    url: "https://pythia.org/latest-manual/HeavyIons.html",
    role: "майбутній рівень багатьох NN-субзіткнень і кінцевого стану",
  },
  {
    label: "Geant4 Physics Reference Manual",
    url: "https://geant4.web.cern.ch/documentation/dev/prm_html/PhysicsReferenceManual/hadronic/index.html",
    role: "майбутнє проходження частинок через матерію та детектор",
  },
]);

export function geometricCentralityPercent(event) {
  const bMax = event?.system?.bMaxFm;
  const b = event?.impactParameterFm;
  if (!(bMax > 0) || !(b >= 0)) return null;
  return Math.min(100, Math.max(0, 100 * (b / bMax) ** 2));
}

export function centralityLabel(percent) {
  if (percent === null || !Number.isFinite(percent)) return "невизначена";
  if (percent < 10) return "дуже центральна";
  if (percent < 30) return "центральна";
  if (percent < 50) return "середня";
  if (percent < 70) return "периферійна";
  return "дуже периферійна";
}

export function buildPipelineRecord(event) {
  const projectile = PROFILE_CATALOG[event.system.projectile];
  const target = PROFILE_CATALOG[event.system.target];
  const beamType = projectile.A === 1 && target.A === 1 ? "proton" : "ion";
  return COLLIDER_PIPELINE.map((stage) => {
    if (stage.key === "beam") {
      return {
        ...stage,
        state: "available-context",
        details: {
          projectile: projectile.label,
          target: target.label,
          sqrtSnnGev: event.system.sqrtSnnGev,
          acceleratorChain: CERN_ACCELERATOR_CONTEXT[beamType].chain,
        },
      };
    }
    if (stage.key === "geometry") {
      return {
        ...stage,
        state: "completed",
        details: {
          impactParameterFm: event.impactParameterFm,
          geometricCentralityPercent: geometricCentralityPercent(event),
          projectileNucleons: projectile.A,
          targetNucleons: target.A,
        },
      };
    }
    if (stage.key === "subcollisions") {
      return {
        ...stage,
        state: "completed",
        details: {
          sigmaMb: event.sigmaMb,
          interactionRadiusFm: event.interactionRadiusFm,
          nPart: event.metrics.nPart,
          nColl: event.metrics.nColl,
        },
      };
    }
    return {
      ...stage,
      state: "not-simulated",
      details: null,
    };
  });
}

export function validateGlauberEvent(event) {
  const errors = [];
  const total = event.projectile.length + event.target.length;
  const participantCount = [...event.projectile, ...event.target]
    .filter((nucleon) => nucleon.collisions > 0).length;
  const collisionCount = event.collisions.length;

  if (event.metrics.nPart !== participantCount) {
    errors.push(`nPart=${event.metrics.nPart}, але фактичних учасників ${participantCount}`);
  }
  if (event.metrics.nColl !== collisionCount) {
    errors.push(`nColl=${event.metrics.nColl}, але записано пар ${collisionCount}`);
  }
  if (event.metrics.nPart + event.metrics.nSpectators !== total) {
    errors.push("participants + spectators не дорівнює повній кількості нуклонів");
  }
  const channelTotal = event.metrics.nCollPP + event.metrics.nCollPN + event.metrics.nCollNN;
  if (channelTotal !== event.metrics.nColl) {
    errors.push("сума каналів pp/pn/nn не дорівнює nColl");
  }
  if (event.accepted !== (event.metrics.nColl > 0)) {
    errors.push("accepted не узгоджено з nColl");
  }
  if (!(event.interactionRadiusFm > 0)) {
    errors.push("interactionRadiusFm має бути додатним");
  }

  return {
    valid: errors.length === 0,
    errors,
    checks: {
      totalNucleons: total,
      participants: participantCount,
      collisionPairs: collisionCount,
      channelTotal,
    },
  };
}

function mean(values) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function quantile(values, q) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * q;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function createCentralityBins() {
  return [
    { key: "0-10", min: 0, max: 10 },
    { key: "10-30", min: 10, max: 30 },
    { key: "30-50", min: 30, max: 50 },
    { key: "50-70", min: 50, max: 70 },
    { key: "70-100", min: 70, max: 100.000001 },
  ].map((bin) => ({ ...bin, events: 0, accepted: 0, nPart: [], nColl: [] }));
}

export function createMinimumBiasAccumulator({
  systemKey = "OO",
  seed = 20260725,
  sigmaMb = null,
  startTrialId = 0,
} = {}) {
  const system = COLLISION_SYSTEMS[systemKey];
  if (!system) throw new Error(`Unknown collision system: ${systemKey}`);
  const bins = createCentralityBins();
  const acceptedNPart = [];
  const acceptedNColl = [];
  const acceptedB = [];
  let trials = 0;
  let accepted = 0;

  return {
    add(count = 1) {
      if (!Number.isInteger(count) || count <= 0) throw new Error("count must be a positive integer");
      for (let offset = 0; offset < count; offset += 1) {
        const event = generateGlauberEvent({
          systemKey,
          seed,
          trialId: startTrialId + trials,
          sigmaMb,
        });
        const validation = validateGlauberEvent(event);
        if (!validation.valid) throw new Error(validation.errors.join("; "));
        const centrality = geometricCentralityPercent(event);
        const bin = bins.find((candidate) => centrality >= candidate.min && centrality < candidate.max);
        if (bin) bin.events += 1;
        trials += 1;
        if (!event.accepted) continue;
        accepted += 1;
        acceptedNPart.push(event.metrics.nPart);
        acceptedNColl.push(event.metrics.nColl);
        acceptedB.push(event.impactParameterFm);
        if (bin) {
          bin.accepted += 1;
          bin.nPart.push(event.metrics.nPart);
          bin.nColl.push(event.metrics.nColl);
        }
      }
      return this.summary();
    },
    summary() {
      const acceptance = trials > 0 ? accepted / trials : 0;
      const areaFm2 = Math.PI * system.bMaxFm ** 2;
      const crossSectionBarn = areaFm2 * acceptance / 100;
      const acceptanceError = trials > 0
        ? Math.sqrt(Math.max(0, acceptance * (1 - acceptance) / trials))
        : 0;
      const crossSectionErrorBarn = areaFm2 * acceptanceError / 100;
      return {
        model: "classical-monte-carlo-glauber-minimum-bias",
        version: "0.6-web-preview",
        system,
        seed,
        sigmaMb: sigmaMb ?? system.defaultSigmaMb,
        startTrialId,
        trials,
        accepted,
        acceptance,
        crossSectionBarn,
        crossSectionErrorBarn,
        means: {
          nPart: mean(acceptedNPart),
          nColl: mean(acceptedNColl),
          impactParameterFm: mean(acceptedB),
        },
        quantiles: {
          nPartP10: quantile(acceptedNPart, 0.10),
          nPartMedian: quantile(acceptedNPart, 0.50),
          nPartP90: quantile(acceptedNPart, 0.90),
          nCollP10: quantile(acceptedNColl, 0.10),
          nCollMedian: quantile(acceptedNColl, 0.50),
          nCollP90: quantile(acceptedNColl, 0.90),
        },
        centralityBins: bins.map((bin) => ({
          key: bin.key,
          min: bin.min,
          max: Math.min(100, bin.max),
          trials: bin.events,
          accepted: bin.accepted,
          meanNPart: mean(bin.nPart),
          meanNColl: mean(bin.nColl),
        })),
      };
    },
  };
}

export function simulateMinimumBias({ events = 1000, ...options } = {}) {
  if (!Number.isInteger(events) || events <= 0) {
    throw new Error("events must be a positive integer");
  }
  const accumulator = createMinimumBiasAccumulator(options);
  accumulator.add(events);
  return accumulator.summary();
}
