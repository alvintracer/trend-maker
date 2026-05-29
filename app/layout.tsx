import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: {
    default: "CommunityWikiKorea",
    template: "%s | CommunityWikiKorea",
  },
  description: "한국 커뮤니티 실시간 트렌드 키워드와 허브 페이지를 모아보는 위키.",
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
  },
  twitter: {
    card: "summary_large_image",
    title: "CommunityWikiKorea",
    description: "한국 커뮤니티 실시간 트렌드 키워드와 허브 페이지를 모아보는 위키.",
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
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-stone-50 text-slate-950">
        <div className="flex flex-1 flex-col">{children}</div>
        <footer className="border-t border-black/10 bg-[#f6f1e5]">
          <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-4 py-6 lg:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold tracking-tight">CommunityWikiKorea</div>
                <p className="mt-1 text-sm text-slate-600">
                  한국 커뮤니티 실시간 트렌드 키워드와 허브를 모아보는 위키.
                </p>
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
