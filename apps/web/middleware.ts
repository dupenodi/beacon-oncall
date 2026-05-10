import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** Root path redirects to sign-in (Edge) for a fast, reliable first paint on all hosts. */
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
