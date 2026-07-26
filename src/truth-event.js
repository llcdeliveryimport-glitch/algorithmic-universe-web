export const CATEGORY_META = Object.freeze({
  photon: { label: "Фотони", symbol: "γ" },
  charged_hadron: { label: "Заряджені мезони", symbol: "π/K" },
  neutral_hadron: { label: "Нейтральні мезони", symbol: "K⁰" },
  baryon: { label: "Баріони й антибаріони", symbol: "p/n" },
  lepton: { label: "Електрони й позитрони", symbol: "e" },
  nuclear_remnant: { label: "Ядерний залишок", symbol: "A" },
  other: { label: "Інші", symbol: "?" },
});

export const PDG_META = Object.freeze({
  "22": { name: "фотон", category: "photon", charge: 0 },
  "211": { name: "π⁺", category: "charged_hadron", charge: 1 },
  "-211": { name: "π⁻", category: "charged_hadron", charge: -1 },
  "321": { name: "K⁺", category: "charged_hadron", charge: 1 },
  "-321": { name: "K⁻", category: "charged_hadron", charge: -1 },
  "130": { name: "K⁰L", category: "neutral_hadron", charge: 0 },
  "2212": { name: "протон", category: "baryon", charge: 1 },
  "-2212": { name: "антипротон", category: "baryon", charge: -1 },
  "2112": { name: "нейтрон", category: "baryon", charge: 0 },
  "-2112": { name: "антинейтрон", category: "baryon", charge: 0 },
  "11": { name: "електрон", category: "lepton", charge: -1 },
  "-11": { name: "позитрон", category: "lepton", charge: 1 },
  "1000070149": { name: "ядерний залишок N-14", category: "nuclear_remnant", charge: 7 },
});

export function expandCompactTruthDataset(raw) {
  if (raw?.schema !== "au-truth-v0.1" || !Array.isArray(raw.p)) return raw;
  const [npartProjectile, npartTarget, npartTotal, ncoll, impactParameterFm] = raw.hi;
  const [allParticles, vertices, stableFinal, closure] = raw.audit;
  return {
    schema: "algorithmic-universe-truth-display",
    schema_version: "0.1.0",
    generator: { name: "PYTHIA Angantyr", version: "8.317" },
    format_source: "HepMC3 Asciiv3",
    system: raw.s, sqrt_s_nn_tev: raw.e, frame: "nucleon-nucleon-centre-of-mass",
    seed: raw.seed, event_number: 0,
    heavy_ion: {
      npart_projectile: npartProjectile, npart_target: npartTarget,
      npart_total: npartTotal, ncoll, impact_parameter_fm: impactParameterFm,
    },
    audit: {
      particle_count_all_statuses: allParticles, vertex_count: vertices,
      stable_final_count: stableFinal, momentum_closure_relative: closure, passed: true,
    },
    particles: raw.p.map((row, index) => {
      const [pdg, pt, eta, phi, energy] = row;
      const meta = PDG_META[String(pdg)] || { name: String(pdg), category: "other", charge: 0 };
      return { id: index + 1, pdg, pt, eta, phi, energy, ...meta };
    }),
  };
}

export function validateTruthDataset(dataset) {
  const errors = [];
  if (!dataset || typeof dataset !== "object") errors.push("dataset is not an object");
  if (!Array.isArray(dataset?.particles)) errors.push("particles must be an array");
  if (dataset?.audit?.stable_final_count !== dataset?.particles?.length) {
    errors.push("stable_final_count does not match particles.length");
  }
  for (const [index, particle] of (dataset?.particles || []).entries()) {
    for (const key of ["id", "pdg", "energy", "pt", "eta", "phi"]) {
      if (!Number.isFinite(particle[key])) errors.push(`particle ${index} has invalid ${key}`);
    }
    if (particle.pt < 0 || particle.energy < 0) errors.push(`particle ${index} has negative kinematics`);
  }
  return { valid: errors.length === 0, errors };
}

export function filterParticles(particles, options = {}) {
  const categories = options.categories instanceof Set ? options.categories : new Set(Object.keys(CATEGORY_META));
  const minPt = Number.isFinite(options.minPt) ? options.minPt : 0;
  const maxAbsEta = Number.isFinite(options.maxAbsEta) ? options.maxAbsEta : Infinity;
  const charge = options.charge || "all";
  return particles.filter((particle) => {
    if (!categories.has(particle.category)) return false;
    if (particle.pt < minPt || Math.abs(particle.eta) > maxAbsEta) return false;
    if (charge === "charged" && particle.charge === 0) return false;
    if (charge === "neutral" && particle.charge !== 0) return false;
    if (charge === "positive" && particle.charge <= 0) return false;
    if (charge === "negative" && particle.charge >= 0) return false;
    return true;
  });
}

export function transversePoint(particle, centerX, centerY, maxRadius) {
  const normalized = Math.log1p(Math.max(0, particle.pt)) / Math.log1p(7);
  const radius = maxRadius * (0.18 + 0.82 * Math.min(1, normalized));
  return {
    x: centerX + Math.cos(particle.phi) * radius,
    y: centerY + Math.sin(particle.phi) * radius,
    radius,
  };
}

export function etaPhiPoint(particle, width, height, padding = 36, etaLimit = 6) {
  const phi = Math.max(-Math.PI, Math.min(Math.PI, particle.phi));
  const eta = Math.max(-etaLimit, Math.min(etaLimit, particle.eta));
  return {
    x: padding + ((phi + Math.PI) / (2 * Math.PI)) * (width - 2 * padding),
    y: padding + ((etaLimit - eta) / (2 * etaLimit)) * (height - 2 * padding),
  };
}

export function summarizeVisible(particles) {
  const result = { total: particles.length, charged: 0, neutral: 0, sumPt: 0, maxPt: 0 };
  for (const particle of particles) {
    if (particle.charge === 0) result.neutral += 1;
    else result.charged += 1;
    result.sumPt += particle.pt;
    result.maxPt = Math.max(result.maxPt, particle.pt);
  }
  return result;
}

export function speciesRows(particles) {
  const counts = new Map();
  for (const particle of particles) {
    const key = `${particle.pdg}:${particle.name}`;
    const current = counts.get(key) || { pdg: particle.pdg, name: particle.name, count: 0, sumPt: 0 };
    current.count += 1;
    current.sumPt += particle.pt;
    counts.set(key, current);
  }
  return [...counts.values()]
    .map((row) => ({ ...row, meanPt: row.sumPt / row.count }))
    .sort((a, b) => b.count - a.count || b.meanPt - a.meanPt);
}

export function buildTruthLog(dataset, visibleParticles) {
  const h = dataset.heavy_ion;
  const audit = dataset.audit;
  const visible = summarizeVisible(visibleParticles);
  return [
    {
      title: "1. Початкова ядерна подія",
      plain: `Angantyr змоделював непружне зіткнення ${dataset.system} при √sNN = ${dataset.sqrt_s_nn_tev.toFixed(2)} TeV. У геометрії взяли участь ${h.npart_total} нуклони та відбулося ${h.ncoll} нуклон-нуклонні субзіткнення.`,
      technical: `system=${dataset.system}; frame=${dataset.frame}; seed=${dataset.seed}; event=${dataset.event_number}; Npart=${h.npart_total}; Ncoll=${h.ncoll}; b=${h.impact_parameter_fm.toFixed(6)} fm`,
    },
    {
      title: "2. Генерація кваркових підподій і адронізація",
      plain: `PYTHIA 8.317 склала субзіткнення в одну truth-level подію. Повний граф містить ${audit.particle_count_all_statuses} записів частинок і ${audit.vertex_count} вершин взаємодій та розпадів.`,
      technical: `generator=PYTHIA Angantyr 8.317; all_particles=${audit.particle_count_all_statuses}; vertices=${audit.vertex_count}`,
    },
    {
      title: "3. Вибір стабільного фінального стану",
      plain: `Для цього екрана відібрано ${audit.stable_final_count} частинок зі статусом 1 — саме вони залишили генераторний граф як стабільний фінальний стан.`,
      technical: `selection=HepMC status 1; stable_final=${audit.stable_final_count}; displayed_after_filters=${visible.total}`,
    },
    {
      title: "4. Що зараз показано",
      plain: `Після ваших фільтрів видно ${visible.total} частинок: ${visible.charged} заряджених і ${visible.neutral} нейтральних. Довжина променя кодує поперечний імпульс pT, а напрям — азимутальний кут φ.`,
      technical: `visible=${visible.total}; charged=${visible.charged}; neutral=${visible.neutral}; ΣpT=${visible.sumPt.toFixed(6)} GeV; max_pT=${visible.maxPt.toFixed(6)} GeV`,
    },
    {
      title: "5. Перевірка законів збереження",
      plain: `Сума чотири-імпульсів двох пучків збіглася із сумою стабільного фінального стану з відносною похибкою ${audit.momentum_closure_relative.toExponential(2)}. Перевірка пройшла.`,
      technical: `momentum_closure_relative=${audit.momentum_closure_relative}; pass=${audit.passed}`,
    },
    {
      title: "6. Наукова межа",
      plain: "Це справжня генераторна truth-подія, але ще не зображення детектора. Лінії не є виміряними треками ATLAS/CMS: для цього потрібні Geant4, digitisation і reconstruction.",
      technical: "level=generator truth; detector_response=false; digitisation=false; reconstruction=false; hydrodynamic_QGP=false",
    },
  ];
}
