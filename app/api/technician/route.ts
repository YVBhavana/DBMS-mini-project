
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import {
  getSession,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth";

const ALLOWED_STATUSES = ["open", "in_progress", "resolved"];

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);

    console.log("TECHNICIAN AUTH CHECK:", {
      userId: session?.userId,
      role: session?.role,
    });

    if (!session) {
      return unauthorizedResponse();
    }

    if (session.role !== "technician") {
      return forbiddenResponse();
    }

    const result = await pool.query(
      `SELECT DISTINCT ON (sr.service_id)
          sr.service_id,
          sr.service_status,
          sr.issue_description,
          sr.diagnosis,
          sr.resolution,
          sr.service_cost,
          sr.reported_date,
          p.product_name,
          p.brand,
          pi.serial_number,
          c.customer_id,
          u.full_name AS customer_name,
          u.email AS customer_email,
          t.technician_id
       FROM service_records sr
       JOIN purchase_items pi
         ON pi.purchase_item_id = sr.purchase_item_id
       JOIN products p
         ON p.product_id = pi.product_id
       JOIN purchases pu
         ON pu.purchase_id = pi.purchase_id
       JOIN customers c
         ON c.customer_id = pu.customer_id
       JOIN app_users u
         ON u.user_id = c.user_id
       JOIN technicians t
         ON t.technician_id = sr.technician_id
       WHERE t.user_id = $1
       ORDER BY sr.service_id, sr.reported_date DESC`,
      [session.userId]
    );

    return NextResponse.json({
      services: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error("TECHNICIAN GET ERROR:", error);

    return NextResponse.json(
      { error: "Failed to fetch technician service requests." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession(request);

    console.log("TECHNICIAN PATCH AUTH CHECK:", {
      userId: session?.userId,
      role: session?.role,
    });

    if (!session) {
      return unauthorizedResponse();
    }

    if (session.role !== "technician") {
      return forbiddenResponse();
    }

    const body = await request.json();

    const serviceId = Number(body.service_id);
    const status = body.status;
    const diagnosis = body.diagnosis;
    const resolution = body.resolution;

    if (!Number.isSafeInteger(serviceId) || serviceId <= 0) {
      return NextResponse.json(
        { error: "A valid service_id is required." },
        { status: 400 }
      );
    }

    if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json(
        {
          error:
            "Invalid status. Allowed values: open, in_progress, resolved.",
        },
        { status: 400 }
      );
    }

    if (
      diagnosis !== undefined &&
      diagnosis !== null &&
      typeof diagnosis !== "string"
    ) {
      return NextResponse.json(
        { error: "Diagnosis must be a string." },
        { status: 400 }
      );
    }

    if (
      resolution !== undefined &&
      resolution !== null &&
      typeof resolution !== "string"
    ) {
      return NextResponse.json(
        { error: "Resolution must be a string." },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `UPDATE service_records sr
       SET
         service_status = COALESCE($1, sr.service_status),
         diagnosis = COALESCE($2, sr.diagnosis),
         resolution = COALESCE($3, sr.resolution)
       WHERE sr.service_id = $4
         AND EXISTS (
           SELECT 1
           FROM technicians t
           WHERE t.technician_id = sr.technician_id
             AND t.user_id = $5
         )
       RETURNING
         sr.service_id,
         sr.service_status,
         sr.diagnosis,
         sr.resolution,
         sr.reported_date`,
      [
        status ?? null,
        diagnosis ?? null,
        resolution ?? null,
        serviceId,
        session.userId,
      ]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        {
          error:
            "Service request not found or not assigned to this technician.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Service request updated successfully.",
      service: result.rows[0],
    });
  } catch (error) {
    console.error("TECHNICIAN PATCH ERROR:", error);

    return NextResponse.json(
      { error: "Failed to update service request." },
      { status: 500 }
    );
  }
}
