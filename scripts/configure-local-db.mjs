import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
const port = Number(process.env.POSTGRES_PORT ?? 5432);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw Error("POSTGRES_PORT must be 1024..65535.");
const password = randomBytes(24).toString("hex");
try {
  writeFileSync(
    ".env",
    `POSTGRES_DB=netcity\nPOSTGRES_USER=netcity\nPOSTGRES_PASSWORD=${password}\nPOSTGRES_PORT=${port}\nDATABASE_URL=postgresql://netcity:${password}@127.0.0.1:${port}/netcity\n`,
    { flag: "wx", mode: 0o600 },
  );
  console.log("Создан .env для локальной PostgreSQL. Секрет не выводится.");
} catch (error) {
  if (error.code === "EEXIST") {
    console.error(
      ".env уже существует — он сохранён. Настройте DATABASE_URL вручную либо используйте существующие параметры.",
    );
    process.exitCode = 1;
  } else throw error;
}
