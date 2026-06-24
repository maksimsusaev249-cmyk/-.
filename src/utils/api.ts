export const getApiUrl = (path: string): string => {
  const baseUrl = (import.meta.env.VITE_API_URL as string) || "";
  const cleanBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
};
