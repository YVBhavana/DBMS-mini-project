
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing from .env.local");
}

const globalForPostgres = globalThis as typeof globalThis & {
  pgPool?: Pool;
};

export const pool =
  globalForPostgres.pgPool ??
  new Pool({
    connectionString,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPostgres.pgPool = pool;
}
