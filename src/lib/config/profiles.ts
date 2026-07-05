import type { ExportProfile, MockupSettings, ProductProfile } from "../../types";

export const baseShirtSettings: MockupSettings = {
  smartObjectName: "YouR Logo hERE",
  left: 0,
  top: 0,
  width: 100,
  height: 100,
  areaLeftPercent: 38,
  areaTopPercent: 25,
  areaWidthPercent: 24,
  areaHeightPercent: 32,
  rotation: 0,
  opacity: 100,
  fitMode: "contain",
  anchor: "center",
};

const mugFrontCenteredSettings: MockupSettings = {
  ...baseShirtSettings,
  areaLeftPercent: 35,
  areaTopPercent: 18,
  areaWidthPercent: 30,
  areaHeightPercent: 64,
  left: 0,
  top: 0,
  width: 100,
  height: 100,
  fitMode: "contain",
  anchor: "center",
};

export const productProfiles: ProductProfile[] = [
  {
    id: "tshirt-front",
    name: "T-Shirt Front",
    description: "Classic front chest placement for shirt mockups.",
    settings: baseShirtSettings,
    exportDefaults: { format: "jpg", cropPreset: "none", maxLongSide: 2000 },
  },
  {
    id: "hoodie-front",
    name: "Hoodie Front",
    description: "Slightly larger central hoodie print area.",
    settings: { ...baseShirtSettings, areaLeftPercent: 35, areaTopPercent: 24, areaWidthPercent: 30, areaHeightPercent: 36 },
    exportDefaults: { format: "jpg", cropPreset: "none", maxLongSide: 2000 },
  },
  {
    id: "mug-front",
    name: "Mug Front Centered",
    description: "Auto-centered mug front placement so the main artwork sits in the visible middle area.",
    settings: mugFrontCenteredSettings,
    exportDefaults: { format: "jpg", cropPreset: "square", maxLongSide: 2000 },
  },
  {
    id: "mug-left",
    name: "Mug Left Side",
    description: "Shifts the artwork into the left visible area for left-facing mug previews.",
    settings: { ...mugFrontCenteredSettings, areaLeftPercent: 18, areaWidthPercent: 30 },
    exportDefaults: { format: "jpg", cropPreset: "square", maxLongSide: 2000 },
  },
  {
    id: "mug-right",
    name: "Mug Right Side",
    description: "Shifts the artwork into the right visible area for right-facing mug previews.",
    settings: { ...mugFrontCenteredSettings, areaLeftPercent: 52, areaWidthPercent: 30 },
    exportDefaults: { format: "jpg", cropPreset: "square", maxLongSide: 2000 },
  },
  {
    id: "mug-wrap",
    name: "Mug Full Wrap",
    description: "Uses a broad centered wrap zone for panorama or full-wrap mug designs.",
    settings: { ...mugFrontCenteredSettings, areaLeftPercent: 10, areaTopPercent: 18, areaWidthPercent: 80, areaHeightPercent: 64, fitMode: "cover" },
    exportDefaults: { format: "jpg", cropPreset: "square", maxLongSide: 2000 },
  },
  {
    id: "pillow-40",
    name: "Pillow 40x40",
    description: "Square-ish placement for cushions and pillows.",
    settings: { ...baseShirtSettings, areaLeftPercent: 24, areaTopPercent: 18, areaWidthPercent: 52, areaHeightPercent: 60 },
    exportDefaults: { format: "jpg", cropPreset: "square", maxLongSide: 2000 },
  },
  {
    id: "bag-front",
    name: "Bag / Tote Front",
    description: "Large center placement for tote bags and gym bags.",
    settings: { ...baseShirtSettings, areaLeftPercent: 32, areaTopPercent: 25, areaWidthPercent: 36, areaHeightPercent: 42 },
    exportDefaults: { format: "jpg", cropPreset: "portrait45", maxLongSide: 2000 },
  },
  {
    id: "poster-flat",
    name: "Poster / Print",
    description: "Large art placement with minimal margins.",
    settings: { ...baseShirtSettings, areaLeftPercent: 8, areaTopPercent: 8, areaWidthPercent: 84, areaHeightPercent: 84 },
    exportDefaults: { format: "jpg", cropPreset: "none", maxLongSide: 2500 },
  },
  {
    id: "sticker-sheet",
    name: "Sticker / Small Item",
    description: "Centered placement for sticker previews and small products.",
    settings: { ...baseShirtSettings, areaLeftPercent: 25, areaTopPercent: 20, areaWidthPercent: 50, areaHeightPercent: 55 },
    exportDefaults: { format: "png", cropPreset: "none", maxLongSide: 2000 },
  },
];

export const exportProfiles: ExportProfile[] = [
  {
    id: "woocommerce",
    name: "WooCommerce",
    description: "Shop-ready JPG/WebP size with clean filenames.",
    options: { format: "webp", quality: 90, maxLongSide: 1800, cropPreset: "none", filenameTemplate: "{mockup}-{design}.{ext}" },
  },
  {
    id: "amazon",
    name: "Amazon",
    description: "Square JPG with white background.",
    options: { format: "jpg", quality: 92, backgroundColor: "#ffffff", maxLongSide: 2000, cropPreset: "square", filenameTemplate: "{index}-{design}-{mockup}.{ext}" },
  },
  {
    id: "etsy",
    name: "Etsy",
    description: "Large high-quality listing image.",
    options: { format: "jpg", quality: 92, maxLongSide: 3000, cropPreset: "none", filenameTemplate: "{design}-{mockup}.{ext}" },
  },
  {
    id: "instagram",
    name: "Instagram 4:5",
    description: "Portrait crop for feed posts.",
    options: { format: "jpg", quality: 90, maxLongSide: 1350, cropPreset: "portrait45", filenameTemplate: "instagram/{design}-{mockup}.{ext}" },
  },
  {
    id: "pinterest",
    name: "Pinterest 2:3",
    description: "Tall pin format.",
    options: { format: "jpg", quality: 90, maxLongSide: 1500, cropPreset: "pinterest23", filenameTemplate: "pinterest/{design}-{mockup}.{ext}" },
  },
  {
    id: "archive-png",
    name: "Archive PNG",
    description: "Original PNG export without crop or compression.",
    options: { format: "png", maxLongSide: 0, cropPreset: "none", filenameTemplate: "{date}/{preset}/{mockup}-{design}.{ext}" },
  },
];


const PRODUCT_PROFILE_KEYWORDS: Record<string, RegExp> = {
  "mug-wrap": /(mug|cup|coffee|ceramic|tasse|becher).*(wrap|panorama|full)|(?:wrap|panorama|full).*(mug|cup|coffee|ceramic|tasse|becher)/i,
  "mug-left": /(mug|cup|coffee|ceramic|tasse|becher).*(left|links)|(?:left|links).*(mug|cup|coffee|ceramic|tasse|becher)/i,
  "mug-right": /(mug|cup|coffee|ceramic|tasse|becher).*(right|rechts)|(?:right|rechts).*(mug|cup|coffee|ceramic|tasse|becher)/i,
  "mug-front": /(mug|cup|coffee|ceramic|tasse|becher)/i,
  "hoodie-front": /(hoodie|sweatshirt|pullover)/i,
  "bag-front": /(tote|bag|tasche|turnbeutel|gym ?bag|shopper)/i,
  "pillow-40": /(pillow|cushion|kissen)/i,
  "poster-flat": /(poster|print|plakat|canvas|art ?print)/i,
  "sticker-sheet": /(sticker|decal|label|aufkleber)/i,
  "tshirt-front": /(shirt|tee|t-?shirt)/i,
};

export function detectProductProfileIdFromMockupName(fileName: string): string | null {
  const name = String(fileName || "").toLowerCase();
  for (const [profileId, regex] of Object.entries(PRODUCT_PROFILE_KEYWORDS)) {
    if (regex.test(name)) return profileId;
  }
  return null;
}

export function findProductProfileById(id: string | null | undefined): ProductProfile | undefined {
  if (!id) return undefined;
  return productProfiles.find((profile) => profile.id === id);
}


export function isMugProductProfileId(id: string | null | undefined): boolean {
  return Boolean(id && /^mug-/.test(id));
}
