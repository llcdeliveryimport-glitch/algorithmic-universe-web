import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildTruthLog,
  expandCompactTruthDataset,
  etaPhiPoint,
  filterParticles,
  speciesRows,
  summarizeVisible,
  transversePoint,
  validateTruthDataset,
} from "../src/truth-event.js";

const dataset = expandCompactTruthDataset(JSON.parse(await readFile(new URL("../data/angantyr-po-9.62tev-event0-compact.json", import.meta.url), "utf8")));

test("real Angantyr dataset passes structural validation", () => {
  const result = validateTruthDataset(dataset);
  assert.equal(result.valid, true, result.errors.join("; "));
  assert.equal(dataset.particles.length, 499);
  assert.equal(dataset.heavy_ion.npart_total, 3);
  assert.equal(dataset.heavy_ion.ncoll, 2);
});

test("dataset contains only the audited species counts", () => {
  const rows = speciesRows(dataset.particles);
  assert.equal(rows.find((row) => row.pdg === 22)?.count, 234);
  assert.equal(rows.find((row) => row.pdg === 211)?.count, 100);
  assert.equal(rows.find((row) => row.pdg === -211)?.count, 96);
});

test("filters keep category, charge, pT and eta constraints", () => {
  const selected = filterParticles(dataset.particles, {
    categories: new Set(["charged_hadron"]), minPt: 0.5, maxAbsEta: 3, charge: "positive",
  });
  assert.ok(selected.length > 0);
  assert.ok(selected.every((particle) => particle.category === "charged_hadron"));
  assert.ok(selected.every((particle) => particle.charge > 0 && particle.pt >= 0.5 && Math.abs(particle.eta) <= 3));
});

test("transverse projection follows phi", () => {
  const p0 = transversePoint({ pt: 1, phi: 0 }, 100, 100, 80);
  const p90 = transversePoint({ pt: 1, phi: Math.PI / 2 }, 100, 100, 80);
  assert.ok(p0.x > 100 && Math.abs(p0.y - 100) < 1e-9);
  assert.ok(p90.y > 100 && Math.abs(p90.x - 100) < 1e-9);
});

test("eta-phi projection stays inside canvas bounds", () => {
  const point = etaPhiPoint({ eta: 99, phi: -99 }, 800, 500, 40, 6);
  assert.ok(point.x >= 40 && point.x <= 760);
  assert.ok(point.y >= 40 && point.y <= 460);
});

test("visible summary conserves charged plus neutral count", () => {
  const summary = summarizeVisible(dataset.particles);
  assert.equal(summary.total, 499);
  assert.equal(summary.charged + summary.neutral, summary.total);
  assert.equal(summary.charged, 239);
});

test("explanation log distinguishes truth from detector simulation", () => {
  const entries = buildTruthLog(dataset, dataset.particles);
  assert.ok(entries.length >= 6);
  assert.ok(entries.some((entry) => entry.plain.includes("не зображення детектора")));
  assert.ok(entries.some((entry) => entry.technical.includes("detector_response=false")));
});
