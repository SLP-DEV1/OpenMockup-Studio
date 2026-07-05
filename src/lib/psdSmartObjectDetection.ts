export interface SmartObjectBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface SmartObjectCandidate {
  name: string;
  score: number;
  isSmartObject: boolean;
  reason: string;
  bounds?: SmartObjectBounds;
}

export interface SmartObjectDetectionResult {
  detectedName: string;
  candidates: SmartObjectCandidate[];
  reason: string;
  selectedBounds?: SmartObjectBounds;
}

const TEXT_DECODER_LATIN1 = new TextDecoder("latin1");

function readAscii(view: DataView, offset: number, length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) out += String.fromCharCode(view.getUint8(offset + i));
  return out;
}

function readUint64AsNumber(view: DataView, offset: number): number {
  const high = view.getUint32(offset, false);
  const low = view.getUint32(offset + 4, false);
  return high * 0x100000000 + low;
}

function pad2(value: number): number {
  return value + (value % 2);
}

function pad4(value: number): number {
  return (value + 3) & ~3;
}

function decodePascalName(view: DataView, offset: number): { name: string; nextOffset: number } {
  const length = view.getUint8(offset);
  const start = offset + 1;
  const end = Math.min(start + length, view.byteLength);
  const bytes = new Uint8Array(view.buffer, view.byteOffset + start, Math.max(0, end - start));
  const raw = TEXT_DECODER_LATIN1.decode(bytes).replace(/\0/g, "").trim();
  const total = pad4(1 + length);
  return { name: raw, nextOffset: offset + total };
}

function decodeUnicodeName(view: DataView, offset: number, length: number): string | null {
  if (length < 4 || offset + length > view.byteLength) return null;
  const chars = view.getUint32(offset, false);
  const availableChars = Math.min(chars, Math.floor((length - 4) / 2));
  let out = "";
  let pos = offset + 4;
  for (let i = 0; i < availableChars; i += 1) {
    const code = view.getUint16(pos, false);
    pos += 2;
    if (code !== 0) out += String.fromCharCode(code);
  }
  return out.trim() || null;
}

function normalizeName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function scoreLayer(name: string, isSmartObject: boolean, isGroupDivider: boolean): { score: number; reason: string } {
  const clean = normalizeName(name);
  const lower = clean.toLowerCase();
  let score = 0;
  const reasons: string[] = [];

  if (!clean) return { score: -1000, reason: "empty name" };
  if (isGroupDivider) {
    score -= 80;
    reasons.push("group divider");
  }
  if (isSmartObject) {
    score += 120;
    reasons.push("smart object tag");
  }

  const positivePatterns: Array<[RegExp, number, string]> = [
    [/\b(your|you?r)\b/i, 25, "name contains your"],
    [/\b(logo|design|art|graphic|print|image)\b/i, 25, "design keyword"],
    [/\b(here|replace|place|placeholder)\b/i, 20, "placeholder keyword"],
    [/smart\s*object/i, 35, "smart object name"],
    [/mockup/i, 10, "mockup keyword"],
  ];
  for (const [pattern, points, reason] of positivePatterns) {
    if (pattern.test(clean)) {
      score += points;
      reasons.push(reason);
    }
  }

  const negativePatterns: Array<[RegExp, number, string]> = [
    [/\b(bg|background|overlay|effects?|levels?|curves?|mask|body|shadow|light|color)\b/i, -35, "non-design keyword"],
    [/luminos|contraste|niveaux|courbes/i, -35, "adjustment keyword"],
  ];
  for (const [pattern, points, reason] of negativePatterns) {
    if (pattern.test(lower)) {
      score += points;
      reasons.push(reason);
    }
  }

  return { score, reason: reasons.join(", ") || "name heuristic" };
}

function buildBounds(left: number, top: number, right: number, bottom: number): SmartObjectBounds | undefined {
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 1 || height <= 1) return undefined;
  return { left, top, right, bottom, width, height };
}

function areaOf(bounds?: SmartObjectBounds): number {
  return bounds ? bounds.width * bounds.height : 0;
}

export async function detectSmartObjectNameFromPsd(file: File): Promise<SmartObjectDetectionResult> {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  const fallback = "Auto-detect";

  try {
    if (view.byteLength < 30) throw new Error("PSD is too small");
    const signature = readAscii(view, 0, 4);
    const version = view.getUint16(4, false);
    if (signature !== "8BPS" || (version !== 1 && version !== 2)) throw new Error("Not a PSD/PSB file");
    const isPsb = version === 2;

    let offset = 26;
    const colorModeLength = view.getUint32(offset, false); offset += 4 + colorModeLength;
    if (offset + 4 > view.byteLength) throw new Error("Missing image resources section");
    const imageResourcesLength = view.getUint32(offset, false); offset += 4 + imageResourcesLength;
    if (offset >= view.byteLength) throw new Error("Missing layer/mask section");

    const readSectionLength = () => {
      if (isPsb) {
        const value = readUint64AsNumber(view, offset);
        offset += 8;
        return value;
      }
      const value = view.getUint32(offset, false);
      offset += 4;
      return value;
    };

    const layerMaskLength = readSectionLength();
    if (!layerMaskLength) throw new Error("PSD has no layer info");
    const layerMaskEnd = Math.min(view.byteLength, offset + layerMaskLength);
    if (offset >= layerMaskEnd) throw new Error("Empty layer/mask section");

    const layerInfoLength = isPsb ? readUint64AsNumber(view, offset) : view.getUint32(offset, false);
    offset += isPsb ? 8 : 4;
    if (!layerInfoLength) throw new Error("PSD has no layer records");
    const layerInfoEnd = Math.min(layerMaskEnd, offset + layerInfoLength);
    if (offset + 2 > layerInfoEnd) throw new Error("Invalid layer info");

    let layerCount = view.getInt16(offset, false);
    offset += 2;
    layerCount = Math.abs(layerCount);
    if (!layerCount || layerCount > 2000) throw new Error(`Unexpected layer count: ${layerCount}`);

    const layerRecords: Array<{ name: string; unicodeName?: string; isSmartObject: boolean; isGroupDivider: boolean; bounds?: SmartObjectBounds }> = [];

    for (let layerIndex = 0; layerIndex < layerCount; layerIndex += 1) {
      if (offset + 18 > layerInfoEnd) break;
      const top = view.getInt32(offset, false);
      const left = view.getInt32(offset + 4, false);
      const bottom = view.getInt32(offset + 8, false);
      const right = view.getInt32(offset + 12, false);
      const bounds = buildBounds(left, top, right, bottom);
      offset += 16;
      const channelCount = view.getUint16(offset, false);
      offset += 2;
      for (let c = 0; c < channelCount; c += 1) {
        offset += 2;
        offset += isPsb ? 8 : 4;
      }
      offset += 4;
      offset += 4;
      offset += 4;
      if (offset + 4 > layerInfoEnd) break;
      const extraLength = view.getUint32(offset, false);
      offset += 4;
      const extraStart = offset;
      const extraEnd = Math.min(layerInfoEnd, extraStart + extraLength);

      if (offset + 4 > extraEnd) { offset = extraEnd; continue; }
      const maskLength = view.getUint32(offset, false);
      offset += 4 + maskLength;
      if (offset + 4 > extraEnd) { offset = extraEnd; continue; }
      const blendingLength = view.getUint32(offset, false);
      offset += 4 + blendingLength;
      if (offset >= extraEnd) { offset = extraEnd; continue; }

      const pascal = decodePascalName(view, offset);
      offset = Math.min(extraEnd, pascal.nextOffset);
      let unicodeName: string | undefined;
      let isSmartObject = false;
      let isGroupDivider = false;

      while (offset + 12 <= extraEnd) {
        const sig = readAscii(view, offset, 4);
        const key = readAscii(view, offset + 4, 4);
        offset += 8;
        if (sig !== "8BIM" && sig !== "8B64") break;
        const dataLength = isPsb ? readUint64AsNumber(view, offset) : view.getUint32(offset, false);
        offset += isPsb ? 8 : 4;
        const dataStart = offset;
        const dataEnd = Math.min(extraEnd, dataStart + dataLength);

        if (key === "luni") {
          unicodeName = decodeUnicodeName(view, dataStart, dataEnd - dataStart) || unicodeName;
        }
        if (key === "SoLd" || key === "SoLE") isSmartObject = true;
        if (key === "lsct" || key === "lsdk") isGroupDivider = true;

        offset = dataStart + pad2(dataLength);
      }

      layerRecords.push({
        name: normalizeName(unicodeName || pascal.name),
        unicodeName,
        isSmartObject,
        isGroupDivider,
        bounds,
      });
      offset = extraEnd;
    }

    const unique = new Map<string, SmartObjectCandidate>();
    for (const record of layerRecords) {
      const name = normalizeName(record.name);
      if (!name) continue;
      const scored = scoreLayer(name, record.isSmartObject, record.isGroupDivider);
      const existing = unique.get(name);
      const candidate: SmartObjectCandidate = {
        name,
        score: scored.score,
        isSmartObject: record.isSmartObject,
        reason: scored.reason,
        bounds: record.bounds,
      };
      if (
        !existing ||
        candidate.score > existing.score ||
        (candidate.score === existing.score && areaOf(candidate.bounds) > areaOf(existing.bounds))
      ) {
        unique.set(name, candidate);
      }
    }

    const candidates = [...unique.values()].sort((a, b) => b.score - a.score || areaOf(b.bounds) - areaOf(a.bounds) || a.name.localeCompare(b.name));
    const best = candidates.find((candidate) => candidate.score > 0) || candidates[0];
    if (!best) throw new Error("No layer names found");

    return {
      detectedName: best.name,
      candidates: candidates.slice(0, 12),
      reason: best.reason,
      selectedBounds: best.bounds,
    };
  } catch (error) {
    return {
      detectedName: fallback,
      candidates: [],
      reason: error instanceof Error ? error.message : "Could not inspect PSD layers",
      selectedBounds: undefined,
    };
  }
}
