const CSS_PIXELS_PER_INCH = 96;
const MILLIMETERS_PER_INCH = 25.4;

export const ADVISORY_A4_WIDTH_PX = 210 * CSS_PIXELS_PER_INCH / MILLIMETERS_PER_INCH;
export const ADVISORY_A4_HEIGHT_PX = 297 * CSS_PIXELS_PER_INCH / MILLIMETERS_PER_INCH;
export const MIN_ADVISORY_A4_PREVIEW_SCALE = 0.25;

export const getAdvisoryA4PreviewScale = (
  containerWidth: number,
  horizontalPadding = 32
): number => {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) return 1;
  const availableWidth = Math.max(0, containerWidth - Math.max(0, horizontalPadding));
  return Math.min(1, Math.max(MIN_ADVISORY_A4_PREVIEW_SCALE, availableWidth / ADVISORY_A4_WIDTH_PX));
};
