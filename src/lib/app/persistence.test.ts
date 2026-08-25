import { afterEach, describe, expect, it, vi } from "vitest";
import type { MockupSettings, RenderHistoryItem } from "../../types";
import { DEFAULT_PRESET_ID, loadStoredHistory, loadStoredPresets, saveStoredHistory, saveStoredPresets } from "./persistence";

const settings: MockupSettings = {
  smartObjectName: "Auto-detect",
  left: 0,
  top: 0,
  width: 100,
  height: 100,
  areaLeftPercent: 0,
  areaTopPercent: 0,
  areaWidthPercent: 100,
  areaHeightPercent: 100,
  rotation: 0,
  opacity: 100,
  fitMode: "contain",
  anchor: "center",
};

function stubStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const localStorage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
  };
  vi.stubGlobal("window", { localStorage });
  return localStorage;
}

afterEach(() => vi.unstubAllGlobals());

describe("browser persistence", () => {
  it("restores the built-in preset when storage is empty", () => {
    stubStorage();
    const presets = loadStoredPresets(settings);

    expect(presets).toHaveLength(1);
    expect(presets[0]).toMatchObject({ id: DEFAULT_PRESET_ID, settings });
  });

  it("keeps storage failures from escaping into the UI", () => {
    const localStorage = stubStorage();
    localStorage.setItem.mockImplementation(() => { throw new Error("blocked"); });

    expect(() => saveStoredPresets([])).not.toThrow();
    expect(() => saveStoredHistory([])).not.toThrow();
  });

  it("loads at most twelve history entries", () => {
    const history = Array.from({ length: 15 }, (_, index): RenderHistoryItem => ({
      id: String(index),
      date: "today",
      mode: "preview",
      mockups: 1,
      designs: 1,
      exported: 1,
      failed: 0,
    }));
    stubStorage({ "openmockup.history.v1": JSON.stringify(history) });

    expect(loadStoredHistory()).toHaveLength(12);
  });
});
