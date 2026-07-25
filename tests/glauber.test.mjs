import test from "node:test";
import assert from "node:assert/strict";
import {
  COLLISION_SYSTEMS,
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

test("nucleus catalogue preserves proton and neutron counts", () => {
  const oxygen = sampleNucleus("O16", mulberry32(123));
  assert.equal(oxygen.length, 16);
  assert.equal(oxygen.filter((nucleon) => nucleon.type === "proton").length, 8);
  assert.equal(oxygen.filter((nucleon) => nucleon.type === "neutron").length, 8);
});

test("central p-O accepted events satisfy Npart = Ncoll + 1", () => {
  const event = generateGlauberEvent({
    systemKey: "pO",
    seed: 20260725,
    trialId: 1,
    impactParameterFm: 0,
    sigmaMb: 72,
  });
  assert.equal(event.accepted, true);
  assert.equal(event.metrics.nPart, event.metrics.nColl + 1);
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
