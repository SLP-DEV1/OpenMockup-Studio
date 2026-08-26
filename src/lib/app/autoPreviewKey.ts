import type { MockupSettings } from "../../types";

export interface AutoPreviewKeyInput {
  mockupId: string;
  designId: string;
  mockupKind: string;
  settings: MockupSettings;
  exportView: unknown;
}

export function buildAutoPreviewKey(input: AutoPreviewKeyInput): string {
  return JSON.stringify(input);
}
