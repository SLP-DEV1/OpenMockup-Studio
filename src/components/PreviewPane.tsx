import type { ReactNode } from "react";
import type {
  BatchError,
  DesignWarning,
  ExportOptions,
  ExportProfile,
  ExportResult,
  LoadedAsset,
  ProductProfile,
  ProgressState,
  RenderHistoryItem,
} from "../types";

interface PreviewPaneProps {
  mockups: LoadedAsset[];
  activeMockupId?: string;
  mockupKind?: "psd" | "image" | "unknown";
  designs: LoadedAsset[];
  activeDesignId?: string;
  preview?: ExportResult;
  previewGallery: ExportResult[];
  progress?: ProgressState;
  batchErrors: BatchError[];
  designWarnings: DesignWarning[];
  history: RenderHistoryItem[];
  isBusy: boolean;
  exportOptions: ExportOptions;
  autoPreview: boolean;
  productProfiles: ProductProfile[];
  activeProductProfileId?: string;
  exportProfiles: ExportProfile[];
  onExportOptionsChange: (options: ExportOptions) => void;
  onAutoPreviewChange: (enabled: boolean) => void;
  onProductProfile: (id: string) => void;
  onExportProfile: (id: string) => void;
  onPreview: () => void;
  onBatch: () => void;
  onCancel: () => void;
  onClearHistory: () => void;
  onSavePreset: () => void;
  onLoadPreset: (file: File) => void;
  onMoveDesign: (index: number, direction: -1 | 1) => void;
  onSelectDesign: (id: string) => void;
  onSelectMockup: (id: string) => void;
  children?: ReactNode;
}

export function PreviewPane({
  mockups,
  activeMockupId,
  mockupKind = "unknown",
  designs,
  activeDesignId,
  preview,
  previewGallery,
  progress,
  batchErrors,
  designWarnings,
  history,
  isBusy,
  exportOptions,
  autoPreview,
  productProfiles,
  activeProductProfileId,
  exportProfiles,
  onExportOptionsChange,
  onAutoPreviewChange,
  onProductProfile,
  onExportProfile,
  onPreview,
  onBatch,
  onCancel,
  onClearHistory,
  onSavePreset,
  onLoadPreset,
  onMoveDesign,
  onSelectDesign,
  onSelectMockup,
  children,
}: PreviewPaneProps) {
  function patchExport(update: Partial<ExportOptions>): void {
    onExportOptionsChange({ ...exportOptions, ...update });
  }

  const totalExports = Math.max(0, mockups.length * designs.length);
  const modeLabel = mockupKind === "image" ? "Image Mockups" : mockupKind === "psd" ? "PSD Mockups" : "Mockups";
  const activeMockup = mockups.find((mockup) => mockup.id === activeMockupId) || mockups[0];
  const activeDesign = designs.find((design) => design.id === activeDesignId) || designs[0];

  async function copyErrors(): Promise<void> {
    const text = batchErrors.map((error, index) => `${index + 1}. ${error.mockupName} + ${error.designName}: ${error.message}`).join("\n");
    await navigator.clipboard?.writeText(text);
  }

  return (
    <section className="workspace workspace-v16">
      <div className="workspace__hero">
        <div>
          <h2>Preview</h2>
          <p>{mockups.length ? `${mockups.length} ${modeLabel}${activeMockup ? ` · Active: ${activeMockup.file.name}` : ""}` : "No mockup loaded yet"}</p>
        </div>
        <div className="actions actions--hero">
          <label className="auto-preview-toggle" title="Automatically refresh the preview when you click another design, switch mockups or change placement settings.">
            <input
              type="checkbox"
              checked={autoPreview}
              onChange={(event) => onAutoPreviewChange(event.target.checked)}
              disabled={!activeMockup || !activeDesign}
            />
            <span>Auto Preview</span>
          </label>
          <button type="button" onClick={() => onPreview()} disabled={isBusy || !activeMockup || !activeDesign}>
            Refresh Preview
          </button>
          <button type="button" className="button-primary" onClick={onBatch} disabled={isBusy || totalExports === 0}>
            Export All{totalExports ? ` (${totalExports})` : ""}
          </button>
          {isBusy ? <button type="button" onClick={onCancel}>Cancel</button> : null}
        </div>
      </div>

      <div className="workspace__stack">
        {mockups.length > 1 ? (
          <section className="export-panel asset-strip-panel">
            <div className="panel__header">
              <h2>Loaded Mockups</h2>
              <span className="tiny-status">click to edit</span>
            </div>
            <div className="mockup-strip">
              {mockups.map((mockup) => (
                <button
                  type="button"
                  key={mockup.id}
                  className={`mockup-chip ${mockup.id === activeMockup?.id ? "is-active-asset" : ""}`}
                  onClick={() => onSelectMockup(mockup.id)}
                  title={mockup.file.name}
                >
                  <span>{mockup.file.name}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="export-panel asset-strip-panel asset-strip-panel--primary">
          <div className="panel__header">
            <div>
              <h2>Loaded Designs</h2>
              <p className="muted small-text">Click a design to select it. The preview is kept/cached; a new render starts only after moving, scaling, rotating or pressing Refresh Preview.</p>
            </div>
            <span className="tiny-status">{activeDesign ? `Active: ${activeDesign.file.name}` : "No active design"}</span>
          </div>
          <div className="design-strip design-strip--selectable">
            {designs.length === 0 ? <span className="muted">No designs loaded yet</span> : designs.map((design, index) => (
              <figure key={design.id} className={design.id === activeDesign?.id ? "is-active-asset" : ""}>
                <button type="button" className="asset-thumb-button" onClick={() => onSelectDesign(design.id)} title={`Use ${design.file.name}`}>
                  <img src={design.url} alt={design.file.name} />
                  <figcaption>{design.file.name}</figcaption>
                </button>
                <div className="design-order-actions" aria-label="Design order">
                  <button type="button" onClick={() => onMoveDesign(index, -1)} disabled={index === 0 || isBusy}>↑</button>
                  <button type="button" onClick={() => onMoveDesign(index, 1)} disabled={index === designs.length - 1 || isBusy}>↓</button>
                </div>
              </figure>
            ))}
          </div>
        </section>

        <section className="export-panel preview-card">
          <div className="preview-stage preview-stage--large">
            {preview ? <img src={preview.url} alt="Generated mockup preview" /> : <EmptyPreview isBusy={isBusy} modeLabel={modeLabel} />}
          </div>

          {progress ? (
            <div className="progress">
              <span>{progress.label}</span>
              <progress value={progress.current} max={progress.total} />
              <strong>{progress.current}/{progress.total}</strong>
            </div>
          ) : null}
        </section>

        <details className="details-card" open={Boolean(designs.length)}>
          <summary>SmartObject / Image Editor</summary>
          <div className="details-card__content">
            {children}
          </div>
        </details>

        <section className="export-panel">
          <div className="panel__header"><h2>Product Profiles</h2></div>
          <div className="profile-grid profile-grid--cards">
            {productProfiles.map((profile) => (
              <button
                type="button"
                key={profile.id}
                className={`profile-card ${activeProductProfileId === profile.id ? "is-active-profile" : ""}`}
                onClick={() => onProductProfile(profile.id)}
                title={profile.description}
              >
                <span className="profile-card__icon">{getProfileIcon(profile.name)}</span>
                <span className="profile-card__name">{profile.name}</span>
                <small>{profile.description}</small>
              </button>
            ))}
          </div>
        </section>

        {previewGallery.length ? (
          <section className="export-panel gallery-panel">
            <div className="panel__header">
              <h2>Batch Preview Grid</h2>
              <span className="tiny-status">{previewGallery.length} rendered</span>
            </div>
            <div className="preview-gallery">
              {previewGallery.map((item) => (
                <figure key={`${item.fileName}-${item.url}`}>
                  <img src={item.url} alt={item.fileName} />
                  <figcaption>{item.fileName}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        ) : null}

        {designWarnings.length ? (
          <details className="warning-list" open>
            <summary>{designWarnings.length} design warning{designWarnings.length === 1 ? "" : "s"}</summary>
            {designWarnings.map((warning) => (
              <p key={`${warning.fileName}-${warning.message}`}><strong>{warning.fileName}</strong>: {warning.message}</p>
            ))}
          </details>
        ) : null}

        {batchErrors.length ? (
          <details className="error-list" open>
            <summary>{batchErrors.length} export error{batchErrors.length === 1 ? "" : "s"}</summary>
            {batchErrors.map((error, index) => (
              <p key={`${error.mockupName}-${error.designName}-${index}`}>
                <strong>{error.mockupName}</strong> + <strong>{error.designName}</strong>: {error.message}
              </p>
            ))}
            <button type="button" onClick={copyErrors}>Copy error details</button>
          </details>
        ) : null}

        <section className="export-panel">
          <div className="panel__header"><h2>Export Options</h2></div>
          <div className="export-grid export-grid--simple">
            <label className="field field--wide">
              <span>Filename Template</span>
              <input value={exportOptions.filenameTemplate} onChange={(event) => patchExport({ filenameTemplate: event.target.value })} placeholder="{index}-{mockup}-{design}.{ext}" />
            </label>
            <label className="field">
              <span>ZIP Name</span>
              <input value={exportOptions.zipName} onChange={(event) => patchExport({ zipName: event.target.value })} />
            </label>
            <label className="field">
              <span>Format</span>
              <select value={exportOptions.format} onChange={(event) => patchExport({ format: event.target.value as ExportOptions["format"] })}>
                <option value="png">PNG</option>
                <option value="jpg">JPG</option>
                <option value="webp">WebP</option>
              </select>
            </label>
            <label className="field">
              <span>Quality</span>
              <input type="number" min="1" max="100" value={exportOptions.quality} disabled={exportOptions.format === "png"} onChange={(event) => patchExport({ quality: Number(event.target.value) })} />
            </label>
          </div>

          <details className="details-card">
            <summary>Advanced Export Settings</summary>
            <div className="details-card__content">
              <div className="profile-grid profile-grid--compact">
                {exportProfiles.map((profile) => (
                  <button type="button" key={profile.id} onClick={() => onExportProfile(profile.id)} title={profile.description}>
                    {profile.name}
                  </button>
                ))}
              </div>

              <div className="export-grid">
                <label className="field">
                  <span>JPG/WebP Background</span>
                  <input type="color" value={exportOptions.backgroundColor} onChange={(event) => patchExport({ backgroundColor: event.target.value })} />
                </label>
                <label className="field">
                  <span>Max Long Side</span>
                  <input type="number" min="0" value={exportOptions.maxLongSide} onChange={(event) => patchExport({ maxLongSide: Number(event.target.value) })} />
                </label>
                <label className="field">
                  <span>Crop Preset</span>
                  <select value={exportOptions.cropPreset} onChange={(event) => patchExport({ cropPreset: event.target.value as ExportOptions["cropPreset"] })}>
                    <option value="none">None</option>
                    <option value="square">Square 1:1</option>
                    <option value="portrait45">Portrait 4:5</option>
                    <option value="pinterest23">Pinterest 2:3</option>
                    <option value="story916">Story 9:16</option>
                  </select>
                </label>
                <label className="field">
                  <span>Watermark Text</span>
                  <input value={exportOptions.watermarkText} onChange={(event) => patchExport({ watermarkText: event.target.value })} placeholder="optional" />
                </label>
                <label className="field">
                  <span>Watermark Opacity</span>
                  <input type="number" min="0" max="100" value={exportOptions.watermarkOpacity} onChange={(event) => patchExport({ watermarkOpacity: Number(event.target.value) })} />
                </label>
                <label className="field">
                  <span>Watermark Position</span>
                  <select value={exportOptions.watermarkPosition} onChange={(event) => patchExport({ watermarkPosition: event.target.value as ExportOptions["watermarkPosition"] })}>
                    <option value="bottom-right">Bottom right</option>
                    <option value="bottom-left">Bottom left</option>
                    <option value="top-right">Top right</option>
                    <option value="top-left">Top left</option>
                    <option value="center">Center</option>
                  </select>
                </label>
              </div>
              <p className="muted small-text">Variables: {"{design}"}, {"{mockup}"}, {"{index}"}, {"{date}"}, {"{preset}"}, {"{ext}"}. ZIP includes _openmockup-report.csv.</p>
            </div>
          </details>
        </section>

        <details className="details-card">
          <summary>Advanced Tools</summary>
          <div className="details-card__content">
            <section className="export-panel export-panel--nested">
              <div className="panel__header"><h2>Render History</h2><button type="button" onClick={onClearHistory} disabled={!history.length}>Clear</button></div>
              {history.length ? (
                <div className="history-list">
                  {history.slice(0, 6).map((item) => (
                    <p key={item.id}><strong>{item.mode}</strong> — {item.exported} ok / {item.failed} failed — {item.mockups} mockups × {item.designs} designs — {item.date}</p>
                  ))}
                </div>
              ) : <p className="muted small-text">No renders yet.</p>}
            </section>

            <div className="preset-row">
              <button type="button" onClick={onSavePreset}>Export Preset JSON</button>
              <label className="button-like">
                Import Preset JSON
                <input type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) onLoadPreset(file); event.target.value = ""; }} />
              </label>
            </div>
          </div>
        </details>
      </div>
    </section>
  );
}

function EmptyPreview({ isBusy, modeLabel }: { isBusy: boolean; modeLabel: string }) {
  return <div className="empty-preview"><span>{isBusy ? `${modeLabel} are rendering...` : "Preview appears after the first run"}</span></div>;
}

function getProfileIcon(name: string): string {
  const normalized = name.toLowerCase();
  if (normalized.includes("mug") || normalized.includes("cup")) return "☕";
  if (normalized.includes("hoodie")) return "🧥";
  if (normalized.includes("shirt")) return "👕";
  if (normalized.includes("bag")) return "👜";
  if (normalized.includes("pillow")) return "🛋️";
  if (normalized.includes("poster") || normalized.includes("print")) return "🖼️";
  if (normalized.includes("sticker")) return "🏷️";
  return "✨";
}
