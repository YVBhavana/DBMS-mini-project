
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const readline = require("readline");
const fs = require("fs");
const path = require("path");

const envPath = path.join(process.cwd(), ".env.local");

if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*DATABASE_URL\s*=\s*(.*)\s*$/);
    if (match) {
      process.env.DATABASE_URL = match[1].replace(/^["']|["']$/g, "");
    }
  }
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing from .env.local");
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Create a password for ananya.demo@example.com: ", async (password) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    if (!password || password.length < 8) {
      throw new Error("Use a password with at least 8 characters.");
    }

    const hash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `UPDATE app_users
       SET password_hash = $1
       WHERE LOWER(email) = LOWER($2)
       RETURNING user_id, email, role`,
      [hash, "ananya.demo@example.com"]
    );

    if (result.rowCount === 0) {
      throw new Error("Demo user not found in app_users.");
    }

    console.log("Password set successfully for:", result.rows[0].email);
    console.log("Role:", result.rows[0].role);
  } catch (error) {
    console.error("Could not set demo password:", error.message);
  } finally {
    await pool.end();
    rl.close();
  }
});
