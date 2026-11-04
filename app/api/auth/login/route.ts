
import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { SignJWT } from "jose";
import { pool } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    if (!email || !password || password.length > 200) {
      return NextResponse.json(
        { error: "Enter a valid email and password." },
        { status: 400 }
      );
    }

    const secret = process.env.JWT_SECRET;

    if (!secret) {
      console.error("JWT_SECRET is missing from .env.local");

      return NextResponse.json(
        { error: "Server authentication is not configured." },
        { status: 500 }
      );
    }

    const result = await pool.query(
      `SELECT user_id, full_name, email, password_hash, role
       FROM app_users
       WHERE LOWER(email) = $1
       LIMIT 1`,
      [email]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const user = result.rows[0];

    const passwordMatches = await compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    // Convert the PostgreSQL ID into a JavaScript number.
    const userId = Number(user.user_id);

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      console.error("Invalid user ID returned by the database.");

      return NextResponse.json(
        { error: "Unable to create a valid session." },
        { status: 500 }
      );
    }

    const key = new TextEncoder().encode(secret);

    const token = await new SignJWT({
      userId,
      role: user.role,
      email: user.email,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("8h")
      .sign(key);

    const response = NextResponse.json({
      message: "Login successful.",
      user: {
        id: userId,
        name: user.full_name,
        email: user.email,
        role: user.role,
      },
    });

    response.cookies.set("warranty_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch (error) {
    console.error("Login API error:", error);

    return NextResponse.json(
      { error: "Unable to sign in. Please try again." },
      { status: 500 }
    );
  }
}
