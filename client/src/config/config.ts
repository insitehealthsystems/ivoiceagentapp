/**
 * Client-side configuration. No secrets live here -- just where to find
 * the Express backend, which is the only service this app talks to.
 */
export const config = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3001/api',
};
