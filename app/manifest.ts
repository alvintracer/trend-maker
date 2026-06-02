import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CommunityWikiKorea | 커뮤니티위키코리아",
    short_name: "커뮤니티위키",
    description: "커뮤니티위키코리아(컴코) - 한국 커뮤니티 인기 게시글과 제목 기반 키워드를 한 화면에서 추적하는 포털.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f7f2",
    theme_color: "#17361f",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-touch-logo.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
