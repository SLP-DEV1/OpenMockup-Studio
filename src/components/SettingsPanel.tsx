import type { DocumentSize, MockupSettings, SavedPreset } from "../types";
import type { SmartObjectBounds, SmartObjectCandidate } from "../lib/psdSmartObjectDetection";

interface SettingsPanelProps {
  settings: MockupSettings;
  onChange: (settings: MockupSettings) => void;
  presets: SavedPreset[];
  activePresetId?: string;
  onApplyPreset: (id: string) => void;
  onSavePreset: () => void;
  onDeletePreset: (id: string) => void;
  smartObjectCandidates?: SmartObjectCandidate[];
  smartObjectDetectionLabel?: string;
  currentProductProfileName?: string;
  smartObjectBounds?: SmartObjectBounds;
  documentSize?: DocumentSize;
  onResetPlacement?: () => void;
  onCenterDesign?: () => void;
  mode?: "psd" | "image";
}

const fitModes = [
  { id: "contain", label: "Inside" },
  { id: "cover", label: "Fill" },
  { id: "width", label: "Width" },
  { id: "height", label: "Height" },
] as const;

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

function percentOf(value: number, total: number): string {
  if (!total) return "0";
  return ((value / total) * 100).toFixed(1);
}

export function SettingsPanel({
  settings,
  onChange,
  presets,
  activePresetId,
  onApplyPreset,
  onSavePreset,
  onDeletePreset,
  smartObjectCandidates = [],
  smartObjectDetectionLabel = "",
  currentProductProfileName = "Current Product",
  smartObjectBounds,
  documentSize,
  onResetPlacement,
  onCenterDesign,
  mode = "psd",
}: SettingsPanelProps) {
  const isMugProfile = /mug/i.test(currentProductProfileName);
  const isImageMode = mode === "image";
  const uniformScale = Math.round((settings.width + settings.height) / 2);

  function patch(update: Partial<MockupSettings>): void {
    onChange({ ...settings, ...update });
  }

  function setUniformScale(scale: number): void {
    patch({ width: scale, height: scale });
  }

  return (
    <section className="panel settings-panel-v14">
      <div className="panel__header">
        <h2>Placement Controls</h2>
      </div>

      <div className="callout-card">
        <div className="callout-card__top">
          <span className="callout-badge">Active product</span>
          <strong>{currentProductProfileName}</strong>
        </div>
        <p className="muted small-text">
          {isMugProfile
            ? "The SmartObject slot stays locked. Move, scale and rotate only the design like in Mockcity."
            : "The SmartObject slot is locked. You only move, scale and rotate the uploaded design inside it."}
        </p>
      </div>

      <div className="preset-manager compact-panel">
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
          <button type="button" onClick={onSavePreset}>Save Preset</button>
          <button type="button" onClick={() => activePresetId && onDeletePreset(activePresetId)} disabled={!activePresetId}>
            Delete Preset
          </button>
        </div>
      </div>

      <section className="compact-panel">
        <div className="section-title-row">
          <h3>{isImageMode ? "Placement Area" : "Locked SmartObject Slot"}</h3>
          <span className="tiny-status">Read only</span>
        </div>
        <div className="slot-summary-grid">
          <div className="slot-summary-item">
            <span>{isImageMode ? "Placement" : "Smart Layer"}</span>
            <strong>{settings.smartObjectName || (isImageMode ? "Image Canvas" : "Auto-detect")}</strong>
          </div>
          <div className="slot-summary-item">
            <span>{isImageMode ? "Area size" : "Slot size"}</span>
            <strong>
              {smartObjectBounds ? `${Math.round(smartObjectBounds.width)} × ${Math.round(smartObjectBounds.height)} px` : `${settings.areaWidthPercent.toFixed(1)}% × ${settings.areaHeightPercent.toFixed(1)}%`}
            </strong>
          </div>
          <div className="slot-summary-item">
            <span>{isImageMode ? "Area position" : "Slot position"}</span>
            <strong>
              {smartObjectBounds ? `${Math.round(smartObjectBounds.left)}, ${Math.round(smartObjectBounds.top)} px` : `${settings.areaLeftPercent.toFixed(1)}%, ${settings.areaTopPercent.toFixed(1)}%`}
            </strong>
          </div>
          <div className="slot-summary-item">
            <span>Document share</span>
            <strong>
              {documentSize ? `${percentOf(smartObjectBounds?.width || (settings.areaWidthPercent * documentSize.width) / 100, documentSize.width)}% × ${percentOf(smartObjectBounds?.height || (settings.areaHeightPercent * documentSize.height) / 100, documentSize.height)}%` : "—"}
            </strong>
          </div>
        </div>
        <p className="hint-text">{smartObjectDetectionLabel || (isImageMode ? "The app uses a visual placement area for PNG/JPG mockups." : "The app automatically locks the SmartObject slot when a PSD is loaded.")}</p>
      </section>

      <section className="compact-panel">
        <div className="section-title-row">
          <h3>Quick Actions</h3>
          <span className="tiny-status">Fast workflow</span>
        </div>
        <div className="quick-actions-grid">
          <button type="button" onClick={() => onCenterDesign ? onCenterDesign() : patch({ left: 0, top: 0, width: 100, height: 100, rotation: 0, anchor: "center" })}>
            {isMugProfile ? "Auto Center" : "Center Design"}
          </button>
          <button type="button" onClick={() => onResetPlacement ? onResetPlacement() : patch(shirtPlacementDefaults)}>
            Reset Placement
          </button>
          <button type="button" onClick={() => patch({ fitMode: "contain", width: 100, height: 100 })}>Fit Inside</button>
          <button type="button" onClick={() => patch({ fitMode: "cover", width: 100, height: 100 })}>Fill Slot</button>
        </div>
      </section>

      <section className="compact-panel">
        <div className="section-title-row">
          <h3>Design Transform</h3>
          <span className="tiny-status">Editable</span>
        </div>

        <div className="slider-group slider-group--stacked">
          <SliderField label="Horizontal Offset" suffix="%" min={-150} max={150} value={settings.left} onChange={(left) => patch({ left })} />
          <SliderField label="Vertical Offset" suffix="%" min={-150} max={150} value={settings.top} onChange={(top) => patch({ top })} />
          <SliderField label="Scale" suffix="%" min={1} max={250} value={uniformScale} onChange={setUniformScale} />
          <SliderField label="Rotation" suffix="°" min={-180} max={180} value={settings.rotation} onChange={(rotation) => patch({ rotation })} />
          <SliderField label="Opacity" suffix="%" min={0} max={100} value={settings.opacity} onChange={(opacity) => patch({ opacity })} />
        </div>

        <div className="segmented-group">
          <span>Fit Mode</span>
          <div className="segmented segmented--wide">
            {fitModes.map((mode) => (
              <button
                className={settings.fitMode === mode.id ? "is-active" : ""}
                key={mode.id}
                type="button"
                onClick={() => patch({ fitMode: mode.id })}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <details className="details-card">
        <summary>Advanced Settings</summary>
        <div className="details-card__content">
          <div className="settings-grid">
            <NumberField label="Design X %" value={settings.left} onChange={(left) => patch({ left })} />
            <NumberField label="Design Y %" value={settings.top} onChange={(top) => patch({ top })} />
            <NumberField label="Design Width %" value={settings.width} min={1} onChange={(width) => patch({ width })} />
            <NumberField label="Design Height %" value={settings.height} min={1} onChange={(height) => patch({ height })} />
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

          <label className="field field--wide">
            <span>{isImageMode ? "Placement" : "Smart Layer"}</span>
            {smartObjectCandidates.length > 0 ? (
              <select value={settings.smartObjectName} onChange={(event) => patch({ smartObjectName: event.target.value })}>
                {smartObjectCandidates.map((candidate) => (
                  <option key={`${candidate.name}-${candidate.score}`} value={candidate.name}>
                    {candidate.name}{candidate.isSmartObject ? " · Smart Object" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <input value={settings.smartObjectName} onChange={(event) => patch({ smartObjectName: event.target.value })} placeholder="Auto-detect" />
            )}
          </label>
          {smartObjectCandidates.length > 1 ? (
            <details className="smart-object-candidates">
              <summary>Detected candidates</summary>
              <ol>
                {smartObjectCandidates.slice(0, 8).map((candidate) => (
                  <li key={`${candidate.name}-${candidate.score}`}>
                    <button type="button" onClick={() => patch({ smartObjectName: candidate.name })}>
                      {candidate.name}
                    </button>
                    <small>
                      Score {candidate.score} · {candidate.reason}
                      {candidate.bounds ? ` · ${Math.round(candidate.bounds.width)}×${Math.round(candidate.bounds.height)} px` : ""}
                    </small>
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
        </div>
      </details>
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

interface SliderFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  suffix?: string;
}

function SliderField({ label, value, onChange, min, max, suffix = "" }: SliderFieldProps) {
  return (
    <label className="slider-field">
      <div className="slider-field__top">
        <span>{label}</span>
        <strong>{Math.round(value)}{suffix}</strong>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}
