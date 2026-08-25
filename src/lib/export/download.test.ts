import { describe, expect, it } from "vitest";
import { renderFileName, slugify } from "./download";

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
});
