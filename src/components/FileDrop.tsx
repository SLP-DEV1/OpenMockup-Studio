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
  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    onFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  return (
    <label className="file-drop">
      <span className="file-drop__title">{title}</span>
      <span className="file-drop__hint">{selectedLabel || hint}</span>
      <input type="file" accept={accept} multiple={multiple} onChange={handleChange} />
    </label>
  );
}
