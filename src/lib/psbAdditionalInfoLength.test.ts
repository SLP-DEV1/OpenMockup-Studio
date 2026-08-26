import { describe, expect, it } from "vitest";
import {
  readAdditionalInfoLength,
  usesEightBytePsbAdditionalInfoLength,
} from "./psbAdditionalInfoLength";

describe("PSB additional layer information lengths", () => {
  it("keeps normal tagged blocks at 4-byte lengths in PSB", () => {
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setUint32(0, 0x00000012, false);
    view.setUint32(4, 0xdeadbeef, false);

    expect(readAdditionalInfoLength(view, 0, true, "luni"))
      .toEqual({ length: 0x12, bytesRead: 4 });
  });

  it("uses 8-byte lengths for the PSB keys defined by Adobe", () => {
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setUint32(0, 0x00000001, false);
    view.setUint32(4, 0x00000002, false);

    expect(readAdditionalInfoLength(view, 0, true, "Layr"))
      .toEqual({ length: 0x100000002, bytesRead: 8 });
    expect(usesEightBytePsbAdditionalInfoLength("Lr16")).toBe(true);
    expect(usesEightBytePsbAdditionalInfoLength("PxSD")).toBe(true);
  });

  it("uses 4-byte lengths for PSD regardless of key", () => {
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setUint32(0, 1234, false);
    view.setUint32(4, 5678, false);

    expect(readAdditionalInfoLength(view, 0, false, "Layr"))
      .toEqual({ length: 1234, bytesRead: 4 });
  });
});
