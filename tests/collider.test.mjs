import test from "node:test";
import assert from "node:assert/strict";
import {
  COLLIDER_PIPELINE,
  MODEL_REFERENCES,
  buildPipelineRecord,
  centralityLabel,
  createMinimumBiasAccumulator,
  geometricCentralityPercent,
  simulateMinimumBias,
  validateGlauberEvent,
} from "../src/collider.js";
import {
  COLLISION_SYSTEMS,
  PROFILE_CATALOG,
  generateGlauberEvent,
} from "../src/glauber.js";

test("every extended nucleus has source and approximation metadata", () => {
  for (const profile of Object.values(PROFILE_CATALOG)) {
    assert.ok(profile.source);
    assert.ok(profile.approximation);
  }
});

test("geometric centrality follows area percentile", () => {
  const event = generateGlauberEvent({ systemKey: "OO", seed: 1, trialId: 1, impactParameterFm: COLLISION_SYSTEMS.OO.bMaxFm / 2 });
  assert.equal(geometricCentralityPercent(event), 25);
  assert.equal(centralityLabel(5), "дуже центральна");
  assert.equal(centralityLabel(85), "дуже периферійна");
});

test("event integrity validator accepts generated events", () => {
  for (const systemKey of Object.keys(COLLISION_SYSTEMS)) {
    const event = generateGlauberEvent({ systemKey, seed: 20260725, trialId: 3 });
    const validation = validateGlauberEvent(event);
    assert.equal(validation.valid, true, validation.errors.join("; "));
  }
});

test("event integrity validator detects channel corruption", () => {
  const event = generateGlauberEvent({ systemKey: "OO", seed: 9, trialId: 2, impactParameterFm: 0 });
  event.metrics.nCollNN += 1;
  const validation = validateGlauberEvent(event);
  assert.equal(validation.valid, false);
});

test("low-participant shape observables are explicitly undefined", () => {
  let event = null;
  for (let trialId = 0; trialId < 1000; trialId += 1) {
    const candidate = generateGlauberEvent({ systemKey: "OO", seed: 20260725, trialId, impactParameterFm: 7 });
    if (candidate.metrics.nPart === 2) { event = candidate; break; }
  }
  assert.ok(event, "expected to find a two-participant peripheral event");
  assert.equal(event.metrics.epsilon2, null);
  assert.equal(event.metrics.epsilon3, null);
  assert.equal(event.metrics.participantAreaFm2, null);
});

test("pipeline never fabricates final-state or detector output", () => {
  const event = generateGlauberEvent({ systemKey: "OO", seed: 3, trialId: 1, impactParameterFm: 0 });
  const record = buildPipelineRecord(event);
  assert.equal(record.length, COLLIDER_PIPELINE.length);
  assert.equal(record.find((stage) => stage.key === "geometry").state, "completed");
  assert.equal(record.find((stage) => stage.key === "subcollisions").state, "completed");
  assert.equal(record.find((stage) => stage.key === "final-state").state, "not-simulated");
  assert.equal(record.find((stage) => stage.key === "detector").state, "not-simulated");
});

test("minimum-bias run is deterministic", () => {
  const first = simulateMinimumBias({ systemKey: "pO", seed: 42, events: 120 });
  const second = simulateMinimumBias({ systemKey: "pO", seed: 42, events: 120 });
  assert.deepEqual(first, second);
});

test("minimum-bias centrality bins account for all trial events", () => {
  const summary = simulateMinimumBias({ systemKey: "OO", seed: 77, events: 150 });
  const trials = summary.centralityBins.reduce((sum, bin) => sum + bin.trials, 0);
  const accepted = summary.centralityBins.reduce((sum, bin) => sum + bin.accepted, 0);
  assert.equal(trials, summary.trials);
  assert.equal(accepted, summary.accepted);
});

test("minimum-bias cross section and uncertainty are finite", () => {
  const summary = simulateMinimumBias({ systemKey: "OO", seed: 123, events: 200 });
  assert.ok(summary.crossSectionBarn > 0);
  assert.ok(summary.crossSectionErrorBarn > 0);
  assert.ok(summary.acceptance > 0 && summary.acceptance < 1);
});

test("incremental accumulator matches one-shot simulation", () => {
  const accumulator = createMinimumBiasAccumulator({ systemKey: "NeNe", seed: 101 });
  accumulator.add(40);
  accumulator.add(60);
  const incremental = accumulator.summary();
  const oneShot = simulateMinimumBias({ systemKey: "NeNe", seed: 101, events: 100 });
  assert.deepEqual(incremental, oneShot);
});

test("model references use primary project domains", () => {
  assert.ok(MODEL_REFERENCES.length >= 4);
  assert.ok(MODEL_REFERENCES.some((source) => source.url.includes("home.cern")));
  assert.ok(MODEL_REFERENCES.some((source) => source.url.includes("pythia.org")));
  assert.ok(MODEL_REFERENCES.some((source) => source.url.includes("geant4.web.cern.ch")));
});
