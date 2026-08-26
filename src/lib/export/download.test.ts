import { describe, expect, it } from "vitest";
import { makeUniqueArchivePaths, renderFileName, slugify } from "./download";

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
});
