import { MongoClient, type Db } from "mongodb";

const globalForMongo = globalThis as typeof globalThis & {
  mongoClientPromise?: Promise<MongoClient>;
};

/** Lazily connect so PostgreSQL-only routes can still load when Mongo is not configured. */
export async function getMongoDb(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;

  if (!uri) throw new Error("MONGODB_URI is missing from .env.local");
  if (!dbName) throw new Error("MONGODB_DB is missing from .env.local");

  if (!globalForMongo.mongoClientPromise) {
    const client = new MongoClient(uri);
    globalForMongo.mongoClientPromise = client.connect();
  }

  const client = await globalForMongo.mongoClientPromise;
  return client.db(dbName);
}
