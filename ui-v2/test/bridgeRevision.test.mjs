import assert from "node:assert/strict";
import test from "node:test";

globalThis.window = { location: { search: "?port=31234" } };
const { bridge } = await import("../src/bridge/bridge.ts");

test("host actions preserve the revision of the rendered control", async (t) => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url, init });
    return {
      ok: true,
      status: 200,
      json: async () => ({ revision: 29, current: { id: "connection" }, canGoBack: true }),
    };
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  for (const [name, action, expected] of [
    ["navigate", () => bridge.navigate({ id: "multiplayer" }, 17),
      { action: "navigate", route: { id: "multiplayer" }, revision: 17 }],
    ["back", () => bridge.back(17), { action: "back", revision: 17 }],
    ["close", () => bridge.close(17), { action: "close", revision: 17 }],
    ["Minecraft Settings", () => bridge.performAction("minecraft-settings", 17),
      { action: "minecraft-settings", revision: 17 }],
    ["Create World", () => bridge.performAction("create-world", 17),
      { action: "create-world", revision: 17 }],
  ]) {
    await t.test(name, async () => {
      requests.length = 0;
      await action();
      assert.equal(requests.length, 1, "An action must not refresh and adopt a newer session revision");
      assert.match(requests[0].url, /\/ui-actions$/);
      assert.equal(requests[0].init.method, "POST");
      assert.deepEqual(JSON.parse(requests[0].init.body), expected);
    });
  }

  await t.test("a stale Cancel is rejected rather than applied to a newer connection", async () => {
    requests.length = 0;
    globalThis.fetch = async (url, init) => {
      requests.push({ url, init });
      if (!init) return { ok: true, status: 200, json: async () => ({ revision: 29 }) };
      return { ok: false, status: 409 };
    };
    await assert.rejects(bridge.back(17), /failed \(409\)/);
    assert.equal(requests.length, 1);
    assert.equal(JSON.parse(requests[0].init.body).revision, 17);
  });

  await t.test("uncommitted or missing revisions send no host action", async () => {
    requests.length = 0;
    for (const revision of [0, -1, undefined, NaN, 1.5]) {
      await assert.rejects(bridge.back(revision), /revision/i);
      await assert.rejects(bridge.performAction("minecraft-settings", revision), /revision/i);
      await assert.rejects(bridge.performAction("create-world", revision), /revision/i);
    }
    assert.equal(requests.length, 0);
  });

  await t.test("quit retains its intentionally revision-independent contract", async () => {
    requests.length = 0;
    globalThis.fetch = async (url, init) => {
      requests.push({ url, init });
      return { ok: true, status: 204 };
    };
    await bridge.performAction("quit");
    assert.equal(requests.length, 1);
    assert.deepEqual(JSON.parse(requests[0].init.body), { action: "quit" });
  });
});
