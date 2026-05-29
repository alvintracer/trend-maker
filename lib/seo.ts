export function isSearchCrawlerUserAgent(userAgent: string | null) {
  if (!userAgent) {
    return false;
  }

  return /(googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|linkedinbot|embedly|pinterest|slackbot|discordbot|whatsapp|telegrambot)/i.test(
    userAgent,
  );
}

export function toAbsoluteUrl(path: string, siteUrl: string) {
  return new URL(path, siteUrl).toString();
}
