export function getSiteUrl() {
  const rawUrl =
    process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
}
