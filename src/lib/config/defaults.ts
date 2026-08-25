import type { MockupSettings } from "../../types";

export const shirtPlacementDefaults: Pick<
  MockupSettings,
  | "left"
  | "top"
  | "width"
  | "height"
  | "areaLeftPercent"
  | "areaTopPercent"
  | "areaWidthPercent"
  | "areaHeightPercent"
  | "rotation"
  | "opacity"
  | "fitMode"
  | "anchor"
> = {
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
