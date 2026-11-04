import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getMongoDb } from "@/lib/mongodb";
import { pool } from "@/lib/db";
import { forbiddenResponse, getSession, unauthorizedResponse } from "@/lib/auth";

const COLLECTION = "service_activity";

async function canAccessService(serviceId: number, userId: number, role: string) {
  if (!Number.isSafeInteger(serviceId) || serviceId <= 0) return false;
  if (role === "admin") {
    const result = await pool.query("SELECT 1 FROM service_records WHERE service_id = $1", [serviceId]);
    return (result.rowCount ?? 0) > 0;
  }
  if (role !== "technician") return false;
  const result = await pool.query(
    `SELECT 1 FROM service_records sr
     JOIN technicians t ON t.technician_id = sr.technician_id
     WHERE sr.service_id = $1 AND t.user_id = $2`,
    [serviceId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return unauthorizedResponse();
  if (session.role !== "admin" && session.role !== "technician") return forbiddenResponse();

  try {
    const db = await getMongoDb();
    const collection = db.collection(COLLECTION);
    await collection.createIndex({ serviceId: 1, createdAt: -1 });

    let filter = {};
    if (session.role === "technician") {
      const assigned = await pool.query(
        `SELECT sr.service_id FROM service_records sr
         JOIN technicians t ON t.technician_id = sr.technician_id
         WHERE t.user_id = $1`,
        [session.userId]
      );
      const serviceIds = assigned.rows.map((row) => Number(row.service_id));
      filter = { serviceId: { $in: serviceIds } };
    }

    const notes = await collection.find(filter).sort({ createdAt: -1 }).limit(250).toArray();
    return NextResponse.json({ notes: notes.map((note) => ({ ...note, _id: note._id.toString() })) });
  } catch (error) {
    console.error("MongoDB service notes GET failed:", error);
    return NextResponse.json({ error: "Unable to load MongoDB service notes. Check MONGODB_URI and MONGODB_DB." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return unauthorizedResponse();
  if (session.role !== "admin" && session.role !== "technician") return forbiddenResponse();

  try {
    const body = await request.json();
    const serviceId = Number(body.serviceId);
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (!Number.isSafeInteger(serviceId) || serviceId <= 0 || !note || note.length > 2000) {
      return NextResponse.json({ error: "Choose a valid service and enter a note (1–2000 characters)." }, { status: 400 });
    }
    if (!(await canAccessService(serviceId, session.userId, session.role))) return forbiddenResponse();

    const now = new Date();
    const result = await (await getMongoDb()).collection(COLLECTION).insertOne({
      serviceId,
      note,
      createdBy: session.userId,
      authorRole: session.role,
      createdAt: now,
      updatedAt: now,
    });
    return NextResponse.json({ message: "Activity note created in MongoDB.", note: { _id: result.insertedId.toString(), serviceId, note, createdBy: session.userId, authorRole: session.role, createdAt: now, updatedAt: now } }, { status: 201 });
  } catch (error) {
    console.error("MongoDB service notes POST failed:", error);
    return NextResponse.json({ error: "Unable to create the note. Check MongoDB configuration." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return unauthorizedResponse();
  if (session.role !== "admin" && session.role !== "technician") return forbiddenResponse();

  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (!ObjectId.isValid(id) || !note || note.length > 2000) return NextResponse.json({ error: "A valid note ID and note (1–2000 characters) are required." }, { status: 400 });

    const db = await getMongoDb();
    const collection = db.collection(COLLECTION);
    const existing = await collection.findOne({ _id: new ObjectId(id) });
    if (!existing) return NextResponse.json({ error: "Note not found." }, { status: 404 });
    if (!(await canAccessService(Number(existing.serviceId), session.userId, session.role))) return forbiddenResponse();
    if (session.role !== "admin" && Number(existing.createdBy) !== session.userId) return forbiddenResponse();

    await collection.updateOne({ _id: new ObjectId(id) }, { $set: { note, updatedAt: new Date() } });
    return NextResponse.json({ message: "Activity note updated in MongoDB." });
  } catch (error) {
    console.error("MongoDB service notes PATCH failed:", error);
    return NextResponse.json({ error: "Unable to update the note." }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return unauthorizedResponse();
  if (session.role !== "admin" && session.role !== "technician") return forbiddenResponse();

  try {
    const id = request.nextUrl.searchParams.get("id") ?? "";
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "A valid note ID is required." }, { status: 400 });
    const db = await getMongoDb();
    const collection = db.collection(COLLECTION);
    const existing = await collection.findOne({ _id: new ObjectId(id) });
    if (!existing) return NextResponse.json({ error: "Note not found." }, { status: 404 });
    if (!(await canAccessService(Number(existing.serviceId), session.userId, session.role))) return forbiddenResponse();
    if (session.role !== "admin" && Number(existing.createdBy) !== session.userId) return forbiddenResponse();
    await collection.deleteOne({ _id: new ObjectId(id) });
    return NextResponse.json({ message: "Activity note deleted from MongoDB." });
  } catch (error) {
    console.error("MongoDB service notes DELETE failed:", error);
    return NextResponse.json({ error: "Unable to delete the note." }, { status: 503 });
  }
}
