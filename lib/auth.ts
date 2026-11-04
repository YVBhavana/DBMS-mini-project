
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, type JWTPayload } from "jose";

export type UserRole = "admin" | "customer" | "technician";

export type SessionPayload = JWTPayload & {
  userId: number;
  role: UserRole;
  email: string;
};

export async function getSession(
  request: NextRequest
): Promise<SessionPayload | null> {
  const token = request.cookies.get("warranty_session")?.value;
  const secret = process.env.JWT_SECRET;

  if (!token || !secret) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret)
    );

    const userId = Number(payload.userId);
    const role = payload.role;
    const email = payload.email;

    if (
      !Number.isSafeInteger(userId) ||
      userId <= 0 ||
      typeof email !== "string" ||
      !["admin", "customer", "technician"].includes(
        String(role)
      )
    ) {
      console.log("AUTH CHECK: JWT payload validation failed");
      return null;
    }

    return {
      ...payload,
      userId,
      role: role as UserRole,
      email,
    };
  } catch (error) {
    console.error(
      "AUTH CHECK: JWT verification failed:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return null;
  }
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { error: "Unauthorized" },
    { status: 401 }
  );
}

export function forbiddenResponse() {
  return NextResponse.json(
    { error: "Forbidden: insufficient permissions" },
    { status: 403 }
  );
}
