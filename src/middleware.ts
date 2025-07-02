import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PathConfig } from "@/config/path.config";

export default function middleware(
  request: NextRequest,
  response: NextResponse,
) {
  const { url, cookies } = request;
  const session = cookies.get("session")?.value;
  const isAuthPage = url.includes(PathConfig.AUTH);

  if (isAuthPage) {
    if (session) {
      return NextResponse.redirect(new URL(PathConfig.DASHBOARD, url));
    }
    return NextResponse.next();
  }
  if (!session) {
    return NextResponse.redirect(new URL(PathConfig.LOGIN, url));
  }
}

export const config = {
  matcher: ["/auth/:path*", "/dashboard/:path*"],
};
