import assert from "node:assert/strict";
import test from "node:test";

globalThis.window = { location: { search: "?port=31311" } };
const { bridge } = await import("../src/bridge/bridge.ts");

test("native module options reach the real UI without dropping host values or enum choices", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ modules: [{
    id: "fps", name: "Performance overlay", enabled: false, settings: [
      { key: "scale", label: "Scale", type: "integer", value: "125", min: "50", max: "150", step: "1", options: [] },
      { key: "anchor", label: "Anchor", type: "enum", value: "top-right", min: "0", max: "0", step: "1",
        options: [{ value: "top-left", label: "Top left" }, { value: "top-right", label: "Top right" }] },
    ],
  }] }) });
  const modules = await bridge.getModules();
  assert.equal(modules.length, 1);
  assert.equal(modules[0].id, "fps");
  assert.deepEqual(modules[0].settings, [
    { key: "scale", label: "Scale", type: "integer", value: "125", min: "50", max: "150", step: "1", options: [] },
    { key: "anchor", label: "Anchor", type: "enum", value: "top-right", min: "0", max: "0", step: "1",
      options: [{ value: "top-left", label: "Top left" }, { value: "top-right", label: "Top right" }] },
  ]);
});

test("editing a native option submits its actual module id, key and serialized value", async (t) => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url, init) => {
    requests.push({ url, init });
    return { ok: true, status: 204 };
  };
  await bridge.setModuleSetting("armor-status", "showDurability", "0");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "http://127.0.0.1:31311/api/v1/client/modules/settings");
  assert.equal(requests[0].init.method, "POST");
  assert.deepEqual(JSON.parse(requests[0].init.body), { id: "armor-status", key: "showDurability", value: "0" });
});
