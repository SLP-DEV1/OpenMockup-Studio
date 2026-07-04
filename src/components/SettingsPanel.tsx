import type { MockupSettings, SavedPreset } from "../types";

interface SettingsPanelProps {
  settings: MockupSettings;
  onChange: (settings: MockupSettings) => void;
  presets: SavedPreset[];
  activePresetId?: string;
  onApplyPreset: (id: string) => void;
  onSavePreset: () => void;
  onDeletePreset: (id: string) => void;
}

const fitModes = ["contain", "cover", "width", "height"] as const;
const anchors = ["center", "top-left", "top-right", "bottom-left", "bottom-right"] as const;

export const shirtPlacementDefaults: Pick<
  MockupSettings,
  | "left"
  | "top"
  | "width"
  | "height"
  | "areaLeftPercent"
  | "areaTopPercent"
  | "areaWidthPercent"
  | "areaHeightPercent"
  | "rotation"
  | "opacity"
  | "fitMode"
  | "anchor"
> = {
  left: 0,
  top: 0,
  width: 100,
  height: 100,
  areaLeftPercent: 38,
  areaTopPercent: 25,
  areaWidthPercent: 24,
  areaHeightPercent: 32,
  rotation: 0,
  opacity: 100,
  fitMode: "contain",
  anchor: "center",
};

export function SettingsPanel({
  settings,
  onChange,
  presets,
  activePresetId,
  onApplyPreset,
  onSavePreset,
  onDeletePreset,
}: SettingsPanelProps) {
  function patch(update: Partial<MockupSettings>): void {
    onChange({ ...settings, ...update });
  }

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Mockup Settings</h2>
      </div>

      <div className="preset-manager">
        <label className="field field--wide">
          <span>Placement Preset</span>
          <select value={activePresetId || ""} onChange={(event) => onApplyPreset(event.target.value)}>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </label>
        <div className="preset-actions">
          <button type="button" onClick={onSavePreset}>Save / Update</button>
          <button type="button" onClick={() => activePresetId && onDeletePreset(activePresetId)} disabled={!activePresetId}>
            Delete
          </button>
        </div>
      </div>

      <label className="field field--wide">
        <span>Smart Object Layer Name</span>
        <input
          value={settings.smartObjectName}
          onChange={(event) => patch({ smartObjectName: event.target.value })}
          placeholder="e.g. Your Design Here"
        />
      </label>

      <div className="settings-grid">
        <NumberField label="Left %" value={settings.left} onChange={(left) => patch({ left })} />
        <NumberField label="Top %" value={settings.top} onChange={(top) => patch({ top })} />
        <NumberField label="Width %" value={settings.width} min={1} onChange={(width) => patch({ width })} />
        <NumberField label="Height %" value={settings.height} min={1} onChange={(height) => patch({ height })} />
      </div>

      <div className="segmented-group">
        <span>Placement Area</span>
        <div className="settings-grid">
          <NumberField label="Placement X %" value={settings.areaLeftPercent} min={0} max={100} onChange={(areaLeftPercent) => patch({ areaLeftPercent })} />
          <NumberField label="Placement Y %" value={settings.areaTopPercent} min={0} max={100} onChange={(areaTopPercent) => patch({ areaTopPercent })} />
          <NumberField label="Placement W %" value={settings.areaWidthPercent} min={1} max={100} onChange={(areaWidthPercent) => patch({ areaWidthPercent })} />
          <NumberField label="Placement H %" value={settings.areaHeightPercent} min={1} max={100} onChange={(areaHeightPercent) => patch({ areaHeightPercent })} />
        </div>
        <button type="button" onClick={() => patch(shirtPlacementDefaults)}>
          Reset Shirt Placement
        </button>
      </div>

      <div className="settings-grid">
        <NumberField label="Rotation" value={settings.rotation} onChange={(rotation) => patch({ rotation })} />
        <NumberField label="Opacity" value={settings.opacity} min={0} max={100} onChange={(opacity) => patch({ opacity })} />
      </div>

      <div className="segmented-group">
        <span>Fit Mode</span>
        <div className="segmented">
          {fitModes.map((mode) => (
            <button
              className={settings.fitMode === mode ? "is-active" : ""}
              key={mode}
              type="button"
              onClick={() => patch({ fitMode: mode })}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <label className="field field--wide">
        <span>Anchor</span>
        <select value={settings.anchor} onChange={(event) => patch({ anchor: event.target.value as MockupSettings["anchor"] })}>
          {anchors.map((anchor) => (
            <option key={anchor} value={anchor}>
              {anchor}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

function NumberField({ label, value, onChange, min, max }: NumberFieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step="1"
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
