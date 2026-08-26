import { describe, expect, it } from "vitest";
import { buildSampleAssetUrl, sampleProjectAssets } from "./sampleProject";

describe("sample project assets", () => {
  it("keeps the GitHub Pages repository subpath", () => {
    expect(buildSampleAssetUrl("/OpenMockup-Studio/", sampleProjectAssets.mockups[0].path))
      .toBe("/OpenMockup-Studio/examples/sample-poster-mockup.png");
  });

  it("normalizes a base URL without a trailing slash", () => {
    expect(buildSampleAssetUrl("/OpenMockup-Studio", sampleProjectAssets.designs[0].path))
      .toBe("/OpenMockup-Studio/examples/sample-design-sun.png");
  });
});
