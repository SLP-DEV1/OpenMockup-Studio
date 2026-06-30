import type { ExportResult, LoadedAsset, ProgressState } from "../types";

interface PreviewPaneProps {
  psdName?: string;
  designs: LoadedAsset[];
  preview?: ExportResult;
  progress?: ProgressState;
  isBusy: boolean;
  onPreview: () => void;
  onBatch: () => void;
  onSavePreset: () => void;
  onLoadPreset: (file: File) => void;
}

export function PreviewPane({
  psdName,
  designs,
  preview,
  progress,
  isBusy,
  onPreview,
  onBatch,
  onSavePreset,
  onLoadPreset,
}: PreviewPaneProps) {
  return (
    <section className="workspace">
      <div className="workspace__topbar">
        <div>
          <h2>Preview</h2>
          <p>{psdName ? `PSD: ${psdName}` : "No PSD loaded yet"}</p>
        </div>
        <div className="actions">
          <button type="button" onClick={onPreview} disabled={isBusy}>
            Generate Preview
          </button>
          <button type="button" className="button-primary" onClick={onBatch} disabled={isBusy}>
            Export Batch
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
          Save Preset
        </button>
        <label className="button-like">
          Load Preset
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
