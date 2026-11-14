import { readFile } from "node:fs/promises";
const {
  DB_PASSWORD_FILE,
  DB_USER,
  DB_NAME,
  DB_HOST = "db",
  DB_PORT = "5432",
} = process.env;
if (!DB_PASSWORD_FILE || !DB_USER || !DB_NAME)
  throw Error(
    "Production requires DB_PASSWORD_FILE, DB_USER and DB_NAME. Temporary mode is disabled.",
  );
const password = (await readFile(DB_PASSWORD_FILE, "utf8")).trim();
if (!password) throw Error("Empty database secret.");
const url = new URL(`postgresql://${DB_HOST}:${DB_PORT}`);
url.username = DB_USER;
url.password = password;
url.pathname = "/" + DB_NAME;
process.env.DATABASE_URL = url.toString();
if (process.argv[2] === "migrate") await import("../scripts/db-migrate.mts");
else await import("../apps/server/src/index.ts");
