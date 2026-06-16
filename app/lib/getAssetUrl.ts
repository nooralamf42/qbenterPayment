export const getAssetUrl = (path: string) => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
};
