import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";

import { getSiteUrl } from "@/lib/site-url";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  applicationName: "CommunityWikiKorea",
  manifest: "/manifest.webmanifest",
  title: {
    default: "CommunityWikiKorea",
    template: "%s | CommunityWikiKorea",
  },
  description: "한국 커뮤니티 실시간 트렌드 키워드와 허브 페이지를 모아보는 위키.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-logo.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "CommunityWikiKorea",
    title: "CommunityWikiKorea",
    description: "한국 커뮤니티 실시간 트렌드 키워드와 허브 페이지를 모아보는 위키.",
    url: "/",
    images: [
      {
        url: "/icon-512.png",
        width: 512,
        height: 512,
        alt: "CommunityWikiKorea logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CommunityWikiKorea",
    description: "한국 커뮤니티 실시간 트렌드 키워드와 허브 페이지를 모아보는 위키.",
    images: ["/icon-512.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteUrl = getSiteUrl();
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "CommunityWikiKorea",
        url: siteUrl,
        logo: `${siteUrl}/icon-512.png`,
        image: `${siteUrl}/icon-512.png`,
      },
      {
        "@type": "WebSite",
        name: "CommunityWikiKorea",
        url: siteUrl,
        publisher: {
          "@type": "Organization",
          name: "CommunityWikiKorea",
          logo: {
            "@type": "ImageObject",
            url: `${siteUrl}/icon-512.png`,
          },
        },
      },
    ],
  };

  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full w-full max-w-[100vw] antialiased overflow-x-hidden`}
    >
      <body className="min-h-full w-full max-w-[100vw] flex flex-col bg-slate-50 text-slate-950 overflow-x-hidden">
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <div className="flex flex-1 flex-col">{children}</div>
        <footer className="border-t border-slate-200 bg-slate-50">
          <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-4 py-6 lg:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Image
                  src="/icon-192.png"
                  alt="CommunityWikiKorea logo"
                  width={40}
                  height={40}
                  className="rounded-xl border border-black/10 bg-white"
                />
                <div>
                  <div className="text-sm font-semibold tracking-tight">CommunityWikiKorea</div>
                  <p className="mt-1 text-sm text-slate-600">
                    한국 커뮤니티 실시간 트렌드 키워드와 허브를 모아보는 위키.
                  </p>
                </div>
              </div>
              <nav className="flex flex-wrap gap-2 text-sm font-medium">
                <Link
                  href="/donate"
                  className="rounded-full border border-black/10 bg-white px-3 py-2 transition-colors hover:bg-stone-100"
                >
                  Donate
                </Link>
                <Link
                  href="/subscribe"
                  className="rounded-full border border-black/10 bg-white px-3 py-2 transition-colors hover:bg-stone-100"
                >
                  Subscribe
                </Link>
                <Link
                  href="/sign-in"
                  className="rounded-full border border-black/10 bg-white px-3 py-2 transition-colors hover:bg-stone-100"
                >
                  Sign In
                </Link>
                <Link
                  href="/privacy-policy"
                  className="rounded-full border border-black/10 bg-white px-3 py-2 transition-colors hover:bg-stone-100"
                >
                  Privacy Policy
                </Link>
                <Link
                  href="/terms-of-use"
                  className="rounded-full border border-black/10 bg-white px-3 py-2 transition-colors hover:bg-stone-100"
                >
                  Terms of Use
                </Link>
              </nav>
            </div>
            <div className="text-xs text-slate-500">
              © 2026 CommunityWikiKorea. All rights reserved.
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
