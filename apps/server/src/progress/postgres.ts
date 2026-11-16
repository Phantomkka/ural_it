import { Pool, type PoolClient } from "pg";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import {PostgresAccountStore} from "../auth/postgres.js";
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
import {validCompany} from '@netcity/shared';
function decode(row: Record<string, any>): ProfileData {
  return {
    projects:row.projects??[],
    id: row.id,
    nickname: row.nickname,
    credits: row.credits,
    xp: row.xp,
    inventory: {power_supply:0,toner:0,ups_battery:0,ssd:0,...row.inventory},
    jobs: row.jobs,
    tutorialCompleted: row.tutorial_completed,
    version: row.version,
    diagnostics: row.diagnostics ?? [],
    service: row.service ?? {cases:[],completed:0},
    cable: row.cable??undefined,
    business:row.business??undefined,
  };
}
export class PostgresProgressStore implements ProgressStore {
  mode = "postgres" as const;
  readonly pool: Pool;
  readonly accounts:PostgresAccountStore;
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
    this.accounts=new PostgresAccountStore(this.pool);
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
      if (!(await client.query("SELECT version FROM schema_migrations WHERE version=4")).rowCount) {
        await client.query(await readFile(new URL("../../migrations/004_accounts.sql", import.meta.url), "utf8"));
        await client.query("INSERT INTO schema_migrations(version) VALUES(4)");
      }
      if (!(await client.query("SELECT version FROM schema_migrations WHERE version=5")).rowCount) {
        await client.query(await readFile(new URL("../../migrations/005_cable.sql", import.meta.url), "utf8"));
        await client.query("INSERT INTO schema_migrations(version) VALUES(5)");
      }
      if (!(await client.query("SELECT version FROM schema_migrations WHERE version=6")).rowCount) {
        await client.query(await readFile(new URL("../../migrations/006_business.sql", import.meta.url), "utf8"));
        await client.query("INSERT INTO schema_migrations(version) VALUES(6)");
      }
      if (!(await client.query("SELECT version FROM schema_migrations WHERE version=7")).rowCount) {await client.query(await readFile(new URL("../../migrations/007_guest_transfer.sql",import.meta.url),"utf8"));await client.query("INSERT INTO schema_migrations(version) VALUES(7)");}
      if (!(await client.query("SELECT version FROM schema_migrations WHERE version=8")).rowCount) {await client.query(await readFile(new URL("../../migrations/008_beta_inventory.sql",import.meta.url),"utf8"));await client.query("INSERT INTO schema_migrations(version) VALUES(8)");}
      if (!(await client.query("SELECT version FROM schema_migrations WHERE version=9")).rowCount) {await client.query(await readFile(new URL("../../migrations/009_crew_projects.sql",import.meta.url),"utf8"));await client.query("INSERT INTO schema_migrations(version) VALUES(9)");}
      if (!(await client.query("SELECT version FROM schema_migrations WHERE version=10")).rowCount) {await client.query(await readFile(new URL("../../migrations/010_companies.sql",import.meta.url),"utf8"));await client.query("INSERT INTO schema_migrations(version) VALUES(10)");}
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
    projectCode?:string,
    companyCode?:string,
    receiptId?:string,
  ) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      // All project mutations acquire this lock BEFORE a profile row: joining from
      // another server process cannot overfill a crew or duplicate stock/rewards.
      if(projectCode)await client.query('SELECT pg_advisory_xact_lock(731009)');
      if(companyCode)await client.query('SELECT pg_advisory_xact_lock(731010)');
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
      const project=projectCode?(await client.query('SELECT data FROM crew_projects WHERE code=$1 FOR UPDATE',[projectCode])).rows[0]?.data:undefined;
      const company=companyCode?(await client.query('SELECT data FROM companies WHERE code=$1 FOR UPDATE',[companyCode])).rows[0]?.data:undefined;
      const occupiedOffices=companyCode?(await client.query("SELECT data->>'officeId' AS office FROM companies WHERE code<>$1 AND data->>'officeId' IS NOT NULL AND data->>'officeId'<>'coworking'",[companyCode])).rows.map(r=>r.office):undefined;
      const companyReceiptUsed=companyCode&&receiptId?!!(await client.query('SELECT 1 FROM company_case_receipts WHERE case_id=$1',[receiptId])).rowCount:false;
      const tx: Transaction = { data, operation: prior,project,company,occupiedOffices,companyReceiptUsed };
      const result = work(tx);
      assertProfile(data);
      if(tx.company&&(!companyCode||tx.company.code!==companyCode||!validCompany(tx.company)))throw Error('Company invariant violation');
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
      if(projectCode&&tx.project)await client.query('INSERT INTO crew_projects(code,data) VALUES($1,$2::jsonb) ON CONFLICT(code) DO UPDATE SET data=EXCLUDED.data',[projectCode,JSON.stringify(tx.project)]);
      if(companyCode&&tx.company)await client.query('INSERT INTO companies(code,owner_profile_id,data) VALUES($1,$2,$3::jsonb) ON CONFLICT(code) DO UPDATE SET data=EXCLUDED.data',[companyCode,tx.company.owner,JSON.stringify(tx.company)]);
      if(companyCode&&tx.consumeCompanyReceipt)await client.query('INSERT INTO company_case_receipts(case_id,company_code) VALUES($1,$2)',[tx.consumeCompanyReceipt,companyCode]);
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
      "UPDATE profiles SET credits=$2,xp=$3,inventory=$4::jsonb,jobs=$5::jsonb,tutorial_completed=$6,version=$7,diagnostics=$8::jsonb,service=$9::jsonb,cable=$10::jsonb,business=$11::jsonb,projects=$12::jsonb WHERE id=$1",
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
        d.cable?JSON.stringify(d.cable):null,
        d.business?JSON.stringify(d.business):null,
        JSON.stringify(d.projects??[]),
      ],
    );
  }
  async health() {
    if(!(await this.pool.query('SELECT version FROM schema_migrations WHERE version=10')).rowCount)throw Error('Company migration required');
    await this.pool.query("SELECT id,cable,business FROM profiles LIMIT 0");
    await this.pool.query("SELECT id,preferences FROM accounts LIMIT 0");
    await this.pool.query("SELECT code FROM crew_projects LIMIT 0");
    await this.pool.query("SELECT code FROM companies LIMIT 0");
    await this.pool.query("SELECT case_id FROM company_case_receipts LIMIT 0");
  }
  async close() {
    await this.pool.end();
  }
  async readProject(code:string):Promise<import('@netcity/shared').CrewProject|null>{return (await this.pool.query('SELECT data FROM crew_projects WHERE code=$1',[code])).rows[0]?.data??null;}
  async readCompany(code:string):Promise<import('@netcity/shared').EnterpriseCompany|null>{return (await this.pool.query('SELECT data FROM companies WHERE code=$1',[code])).rows[0]?.data??null;}
}
