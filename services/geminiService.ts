import { apiRequest, getStoredToken } from './api';
export const generateSafetyResponse = async (message: string): Promise<string> => {
  try {
    const result = await apiRequest<{ response: string }>('/safety-chat', { method: 'POST', token: getStoredToken(), body: { message } });
    return result.response;
  } catch { return 'The safety assistant is temporarily unavailable. Contact local emergency services for urgent help.'; }
};
