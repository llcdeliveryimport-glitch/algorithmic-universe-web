import test from "node:test";
import assert from "node:assert/strict";

import { createMinimumBiasAccumulator } from "../src/collider.js";
import { generateGlauberEvent } from "../src/glauber.js";
import {
  buildBatchExplanation,
  buildEventExplanation,
  formatExplanationLog,
} from "../src/explanations.js";

test("event explanation covers geometry, pairs, participants and model limit", () => {
  const event = generateGlauberEvent({
    systemKey: "OO",
    seed: 20260725,
    trialId: 29,
    impactParameterFm: 7,
    sigmaMb: 68,
  });
  const entries = buildEventExplanation(event);
  assert.ok(entries.length >= 10);
  assert.match(entries.map((item) => item.title).join(" | "), /Перевірено всі можливі пари/);
  assert.match(entries.map((item) => item.title).join(" | "), /Пораховано учасників/);
  assert.equal(entries.at(-1).level, "limit");
});

test("two-participant event explains why shape observables are undefined", () => {
  const event = generateGlauberEvent({
    systemKey: "OO",
    seed: 20260725,
    trialId: 29,
    impactParameterFm: 7,
    sigmaMb: 68,
  });
  assert.equal(event.metrics.nPart, 2);
  const entries = buildEventExplanation(event);
  const shape = entries.find((item) => item.title === "Форма області не визначається");
  assert.ok(shape);
  assert.match(shape.explanation, /щонайменше з трьох учасників/);
});

test("technical event log includes deterministic and interaction parameters", () => {
  const event = generateGlauberEvent({ systemKey: "pO", seed: 42, trialId: 7, impactParameterFm: 0 });
  const text = formatExplanationLog(buildEventExplanation(event), "technical");
  assert.match(text, /deterministic key=42:7/);
  assert.match(text, /σNN=/);
  assert.match(text, /event integrity=PASS/);
});

test("batch explanation states acceptance, cross section and uncertainty scope", () => {
  const accumulator = createMinimumBiasAccumulator({ systemKey: "OO", seed: 123 });
  accumulator.add(120);
  const summary = accumulator.summary();
  const entries = buildBatchExplanation(summary);
  const text = formatExplanationLog(entries, "plain");
  assert.match(text, /trial-подій/);
  assert.match(text, /геометричний переріз/i);
  assert.match(text, /не є всією невизначеністю/);
});

test("plain and technical logs describe the same ordered steps", () => {
  const event = generateGlauberEvent({ systemKey: "NeNe", seed: 11, trialId: 5, impactParameterFm: 4 });
  const entries = buildEventExplanation(event);
  const plain = formatExplanationLog(entries, "plain");
  const technical = formatExplanationLog(entries, "technical");
  assert.equal((plain.match(/^\d{2}\./gm) || []).length, entries.length);
  assert.equal((technical.match(/^\d{2}\./gm) || []).length, entries.length);
  assert.notEqual(plain, technical);
});
