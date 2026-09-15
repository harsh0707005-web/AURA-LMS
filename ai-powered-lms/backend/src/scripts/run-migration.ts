import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log("Applying migration 20260822_academic_expansion...");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  const migrationPath = path.resolve(
    __dirname,
    "../../prisma/migrations/20260822_academic_expansion/migration.sql"
  );
  
  const sql = fs.readFileSync(migrationPath, "utf-8");
  
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log("[SUCCESS] Academic migration executed cleanly!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[ERROR] Migration execution failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
