import assert from "node:assert/strict";
import test from "node:test";

globalThis.window = { location: { search: "" } };
const { bridge } = await import("../src/bridge/bridge.ts?fps-mock-contract");

test("standalone FPS data mirrors the runtime appearance rows", async () => {
  const fps = (await bridge.getModules()).find((module) => module.id === "fps");
  assert.equal(fps?.name, "FPS");
  assert.equal(fps?.description, "Display your FPS on the HUD.");
  assert.deepEqual(fps?.settings?.map(({ key, type, value, min, max }) => ({ key, type, value, min, max })), [
    { key: "enabled", type: "boolean", value: "0", min: "0", max: "1" },
    { key: "scale", type: "integer", value: "100", min: "50", max: "400" },
    { key: "opacity", type: "integer", value: "100", min: "25", max: "100" },
    { key: "anchor", type: "enum", value: "top-left", min: "0", max: "0" },
    { key: "offsetX", type: "integer", value: "12", min: "0", max: "4096" },
    { key: "offsetY", type: "integer", value: "12", min: "0", max: "4096" },
    { key: "reverseOrder", type: "boolean", value: "1", min: "0", max: "1" },
    { key: "textShadow", type: "boolean", value: "1", min: "0", max: "1" },
    { key: "showBrackets", type: "boolean", value: "1", min: "0", max: "1" },
    { key: "bracketColor", type: "color", value: "#ffffffff", min: "0", max: "0" },
    { key: "showBackground", type: "boolean", value: "0", min: "0", max: "1" },
    { key: "staticBackgroundWidth", type: "boolean", value: "1", min: "0", max: "1" },
    { key: "backgroundWidth", type: "integer", value: "56", min: "10", max: "300" },
    { key: "backgroundHeight", type: "integer", value: "18", min: "10", max: "100" },
    { key: "border", type: "boolean", value: "0", min: "0", max: "1" },
    { key: "borderThickness", type: "integer", value: "50", min: "10", max: "500" },
    { key: "borderColor", type: "color", value: "#9f000000", min: "0", max: "0" },
    { key: "backgroundColor", type: "color", value: "#6f000000", min: "0", max: "0" },
    { key: "textColor", type: "color", value: "#ffffffff", min: "0", max: "0" },
  ]);
});

test("standalone FPS writes reject values the runtime rejects", async () => {
  await assert.rejects(bridge.setModuleSetting("fps", "scale", "401"), /invalid/i);
  await assert.rejects(bridge.setModuleSetting("fps", "reverseOrder", "true"), /invalid/i);
  await assert.rejects(bridge.setModuleSetting("fps", "textColor", "#gg000000"), /invalid/i);
  await bridge.setModuleSetting("fps", "scale", "114");
  assert.equal((await bridge.getModules()).find(({ id }) => id === "fps")?.settings
    ?.find(({ key }) => key === "scale")?.value, "114");
});


test("FPS reset is one operation and preserves enable, placement and opacity", async () => {
  await bridge.setModuleSetting("fps", "opacity", "72");
  await bridge.setModuleSetting("fps", "offsetX", "48");
  await bridge.setModuleSetting("fps", "textColor", "#80abcdef");
  await bridge.setModuleSetting("fps", "resetAppearance", "1");
  const values = new Map((await bridge.getModules()).find(({ id }) => id === "fps").settings.map(({key, value}) => [key, value]));
  assert.equal(values.get("scale"), "100");
  assert.equal(values.get("textColor"), "#ffffffff");
  assert.equal(values.get("opacity"), "72");
  assert.equal(values.get("offsetX"), "48");
  assert.equal(values.get("enabled"), "0");
});
