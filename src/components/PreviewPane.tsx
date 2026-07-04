import type { BatchError, ExportOptions, ExportResult, LoadedAsset, ProgressState } from "../types";

interface PreviewPaneProps {
  psdNames: string[];
  designs: LoadedAsset[];
  preview?: ExportResult;
  progress?: ProgressState;
  batchErrors: BatchError[];
  isBusy: boolean;
  exportOptions: ExportOptions;
  onExportOptionsChange: (options: ExportOptions) => void;
  onPreview: () => void;
  onBatch: () => void;
  onSavePreset: () => void;
  onLoadPreset: (file: File) => void;
}

export function PreviewPane({
  psdNames,
  designs,
  preview,
  progress,
  batchErrors,
  isBusy,
  exportOptions,
  onExportOptionsChange,
  onPreview,
  onBatch,
  onSavePreset,
  onLoadPreset,
}: PreviewPaneProps) {
  function patchExport(update: Partial<ExportOptions>): void {
    onExportOptionsChange({ ...exportOptions, ...update });
  }

  const totalExports = Math.max(0, psdNames.length * designs.length);

  return (
    <section className="workspace">
      <div className="workspace__topbar">
        <div>
          <h2>Preview</h2>
          <p>{psdNames.length ? `${psdNames.length} PSD${psdNames.length === 1 ? "" : "s"}: ${psdNames.join(", ")}` : "No PSD loaded yet"}</p>
        </div>
        <div className="actions">
          <button type="button" onClick={onPreview} disabled={isBusy}>
            Generate Preview
          </button>
          <button type="button" className="button-primary" onClick={onBatch} disabled={isBusy || totalExports === 0}>
            Export All{totalExports ? ` (${totalExports})` : ""}
          </button>
        </div>
      </div>

      <div className="preview-stage">
        {preview ? <img src={preview.url} alt="Generated mockup preview" /> : <EmptyPreview isBusy={isBusy} />}
      </div>

      {progress ? (
        <div className="progress">
          <span>{progress.label}</span>
          <progress value={progress.current} max={progress.total} />
          <strong>
            {progress.current}/{progress.total}
          </strong>
        </div>
      ) : null}

      {batchErrors.length ? (
        <details className="error-list" open>
          <summary>{batchErrors.length} export error{batchErrors.length === 1 ? "" : "s"}</summary>
          {batchErrors.map((error, index) => (
            <p key={`${error.mockupName}-${error.designName}-${index}`}>
              <strong>{error.mockupName}</strong> + <strong>{error.designName}</strong>: {error.message}
            </p>
          ))}
        </details>
      ) : null}

      <section className="export-panel">
        <div className="panel__header">
          <h2>Export Options</h2>
        </div>
        <div className="export-grid">
          <label className="field field--wide">
            <span>Filename Template</span>
            <input
              value={exportOptions.filenameTemplate}
              onChange={(event) => patchExport({ filenameTemplate: event.target.value })}
              placeholder="{index}-{mockup}-{design}.{ext}"
            />
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
            <input
              type="number"
              min="1"
              max="100"
              value={exportOptions.quality}
              disabled={exportOptions.format === "png"}
              onChange={(event) => patchExport({ quality: Number(event.target.value) })}
            />
          </label>
          <label className="field">
            <span>JPG/WebP Background</span>
            <input type="color" value={exportOptions.backgroundColor} onChange={(event) => patchExport({ backgroundColor: event.target.value })} />
          </label>
        </div>
        <p className="muted small-text">
          Variables: {"{design}"}, {"{mockup}"}, {"{index}"}, {"{date}"}, {"{preset}"}, {"{ext}"}
        </p>
      </section>

      <div className="design-strip">
        {designs.length === 0 ? (
          <span className="muted">No designs loaded yet</span>
        ) : (
          designs.map((design) => (
            <figure key={design.id}>
              <img src={design.url} alt={design.file.name} />
              <figcaption>{design.file.name}</figcaption>
            </figure>
          ))
        )}
      </div>

      <div className="preset-row">
        <button type="button" onClick={onSavePreset}>
          Export Preset JSON
        </button>
        <label className="button-like">
          Import Preset JSON
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onLoadPreset(file);
              event.target.value = "";
            }}
          />
        </label>
      </div>
    </section>
  );
}

function EmptyPreview({ isBusy }: { isBusy: boolean }) {
  return (
    <div className="empty-preview">
      <span>{isBusy ? "Photopea is rendering..." : "Preview appears after the first run"}</span>
    </div>
  );
}
