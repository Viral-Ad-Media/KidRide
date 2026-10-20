import { ApiError, apiRequest, getStoredToken } from './api';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const LABELS: Record<string, string> = {
  license: "Driver's license",
  insurance: 'Vehicle insurance',
  registration: 'Vehicle registration',
  photo_front: 'Front photo',
  photo_left: 'Left photo',
  photo_right: 'Right photo'
};
// Long edge after downscaling; plenty for reading a document or checking a face.
const MAX_IMAGE_EDGE = 2000;

const toMb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);

// Phone photos are often well over 5 MB; re-encode large images as JPEG so they fit.
// Other formats the browser can open (e.g. WEBP) are always converted to JPEG.
const shrinkImage = async (file: Blob): Promise<Blob> => {
  const mustConvert = !ALLOWED_TYPES.includes(file.type);
  if (!file.type.startsWith('image/') || (!mustConvert && file.size <= 1.5 * 1024 * 1024)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    return blob && (mustConvert || blob.size < file.size) ? blob : file;
  } catch {
    return file;
  }
};

export const uploadVerification = async (kind: string, source: File | string): Promise<string> => {
  const label = LABELS[kind] || 'Document';
  const original = typeof source === 'string' ? await fetch(source).then((response) => response.blob()) : source;
  const file = await shrinkImage(original);
  if (!ALLOWED_TYPES.includes(file.type)) {
    // e.g. HEIC from an iPhone, which most browsers cannot open.
    throw new Error(`${label}: unsupported file type (${original.type || 'unknown'}). Use a JPEG, PNG or PDF.`);
  }
  if (!file.size) throw new Error(`${label}: the file is empty.`);
  if (file.size > MAX_BYTES) throw new Error(`${label}: file is too large (${toMb(file.size)} MB, max 5 MB).`);

  let result: { path: string; signedUrl: string };
  try {
    result = await apiRequest<{ path: string; signedUrl: string }>('/users/verification-upload', { method: 'POST', token: getStoredToken(), body: { kind, contentType: file.type } });
  } catch (error) {
    throw new Error(`${label}: ${error instanceof ApiError ? error.message : 'could not start the upload'}.`);
  }

  let response: Response;
  try {
    response = await fetch(result.signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file, signal: AbortSignal.timeout(60000) });
  } catch {
    throw new Error(`${label}: upload failed. Check your connection and try again.`);
  }
  if (!response.ok) throw new Error(`${label}: upload failed (HTTP ${response.status}). Please try again.`);
  return result.path;
};
