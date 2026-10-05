import { apiRequest, getStoredToken } from './api';
export const uploadVerification = async (kind: string, source: File | string): Promise<string> => {
  const file = typeof source === 'string' ? await fetch(source).then(response => response.blob()) : source;
  if (!file.size || file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) throw new Error('Choose a JPEG, PNG, or PDF file up to 5 MB.');
  const result = await apiRequest<{ path: string; signedUrl: string }>('/users/verification-upload', { method: 'POST', token: getStoredToken(), body: { kind, contentType: file.type } });
  const response = await fetch(result.signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file, signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error('Document upload failed. Please try again.');
  return result.path;
};
