import test from "node:test";
import assert from "node:assert/strict";
import {
  COLLISION_SYSTEMS,
  generateAcceptedGlauberEvent,
  generateGlauberEvent,
  mbToFm2,
  mulberry32,
  sampleImpactParameter,
  sampleNucleus,
} from "../src/glauber.js";

test("same seed and trial produce the same event", () => {
  const first = generateGlauberEvent({ systemKey: "OO", seed: 42, trialId: 7 });
  const second = generateGlauberEvent({ systemKey: "OO", seed: 42, trialId: 7 });
  assert.deepEqual(first, second);
});

test("accepted-event search is deterministic and returns a collision", () => {
  const first = generateAcceptedGlauberEvent({ systemKey: "pO", seed: 42, trialId: 0 });
  const second = generateAcceptedGlauberEvent({ systemKey: "pO", seed: 42, trialId: 0 });
  assert.deepEqual(first, second);
  assert.equal(first.accepted, true);
  assert.ok(first.searchAttempts >= 1);
});

test("nucleus catalogue preserves proton and neutron counts", () => {
  const oxygen = sampleNucleus("O16", mulberry32(123));
  assert.equal(oxygen.length, 16);
  assert.equal(oxygen.filter((nucleon) => nucleon.type === "proton").length, 8);
  assert.equal(oxygen.filter((nucleon) => nucleon.type === "neutron").length, 8);
});

test("central p-O accepted events satisfy Npart = Ncoll + 1", () => {
  const event = generateAcceptedGlauberEvent({
    systemKey: "pO",
    seed: 20260725,
    trialId: 0,
    impactParameterFm: 0,
    sigmaMb: 72,
  });
  assert.equal(event.accepted, true);
  assert.equal(event.metrics.nPart, event.metrics.nColl + 1);
});

test("participants and spectators account for every nucleon", () => {
  const event = generateAcceptedGlauberEvent({ systemKey: "OO", seed: 20260725, trialId: 0 });
  const total = event.projectile.length + event.target.length;
  assert.equal(event.metrics.nPart + event.metrics.nSpectators, total);
});

test("impact parameter sampling follows area measure bounds", () => {
  const random = mulberry32(99);
  const bMax = COLLISION_SYSTEMS.OO.bMaxFm;
  for (let i = 0; i < 1000; i += 1) {
    const b = sampleImpactParameter(random, bMax);
    assert.ok(b >= 0 && b <= bMax);
  }
});

test("millibarn conversion is correct", () => {
  assert.equal(mbToFm2(70), 7);
});
