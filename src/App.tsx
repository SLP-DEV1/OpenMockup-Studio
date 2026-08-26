import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileDrop } from "./components/FileDrop";
import { PhotopeaFrame } from "./components/PhotopeaFrame";
import { PreviewPane } from "./components/PreviewPane";
import { SettingsPanel } from "./components/SettingsPanel";
import { VisualPlacementEditor } from "./components/VisualPlacementEditor";
import { buildAutoPreviewKey } from "./lib/app/autoPreviewKey";
import { exportProfiles, isMugProductProfileId, productProfiles } from "./lib/config/profiles";
import {
  analyseMockupAsset,
  buildDesignWarnings,
  defaultExportOptions,
  defaultSettings,
  detectMockupKind,
  fallbackDocumentSize,
  getImageModeSettings,
  getLockedSmartSlotFromBounds,
  makeAsset,
  revokeAssetUrls,
  revokeResultUrls,
  type MockupKind,
  type MockupMeta,
} from "./lib/app/mockups";
import {
  DEFAULT_PRESET_ID,
  loadStoredHistory,
  loadStoredPresets,
  loadStoredTheme,
  saveStoredHistory,
  saveStoredPresets,
  saveStoredTheme,
} from "./lib/app/persistence";
import { updatePreviewCache } from "./lib/app/previewCache";
import { convertExportBlob } from "./lib/export/convert";
import { downloadZip, readPreset, renderFileName, savePreset } from "./lib/export/download";
import { PhotopeaClient } from "./lib/photopea";
import { getImageDimensions } from "./lib/images";
import { renderImageMockup } from "./lib/renderImageMockup";
import type {
  BatchError,
  ExportOptions,
  ExportResult,
  LoadedAsset,
  MockupSettings,
  ProgressState,
  RenderHistoryItem,
  SavedPreset,
} from "./types";

export default function App() {
  const photopeaClientRef = useRef<PhotopeaClient | null>(null);
  const cancelBatchRef = useRef(false);
  const autoPreviewTimerRef = useRef<number | undefined>(undefined);
  const lastAutoPreviewKeyRef = useRef<string>("");
  const isBusyRef = useRef(false);
  const mockupsRef = useRef<LoadedAsset[]>([]);
  const designsRef = useRef<LoadedAsset[]>([]);
  const previewRef = useRef<ExportResult | undefined>(undefined);
  const previewCacheRef = useRef<Record<string, ExportResult>>({});
  const previewGalleryRef = useRef<ExportResult[]>([]);
  const mockupLoadGenerationRef = useRef(0);
  const designLoadGenerationRef = useRef(0);

  const [mockups, setMockups] = useState<LoadedAsset[]>([]);
  const [designs, setDesigns] = useState<LoadedAsset[]>([]);
  const [activeMockupId, setActiveMockupId] = useState<string>("");
  const [activeDesignId, setActiveDesignId] = useState<string>("");
  const [mockupMetaById, setMockupMetaById] = useState<Record<string, MockupMeta>>({});
  const [settingsByMockupId, setSettingsByMockupId] = useState<Record<string, MockupSettings>>({});
  const [designDimensions, setDesignDimensions] = useState<Record<string, { width: number; height: number }>>({});
  const [settings, setSettings] = useState<MockupSettings>(defaultSettings);
  const [exportOptions, setExportOptions] = useState<ExportOptions>(defaultExportOptions);
  const [presets, setPresets] = useState<SavedPreset[]>(() => loadStoredPresets(defaultSettings));
  const [activePresetId, setActivePresetId] = useState(DEFAULT_PRESET_ID);
  const [preview, setPreview] = useState<ExportResult | undefined>();
  const [previewCache, setPreviewCache] = useState<Record<string, ExportResult>>({});
  const [previewGallery, setPreviewGallery] = useState<ExportResult[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">(() => loadStoredTheme());
  const [progress, setProgress] = useState<ProgressState | undefined>();
  const [batchErrors, setBatchErrors] = useState<BatchError[]>([]);
  const [history, setHistory] = useState<RenderHistoryItem[]>(() => loadStoredHistory());
  const [status, setStatus] = useState("Ready for image mockups. PSD renderer loads only when needed.");
  const [stepLabel, setStepLabel] = useState<string>("");
  const [isBusy, setBusy] = useState(false);
  const [autoPreview, setAutoPreview] = useState(true);
  const [isPhotopeaReady, setPhotopeaReady] = useState(false);

  const activeMockup = useMemo(
    () => mockups.find((mockup) => mockup.id === activeMockupId) || mockups[0],
    [activeMockupId, mockups],
  );
  const activeDesign = useMemo(
    () => designs.find((design) => design.id === activeDesignId) || designs[0],
    [activeDesignId, designs],
  );
  const activeMockupMeta = activeMockup ? mockupMetaById[activeMockup.id] : undefined;
  const activeMockupKind = activeMockupMeta?.kind ?? detectMockupKind(activeMockup?.file);
  const documentSize = activeMockupMeta?.documentSize ?? fallbackDocumentSize;
  const smartObjectCandidates = activeMockupMeta?.smartObjectCandidates ?? [];
  const smartObjectBounds = activeMockupMeta?.smartObjectBounds;
  const smartObjectDetectionLabel = activeMockupMeta?.smartObjectDetectionLabel ?? "Smart layer auto-detect waits for a PSD.";
  const activeProductProfileId = activeMockupMeta?.productProfileId ?? "tshirt-front";
  const activeProductProfile = useMemo(
    () => productProfiles.find((profile) => profile.id === activeProductProfileId) || productProfiles[0],
    [activeProductProfileId],
  );
  const needsPhotopea = useMemo(
    () => mockups.some((mockup) => (mockupMetaById[mockup.id]?.kind ?? detectMockupKind(mockup.file)) === "psd"),
    [mockupMetaById, mockups],
  );
  const canRun = Boolean(activeMockup && activeDesign);
  const activePreset = useMemo(() => presets.find((preset) => preset.id === activePresetId), [presets, activePresetId]);
  const designWarnings = useMemo(() => buildDesignWarnings(designDimensions, designs), [designDimensions, designs]);
  const exportViewFingerprint = useMemo(
    () => ({
      format: exportOptions.format,
      quality: exportOptions.quality,
      backgroundColor: exportOptions.backgroundColor,
      maxLongSide: exportOptions.maxLongSide,
      cropPreset: exportOptions.cropPreset,
      watermarkText: exportOptions.watermarkText,
      watermarkOpacity: exportOptions.watermarkOpacity,
      watermarkPosition: exportOptions.watermarkPosition,
    }),
    [
      exportOptions.format,
      exportOptions.quality,
      exportOptions.backgroundColor,
      exportOptions.maxLongSide,
      exportOptions.cropPreset,
      exportOptions.watermarkText,
      exportOptions.watermarkOpacity,
      exportOptions.watermarkPosition,
    ],
  );

  const currentPreviewCacheKey = useMemo(
    () => JSON.stringify({
      mockupId: activeMockup?.id || "",
      designId: activeDesign?.id || "",
      mockupKind: activeMockupKind,
      settings,
      exportView: exportViewFingerprint,
    }),
    [activeMockup?.id, activeDesign?.id, activeMockupKind, settings, exportViewFingerprint],
  );

  const currentAutoPreviewKey = useMemo(
    () => buildAutoPreviewKey({
      mockupId: activeMockup?.id || "",
      designId: activeDesign?.id || "",
      mockupKind: activeMockupKind,
      settings,
      exportView: exportViewFingerprint,
    }),
    [activeMockup?.id, activeDesign?.id, activeMockupKind, settings, exportViewFingerprint],
  );

  const handlePhotopeaFrame = useCallback((iframe: HTMLIFrameElement | null) => {
    if (!iframe) {
      photopeaClientRef.current?.destroy();
      photopeaClientRef.current = null;
      setPhotopeaReady(false);
      return;
    }
    if (photopeaClientRef.current) return;

    setPhotopeaReady(false);
    const client = new PhotopeaClient(iframe, (info) => {
      if (info.startedAt && !info.durationMs) {
        setStepLabel(info.label);
      } else if (info.durationMs !== undefined && info.step !== "photopea") {
        setStepLabel(`Done: ${info.label} (${(info.durationMs / 1000).toFixed(1)}s)`);
        setTimeout(() => setStepLabel(""), 500);
      }
    });
    photopeaClientRef.current = client;
    client
      .waitUntilReady()
      .then(() => {
        setPhotopeaReady(true);
        setStatus("Photopea ready for PSD mockups.");
      })
      .catch((error) => {
        setPhotopeaReady(false);
        setStatus(error instanceof Error ? error.message : "Photopea could not be loaded.");
      });
  }, []);

  useEffect(() => { mockupsRef.current = mockups; }, [mockups]);
  useEffect(() => { designsRef.current = designs; }, [designs]);
  useEffect(() => { isBusyRef.current = isBusy; }, [isBusy]);
  useEffect(() => { previewRef.current = preview; }, [preview]);
  useEffect(() => { previewCacheRef.current = previewCache; }, [previewCache]);
  useEffect(() => { previewGalleryRef.current = previewGallery; }, [previewGallery]);
  useEffect(() => { saveStoredPresets(presets); }, [presets]);
  useEffect(() => { saveStoredHistory(history); }, [history]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveStoredTheme(theme);
  }, [theme]);

  useEffect(() => {
    return () => {
      revokeAssetUrls(mockupsRef.current);
      revokeAssetUrls(designsRef.current);
      mockupLoadGenerationRef.current += 1;
      designLoadGenerationRef.current += 1;
      if (autoPreviewTimerRef.current) window.clearTimeout(autoPreviewTimerRef.current);
      revokeResultUrls(Object.values(previewCacheRef.current));
      revokeResultUrls(previewGalleryRef.current);
      photopeaClientRef.current?.destroy();
      photopeaClientRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (needsPhotopea && !photopeaClientRef.current) {
      setStatus("Loading Photopea for PSD mockups...");
    }
  }, [needsPhotopea]);

  function clearPreview(): void {
    setPreview(undefined);
  }

  function clearPreviewCache(): void {
    setPreviewCache((current) => {
      revokeResultUrls(Object.values(current));
      return {};
    });
    previewCacheRef.current = {};
  }

  function clearPreviewGallery(): void {
    setPreviewGallery((current) => {
      revokeResultUrls(current);
      return [];
    });
  }

  function clearRenderedOutputs(): void {
    clearPreview();
    clearPreviewCache();
    clearPreviewGallery();
  }

  function commitSettings(nextSettings: MockupSettings): void {
    setSettings(nextSettings);
    const id = activeMockup?.id;
    if (id) {
      setSettingsByMockupId((current) => ({ ...current, [id]: nextSettings }));
    }
  }

  async function handleMockups(files: File[]): Promise<void> {
    const loadGeneration = ++mockupLoadGenerationRef.current;
    lastAutoPreviewKeyRef.current = "";
    revokeAssetUrls(mockupsRef.current);
    const assets = files.map(makeAsset);
    setMockups(assets);
    setActiveMockupId(assets[0]?.id || "");
    setMockupMetaById({});
    setSettingsByMockupId({});
    clearRenderedOutputs();
    photopeaClientRef.current?.resetPsdCache();

    if (!assets.length) {
      setSettings(defaultSettings);
      setStatus("No mockups loaded.");
      return;
    }

    setStatus(`Analysing ${assets.length} mockup${assets.length === 1 ? "" : "s"}...`);
    const nextMeta: Record<string, MockupMeta> = {};
    const nextSettings: Record<string, MockupSettings> = {};
    const statuses: string[] = [];

    for (const asset of assets) {
      const analysed = await analyseMockupAsset(asset);
      if (loadGeneration !== mockupLoadGenerationRef.current) return;
      nextMeta[asset.id] = analysed.meta;
      nextSettings[asset.id] = analysed.settings;
      statuses.push(analysed.status);
    }

    setMockupMetaById(nextMeta);
    setSettingsByMockupId(nextSettings);
    setSettings(nextSettings[assets[0].id] || defaultSettings);
    setStatus(assets.length > 1 ? `${assets.length} mockups loaded. Active: ${assets[0].file.name}` : statuses[0]);
  }

  async function handleDesigns(files: File[]): Promise<void> {
    const loadGeneration = ++designLoadGenerationRef.current;
    lastAutoPreviewKeyRef.current = "";
    revokeAssetUrls(designsRef.current);
    const assets = files.map(makeAsset);
    setDesigns(assets);
    setActiveDesignId(assets[0]?.id || "");
    clearRenderedOutputs();

    const nextDimensions: Record<string, { width: number; height: number }> = {};
    await Promise.all(
      assets.map(async (asset) => {
        try { nextDimensions[asset.id] = await getImageDimensions(asset.file); } catch {}
      }),
    );
    if (loadGeneration !== designLoadGenerationRef.current) return;
    setDesignDimensions(nextDimensions);
    setStatus(assets.length ? `${assets.length} design${assets.length === 1 ? "" : "s"} loaded. Click a thumbnail to edit it.` : "No designs loaded.");
  }

  function selectMockup(id: string): void {
    const mockup = mockups.find((item) => item.id === id);
    if (!mockup) return;
    const nextSettings = settingsByMockupId[id] || defaultSettings;
    const nextKind = mockupMetaById[id]?.kind ?? detectMockupKind(mockup.file);
    setActiveMockupId(id);
    setSettings(nextSettings);
    clearPreviewGallery();
    const cachedPreview = activeDesign
      ? previewCacheRef.current[buildPreviewCacheKey(id, activeDesign.id, nextKind, nextSettings)]
      : undefined;
    setPreview(cachedPreview);
    setStatus(cachedPreview ? `Active mockup: ${mockup.file.name} · cached preview shown.` : `Active mockup: ${mockup.file.name}`);
  }

  function buildPreviewCacheKey(mockupId: string, designId: string, mockupKind: MockupKind, renderSettings: MockupSettings): string {
    return JSON.stringify({
      mockupId,
      designId,
      mockupKind,
      settings: renderSettings,
      exportView: exportViewFingerprint,
    });
  }

  function selectDesign(id: string): void {
    const design = designs.find((item) => item.id === id);
    if (!design) return;
    setActiveDesignId(id);
    const cachedPreview = activeMockup
      ? previewCacheRef.current[buildPreviewCacheKey(activeMockup.id, id, activeMockupKind, settings)]
      : undefined;
    if (cachedPreview) {
      setPreview(cachedPreview);
      setStatus(`Active design: ${design.file.name} · cached preview shown.`);
    } else if (autoPreview) {
      setPreview(undefined);
      setStatus(`Active design: ${design.file.name} · Auto Preview updating...`);
    } else {
      setStatus(`Active design: ${design.file.name} · preview kept until you move/scale it or click Refresh Preview.`);
    }
  }

  function addHistory(item: Omit<RenderHistoryItem, "id" | "date">): void {
    setHistory((current) => [
      { ...item, id: crypto.randomUUID(), date: new Date().toLocaleString() },
      ...current,
    ].slice(0, 12));
  }

  async function renderOne(mockup: LoadedAsset, design: LoadedAsset, itemIndex: number, presetName?: string, renderSettings?: MockupSettings): Promise<ExportResult> {
    const mockupKind = mockupMetaById[mockup.id]?.kind ?? detectMockupKind(mockup.file);
    const placementSettings = renderSettings || settingsByMockupId[mockup.id] || settings;
    let sourceBlob: Blob;

    if (mockupKind === "image") {
      sourceBlob = await renderImageMockup(mockup.file, design.file, placementSettings);
    } else {
      if (!photopeaClientRef.current) throw new Error("Photopea is not ready yet. Wait until the PSD renderer has loaded.");
      const cachedDimensions = designDimensions[design.id] ?? await getImageDimensions(design.file);
      sourceBlob = await photopeaClientRef.current.renderMockup(
        mockup.file,
        design.file,
        placementSettings,
        cachedDimensions.width,
        cachedDimensions.height,
      );
    }

    const blob = await convertExportBlob(sourceBlob, exportOptions);
    const fileName = renderFileName(exportOptions.filenameTemplate, {
      designName: design.file.name,
      mockupName: mockup.file.name,
      index: itemIndex,
      presetName,
      format: exportOptions.format,
    });

    return { fileName, blob, url: URL.createObjectURL(blob) };
  }

  async function generatePreview(source: "manual" | "auto" = "manual"): Promise<void> {
    if (autoPreviewTimerRef.current) {
      window.clearTimeout(autoPreviewTimerRef.current);
      autoPreviewTimerRef.current = undefined;
    }

    if (!activeMockup || !activeDesign) {
      setStatus("Please add at least one mockup and at least one design.");
      return;
    }

    if (activeMockupKind === "psd" && !isPhotopeaReady) {
      setStatus("Photopea is still loading. Auto Preview will continue once it is ready.");
      return;
    }

    const previewKey = currentPreviewCacheKey;
    lastAutoPreviewKeyRef.current = currentAutoPreviewKey;
    setBusy(true);
    clearPreviewGallery();
    setBatchErrors([]);
    setProgress({
      current: 0,
      total: 1,
      label: source === "auto" ? `Auto preview: ${activeDesign.file.name}` : `Rendering preview: ${activeDesign.file.name}`,
    });
    try {
      const result = await renderOne(activeMockup, activeDesign, 0, activePreset?.name, settings);
      setPreviewCache((current) => {
        const update = updatePreviewCache(current, previewKey, result);
        if (update.replaced && update.replaced.url !== result.url) URL.revokeObjectURL(update.replaced.url);
        revokeResultUrls(update.evicted.filter((item) => item.url !== result.url));
        return update.cache;
      });
      setPreview(result);
      setProgress({ current: 1, total: 1, label: source === "auto" ? "Auto preview updated" : "Preview complete" });
      setStatus(source === "auto"
        ? `Auto preview updated: ${activeDesign.file.name}`
        : activeMockupKind === "image" ? "Image mockup preview generated." : "PSD preview generated.");
      if (source === "manual") {
        addHistory({ mode: "preview", mockups: 1, designs: 1, exported: 1, failed: 0, presetName: activePreset?.name });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Preview could not be generated.";
      setBatchErrors([{ mockupName: activeMockup.file.name, designName: activeDesign.file.name, message }]);
      setStatus(source === "auto" ? `Auto preview failed: ${message}` : message);
      if (source === "manual") {
        addHistory({ mode: "preview", mockups: 1, designs: 1, exported: 0, failed: 1, presetName: activePreset?.name });
      }
    } finally {
      setBusy(false);
      window.setTimeout(() => setProgress(undefined), 1200);
    }
  }

  useEffect(() => {
    if (autoPreviewTimerRef.current) {
      window.clearTimeout(autoPreviewTimerRef.current);
      autoPreviewTimerRef.current = undefined;
    }

    if (!autoPreview || !canRun) return;
    if (lastAutoPreviewKeyRef.current === currentAutoPreviewKey) return;

    const cachedPreview = previewCacheRef.current[currentPreviewCacheKey];
    if (cachedPreview) {
      setPreview(cachedPreview);
      lastAutoPreviewKeyRef.current = currentAutoPreviewKey;
      setStatus("Cached preview shown. Move, scale or rotate the design to render a new version.");
      return;
    }

    if (activeMockupKind === "psd" && !isPhotopeaReady) {
      setStatus("Auto Preview waits for Photopea to finish loading...");
      return;
    }

    if (isBusy) return;

    autoPreviewTimerRef.current = window.setTimeout(() => {
      autoPreviewTimerRef.current = undefined;
      if (isBusyRef.current) return;
      lastAutoPreviewKeyRef.current = currentAutoPreviewKey;
      void generatePreview("auto");
    }, activeMockupKind === "psd" ? 900 : 450);

    return () => {
      if (autoPreviewTimerRef.current) {
        window.clearTimeout(autoPreviewTimerRef.current);
        autoPreviewTimerRef.current = undefined;
      }
    };
  }, [autoPreview, canRun, currentAutoPreviewKey, activeMockupKind, isPhotopeaReady, isBusy]);


  async function exportBatch(): Promise<void> {
    if (!mockups.length || !designs.length) {
      setStatus("Please check the mockups and designs.");
      return;
    }

    cancelBatchRef.current = false;
    setBusy(true);
    clearPreviewGallery();
    setBatchErrors([]);
    const results: ExportResult[] = [];
    const errors: BatchError[] = [];
    const total = mockups.length * designs.length;
    let itemIndex = 0;

    try {
      for (const mockup of mockups) {
        const renderSettings = settingsByMockupId[mockup.id] || settings;
        for (const design of designs) {
          if (cancelBatchRef.current) {
            setStatus("Batch export cancelled.");
            break;
          }
          setProgress({ current: itemIndex, total, label: `Export: ${mockup.file.name} + ${design.file.name}` });
          try {
            const result = await renderOne(mockup, design, itemIndex, activePreset?.name, renderSettings);
            results.push(result);
          } catch (error) {
            errors.push({ mockupName: mockup.file.name, designName: design.file.name, message: error instanceof Error ? error.message : "Unknown render error" });
          }
          itemIndex += 1;
          await new Promise((resolve) => window.setTimeout(resolve, 200));
        }
        if (cancelBatchRef.current) break;
      }

      setBatchErrors(errors);
      if (results.length === 0) throw new Error(errors[0]?.message || "No mockups could be exported.");

      setProgress({ current: itemIndex, total, label: "Creating ZIP" });
      await downloadZip(results, exportOptions.zipName, errors);
      setPreviewGallery(results);
      setStatus(errors.length ? `${results.length} mockups exported, ${errors.length} failed. Error log added to ZIP.` : `${results.length} mockups exported.`);
      addHistory({ mode: "batch", mockups: mockups.length, designs: designs.length, exported: results.length, failed: errors.length, presetName: activePreset?.name, zipName: exportOptions.zipName });
    } catch (error) {
      revokeResultUrls(results);
      setStatus(error instanceof Error ? error.message : "Batch export failed.");
      addHistory({ mode: "batch", mockups: mockups.length, designs: designs.length, exported: results.length, failed: Math.max(1, errors.length), presetName: activePreset?.name, zipName: exportOptions.zipName });
    } finally {
      setBusy(false);
      cancelBatchRef.current = false;
      window.setTimeout(() => setProgress(undefined), 1600);
    }
  }

  function cancelBatch(): void {
    cancelBatchRef.current = true;
    setStatus("Cancelling after current render...");
  }

  function applyPreset(id: string): void {
    const preset = presets.find((item) => item.id === id);
    if (!preset) return;
    commitSettings(preset.settings);
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
    if (id === DEFAULT_PRESET_ID) { setStatus("The default preset cannot be deleted."); return; }
    const preset = presets.find((item) => item.id === id);
    if (!preset || !window.confirm(`Delete preset "${preset.name}"?`)) return;
    setPresets((current) => current.filter((item) => item.id !== id));
    setActivePresetId(DEFAULT_PRESET_ID);
    setStatus(`Preset deleted: ${preset.name}`);
  }

  async function loadPreset(file: File): Promise<void> {
    try {
      const importedSettings = await readPreset(file);
      commitSettings(importedSettings);
      const id = crypto.randomUUID();
      const name = file.name.replace(/\.json$/i, "") || "Imported preset";
      setPresets((current) => [...current, { id, name, settings: importedSettings, updatedAt: Date.now() }]);
      setActivePresetId(id);
      setStatus("Preset imported and loaded.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Preset could not be loaded."); }
  }

  function applyProductProfile(id: string): void {
    const profile = productProfiles.find((item) => item.id === id);
    if (!profile) return;
    const lockedSlot = activeMockupKind === "psd" ? getLockedSmartSlotFromBounds(smartObjectBounds, documentSize) : null;
    const nextSettings: MockupSettings = activeMockupKind === "image"
      ? getImageModeSettings(profile)
      : { ...profile.settings, ...(lockedSlot ?? {}), smartObjectName: settings.smartObjectName };
    commitSettings(nextSettings);
    if (activeMockup) {
      setMockupMetaById((current) => ({
        ...current,
        [activeMockup.id]: { ...(current[activeMockup.id] || activeMockupMeta || { kind: activeMockupKind, documentSize, smartObjectCandidates, smartObjectDetectionLabel, productProfileId: profile.id }), productProfileId: profile.id },
      }));
    }
    if (profile.exportDefaults) setExportOptions((current) => ({ ...current, ...profile.exportDefaults }));
    setStatus(activeMockupKind === "image"
      ? `Image profile loaded: ${profile.name}`
      : isMugProductProfileId(profile.id)
        ? `Product profile loaded: ${profile.name} · ready for centered mug placement`
        : `Product profile loaded: ${profile.name}`);
  }

  function applyExportProfile(id: string): void {
    const profile = exportProfiles.find((item) => item.id === id);
    if (!profile) return;
    setExportOptions((current) => ({ ...current, ...profile.options }));
    setStatus(`Export profile loaded: ${profile.name}`);
  }

  function resetPlacementToActiveProduct(): void {
    const profile = productProfiles.find((item) => item.id === activeProductProfileId) || productProfiles[0];
    const lockedSlot = activeMockupKind === "psd" ? getLockedSmartSlotFromBounds(smartObjectBounds, documentSize) : null;
    const nextSettings: MockupSettings = activeMockupKind === "image"
      ? getImageModeSettings(profile)
      : { ...profile.settings, ...(lockedSlot ?? {}), smartObjectName: settings.smartObjectName };
    commitSettings(nextSettings);
    setStatus(`Placement reset: ${profile.name}`);
  }

  function centerDesignInPlacement(): void {
    commitSettings({
      ...settings,
      left: 0,
      top: 0,
      rotation: 0,
      width: 100,
      height: 100,
      anchor: "center",
      fitMode: activeProductProfileId === "mug-wrap" ? "cover" : "contain",
    });
    setStatus(isMugProductProfileId(activeProductProfileId)
      ? "Design centered for mug placement."
      : activeMockupKind === "image"
        ? "Design centered on the image mockup."
        : "Design centered inside the placement area.");
  }

  function moveDesign(index: number, direction: -1 | 1): void {
    setDesigns((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    clearPreviewGallery();
    setStatus("Design order updated.");
  }

  function toggleTheme(): void {
    setTheme((current) => current === "dark" ? "light" : "dark");
  }

  function clearHistory(): void {
    setHistory([]);
    setStatus("Render history cleared.");
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Local bulk mockup tool</p>
          <h1>OpenMockup Studio</h1>
        </div>
        <div className="header-actions">
          <button type="button" onClick={toggleTheme}>{theme === "dark" ? "Light UI" : "Dark UI"}</button>
          <span className="status-pill">{stepLabel ? `${status} — ${stepLabel}` : status}</span>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <section className="panel">
            <div className="panel__header"><h2>Files</h2></div>
            <FileDrop
              title="Mockups"
              hint="Choose PSD, PNG or JPG mockups"
              accept=".psd,image/png,image/jpeg,image/webp,application/octet-stream"
              multiple
              onFiles={handleMockups}
              selectedLabel={mockups.length ? `${mockups.length} mockup${mockups.length === 1 ? "" : "s"} loaded${activeMockup ? ` · active: ${activeMockup.file.name}` : ""}` : undefined}
            />
            <FileDrop title="Designs" hint="Choose PNG/JPG files" accept="image/png,image/jpeg,image/webp" multiple onFiles={handleDesigns} selectedLabel={designs.length ? `${designs.length} design${designs.length === 1 ? "" : "s"} loaded${activeDesign ? ` · active: ${activeDesign.file.name}` : ""}` : undefined} />
          </section>
          <SettingsPanel
            settings={settings}
            onChange={commitSettings}
            presets={presets}
            activePresetId={activePresetId}
            onApplyPreset={applyPreset}
            onSavePreset={saveCurrentPreset}
            onDeletePreset={deletePreset}
            smartObjectCandidates={smartObjectCandidates}
            smartObjectDetectionLabel={smartObjectDetectionLabel}
            currentProductProfileName={activeProductProfile?.name}
            smartObjectBounds={smartObjectBounds}
            documentSize={documentSize}
            onResetPlacement={resetPlacementToActiveProduct}
            onCenterDesign={centerDesignInPlacement}
            mode={activeMockupKind === "image" ? "image" : "psd"}
          />
        </aside>

        <PreviewPane
          mockups={mockups}
          activeMockupId={activeMockup?.id}
          mockupKind={activeMockupKind}
          designs={designs}
          activeDesignId={activeDesign?.id}
          preview={preview}
          previewGallery={previewGallery}
          progress={progress}
          batchErrors={batchErrors}
          designWarnings={designWarnings}
          history={history}
          isBusy={isBusy}
          exportOptions={exportOptions}
          productProfiles={productProfiles}
          activeProductProfileId={activeProductProfileId}
          exportProfiles={exportProfiles}
          onExportOptionsChange={setExportOptions}
          autoPreview={autoPreview}
          onAutoPreviewChange={(enabled) => {
            setAutoPreview(enabled);
            lastAutoPreviewKeyRef.current = enabled ? "" : currentAutoPreviewKey;
            setStatus(enabled ? "Auto Preview enabled." : "Auto Preview disabled.");
          }}
          onProductProfile={applyProductProfile}
          onExportProfile={applyExportProfile}
          onPreview={generatePreview}
          onBatch={exportBatch}
          onCancel={cancelBatch}
          onClearHistory={clearHistory}
          onSavePreset={() => savePreset(settings, activePreset?.name)}
          onLoadPreset={loadPreset}
          onMoveDesign={moveDesign}
          onSelectDesign={selectDesign}
          onSelectMockup={selectMockup}
        >
          <VisualPlacementEditor
            documentSize={documentSize}
            design={activeDesign}
            mockup={activeMockupKind === "image" ? activeMockup : undefined}
            settings={settings}
            onChange={commitSettings}
            disabled={isBusy}
            mode={activeMockupKind === "image" ? "image" : "psd"}
          />
        </PreviewPane>
      </div>

      {needsPhotopea ? <PhotopeaFrame ref={handlePhotopeaFrame} /> : null}
    </main>
  );
}
