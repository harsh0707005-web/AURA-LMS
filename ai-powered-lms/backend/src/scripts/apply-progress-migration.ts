import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runProgressMigration() {
  console.log("Applying migration 20260826_material_progress...");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const migrationPath = path.resolve(
    __dirname,
    "../../prisma/migrations/20260826_material_progress/migration.sql"
  );

  const sql = fs.readFileSync(migrationPath, "utf-8");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);

    // Record migration in _prisma_migrations table if exists
    await client.query(`
      INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
      VALUES (
        gen_random_uuid(),
        'material_progress_checksum',
        NOW(),
        '20260826_material_progress',
        NULL,
        NULL,
        NOW(),
        1
      )
      ON CONFLICT DO NOTHING;
    `);

    await client.query("COMMIT");
    console.log("[SUCCESS] MaterialProgress migration executed cleanly!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[ERROR] Migration execution failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runProgressMigration();
