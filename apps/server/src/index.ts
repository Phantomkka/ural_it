import { createGameServer } from "./server.js";
const port = Number(process.env.PORT ?? 2567);
import { MemoryProgressStore } from "./progress/store.js";
import { PostgresProgressStore } from "./progress/postgres.js";
const store = process.env.DATABASE_URL
  ? new PostgresProgressStore(process.env.DATABASE_URL)
  : new MemoryProgressStore();
try {
  await store.health();
} catch (error) {
  console.error(
    "Код ошибки PostgreSQL:",
    String((error as { code?: unknown }).code ?? "UNKNOWN"),
  );
  console.error(
    "PostgreSQL недоступен или миграции не применены. Проверьте DATABASE_URL и npm run db:migrate. Временный режим автоматически НЕ включается.",
  );
  await store.close();
  process.exit(1);
}
if (store.mode === "temporary")
  console.warn(
    "ВРЕМЕННЫЕ ДАННЫЕ: DATABASE_URL не задан. Прогресс сбросится при перезапуске сервера.",
  );
const game = createGameServer({ store });
let closing = false;
const close = async () => {
  if (closing) return;
  closing = true;
  await game.gracefullyShutdown(false);
  await store.close();
};
process.once("SIGTERM", () => void close());
process.once("SIGINT", () => void close());
await game.listen(port, "0.0.0.0");
console.log(`NETCITY server listening on ${port}`);
