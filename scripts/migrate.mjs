import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required before database migrations can run.");
}

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });

try {
  const database = drizzle(pool);
  await migrate(database, { migrationsFolder: "./drizzle" });
  console.log("Database migrations completed.");
} finally {
  await pool.end();
}
