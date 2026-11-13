import { PostgresProgressStore } from "../apps/server/src/progress/postgres.js";
if (!process.env.DATABASE_URL)
  throw Error("Задайте DATABASE_URL в .env перед миграцией.");
const store = new PostgresProgressStore(process.env.DATABASE_URL);
try {
  await store.migrate();
  console.log("Миграции PostgreSQL применены.");
} finally {
  await store.close();
}
