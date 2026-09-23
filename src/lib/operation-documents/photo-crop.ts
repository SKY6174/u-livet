export const OPERATION_PHOTO_ASPECT_RATIO = 16 / 9;

export type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function centerCropRect(
  sourceWidth: number,
  sourceHeight: number,
  aspectRatio = OPERATION_PHOTO_ASPECT_RATIO,
): CropRect {
  if (sourceWidth <= 0 || sourceHeight <= 0 || aspectRatio <= 0) {
    throw new Error("사진 크기를 확인해 주세요.");
  }
  const sourceRatio = sourceWidth / sourceHeight;
  if (sourceRatio > aspectRatio) {
    const width = sourceHeight * aspectRatio;
    return { x: (sourceWidth - width) / 2, y: 0, width, height: sourceHeight };
  }
  const height = sourceWidth / aspectRatio;
  return { x: 0, y: (sourceHeight - height) / 2, width: sourceWidth, height };
}

export function operationPhotoSize(
  sourceWidth: number,
  sourceHeight: number,
  maxWidth: number,
): { width: number; height: number } {
  const crop = centerCropRect(sourceWidth, sourceHeight);
  const width = Math.max(16, Math.floor(Math.min(crop.width, maxWidth) / 16) * 16);
  return { width, height: (width / 16) * 9 };
}

export function drawOperationPhoto(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
) {
  const crop = centerCropRect(sourceWidth, sourceHeight);
  context.fillStyle = "white";
  context.fillRect(0, 0, targetWidth, targetHeight);
  context.drawImage(
    source,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    targetWidth,
    targetHeight,
  );
}
