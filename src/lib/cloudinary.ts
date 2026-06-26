// ─────────────────────────────────────────────────────────────────────────────
// Cloudinary unsigned upload (browser).
//
// Mirrors Android src/services/cloudinaryService.ts so website photos land in
// the SAME Cloudinary account/folder and `photos[]` holds the same kind of
// secure_url strings Android stores. Android uploads to:
//   public_id: bandhan/users/{uid}/photos/{index}
//   endpoint:  https://api.cloudinary.com/v1_1/{cloudName}/image/upload
//   fields:    file, upload_preset, public_id  (unsigned preset only)
//
// Config comes from NEXT_PUBLIC_CLOUDINARY_* env vars (see .env.local).
// ─────────────────────────────────────────────────────────────────────────────

const MAX_WIDTH_PX = 1200;
const JPEG_QUALITY = 0.82;

function getConfig(): { cloudName: string; uploadPreset: string } {
  return {
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '',
    uploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? '',
  };
}

export function isCloudinaryConfigured(): boolean {
  const { cloudName, uploadPreset } = getConfig();
  return !!cloudName && !!uploadPreset;
}

// Downscale to <= MAX_WIDTH_PX wide and re-encode as JPEG, mirroring Android's
// single compression pass (expo-image-manipulator resize+compress).
async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_WIDTH_PX / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return file; // fall back to the original if canvas is unavailable
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise<Blob>((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob ?? file),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

/**
 * Compress → unsigned Cloudinary upload → secure_url.
 * Returns the CDN URL to store in DbProfile.photos[index].
 */
export async function uploadUserPhoto(
  file: File,
  uid: string,
  index: number,
): Promise<string> {
  const { cloudName, uploadPreset } = getConfig();
  if (!cloudName || !uploadPreset) {
    throw new Error(
      'Cloudinary not configured — set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and ' +
        'NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET in .env.local',
    );
  }

  const compressed = await compressImage(file);
  const publicId = `bandhan/users/${uid}/photos/${index}`;
  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

  const form = new FormData();
  form.append('file', compressed, `photo_${index}.jpg`);
  form.append('upload_preset', uploadPreset);
  form.append('public_id', publicId);

  let response: Response;
  let text: string;
  try {
    response = await fetch(endpoint, { method: 'POST', body: form });
    text = await response.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Cloudinary network error: ${msg}`);
  }

  let body: { secure_url?: string; error?: { message: string } };
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`Cloudinary: unparseable response (HTTP ${response.status})`);
  }

  if (!response.ok || !body.secure_url) {
    const detail = body.error?.message ?? text.slice(0, 200);
    throw new Error(`Cloudinary upload failed (HTTP ${response.status}): ${detail}`);
  }

  return body.secure_url;
}
