import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

import { getSiteUrl } from "@/lib/site-url";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const secret = searchParams.get("secret");
  const path = searchParams.get("path") || "/";
  const pingGoogle = searchParams.get("ping") !== "false"; // 기본값: 핑 전송함

  // 1. 보안 인증 (Vercel 환경변수와 로컬 봇의 secret이 일치해야 함)
  const expectedSecret = process.env.REVALIDATE_SECRET;
  
  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json(
      { message: "Invalid secret token" },
      { status: 401 },
    );
  }

  try {
    // 2. Vercel 캐시 강제 무효화 (On-Demand Revalidation)
    revalidatePath(path);

    // 3. Google Sitemap Ping 전송
    let pingSuccess = false;
    
    if (pingGoogle) {
      const siteUrl = getSiteUrl();
      const sitemapUrl = `${siteUrl}/sitemap.xml`;
      const googlePingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(
        sitemapUrl,
      )}`;

      const pingResponse = await fetch(googlePingUrl, {
        method: "GET",
        // 구글 핑은 캐싱하면 안 됨
        cache: "no-store", 
      });
      
      pingSuccess = pingResponse.ok;
    }

    return NextResponse.json({
      revalidated: true,
      path,
      googlePinged: pingSuccess,
      now: Date.now(),
    });
  } catch (error) {
    return NextResponse.json(
      { message: "Error during revalidation", error: String(error) },
      { status: 500 },
    );
  }
}
