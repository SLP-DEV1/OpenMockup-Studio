import type { ChangeEvent } from "react";

interface FileDropProps {
  title: string;
  hint: string;
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  selectedLabel?: string;
}

export function FileDrop({ title, hint, accept, multiple, onFiles, selectedLabel }: FileDropProps) {
  const isStaticDemo = import.meta.env.MODE === "demo";
  const isMockupPicker = accept.toLowerCase().includes(".psd");
  const effectiveAccept = isStaticDemo && isMockupPicker
    ? accept
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.toLowerCase() !== ".psd" && value.toLowerCase() !== "application/octet-stream")
      .join(",")
    : accept;
  const effectiveHint = isStaticDemo && isMockupPicker
    ? "Choose PNG, JPG or WebP mockups · PSD requires the local app"
    : hint;

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    const files = Array.from(event.target.files ?? []);
    const acceptedFiles = isStaticDemo && isMockupPicker
      ? files.filter((file) => !file.name.toLowerCase().endsWith(".psd"))
      : files;
    onFiles(acceptedFiles);
    event.target.value = "";
  }

  return (
    <label className="file-drop">
      <span className="file-drop__title">{title}</span>
      <span className="file-drop__hint">{selectedLabel || effectiveHint}</span>
      <input type="file" accept={effectiveAccept} multiple={multiple} onChange={handleChange} />
    </label>
  );
}
