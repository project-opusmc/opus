import assert from "node:assert/strict";
import test from "node:test";

const {
  FPS_SETTING_DEFAULTS,
  buildFpsResetOperations,
  formatArgb,
  parseArgb,
} = await import("../src/components/fpsSettingsModel.ts");

test("FPS reset targets only changed visible appearance settings in stable UI order", () => {
  const settings = [
    { key: "enabled", value: "1" },
    { key: "scale", value: "114" },
    { key: "opacity", value: "72" },
    { key: "reverseOrder", value: "1" },
    { key: "showBrackets", value: "0" },
    { key: "borderThickness", value: "125" },
    { key: "offsetX", value: "48" },
    { key: "textColor", value: "#ffffffff" },
  ];

  assert.deepEqual(buildFpsResetOperations(settings), [
    { key: "scale", value: "100" },
    { key: "showBrackets", value: "1" },
    { key: "borderThickness", value: "50" },
  ]);
  assert.equal(FPS_SETTING_DEFAULTS.some(({ key }) => key === "opacity"), false);
  assert.equal(FPS_SETTING_DEFAULTS.some(({ key }) => key === "anchor"), false);
});

test("ARGB helpers preserve RGB and alpha in the runtime #AARRGGBB wire order", () => {
  assert.deepEqual(parseArgb("#9f12abef"), { alpha: 159, red: 18, green: 171, blue: 239 });
  assert.equal(formatArgb({ alpha: 7, red: 1, green: 128, blue: 255 }), "#070180ff");
  assert.equal(parseArgb("#fff"), null);
  assert.equal(parseArgb("#gg000000"), null);
});
