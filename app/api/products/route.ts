
import { NextRequest, NextResponse } from "next/server";
import { getSession, unauthorizedResponse } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await getSession(request);

  if (!session) {
    return unauthorizedResponse();
  }

  try {
    const result = await pool.query(`
      SELECT
        pi.purchase_item_id,
        pi.serial_number,
        pi.quantity,
        pi.unit_price,
        p.product_id,
        p.product_name,
        p.brand,
        p.model_number,
        p.category,
        p.warranty_period_months,
        w.warranty_id,
        w.start_date,
        w.end_date,
        w.warranty_status,
        CASE
          WHEN w.warranty_id IS NULL THEN 'not_registered'
          WHEN w.warranty_status = 'void' THEN 'void'
          WHEN w.warranty_status = 'claimed' THEN 'claimed'
          WHEN w.end_date < CURRENT_DATE THEN 'expired'
          WHEN w.start_date > CURRENT_DATE THEN 'not_started'
          ELSE 'active'
        END AS current_warranty_state
      FROM purchase_items pi
      JOIN products p ON p.product_id = pi.product_id
      LEFT JOIN warranties w
        ON w.purchase_item_id = pi.purchase_item_id
      ORDER BY pi.purchase_item_id DESC
    `);

    return NextResponse.json({
      products: result.rows,
      total: result.rowCount ?? result.rows.length,
    });
  } catch (error) {
    console.error("Products API error:", error);

    return NextResponse.json(
      { error: "Unable to load registered products." },
      { status: 500 }
    );
  }
}
