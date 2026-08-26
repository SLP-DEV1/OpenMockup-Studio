import { useState } from "react";
import { dispatchSampleFiles, loadSampleProjectFiles } from "../lib/app/sampleProject";

export function DemoBanner() {
  const [isLoading, setLoading] = useState(false);
  const [isSampleLoaded, setSampleLoaded] = useState(false);
  const [error, setError] = useState("");

  async function loadSample(): Promise<void> {
    if (isLoading) return;
    setLoading(true);
    setError("");
    try {
      const sample = await loadSampleProjectFiles(import.meta.env.BASE_URL);
      dispatchSampleFiles("mockups", sample.mockups);
      dispatchSampleFiles("designs", sample.designs);
      setSampleLoaded(true);
    } catch (sampleError) {
      setError(sampleError instanceof Error ? sampleError.message : "Sample project could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  function clearSample(): void {
    dispatchSampleFiles("mockups", []);
    dispatchSampleFiles("designs", []);
    setSampleLoaded(false);
    setError("");
  }

  return (
    <div
      role="status"
      style={{
        padding: "10px 16px",
        textAlign: "center",
        background: "#111827",
        color: "#ffffff",
        fontSize: "14px",
        fontWeight: 600,
        lineHeight: 1.45,
        display: "flex",
        gap: "10px",
        justifyContent: "center",
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <span>Browser demo: PNG, JPG and WebP mockups run locally in this tab.</span>
      <button
        type="button"
        onClick={() => void (isSampleLoaded ? clearSample() : loadSample())}
        disabled={isLoading}
        style={{
          border: "1px solid #93c5fd",
          borderRadius: "8px",
          background: isSampleLoaded ? "#1f2937" : "#2563eb",
          color: "#ffffff",
          cursor: isLoading ? "wait" : "pointer",
          fontWeight: 800,
          padding: "6px 10px",
        }}
      >
        {isLoading ? "Loading sample..." : isSampleLoaded ? "Use my files" : "Try sample project"}
      </button>
      <a
        href="https://github.com/SLP-DEV1/OpenMockup-Studio#quick-start"
        style={{ color: "#93c5fd", textDecoration: "underline" }}
      >
        PSD / full version
      </a>
      {error ? <span style={{ color: "#fecaca" }}>{error}</span> : null}
    </div>
  );
}
