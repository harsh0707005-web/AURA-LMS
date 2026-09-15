import prisma from "./lib/prisma.js";

async function testDatabase() {
  console.log("==========================================");
  console.log("Checking PostgreSQL Connection via Prisma");
  console.log("==========================================");

  try {
    const userCount = await prisma.user.count();
    console.log(`[SUCCESS] Connected to PostgreSQL successfully!`);
    console.log(`[DATABASE] Database: ai_lms`);
    console.log(`[TABLE] "User" table exists and is accessible.`);
    console.log(`[STATS] Current User row count: ${userCount}`);
    console.log("==========================================");
    process.exit(0);
  } catch (error) {
    console.error("[ERROR] Failed to query PostgreSQL database:", error);
    process.exit(1);
  }
}

testDatabase();
