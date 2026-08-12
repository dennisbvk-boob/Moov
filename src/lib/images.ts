/** Anything bigger than this is refused outright, after downscaling. */
export const MAX_BYTES = 12 * 1024 * 1024;

const MAX_EDGE = 2000;
const JPEG_QUALITY = 0.82;

export function isImage(mime: string | null | undefined): boolean {
  return !!mime && mime.startsWith('image/');
}

export function prettySize(bytes: number | null | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`.replace('.', ',');
}

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  // createImageBitmap honours EXIF orientation, so portrait photos stay portrait
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* fall through to the <img> path */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // the bitmap is already rasterised by the time we draw it
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

/**
 * Shrink phone photos before they cross the network. A modern iPhone shot is
 * 3–5 MB; at 2000px on the long edge it lands around 400 kB with no visible
 * loss on a phone screen. Non-images and small images pass through untouched.
 */
export async function shrinkImage(file: File): Promise<Blob> {
  if (!isImage(file.type) || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file;
  }

  let src: ImageBitmap | HTMLImageElement;
  try {
    src = await decode(file);
  } catch {
    return file; // undecodable here, but the server may still like it
  }

  // both ImageBitmap and a detached HTMLImageElement report intrinsic pixels here
  const w = src.width;
  const h = src.height;
  if (!w || !h) return file;

  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  // already small and already reasonably sized on disk? leave it alone
  if (scale === 1 && file.size < 1024 * 1024) return file;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  if ('close' in src) src.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  );
  // keep whichever is actually smaller
  return blob && blob.size < file.size ? blob : file;
}

/** Storage key: <household>/<task>/<attachment>.<ext> — the first segment drives RLS. */
export function storagePath(
  householdId: string,
  taskId: string,
  attachmentId: string,
  filename: string,
  mime: string,
): string {
  const fromName = filename.includes('.') ? filename.split('.').pop()! : '';
  const ext = (mime === 'image/jpeg' ? 'jpg' : fromName || 'bin')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 8);
  return `${householdId}/${taskId}/${attachmentId}.${ext || 'bin'}`;
}
