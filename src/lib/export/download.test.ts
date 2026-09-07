import { describe, expect, it } from "vitest";
import { makeUniqueArchivePaths, releaseNonGalleryResults, renderFileName, slugify } from "./download";

describe("export file names", () => {
  it("creates portable slugs", () => {
    expect(slugify(" Café / Summer Shirt.PNG ")).toBe("cafe-summer-shirt");
  });

  it("renders a deterministic, sanitized export name", () => {
    expect(renderFileName("{index}-{mockup}-{design}.{ext}", {
      designName: "My Design.png",
      mockupName: "Front / View.psd",
      index: 4,
      format: "webp",
    })).toBe("005-front-view-my-design.webp");
  });

  it("falls back to a safe template and requested extension", () => {
    expect(renderFileName("", {
      designName: "Logo.jpg",
      mockupName: "Mug.psd",
      index: 0,
      format: "jpg",
    })).toBe("001-mug-logo.jpg");
  });

  it("adds deterministic suffixes when archive paths collide", () => {
    expect(makeUniqueArchivePaths([
      "design.png",
      "design.png",
      "design.png",
    ])).toEqual([
      "design.png",
      "design-2.png",
      "design-3.png",
    ]);
  });

  it("preserves subfolders and skips suffixes that already exist", () => {
    expect(makeUniqueArchivePaths([
      "front/design.png",
      "front/design-2.png",
      "front/design.png",
      "back/design.png",
    ])).toEqual([
      "front/design.png",
      "front/design-2.png",
      "front/design-3.png",
      "back/design.png",
    ]);
  });

  it("treats archive path collisions case-insensitively for portable ZIPs", () => {
    expect(makeUniqueArchivePaths(["Design.PNG", "design.png"]))
      .toEqual(["Design.PNG", "design-2.png"]);
  });

  it("releases non-gallery blobs without changing exported item counts", () => {
    const revoked: string[] = [];
    const results = Array.from({ length: 4 }, (_, index) => ({
      fileName: `${index}.png`,
      blob: new Blob([`image-${index}`], { type: "image/png" }),
      url: `blob:test-${index}`,
    }));

    releaseNonGalleryResults(results, 2, (url) => revoked.push(url));

    expect(results).toHaveLength(4);
    expect(results[0].blob.size).toBeGreaterThan(0);
    expect(results[1].url).toBe("blob:test-1");
    expect(results[2].blob.size).toBe(0);
    expect(results[2].url).toBe("");
    expect(results[3].blob.size).toBe(0);
    expect(revoked).toEqual(["blob:test-2", "blob:test-3"]);
  });
});
