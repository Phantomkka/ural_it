import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { Client } from "@colyseus/sdk";
import { matchMaker } from "@colyseus/core";
import { ROOM_NAME } from "@netcity/shared";
import { PostgresProgressStore } from "./progress/postgres.js";
import { progressContract } from "./progress.contract.js";
import { ProgressService } from "./progress/service.js";
import { hashToken } from "./progress/store.js";
import { createGameServer } from "./server.js";
import type { StreetRoom, StreetState } from "./StreetRoom.js";
const until = async (check: () => boolean) => {
  const end = Date.now() + 5000;
  while (!check()) {
    if (Date.now() > end) throw Error("Timed out");
    await new Promise((r) => setTimeout(r, 15));
  }
};
test("PostgreSQL real transactions, concurrent requests and server restart persistence", async (t) => {
  const base = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!base)
    throw Error(
      "Set TEST_DATABASE_URL or DATABASE_URL to run PostgreSQL integration tests.",
    );
  const admin = new Pool({ connectionString: base }),
    schema = "test_" + randomUUID().replaceAll("-", "");
  await admin.query(`CREATE SCHEMA ${schema}`);
  const url = new URL(base);
  url.searchParams.set("options", `-c search_path=${schema}`);
  let store = new PostgresProgressStore(url.toString());
  try {
    await store.migrate();
    await store.migrate();
    await progressContract(t, store);
    await t.test(
      "hash-only storage and persistence across a real server and pool restart",
      async () => {
        const guest = await store.register(),
          service = new ProgressService(store);
        const job = (await store.read(guest.profileId)).jobs[0];
        await service.command(guest.profileId, {
          type: "accept",
          jobId: job.id,
          requestId: randomUUID(),
        });
        await service.inspect(guest.profileId, job.id, () => null);
        await service.finish(guest.profileId, job.id, () => null);
        await service.command(guest.profileId, {
          type: "buy",
          itemId: "patch_cord",
          requestId: randomUUID(),
        });
        const row = (
          await store.pool.query(
            "SELECT token_hash FROM profiles WHERE id=$1",
            [guest.profileId],
          )
        ).rows[0];
        assert.equal(row.token_hash, hashToken(guest.token));
        assert.notEqual(row.token_hash, guest.token);
        const server = createGameServer({ store });
        await server.listen(26794, "127.0.0.1");
        const a = await new Client(
          "ws://127.0.0.1:26794",
        ).joinOrCreate<StreetState>(ROOM_NAME, { guestToken: guest.token });
        await a.leave();
        await server.gracefullyShutdown(false);
        await store.close();
        store = new PostgresProgressStore(url.toString());
        const restarted = createGameServer({ store });
        await restarted.listen(26794, "127.0.0.1");
        try {
          const b = await new Client(
            "ws://127.0.0.1:26794",
          ).joinOrCreate<StreetState>(ROOM_NAME, { guestToken: guest.token });
          const profiles: any[] = [];
          b.onMessage("profile", (p) => profiles.push(p));
          b.onMessage("progressResult", () => {});
          b.send("progress", { type: "refresh" });
          await until(() => profiles.length > 0);
          assert.equal(profiles[0].credits, 70);
          assert.equal(profiles[0].xp, 60);
          assert.equal(profiles[0].inventory.patch_cord, 1);
          assert.equal(profiles[0].tutorialCompleted, true);
          assert.equal(profiles[0].persistence, "postgres");
          assert.equal(
            (
              await store.pool.query(
                "SELECT count(*)::int AS n FROM reward_events WHERE profile_id=$1",
                [guest.profileId],
              )
            ).rows[0].n,
            1,
          );
          await b.leave();
        } finally {
          await restarted.gracefullyShutdown(false);
        }
      },
    );
  } finally {
    await store.close();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});
