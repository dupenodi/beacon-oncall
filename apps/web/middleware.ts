import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Edge redirect — avoids relying on RSC `redirect()` for `/`, which has been flaky
 * on some Vercel deployments (FUNCTION_INVOCATION_FAILED on the root segment).
 */
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};
