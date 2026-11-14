import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import { randomUUID } from "node:crypto";
import { levelFor, REPEAT_DELAY_MS, type WorkKind } from "@netcity/shared";
import { ProgressService } from "./progress/service.js";
import { snapshot, hashToken, type ProgressStore } from "./progress/store.js";
export async function progressContract(t: TestContext, store: ProgressStore) {
  const fixture = async () => {
    const guest = await store.register();
    let now = 1_000_000;
    const service = new ProgressService(store, () => now);
    const data = () => store.read(guest.profileId);
    const job = async (kind: WorkKind) =>
      (await data()).jobs.filter((j) => j.kind === kind).at(-1)!;
    const command = (value: object) =>
      service.command(guest.profileId, { ...value, requestId: randomUUID() });
    const tutorial = async () => {
      const j = await job("patch");
      assert.equal(
        (await command({ type: "accept", jobId: j.id })).result.ok,
        true,
      );
      await service.inspect(guest.profileId, j.id, () => null);
      assert.equal(
        (await service.finish(guest.profileId, j.id, () => null)).result.ok,
        true,
      );
      return j;
    };
    return {
      guest,
      service,
      data,
      job,
      command,
      tutorial,
      advance: (ms: number) => (now += ms),
    };
  };
  await t.test(
    "paid diagnostics survive retries, preserve privacy and cannot be completed through progress commands",
    async () => {
      const f=await fixture();
      await f.tutorial();
      assert.equal((await f.service.finishDiagnostic(f.guest.profileId,"003",()=>"Too far")).result.ok,false);
      const results=await Promise.all(Array.from({length:8},()=>f.service.finishDiagnostic(f.guest.profileId,"003",()=>null)));
      assert.equal(results.filter(r=>r.result.ok&&!r.result.replayed).length,1);
      assert.equal((await f.data()).credits,160); assert.equal((await f.data()).xp,100);
      assert.deepEqual((await f.data()).diagnostics,["003"]);
      assert.equal((await f.command({type:"finishDiagnostic",jobId:"004"})).result.ok,false);
      const other=await fixture(); assert.deepEqual((await other.data()).diagnostics,[]);
      assert.equal((await f.service.finishDiagnostic(f.guest.profileId,"999",()=>null)).result.ok,false);
    },
  );
  await t.test(
    "concurrent completion grants NET/XP exactly once per instance",
    async () => {
      const f = await fixture(),
        j = await f.job("patch");
      await f.command({ type: "accept", jobId: j.id });
      assert.equal(
        (await f.service.finish(f.guest.profileId, j.id, () => null)).result.ok,
        false,
      );
      await f.service.inspect(f.guest.profileId, j.id, () => null);
      const results = await Promise.all(
        Array.from({ length: 12 }, () =>
          f.service.finish(f.guest.profileId, j.id, () => null),
        ),
      );
      assert.equal(results.filter((r) => r.result.ok).length, 1);
      const d = await f.data();
      assert.equal(d.credits, 100);
      assert.equal(d.xp, 60);
      assert.equal(levelFor(d.xp).level, 2);
      assert.equal(d.tutorialCompleted, true);
    },
  );
  await t.test(
    "purchase keys prevent replay, payload substitution and overspending under concurrency",
    async () => {
      const f = await fixture();
      await f.tutorial();
      const action = {
        type: "buy",
        itemId: "patch_cord",
        requestId: randomUUID(),
      };
      const result = await Promise.all(
        Array.from({ length: 16 }, () =>
          f.service.command(f.guest.profileId, action),
        ),
      );
      assert.equal(result.filter((r) => r.result.replayed).length, 15);
      assert.equal((await f.data()).credits, 70);
      assert.equal((await f.data()).inventory.patch_cord, 1);
      assert.equal(
        (
          await f.service.command(f.guest.profileId, {
            ...action,
            itemId: "cleaner",
          })
        ).result.ok,
        false,
      );
      await Promise.all(
        Array.from({ length: 10 }, () =>
          f.command({ type: "buy", itemId: "patch_cord" }),
        ),
      );
      assert.equal((await f.data()).credits, 10);
      assert.equal((await f.data()).inventory.patch_cord, 3);
      for (const value of [
        { type: "buy", itemId: "__proto__" },
        { type: "buy", itemId: "patch_cord", quantity: -1 },
        { type: "completeJob", completeJob: true, credits: 999 },
      ])
        assert.equal((await f.command(value)).result.ok, false);
      assert.equal((await f.data()).credits, 10);
    },
  );
  await t.test(
    "rack work consumes a purchased item only on successful server-verified repair",
    async () => {
      const f = await fixture();
      await f.tutorial();
      const j = await f.job("rack");
      await f.command({ type: "accept", jobId: j.id });
      await f.service.inspect(f.guest.profileId, j.id, () => null);
      assert.equal(
        (await f.service.finish(f.guest.profileId, j.id, () => null)).result.ok,
        false,
      );
      await f.command({ type: "buy", itemId: "cleaner" });
      assert.equal(
        (await f.service.finish(f.guest.profileId, j.id, () => "too far"))
          .result.ok,
        false,
      );
      assert.equal((await f.data()).inventory.cleaner, 1);
      assert.equal(
        (await f.service.finish(f.guest.profileId, j.id, () => null)).result.ok,
        true,
      );
      assert.equal((await f.data()).inventory.cleaner, 0);
      assert.equal((await f.data()).inventory.toolkit, 1);
      assert.equal((await f.data()).credits, 160);
      assert.equal((await f.data()).xp, 110);
      assert.equal(
        (await f.service.finish(f.guest.profileId, j.id, () => null)).result.ok,
        false,
      );
    },
  );
  await t.test(
    "only one active order, including simultaneous acceptance; cancelled keys do not reactivate work",
    async () => {
      const f = await fixture(),
        a = await f.job("patch"),
        b = await f.job("rack");
      const request = { type: "accept", jobId: a.id, requestId: randomUUID() };
      const result = await Promise.all([
        f.service.command(f.guest.profileId, request),
        f.command({ type: "accept", jobId: b.id }),
      ]);
      assert.equal(result.filter((r) => r.result.ok).length, 1);
      const active = (await f.data()).jobs.find((j) => j.status === "ACTIVE")!;
      await f.command({ type: "cancel", jobId: active.id });
      await f.service.command(f.guest.profileId, request);
      assert.equal(
        (await f.data()).jobs.filter((j) => j.status === "ACTIVE").length,
        0,
      );
    },
  );
  await t.test(
    "repeat jobs are server-created after cooldown with a new ID and require a consumable",
    async () => {
      const f = await fixture(),
        first = await f.tutorial();
      await f.service.refresh(f.guest.profileId);
      assert.equal(
        (await f.data()).jobs.filter((j) => j.kind === "patch").length,
        1,
      );
      f.advance(REPEAT_DELAY_MS);
      await f.service.refresh(f.guest.profileId);
      const next = await f.job("patch");
      assert.notEqual(next.id, first.id);
      assert.equal(next.tutorial, false);
      await f.command({ type: "accept", jobId: next.id });
      await f.service.inspect(f.guest.profileId, next.id, () => null);
      assert.equal(
        (await f.service.finish(f.guest.profileId, next.id, () => null)).result
          .ok,
        false,
      );
      await f.command({ type: "buy", itemId: "patch_cord" });
      assert.equal(
        (await f.service.finish(f.guest.profileId, next.id, () => null)).result
          .ok,
        true,
      );
      assert.equal((await f.data()).credits, 170);
      assert.equal((await f.data()).inventory.patch_cord, 0);
      assert.equal((await f.data()).xp, 120);
    },
  );
  await t.test(
    "bearer hash authentication, profile ownership and private snapshot",
    async () => {
      const a = await fixture(),
        b = await fixture();
      assert.notEqual(a.guest.token, b.guest.token);
      assert.notEqual(hashToken(a.guest.token), a.guest.token);
      assert.equal(await store.identify(a.guest.token), a.guest.profileId);
      assert.equal(await store.identify(a.guest.profileId), null);
      assert.equal(await store.identify("0".repeat(64)), null);
      const job = await a.job("patch");
      assert.equal(
        (await b.command({ type: "accept", jobId: job.id })).result.ok,
        false,
      );
      assert.equal(
        (await b.service.finish(b.guest.profileId, job.id, () => null)).result
          .ok,
        false,
      );
      assert.equal("id" in snapshot(await a.data(), store.mode), false);
      assert.equal((await a.data()).credits, 0);
      assert.equal((await b.data()).credits, 0);
    },
  );
  await t.test(
    "failed transactions and duplicate reward ledger inserts roll back all money changes",
    async () => {
      const f = await fixture();
      await assert.rejects(
        store.transaction(f.guest.profileId, null, (tx) => {
          tx.data.credits = -1;
          return { ok: true, message: "bad" };
        }),
      );
      assert.equal((await f.data()).credits, 0);
      const id = randomUUID();
      await store.transaction(f.guest.profileId, null, (tx) => {
        tx.reward = { jobId: id, credits: 1, xp: 1 };
        tx.data.credits = 1;
        return { ok: true, message: "first" };
      });
      await assert.rejects(
        store.transaction(f.guest.profileId, null, (tx) => {
          tx.reward = { jobId: id, credits: 1, xp: 1 };
          tx.data.credits = 99;
          return { ok: true, message: "duplicate" };
        }),
      );
      assert.equal((await f.data()).credits, 1);
    },
  );
}
