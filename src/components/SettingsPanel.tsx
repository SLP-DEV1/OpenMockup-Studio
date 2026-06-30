import type { MockupSettings } from "../types";

interface SettingsPanelProps {
  settings: MockupSettings;
  onChange: (settings: MockupSettings) => void;
}

const fitModes = ["contain", "cover", "width", "height"] as const;
const anchors = ["center", "top-left", "top-right", "bottom-left", "bottom-right"] as const;

export function SettingsPanel({ settings, onChange }: SettingsPanelProps) {
  function patch(update: Partial<MockupSettings>): void {
    onChange({ ...settings, ...update });
  }

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Mockup Settings</h2>
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
        <NumberField label="Width %" value={settings.width} onChange={(width) => patch({ width })} />
        <NumberField label="Height %" value={settings.height} onChange={(height) => patch({ height })} />
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
