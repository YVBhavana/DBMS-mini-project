
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { pool } from "@/lib/db";

export async function GET(request: NextRequest) {
  // 1. Check the login session
  const token = request.cookies.get("warranty_session")?.value;
  const secret = process.env.JWT_SECRET;

  if (!token || !secret) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // 2. Verify the session token
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
  } catch {
    return NextResponse.json(
      { error: "Invalid or expired session" },
      { status: 401 }
    );
  }

  // 3. Load dashboard statistics
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM purchase_items)::int
          AS registered_products,

        (SELECT COUNT(*)
         FROM warranties
         WHERE warranty_status = 'active'
           AND start_date <= CURRENT_DATE
           AND end_date >= CURRENT_DATE)::int
          AS active_warranties,

        (SELECT COUNT(*)
         FROM service_records
         WHERE service_status IN ('open', 'assigned', 'in_progress'))::int
          AS open_service_requests,

        (SELECT COUNT(*)
         FROM warranties
         WHERE warranty_status = 'active'
           AND end_date >= CURRENT_DATE
           AND end_date < CURRENT_DATE + INTERVAL '30 days')::int
          AS expiring_soon
    `);

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("Dashboard query failed:", error);

    return NextResponse.json(
      { error: "Unable to load dashboard statistics" },
      { status: 500 }
    );
  }
}
