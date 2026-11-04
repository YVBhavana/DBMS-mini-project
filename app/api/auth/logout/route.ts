
import { NextRequest, NextResponse } from "next/server";

function logoutResponse() {
  const response = NextResponse.json({
    message: "Logged out successfully.",
  });

  response.cookies.set({
    name: "warranty_session",
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}

export async function POST(_request: NextRequest) {
  return logoutResponse();
}

export async function GET() {
  return logoutResponse();
}
