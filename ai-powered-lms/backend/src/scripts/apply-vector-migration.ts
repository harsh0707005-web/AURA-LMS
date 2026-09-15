import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyVectorMigration() {
  console.log("Applying forward migration: 20260822_pgvector_embeddings...");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const migrationPath = path.resolve(
    __dirname,
    "../../prisma/migrations/20260822_pgvector_embeddings/migration.sql"
  );

  const sql = fs.readFileSync(migrationPath, "utf-8");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log("[SUCCESS] DocumentChunk.embedding vector(3072) column added to PostgreSQL!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[ERROR] Migration execution failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

applyVectorMigration();
