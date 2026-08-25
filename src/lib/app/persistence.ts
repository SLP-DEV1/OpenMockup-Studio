import type { MockupSettings, RenderHistoryItem, SavedPreset } from "../../types";

const PRESETS_STORAGE_KEY = "openmockup.presets.v2";
const HISTORY_STORAGE_KEY = "openmockup.history.v1";
const THEME_STORAGE_KEY = "openmockup.theme.v1";

export const DEFAULT_PRESET_ID = "tshirt-front-standard";

export function loadStoredPresets(defaultSettings: MockupSettings): SavedPreset[] {
  const defaultPreset: SavedPreset = {
    id: DEFAULT_PRESET_ID,
    name: "T-Shirt Front Standard",
    settings: defaultSettings,
    updatedAt: Date.now(),
  };

  try {
    const raw = window.localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!raw) return [defaultPreset];
    const parsed = JSON.parse(raw) as SavedPreset[];
    if (!Array.isArray(parsed)) return [defaultPreset];
    const cleaned = parsed.filter((preset) => preset?.id && preset?.name && preset?.settings?.smartObjectName);
    if (!cleaned.some((preset) => preset.id === DEFAULT_PRESET_ID)) cleaned.unshift(defaultPreset);
    return cleaned.length ? cleaned : [defaultPreset];
  } catch {
    return [defaultPreset];
  }
}

export function saveStoredPresets(presets: SavedPreset[]): void {
  try {
    window.localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // Presets remain available for the current session when storage is unavailable.
  }
}

export function loadStoredHistory(): RenderHistoryItem[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HISTORY_STORAGE_KEY) || "[]") as RenderHistoryItem[];
    return Array.isArray(parsed) ? parsed.slice(0, 12) : [];
  } catch {
    return [];
  }
}

export function saveStoredHistory(history: RenderHistoryItem[]): void {
  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 12)));
  } catch {
    // History remains available for the current session when storage is unavailable.
  }
}

export function loadStoredTheme(): "light" | "dark" {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function saveStoredTheme(theme: "light" | "dark"): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The selected theme still applies for the current session.
  }
}
