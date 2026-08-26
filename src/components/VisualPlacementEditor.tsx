import { useEffect, useMemo, useRef, useState } from "react";
import type { DocumentSize, LoadedAsset, MockupSettings } from "../types";
import { angleFrom, clamp, computePlacementMetrics, normalizeAngle } from "../lib/renderPlacement";

interface VisualPlacementEditorProps {
  documentSize: DocumentSize;
  design?: LoadedAsset;
  mockup?: LoadedAsset;
  settings: MockupSettings;
  onChange: (settings: MockupSettings) => void;
  disabled?: boolean;
  mode?: "psd" | "image";
}

type DragMode = "design-move" | "design-scale" | "design-rotate" | null;

interface DragState {
  mode: DragMode;
  startX: number;
  startY: number;
  initial: MockupSettings;
  centerX?: number;
  centerY?: number;
  startAngle?: number;
  startRotation?: number;
  startScaleWidth?: number;
  startScaleHeight?: number;
  displayWidth?: number;
  displayHeight?: number;
}

export function VisualPlacementEditor({ documentSize, design, mockup, settings, onChange, disabled, mode = "psd" }: VisualPlacementEditorProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [showGuides, setShowGuides] = useState(true);
  const [designSize, setDesignSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!design) {
      setDesignSize(null);
      return;
    }
    const image = new Image();
    image.onload = () => setDesignSize({ width: image.naturalWidth || image.width || 1, height: image.naturalHeight || image.height || 1 });
    image.onerror = () => setDesignSize(null);
    image.src = design.url;
  }, [design]);

  const aspect = documentSize.width > 0 && documentSize.height > 0 ? documentSize.width / documentSize.height : 1.5;

  const metrics = useMemo(() => computePlacementMetrics(settings, designSize), [designSize, settings]);
  const usesCoverClip = mode === "image" && settings.fitMode === "cover" && Boolean(design);
  const targetWidth = Math.max(0.001, metrics.targetWidth);
  const targetHeight = Math.max(0.001, metrics.targetHeight);

  function pointerPercent(event: React.PointerEvent): { x: number; y: number } | null {
    const element = ref.current;
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    };
  }

  function beginDrag(event: React.PointerEvent, dragMode: DragMode): void {
    if (disabled || !dragMode) return;
    event.preventDefault();
    event.stopPropagation();
    const point = pointerPercent(event);
    if (!point) return;
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);

    const next: DragState = {
      mode: dragMode,
      startX: point.x,
      startY: point.y,
      initial: { ...settings },
    };

    if (dragMode === "design-rotate") {
      const centerX = metrics.displayLeft + metrics.displayWidth / 2;
      const centerY = metrics.displayTop + metrics.displayHeight / 2;
      next.centerX = centerX;
      next.centerY = centerY;
      next.startAngle = angleFrom(centerX, centerY, point.x, point.y);
      next.startRotation = settings.rotation;
    }

    if (dragMode === "design-scale") {
      next.startScaleWidth = settings.width;
      next.startScaleHeight = settings.height;
      next.displayWidth = metrics.displayWidth;
      next.displayHeight = metrics.displayHeight;
    }

    setDrag(next);
  }

  function updateDrag(event: React.PointerEvent): void {
    if (!drag || disabled) return;
    const point = pointerPercent(event);
    if (!point) return;

    const dx = point.x - drag.startX;
    const dy = point.y - drag.startY;
    const base = drag.initial;

    if (drag.mode === "design-move") {
      const areaW = Math.max(1, base.areaWidthPercent);
      const areaH = Math.max(1, base.areaHeightPercent);
      const nextLeft = base.left + (dx / areaW) * 100;
      const nextTop = base.top + (dy / areaH) * 100;
      onChange({ ...settings, left: Number(nextLeft.toFixed(2)), top: Number(nextTop.toFixed(2)) });
      return;
    }

    if (drag.mode === "design-scale") {
      const relativeX = dx / Math.max(2, drag.displayWidth || 1);
      const relativeY = dy / Math.max(2, drag.displayHeight || 1);
      const multiplier = clamp(1 + Math.max(relativeX, relativeY), 0.05, 6);
      const nextWidth = clamp((drag.startScaleWidth || base.width) * multiplier, 1, 500);
      const nextHeight = clamp((drag.startScaleHeight || base.height) * multiplier, 1, 500);
      onChange({ ...settings, width: Number(nextWidth.toFixed(2)), height: Number(nextHeight.toFixed(2)) });
      return;
    }

    if (drag.mode === "design-rotate") {
      const currentAngle = angleFrom(drag.centerX || 0, drag.centerY || 0, point.x, point.y);
      const nextRotation = normalizeAngle((drag.startRotation || 0) + (currentAngle - (drag.startAngle || 0)));
      onChange({ ...settings, rotation: Number(nextRotation.toFixed(2)) });
    }
  }

  function endDrag(): void {
    setDrag(null);
  }

  const slotLabel = mode === "image" ? "Placement Area" : "SmartObject Slot";
  const panelTitle = mode === "image" ? "Image Mockup Editor" : "SmartObject Editor";
  const panelDescription = mode === "image"
    ? "The mockup image stays fixed. Drag, scale and rotate only the uploaded design."
    : "The SmartObject slot is fixed. Drag, scale and rotate only the uploaded design.";

  return (
    <section className="live-editor-panel live-editor-panel--mockcity">
      <div className="panel__header">
        <div>
          <h2>{panelTitle}</h2>
          <p className="muted small-text">{panelDescription}</p>
        </div>
        <button type="button" onClick={() => setShowGuides((value) => !value)}>
          {showGuides ? "Hide Guides" : "Show Guides"}
        </button>
      </div>

      <div
        ref={ref}
        className={`live-editor live-editor--mockcity ${showGuides ? "has-guides" : ""} ${mockup ? "live-editor--with-mockup" : ""}`}
        style={{ aspectRatio: `${aspect}` }}
        onPointerMove={updateDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {mockup ? <img className="live-editor__mockup-image" src={mockup.url} alt={mockup.file.name} /> : null}

        <div className="live-editor__doc-label">
          {documentSize.width}×{documentSize.height}
        </div>

        <div
          className="live-editor__slot"
          style={{
            left: `${metrics.areaLeft}%`,
            top: `${metrics.areaTop}%`,
            width: `${metrics.areaWidth}%`,
            height: `${metrics.areaHeight}%`,
          }}
        >
          <span>{slotLabel}</span>
        </div>

        {usesCoverClip && design ? (
          <div
            className="live-editor__cover-clip"
            style={{
              left: `${metrics.targetLeft}%`,
              top: `${metrics.targetTop}%`,
              width: `${metrics.targetWidth}%`,
              height: `${metrics.targetHeight}%`,
            }}
          >
            <div
              className="live-editor__cover-design"
              style={{
                left: `${((metrics.displayLeft - metrics.targetLeft) / targetWidth) * 100}%`,
                top: `${((metrics.displayTop - metrics.targetTop) / targetHeight) * 100}%`,
                width: `${(metrics.displayWidth / targetWidth) * 100}%`,
                height: `${(metrics.displayHeight / targetHeight) * 100}%`,
                opacity: clamp(settings.opacity, 0, 100) / 100,
                transform: `rotate(${settings.rotation}deg)`,
              }}
            >
              <img src={design.url} alt="" aria-hidden="true" />
            </div>
          </div>
        ) : null}

        <div
          className="live-editor__design-box live-editor__design-box--mockcity"
          style={{
            left: `${metrics.displayLeft}%`,
            top: `${metrics.displayTop}%`,
            width: `${metrics.displayWidth}%`,
            height: `${metrics.displayHeight}%`,
            opacity: usesCoverClip ? 1 : clamp(settings.opacity, 0, 100) / 100,
            transform: `rotate(${settings.rotation}deg)`,
          }}
          onPointerDown={(event) => beginDrag(event, "design-move")}
          title="Drag design"
        >
          {design && !usesCoverClip ? (
            <img
              src={design.url}
              alt={design.file.name}
              style={{ objectFit: settings.fitMode === "cover" ? "cover" : "contain" }}
            />
          ) : !design ? (
            <span>No design</span>
          ) : null}

          <button
            type="button"
            className="live-editor__rotate-handle"
            onPointerDown={(event) => beginDrag(event, "design-rotate")}
            title="Rotate design"
          >
            ↻
          </button>
          <button
            type="button"
            className="live-editor__scale-handle"
            onPointerDown={(event) => beginDrag(event, "design-scale")}
            title="Scale design"
          />
        </div>
      </div>

      <div className="editor-meta-row">
        <span className="tiny-status">{mode === "image" ? "Image mode" : "Locked slot"}</span>
        <span className="muted small-text">
          {slotLabel} {Math.round(metrics.areaWidth)}% × {Math.round(metrics.areaHeight)}% · Design {Math.round(metrics.displayWidth)}% × {Math.round(metrics.displayHeight)}%
        </span>
      </div>
    </section>
  );
}
