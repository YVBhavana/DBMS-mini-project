import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getMongoDb } from "@/lib/mongodb";

export async function GET() {
  const result = { postgres: "disconnected", mongodb: "disconnected" };

  try {
    await pool.query("SELECT 1");
    result.postgres = "connected";
  } catch (error) {
    console.error("PostgreSQL connection failed:", error);
  }

  try {
    await (await getMongoDb()).command({ ping: 1 });
    result.mongodb = "connected";
  } catch (error) {
    console.error("MongoDB connection failed:", error);
  }

  const connected = result.postgres === "connected" && result.mongodb === "connected";
  return NextResponse.json(result, { status: connected ? 200 : 503 });
}
