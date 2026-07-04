import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileDrop } from "./components/FileDrop";
import { PhotopeaFrame } from "./components/PhotopeaFrame";
import { PreviewPane } from "./components/PreviewPane";
import { SettingsPanel, shirtPlacementDefaults } from "./components/SettingsPanel";
import { downloadZip, readPreset, renderFileName, safeOutputName, savePreset } from "./lib/export/download";
import { PhotopeaClient } from "./lib/photopea";
import type {
  BatchError,
  ExportFormat,
  ExportOptions,
  ExportResult,
  LoadedAsset,
  MockupSettings,
  ProgressState,
  SavedPreset,
} from "./types";

const PRESETS_STORAGE_KEY = "openmockup.presets.v2";
const DEFAULT_PRESET_ID = "tshirt-front-standard";

const defaultSettings: MockupSettings = {
  smartObjectName: "YouR Logo hERE",
  ...shirtPlacementDefaults,
};

const defaultExportOptions: ExportOptions = {
  filenameTemplate: "{index}-{mockup}-{design}.{ext}",
  zipName: "openmockup-export.zip",
  format: "png",
  quality: 92,
  backgroundColor: "#ffffff",
};

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not load image dimensions from ${file.name}`));
    };
    img.src = url;
  });
}

function makeAsset(file: File): LoadedAsset {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
    file,
    url: URL.createObjectURL(file),
  };
}

function loadStoredPresets(): SavedPreset[] {
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

function saveStoredPresets(presets: SavedPreset[]): void {
  window.localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(blob);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not convert exported image."));
    };
    image.src = url;
  });
}

async function convertExportBlob(blob: Blob, options: ExportOptions): Promise<Blob> {
  if (options.format === "png") return blob;

  const image = await loadImageFromBlob(blob);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not convert export format.");

  ctx.fillStyle = options.backgroundColor || "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0);

  const mimeType = options.format === "webp" ? "image/webp" : "image/jpeg";
  const quality = Math.max(1, Math.min(100, Number(options.quality) || 92)) / 100;

  return new Promise((resolve, reject) => {
    canvas.toBlob((converted) => {
      if (!converted) {
        reject(new Error(`Could not create ${options.format.toUpperCase()} export.`));
        return;
      }
      resolve(converted);
    }, mimeType, quality);
  });
}

export default function App() {
  const photopeaClientRef = useRef<PhotopeaClient | null>(null);
  const [psds, setPsds] = useState<LoadedAsset[]>([]);
  const [designs, setDesigns] = useState<LoadedAsset[]>([]);
  const [settings, setSettings] = useState<MockupSettings>(defaultSettings);
  const [exportOptions, setExportOptions] = useState<ExportOptions>(defaultExportOptions);
  const [presets, setPresets] = useState<SavedPreset[]>(() => loadStoredPresets());
  const [activePresetId, setActivePresetId] = useState(DEFAULT_PRESET_ID);
  const [preview, setPreview] = useState<ExportResult | undefined>();
  const [progress, setProgress] = useState<ProgressState | undefined>();
  const [batchErrors, setBatchErrors] = useState<BatchError[]>([]);
  const [status, setStatus] = useState("Loading Photopea...");
  const [stepLabel, setStepLabel] = useState<string>("");
  const [isBusy, setBusy] = useState(false);

  const handlePhotopeaFrame = useCallback((iframe: HTMLIFrameElement | null) => {
    if (!iframe || photopeaClientRef.current) return;

    const client = new PhotopeaClient(iframe, (info) => {
      if (info.startedAt && !info.durationMs) {
        setStepLabel(info.label);
      } else if (info.durationMs !== undefined) {
        if (info.step !== "photopea") {
          setStepLabel(`Done: ${info.label} (${(info.durationMs / 1000).toFixed(1)}s)`);
          setTimeout(() => setStepLabel(""), 500);
        }
      }
    });
    photopeaClientRef.current = client;
    client
      .waitUntilReady()
      .then(() => setStatus("Ready for PSDs and designs."))
      .catch((error) => setStatus(error instanceof Error ? error.message : "Photopea could not be loaded."));
    return;
  }, []);

  useEffect(() => {
    saveStoredPresets(presets);
  }, [presets]);

  useEffect(() => {
    return () => {
      psds.forEach((asset) => URL.revokeObjectURL(asset.url));
      designs.forEach((asset) => URL.revokeObjectURL(asset.url));
      if (preview) URL.revokeObjectURL(preview.url);
    };
  }, [psds, designs, preview]);

  const canRun = useMemo(
    () => Boolean(psds.length > 0 && designs.length > 0 && settings.smartObjectName.trim()),
    [psds, designs, settings],
  );

  const activePreset = useMemo(
    () => presets.find((preset) => preset.id === activePresetId),
    [presets, activePresetId],
  );

  function handlePsds(files: File[]): void {
    psds.forEach((asset) => URL.revokeObjectURL(asset.url));
    setPsds(files.map(makeAsset));
    photopeaClientRef.current?.resetPsdCache();
  }

  function handleDesigns(files: File[]): void {
    designs.forEach((design) => URL.revokeObjectURL(design.url));
    setDesigns(files.map(makeAsset));
  }

  async function renderOne(psd: File, design: File, itemIndex: number, presetName?: string): Promise<ExportResult> {
    if (!photopeaClientRef.current) throw new Error("Photopea is not ready.");
    const { width: designWidth, height: designHeight } = await getImageDimensions(design);
    const pngBlob = await photopeaClientRef.current.renderMockup(psd, design, settings, designWidth, designHeight);
    const blob = await convertExportBlob(pngBlob, exportOptions);
    const fileName = renderFileName(exportOptions.filenameTemplate, {
      designName: design.name,
      mockupName: psd.name,
      index: itemIndex,
      presetName,
      format: exportOptions.format,
    });

    return {
      fileName,
      blob,
      url: URL.createObjectURL(blob),
    };
  }

  async function generatePreview(): Promise<void> {
    if (!canRun || !photopeaClientRef.current) {
      setStatus("Please add at least one PSD, at least one design, and a layer name.");
      return;
    }

    setBusy(true);
    setBatchErrors([]);
    setProgress({ current: 0, total: 1, label: "Rendering preview" });
    try {
      const result = await renderOne(psds[0].file, designs[0].file, 0, activePreset?.name);
      if (preview) URL.revokeObjectURL(preview.url);
      setPreview({ ...result, fileName: safeOutputName(designs[0].file.name, 0, exportOptions.format) });
      setProgress({ current: 1, total: 1, label: "Preview complete" });
      setStatus("Preview generated.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Preview could not be generated.");
    } finally {
      setBusy(false);
      window.setTimeout(() => setProgress(undefined), 1200);
    }
  }

  async function exportBatch(): Promise<void> {
    if (!canRun || !photopeaClientRef.current) {
      setStatus("Please check the PSDs, designs, and layer name.");
      return;
    }

    setBusy(true);
    setBatchErrors([]);
    const results: ExportResult[] = [];
    const errors: BatchError[] = [];
    const total = psds.length * designs.length;
    let itemIndex = 0;

    try {
      for (const mockup of psds) {
        for (const design of designs) {
          setProgress({ current: itemIndex, total, label: `Export: ${mockup.file.name} + ${design.file.name}` });
          try {
            const result = await renderOne(mockup.file, design.file, itemIndex, activePreset?.name);
            results.push(result);
          } catch (error) {
            errors.push({
              mockupName: mockup.file.name,
              designName: design.file.name,
              message: error instanceof Error ? error.message : "Unknown render error",
            });
          }
          itemIndex += 1;
          // Small pause keeps Photopea from receiving consecutive commands too aggressively.
          await new Promise((resolve) => window.setTimeout(resolve, 350));
        }
      }

      setBatchErrors(errors);
      if (results.length === 0) {
        throw new Error(errors[0]?.message || "No mockups could be exported.");
      }

      setProgress({ current: total, total, label: "Creating ZIP" });
      await downloadZip(results, exportOptions.zipName, errors);
      setStatus(errors.length ? `${results.length} mockups exported, ${errors.length} failed. Error log added to ZIP.` : `${results.length} mockups exported.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Batch export failed.");
    } finally {
      results.forEach((result) => URL.revokeObjectURL(result.url));
      setBusy(false);
      window.setTimeout(() => setProgress(undefined), 1600);
    }
  }

  function applyPreset(id: string): void {
    const preset = presets.find((item) => item.id === id);
    if (!preset) return;
    setSettings(preset.settings);
    setActivePresetId(id);
    setStatus(`Preset loaded: ${preset.name}`);
  }

  function saveCurrentPreset(): void {
    const existing = activePresetId ? presets.find((preset) => preset.id === activePresetId) : undefined;
    const enteredName = window.prompt("Preset name", existing?.name || "New Preset");
    const name = enteredName?.trim();
    if (!name) return;

    const id = existing && existing.id !== DEFAULT_PRESET_ID ? existing.id : crypto.randomUUID();
    const nextPreset: SavedPreset = { id, name, settings, updatedAt: Date.now() };
    setPresets((current) => {
      const withoutOld = current.filter((preset) => preset.id !== id);
      return [...withoutOld, nextPreset].sort((a, b) => a.name.localeCompare(b.name));
    });
    setActivePresetId(id);
    setStatus(`Preset saved: ${name}`);
  }

  function deletePreset(id: string): void {
    if (id === DEFAULT_PRESET_ID) {
      setStatus("The default preset cannot be deleted.");
      return;
    }
    const preset = presets.find((item) => item.id === id);
    if (!preset) return;
    if (!window.confirm(`Delete preset "${preset.name}"?`)) return;
    setPresets((current) => current.filter((item) => item.id !== id));
    setActivePresetId(DEFAULT_PRESET_ID);
    setStatus(`Preset deleted: ${preset.name}`);
  }

  async function loadPreset(file: File): Promise<void> {
    try {
      const importedSettings = await readPreset(file);
      setSettings(importedSettings);
      const id = crypto.randomUUID();
      const name = file.name.replace(/\.json$/i, "") || "Imported preset";
      setPresets((current) => [...current, { id, name, settings: importedSettings, updatedAt: Date.now() }]);
      setActivePresetId(id);
      setStatus("Preset imported and loaded.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Preset could not be loaded.");
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Local bulk mockup tool</p>
          <h1>OpenMockup Studio</h1>
        </div>
        <span className="status-pill">{stepLabel ? `${status} — ${stepLabel}` : status}</span>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <section className="panel">
            <div className="panel__header">
              <h2>Files</h2>
            </div>
            <FileDrop
              title="PSD-Mockups"
              hint="Choose one or more PSDs"
              accept=".psd,application/octet-stream"
              multiple
              onFiles={handlePsds}
              selectedLabel={psds.length ? `${psds.length} PSD${psds.length === 1 ? "" : "s"}: ${psds.map((item) => item.file.name).join(", ")}` : undefined}
            />
            <FileDrop
              title="Designs"
              hint="Choose PNG/JPG files"
              accept="image/png,image/jpeg"
              multiple
              onFiles={handleDesigns}
              selectedLabel={designs.length ? `${designs.length} design${designs.length === 1 ? "" : "s"} loaded` : undefined}
            />
          </section>
          <SettingsPanel
            settings={settings}
            onChange={setSettings}
            presets={presets}
            activePresetId={activePresetId}
            onApplyPreset={applyPreset}
            onSavePreset={saveCurrentPreset}
            onDeletePreset={deletePreset}
          />
        </aside>

        <PreviewPane
          psdNames={psds.map((item) => item.file.name)}
          designs={designs}
          preview={preview}
          progress={progress}
          batchErrors={batchErrors}
          isBusy={isBusy}
          exportOptions={exportOptions}
          onExportOptionsChange={setExportOptions}
          onPreview={generatePreview}
          onBatch={exportBatch}
          onSavePreset={() => savePreset(settings, activePreset?.name)}
          onLoadPreset={loadPreset}
        />
      </div>

      <PhotopeaFrame ref={handlePhotopeaFrame} />
    </main>
  );
}
