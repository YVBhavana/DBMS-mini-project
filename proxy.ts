
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

export async function proxy(request: NextRequest) {
  const token = request.cookies.get("warranty_session")?.value;
  const secret = process.env.JWT_SECRET;
  const isLoginPage = request.nextUrl.pathname === "/login";

  if (!token || !secret) {
    if (isLoginPage) return NextResponse.next();

    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(secret));

    if (isLoginPage) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  } catch {
    if (isLoginPage) return NextResponse.next();

    const response = NextResponse.redirect(
      new URL("/login", request.url)
    );
    response.cookies.delete("warranty_session");
    return response;
  }
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
