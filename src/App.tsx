import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileDrop } from "./components/FileDrop";
import { PhotopeaFrame } from "./components/PhotopeaFrame";
import { PreviewPane } from "./components/PreviewPane";
import { SettingsPanel } from "./components/SettingsPanel";
import { downloadZip, readPreset, safeOutputName, savePreset } from "./lib/export/download";
import { PhotopeaClient } from "./lib/photopea";
import type { ExportResult, LoadedAsset, MockupSettings, ProgressState } from "./types";

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error(`Could not load image dimensions from ${file.name}`));
    img.src = URL.createObjectURL(file);
  });
}

const defaultSettings: MockupSettings = {
  smartObjectName: "YouR Logo hERE",
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

export default function App() {
  const photopeaClientRef = useRef<PhotopeaClient | null>(null);
  const [psd, setPsd] = useState<File | undefined>();
  const [designs, setDesigns] = useState<LoadedAsset[]>([]);
  const [settings, setSettings] = useState<MockupSettings>(defaultSettings);
  const [preview, setPreview] = useState<ExportResult | undefined>();
  const [progress, setProgress] = useState<ProgressState | undefined>();
  const [status, setStatus] = useState("Loading Photopea...");
  const [stepLabel, setStepLabel] = useState<string>("");
  const [isBusy, setBusy] = useState(false);

  const handlePhotopeaFrame = useCallback((iframe: HTMLIFrameElement | null) => {
    if (!iframe || photopeaClientRef.current) return;

    const client = new PhotopeaClient(iframe, (info) => {
      // Update step label in the UI status pill
      if (info.startedAt && !info.durationMs) {
        setStepLabel(info.label);
      } else if (info.durationMs !== undefined) {
        // Step completed — clear or show duration briefly
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
    return () => {
      designs.forEach((design) => URL.revokeObjectURL(design.url));
      if (preview) URL.revokeObjectURL(preview.url);
    };
  }, [designs, preview]);

  const canRun = useMemo(() => Boolean(psd && designs.length > 0 && settings.smartObjectName.trim()), [psd, designs, settings]);

  function handleDesigns(files: File[]): void {
    designs.forEach((design) => URL.revokeObjectURL(design.url));
    setDesigns(
      files.map((file) => ({
        id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        url: URL.createObjectURL(file),
      })),
    );
  }

  async function generatePreview(): Promise<void> {
    if (!canRun || !psd || !photopeaClientRef.current) {
      setStatus("Please add a PSD, at least one design, and a layer name.");
      return;
    }

    setBusy(true);
    setProgress({ current: 0, total: 1, label: "Rendering preview" });
    try {
      const { width: designWidth, height: designHeight } = await getImageDimensions(designs[0].file);
      const blob = await photopeaClientRef.current.renderMockup(psd, designs[0].file, settings, designWidth, designHeight);
      if (preview) URL.revokeObjectURL(preview.url);
      setPreview({
        fileName: safeOutputName(designs[0].file.name, 0),
        blob,
        url: URL.createObjectURL(blob),
      });
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
    if (!canRun || !psd || !photopeaClientRef.current) {
      setStatus("Please check the PSD, designs, and layer name.");
      return;
    }

    setBusy(true);
    const results: ExportResult[] = [];
    try {
      for (let index = 0; index < designs.length; index += 1) {
        const design = designs[index];
        setProgress({ current: index, total: designs.length, label: `Export: ${design.file.name}` });
        const { width: dw, height: dh } = await getImageDimensions(design.file);
        const blob = await photopeaClientRef.current.renderMockup(psd, design.file, settings, dw, dh);
        results.push({
          fileName: safeOutputName(design.file.name, index),
          blob,
          url: URL.createObjectURL(blob),
        });
      }

      setProgress({ current: designs.length, total: designs.length, label: "Creating ZIP" });
      await downloadZip(results, "openmockup-export.zip");
      setStatus(`${results.length} mockups exported.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Batch export failed.");
    } finally {
      results.forEach((result) => URL.revokeObjectURL(result.url));
      setBusy(false);
      window.setTimeout(() => setProgress(undefined), 1200);
    }
  }

  async function loadPreset(file: File): Promise<void> {
    try {
      setSettings(await readPreset(file));
      setStatus("Preset loaded.");
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
              title="PSD-Mockup"
              hint="Choose a PSD"
              accept=".psd,application/octet-stream"
              onFiles={(files) => setPsd(files[0])}
              selectedLabel={psd?.name}
            />
            <FileDrop
              title="Designs"
              hint="Choose PNG/JPG files"
              accept="image/png,image/jpeg"
              multiple
              onFiles={handleDesigns}
              selectedLabel={designs.length ? `${designs.length} designs loaded` : undefined}
            />
          </section>
          <SettingsPanel settings={settings} onChange={setSettings} />
        </aside>

        <PreviewPane
          psdName={psd?.name}
          designs={designs}
          preview={preview}
          progress={progress}
          isBusy={isBusy}
          onPreview={generatePreview}
          onBatch={exportBatch}
          onSavePreset={() => savePreset(settings)}
          onLoadPreset={loadPreset}
        />
      </div>

      <PhotopeaFrame ref={handlePhotopeaFrame} />
    </main>
  );
}
