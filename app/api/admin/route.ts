
import { NextRequest, NextResponse } from "next/server";
import {
  getSession,
  forbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth";
import { pool } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await getSession(request);

  if (!session) {
    console.log("ADMIN API: No valid session");
    return unauthorizedResponse();
  }

  console.log("ADMIN API: Authenticated role =", session.role);

  if (session.role !== "admin") {
    return forbiddenResponse();
  }

  try {
    const result = await pool.query(`
      SELECT user_id, full_name, email, role, created_at
      FROM app_users
      ORDER BY user_id
    `);

    return NextResponse.json({ users: result.rows });
  } catch (error) {
    console.error("Admin users query failed:", error);
    return NextResponse.json(
      { error: "Unable to load users" },
      { status: 500 }
    );
  }
}
