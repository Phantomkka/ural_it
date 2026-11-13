import { test } from "node:test";
import { MemoryProgressStore } from "./progress/store.js";
import { progressContract } from "./progress.contract.js";
test("temporary progress obeys transaction, identity and gameplay contracts", async (t) => {
  const store = new MemoryProgressStore();
  try {
    await progressContract(t, store);
  } finally {
    await store.close();
  }
});
