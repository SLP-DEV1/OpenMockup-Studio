import type { MockupSettings, PerspectiveCorners } from "../types";
import { isValidPerspectiveCorners } from "../lib/perspective";

interface PerspectiveControlsProps {
  settings: MockupSettings;
  onChange: (settings: MockupSettings) => void;
  mode: "psd" | "image";
}

function cornersFromPlacement(settings: MockupSettings): PerspectiveCorners {
  const left = Math.max(0, Math.min(100, settings.areaLeftPercent));
  const top = Math.max(0, Math.min(100, settings.areaTopPercent));
  const right = Math.max(left + 1, Math.min(100, settings.areaLeftPercent + settings.areaWidthPercent));
  const bottom = Math.max(top + 1, Math.min(100, settings.areaTopPercent + settings.areaHeightPercent));
  return {
    topLeft: { x: left, y: top },
    topRight: { x: right, y: top },
    bottomRight: { x: right, y: bottom },
    bottomLeft: { x: left, y: bottom },
  };
}

export function PerspectiveControls({ settings, onChange, mode }: PerspectiveControlsProps) {
  if (mode !== "image") return null;

  const enabled = Boolean(settings.perspective?.enabled);

  function enablePerspective(): void {
    const existing = settings.perspective?.corners;
    const corners = existing && isValidPerspectiveCorners(existing)
      ? existing
      : cornersFromPlacement(settings);
    onChange({ ...settings, perspective: { enabled: true, corners } });
  }

  function disablePerspective(): void {
    if (!settings.perspective) return;
    onChange({ ...settings, perspective: { ...settings.perspective, enabled: false } });
  }

  function resetPerspective(): void {
    onChange({ ...settings, perspective: { enabled: true, corners: cornersFromPlacement(settings) } });
  }

  return (
    <section className="compact-panel">
      <div className="section-title-row">
        <h3>4-Corner Perspective</h3>
        <span className="tiny-status">{enabled ? "Enabled" : "Optional"}</span>
      </div>
      <p className="hint-text">
        Warp the design onto angled signs, frames, screens or packaging. When enabled, drag the four teal corners directly in the editor.
      </p>
      <div className="quick-actions-grid">
        <button type="button" className={enabled ? "is-active" : ""} onClick={enabled ? disablePerspective : enablePerspective}>
          {enabled ? "Disable Perspective" : "Enable Perspective"}
        </button>
        <button type="button" onClick={resetPerspective} disabled={!enabled}>
          Reset Corners
        </button>
      </div>
      {enabled ? (
        <p className="muted small-text">
          Perspective uses the four corners as the complete design surface. Move/scale/rotate controls are ignored until perspective is disabled.
        </p>
      ) : null}
    </section>
  );
}
