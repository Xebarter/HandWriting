import { ImageAsset } from './types';

let imageIdCounter = 0;

function generateImageId(): string {
  return `image-${++imageIdCounter}-${Date.now()}`;
}

// Upload image from file
export async function uploadImage(file: File): Promise<ImageAsset> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();

      img.onload = () => {
        const asset: ImageAsset = {
          id: generateImageId(),
          dataUrl,
          x: 0,
          y: 0,
          width: Math.min(img.width, 400),
          height: Math.min(img.height, 400),
          rotation: 0,
          zIndex: 1,
          opacity: 1,
        };
        resolve(asset);
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// Upload image from URL
export async function uploadImageFromUrl(url: string): Promise<ImageAsset> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');

      const asset: ImageAsset = {
        id: generateImageId(),
        dataUrl,
        x: 0,
        y: 0,
        width: Math.min(img.width, 400),
        height: Math.min(img.height, 400),
        rotation: 0,
        zIndex: 1,
        opacity: 1,
      };
      resolve(asset);
    };

    img.onerror = () => reject(new Error('Failed to load image from URL'));
    img.src = url;
  });
}

// Update image position
export function moveImage(asset: ImageAsset, x: number, y: number): void {
  asset.x = x;
  asset.y = y;
}

// Resize image
export function resizeImage(asset: ImageAsset, width: number, height: number): void {
  asset.width = Math.max(10, width);
  asset.height = Math.max(10, height);
}

// Rotate image (in degrees)
export function rotateImage(asset: ImageAsset, angle: number): void {
  asset.rotation = angle % 360;
}

// Change image opacity
export function setImageOpacity(asset: ImageAsset, opacity: number): void {
  asset.opacity = Math.max(0, Math.min(1, opacity));
}

// Change z-index (layer order)
export function setImageZIndex(asset: ImageAsset, zIndex: number): void {
  asset.zIndex = Math.max(0, zIndex);
}

// Get image bounding box
export function getImageBoundingBox(asset: ImageAsset): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return {
    x: asset.x,
    y: asset.y,
    width: asset.width,
    height: asset.height,
  };
}

// Check if point is inside image
export function isPointInImage(asset: ImageAsset, px: number, py: number): boolean {
  return px >= asset.x && px <= asset.x + asset.width && py >= asset.y && py <= asset.y + asset.height;
}

// Scale image to fit within bounds
export function fitImageInBounds(
  asset: ImageAsset,
  maxWidth: number,
  maxHeight: number
): void {
  const scale = Math.min(maxWidth / asset.width, maxHeight / asset.height);
  asset.width *= scale;
  asset.height *= scale;
}

// Render image on canvas
export function renderImageOnCanvas(
  ctx: CanvasRenderingContext2D,
  asset: ImageAsset
): void {
  const img = new Image();
  img.onload = () => {
    ctx.save();
    ctx.globalAlpha = asset.opacity;

    // Translate to center, rotate, translate back
    const centerX = asset.x + asset.width / 2;
    const centerY = asset.y + asset.height / 2;

    ctx.translate(centerX, centerY);
    ctx.rotate((asset.rotation * Math.PI) / 180);
    ctx.drawImage(img, -asset.width / 2, -asset.height / 2, asset.width, asset.height);

    ctx.restore();
  };
  img.src = asset.dataUrl;
}

// Clone image asset
export function cloneImage(asset: ImageAsset): ImageAsset {
  return { ...asset, id: generateImageId() };
}

// Flip image horizontally
export function flipImageHorizontal(asset: ImageAsset): void {
  asset.rotation = (asset.rotation + 180) % 360;
}

// Flip image vertically
export function flipImageVertical(asset: ImageAsset): void {
  asset.rotation = (360 - asset.rotation) % 360;
}

// Get image dimensions from file before upload
export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// Export images as collection (for saving/loading)
export function serializeImages(images: ImageAsset[]): string {
  return JSON.stringify(images);
}

// Import images from JSON
export function deserializeImages(json: string): ImageAsset[] {
  return JSON.parse(json);
}

// Apply filter to image (convert to canvas for processing)
export async function applyFilter(
  asset: ImageAsset,
  filterType: 'grayscale' | 'sepia' | 'blur' | 'brightness'
): Promise<void> {
  const img = new Image();
  img.crossOrigin = 'anonymous';

  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    switch (filterType) {
      case 'grayscale':
        for (let i = 0; i < data.length; i += 4) {
          const gray = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
          data[i] = data[i + 1] = data[i + 2] = gray;
        }
        break;

      case 'sepia':
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          data[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
          data[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
          data[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
        }
        break;

      case 'brightness':
        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.min(255, data[i] * 1.2);
          data[i + 1] = Math.min(255, data[i + 1] * 1.2);
          data[i + 2] = Math.min(255, data[i + 2] * 1.2);
        }
        break;
    }

    ctx.putImageData(imageData, 0, 0);
    asset.dataUrl = canvas.toDataURL('image/png');
  };

  img.src = asset.dataUrl;
}
