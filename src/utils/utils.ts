export function withBase(path: string): string {
  const BASE_URL = import.meta.env.BASE_URL ?? "/";
  const baseNoTrailing = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;

  if (!path) return BASE_URL;
  if (path.startsWith("#")) return path;
  if (path.startsWith("/")) return `${baseNoTrailing}${path}` || path;
  return `${BASE_URL}${path}`;
}