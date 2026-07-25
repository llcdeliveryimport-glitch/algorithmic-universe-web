export const NUCLEAR_PROFILE_METADATA = Object.freeze({
  p: {
    source: "PDG / proton identity",
    approximation: "point-like transverse center at Glauber geometry level",
  },
  O16: {
    source: "TGlauberMC-compatible Oho2 profile parameters",
    approximation: "spherical modified harmonic oscillator; shift-all recentering",
  },
  Ne20: {
    source: "TGlauberMC-compatible Ne profile parameters",
    approximation: "spherical Woods–Saxon; deformation and correlated configurations not yet enabled",
  },
  Pb208: {
    source: "TGlauberMC-compatible Pb-star profile parameters",
    approximation: "spherical Woods–Saxon baseline",
  },
});

export function normalizeGlauberEvent(event) {
  const insufficientShapeParticipants = event.metrics.nPart < 3;
  return {
    ...event,
    version: "0.6-web-preview",
    assumptions: {
      nuclearGeometry: "independent spherical sampling with minimum separation and shift-all recentering",
      nucleonOverlap: "hard-sphere transverse criterion",
      beamTrajectories: "straight eikonal paths",
      finalState: "not simulated",
      detector: "not simulated",
    },
    metrics: {
      ...event.metrics,
      epsilon2: insufficientShapeParticipants ? null : event.metrics.epsilon2,
      epsilon3: insufficientShapeParticipants ? null : event.metrics.epsilon3,
      participantAreaFm2: insufficientShapeParticipants ? null : event.metrics.participantAreaFm2,
    },
  };
}
