import { Pool, type PoolClient } from "pg";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  hashToken,
  validToken,
  newProfile,
  assertProfile,
  type ProfileData,
  type ProgressStore,
  type Transaction,
} from "./store.js";
import type { ProgressResult } from "@netcity/shared";
function decode(row: Record<string, any>): ProfileData {
  return {
    id: row.id,
    nickname: row.nickname,
    credits: row.credits,
    xp: row.xp,
    inventory: row.inventory,
    jobs: row.jobs,
    tutorialCompleted: row.tutorial_completed,
    version: row.version,
    diagnostics: row.diagnostics ?? [],
    service: row.service ?? {cases:[],completed:0},
  };
}
export class PostgresProgressStore implements ProgressStore {
  mode = "postgres" as const;
  readonly pool: Pool;
  constructor(url: string) {
    this.pool = new Pool({
      connectionString: url,
      max: 10,
      connectionTimeoutMillis: 5000,
      statement_timeout: 10000,
    });
    this.pool.on("error", () =>
      console.error("PostgreSQL: ошибка фонового подключения."),
    );
  }
  async migrate() {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(731007)");
      await client.query(
        "CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY)",
      );
      if (
        !(
          await client.query(
            "SELECT version FROM schema_migrations WHERE version=1",
          )
        ).rowCount
      ) {
        await client.query(
          await readFile(
            new URL("../../migrations/001_progress.sql", import.meta.url),
            "utf8",
          ),
        );
        await client.query("INSERT INTO schema_migrations(version) VALUES(1)");
      }
      if (!(await client.query("SELECT version FROM schema_migrations WHERE version=2")).rowCount) {
        await client.query(await readFile(new URL("../../migrations/002_diagnostics.sql", import.meta.url), "utf8"));
        await client.query("INSERT INTO schema_migrations(version) VALUES(2)");
      }
      if (!(await client.query("SELECT version FROM schema_migrations WHERE version=3")).rowCount) {
        await client.query(await readFile(new URL("../../migrations/003_client_cases.sql", import.meta.url), "utf8"));
        await client.query("INSERT INTO schema_migrations(version) VALUES(3)");
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async register() {
    const token = randomBytes(32).toString("hex"),
      data = newProfile();
    await this.pool.query(
      "INSERT INTO profiles(id,token_hash,nickname,inventory,jobs) VALUES($1,$2,$3,$4::jsonb,$5::jsonb)",
      [
        data.id,
        hashToken(token),
        data.nickname,
        JSON.stringify(data.inventory),
        JSON.stringify(data.jobs),
      ],
    );
    return { token, profileId: data.id };
  }
  async identify(token: string) {
    if (!validToken(token)) return null;
    const result = await this.pool.query(
      "SELECT id FROM profiles WHERE token_hash=$1",
      [hashToken(token)],
    );
    return result.rows[0]?.id ?? null;
  }
  async read(id: string) {
    const result = await this.pool.query("SELECT * FROM profiles WHERE id=$1", [
      id,
    ]);
    if (!result.rowCount) throw Error("Unknown profile");
    return decode(result.rows[0]);
  }
  async transaction(
    id: string,
    key: string | null,
    work: (tx: Transaction) => ProgressResult,
  ) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const rows = await client.query(
        "SELECT * FROM profiles WHERE id=$1 FOR UPDATE",
        [id],
      );
      if (!rows.rowCount) throw Error("Unknown profile");
      const data = decode(rows.rows[0]),
        before = JSON.stringify(data);
      const prior = key
        ? (
            await client.query(
              "SELECT fingerprint,result FROM profile_operations WHERE profile_id=$1 AND idempotency_key=$2",
              [id, key],
            )
          ).rows[0]
        : undefined;
      const tx: Transaction = { data, operation: prior };
      const result = work(tx);
      assertProfile(data);
      if (tx.reward)
        await client.query(
          "INSERT INTO reward_events(job_id,profile_id,credits,xp) VALUES($1,$2,$3,$4)",
          [tx.reward.jobId, id, tx.reward.credits, tx.reward.xp],
        );
      if (JSON.stringify(data) !== before) {
        data.version++;
        await this.save(client, data);
      }
      if (tx.saveOperation && key)
        await client.query(
          "INSERT INTO profile_operations(profile_id,idempotency_key,fingerprint,result) VALUES($1,$2,$3,$4::jsonb)",
          [
            id,
            key,
            tx.saveOperation.fingerprint,
            JSON.stringify(tx.saveOperation.result),
          ],
        );
      await client.query("COMMIT");
      return { result, data };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  private async save(client: PoolClient, d: ProfileData) {
    await client.query(
      "UPDATE profiles SET credits=$2,xp=$3,inventory=$4::jsonb,jobs=$5::jsonb,tutorial_completed=$6,version=$7,diagnostics=$8::jsonb,service=$9::jsonb WHERE id=$1",
      [
        d.id,
        d.credits,
        d.xp,
        JSON.stringify(d.inventory),
        JSON.stringify(d.jobs),
        d.tutorialCompleted,
        d.version,
        JSON.stringify(d.diagnostics ?? []),
        JSON.stringify(d.service ?? {cases:[],completed:0}),
      ],
    );
  }
  async health() {
    await this.pool.query("SELECT id FROM profiles LIMIT 0");
  }
  async close() {
    await this.pool.end();
  }
}
