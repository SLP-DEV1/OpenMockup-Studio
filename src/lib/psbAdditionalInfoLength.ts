const PSB_EIGHT_BYTE_LENGTH_KEYS = new Set([
  "LMsk",
  "Lr16",
  "Lr32",
  "Layr",
  "Mt16",
  "Mt32",
  "Mtrn",
  "Alph",
  "FMsk",
  "lnk2",
  "FEid",
  "FXid",
  "PxSD",
]);

export function usesEightBytePsbAdditionalInfoLength(key: string): boolean {
  return PSB_EIGHT_BYTE_LENGTH_KEYS.has(key);
}

export function readAdditionalInfoLength(
  view: DataView,
  offset: number,
  isPsb: boolean,
  key: string,
): { length: number; bytesRead: 4 | 8 } {
  if (isPsb && usesEightBytePsbAdditionalInfoLength(key)) {
    const high = view.getUint32(offset, false);
    const low = view.getUint32(offset + 4, false);
    return { length: high * 0x100000000 + low, bytesRead: 8 };
  }

  return { length: view.getUint32(offset, false), bytesRead: 4 };
}
