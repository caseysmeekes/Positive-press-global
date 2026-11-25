import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  const login = typeof token.githubLogin === "string" ? token.githubLogin.toLowerCase() : "";
  const allowed = (process.env.GITHUB_ALLOWED_USER || "caseysmeekes").toLowerCase();
  if (login !== allowed) return NextResponse.redirect(new URL("/api/auth/signout", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*"] };
