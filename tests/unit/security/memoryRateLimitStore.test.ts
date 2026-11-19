import { describe, expect, it } from "vitest";
import { MemoryRateLimitStore } from "@/security/memoryRateLimitStore";

const RULE = { limit: 3, windowSeconds: 60 };

describe("MemoryRateLimitStore", () => {
  it("counts the hits on one key", async () => {
    const store = new MemoryRateLimitStore();

    expect((await store.hit("k", RULE)).count).toBe(1);
    expect((await store.hit("k", RULE)).count).toBe(2);
    expect((await store.hit("k", RULE)).count).toBe(3);
  });

  it("counts the keys apart from one another", async () => {
    const store = new MemoryRateLimitStore();

    await store.hit("a", RULE);
    const other = await store.hit("b", RULE);

    expect(other.count).toBe(1);
  });

  it("opens a new window once the old one has passed", async () => {
    const store = new MemoryRateLimitStore();

    await store.hit("k", { limit: 3, windowSeconds: 0 });
    const afterWindow = await store.hit("k", RULE);

    expect(afterWindow.count).toBe(1);
  });

  it("reports the time that is left in the window", async () => {
    const store = new MemoryRateLimitStore();

    const first = await store.hit("k", RULE);
    const second = await store.hit("k", RULE);

    expect(first.ttlSeconds).toBe(60);
    expect(second.ttlSeconds).toBeGreaterThan(0);
    expect(second.ttlSeconds).toBeLessThanOrEqual(60);
  });

  it("stays within its cap, so that a varying client cannot grow it without end", async () => {
    const store = new MemoryRateLimitStore(10);

    for (let index = 0; index < 500; index += 1) {
      await store.hit(`key-${index}`, RULE);
    }

    expect(store.size).toBeLessThanOrEqual(10);
  });

  it("drops the expired counters before the live ones", async () => {
    const store = new MemoryRateLimitStore(4);

    // Two counters that are already gone, and two that are still counting.
    await store.hit("expired-1", { limit: 3, windowSeconds: 0 });
    await store.hit("expired-2", { limit: 3, windowSeconds: 0 });
    await store.hit("live-1", RULE);
    await store.hit("live-2", RULE);

    // One more counter puts the store over its cap, so it makes room —
    // and it drops the counters that are no longer counting first.
    await store.hit("filler-0", RULE);
    expect(store.size).toBeLessThanOrEqual(4);

    // The live counters still count; they were not evicted for the expired
    // ones.
    expect((await store.hit("live-1", RULE)).count).toBe(2);
    expect((await store.hit("live-2", RULE)).count).toBe(2);
  });
});
