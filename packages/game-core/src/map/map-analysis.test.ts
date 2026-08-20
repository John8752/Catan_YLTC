import { describe, expect, it } from "vitest";
import { RESOURCE_TYPES } from "../resources/index.js";
import { analyzeMap } from "./map-analysis.js";
import { createExtendedMap, createStandardMap } from "./standard-map.js";

describe("map fairness analysis", () => {
  it("reports production strength for every resource from the visible number tokens", () => {
    const map = createStandardMap(20260820);
    const analysis = analyzeMap(map);

    expect(analysis.resources.map((resource) => resource.resource)).toEqual(RESOURCE_TYPES);
    expect(analysis.resources.reduce((total, resource) => total + resource.productionPips, 0)).toBe(58);
    expect(analysis.resources.every((resource) => resource.tileCount > 0)).toBe(true);
    expect(analysis.score).toBeGreaterThanOrEqual(0);
    expect(analysis.score).toBeLessThanOrEqual(100);
  });

  it("selects consistently balanced maps across both playable topologies", () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      expect(analyzeMap(createStandardMap(seed)).score).toBeGreaterThanOrEqual(78);
      expect(analyzeMap(createExtendedMap(seed)).score).toBeGreaterThanOrEqual(78);
    }
  });
});
