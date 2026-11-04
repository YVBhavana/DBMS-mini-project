
import { NextRequest, NextResponse } from "next/server";
import {
  getSession,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth";
import { pool } from "@/lib/db";

const ALLOWED_STATUSES = [
  "open",
  "in_progress",
  "resolved",
] as const;

type ServiceStatus = (typeof ALLOWED_STATUSES)[number];

export async function GET(request: NextRequest) {
  const session = await getSession(request);

  if (!session) {
    return unauthorizedResponse();
  }

  if (session.role !== "admin" && session.role !== "technician") {
    return forbiddenResponse();
  }

  try {
    const result = await pool.query(`
      SELECT
        sr.service_id,
        sr.reported_date,
        sr.issue_description,
        sr.diagnosis,
        sr.resolution,
        sr.service_status,
        sr.service_cost,
        pi.serial_number,
        p.product_name,
        p.brand,
        p.model_number,
        customer_user.full_name AS customer_name,
        technician.technician_id,
        technician_user.full_name AS technician_name
      FROM service_records sr
      JOIN purchase_items pi
        ON pi.purchase_item_id = sr.purchase_item_id
      JOIN products p
        ON p.product_id = pi.product_id
      JOIN purchases pu
        ON pu.purchase_id = pi.purchase_id
      JOIN customers c
        ON c.customer_id = pu.customer_id
      JOIN app_users customer_user
        ON customer_user.user_id = c.user_id
      LEFT JOIN technicians technician
        ON technician.technician_id = sr.technician_id
      LEFT JOIN app_users technician_user
        ON technician_user.user_id = technician.user_id
      ORDER BY sr.reported_date DESC, sr.service_id DESC
    `);

    return NextResponse.json({
      services: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error("Service requests API error:", error);

    return NextResponse.json(
      { error: "Unable to load service requests." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSession(request);

  if (!session) {
    return unauthorizedResponse();
  }

  if (session.role !== "admin") {
    return forbiddenResponse();
  }

  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body." },
      { status: 400 }
    );
  }

  // Accept a numeric ID or a numeric string, but reject invalid IDs.
  const rawServiceId = body.service_id;

  const serviceId =
    typeof rawServiceId === "number"
      ? rawServiceId
      : typeof rawServiceId === "string" &&
          rawServiceId.trim() !== ""
        ? Number(rawServiceId)
        : NaN;

  const status = body.service_status;

  if (
    !Number.isSafeInteger(serviceId) ||
    serviceId <= 0
  ) {
    console.error("Invalid service_id received by PATCH:", {
      service_id: rawServiceId,
      receivedBody: body,
    });

    return NextResponse.json(
      {
        error: "A valid service_id is required.",
      },
      { status: 400 }
    );
  }

  if (
    typeof status !== "string" ||
    !ALLOWED_STATUSES.includes(status as ServiceStatus)
  ) {
    return NextResponse.json(
      {
        error: `Invalid service_status. Allowed values: ${ALLOWED_STATUSES.join(", ")}.`,
      },
      { status: 400 }
    );
  }

  if (
    body.diagnosis !== undefined &&
    body.diagnosis !== null &&
    (typeof body.diagnosis !== "string" ||
      body.diagnosis.length > 2000)
  ) {
    return NextResponse.json(
      {
        error: "Diagnosis must be text of at most 2000 characters.",
      },
      { status: 400 }
    );
  }

  if (
    body.resolution !== undefined &&
    body.resolution !== null &&
    (typeof body.resolution !== "string" ||
      body.resolution.length > 2000)
  ) {
    return NextResponse.json(
      {
        error: "Resolution must be text of at most 2000 characters.",
      },
      { status: 400 }
    );
  }

  try {
    const result = await pool.query(
      `
        UPDATE service_records
        SET
          service_status = $1,
          diagnosis = CASE
            WHEN $2::boolean THEN $3::text
            ELSE diagnosis
          END,
          resolution = CASE
            WHEN $4::boolean THEN $5::text
            ELSE resolution
          END
        WHERE service_id = $6
        RETURNING
          service_id,
          service_status,
          diagnosis,
          resolution
      `,
      [
        status,
        body.diagnosis !== undefined,
        body.diagnosis ?? null,
        body.resolution !== undefined,
        body.resolution ?? null,
        serviceId,
      ]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "Service request not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Service request updated successfully.",
      service: result.rows[0],
    });
  } catch (error) {
    console.error("Service request update error:", error);

    return NextResponse.json(
      { error: "Unable to update service request." },
      { status: 500 }
    );
  }
}
