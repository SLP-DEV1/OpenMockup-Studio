export const SAMPLE_PROJECT_EVENT = "openmockup:sample-files";

export type SampleFileRole = "mockups" | "designs";

export interface SampleFilesDetail {
  role: SampleFileRole;
  files: File[];
}

export const sampleProjectAssets = {
  mockups: [
    { path: "examples/sample-poster-mockup.png", name: "sample-poster-mockup.png" },
  ],
  designs: [
    { path: "examples/sample-design-sun.png", name: "sample-design-sun.png" },
    { path: "examples/sample-design-leaf.png", name: "sample-design-leaf.png" },
  ],
} as const;

export function buildSampleAssetUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${normalizedBase}${path.replace(/^\/+/, "")}`;
}

async function loadSampleFile(
  baseUrl: string,
  asset: { path: string; name: string },
  fetcher: typeof fetch,
): Promise<File> {
  const response = await fetcher(buildSampleAssetUrl(baseUrl, asset.path));
  if (!response.ok) throw new Error(`Could not load sample asset: ${asset.name}`);
  const blob = await response.blob();
  return new File([blob], asset.name, { type: blob.type || "image/png" });
}

export async function loadSampleProjectFiles(
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<{ mockups: File[]; designs: File[] }> {
  const [mockups, designs] = await Promise.all([
    Promise.all(sampleProjectAssets.mockups.map((asset) => loadSampleFile(baseUrl, asset, fetcher))),
    Promise.all(sampleProjectAssets.designs.map((asset) => loadSampleFile(baseUrl, asset, fetcher))),
  ]);
  return { mockups, designs };
}

export function dispatchSampleFiles(role: SampleFileRole, files: File[]): void {
  window.dispatchEvent(new CustomEvent<SampleFilesDetail>(SAMPLE_PROJECT_EVENT, {
    detail: { role, files },
  }));
}
