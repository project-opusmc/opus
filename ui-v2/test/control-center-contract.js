// Isolated browser + intercepted native API. No real account, clipboard or game.
async (page) => {
  await page.goto("about:blank");
  await page.unrouteAll({ behavior: "wait" });
  const requireState = (condition, message) => { if (!condition) throw new Error(message); };
  const option = (key, label, type, value, min = "0", max = "1", options = []) =>
    ({ key, label, type, value, min, max, step: "1", options });
  const modules = [
    { id: "fps", name: "FPS", enabled: false, settings: [
      option("enabled", "Enabled", "boolean", "0"), option("scale", "Scale", "integer", "100", "50", "400"),
      option("opacity", "Opacity", "integer", "100", "25", "100"),
      option("anchor", "Anchor", "enum", "top-left", "0", "0", [
        { value: "top-left", label: "Top left" }, { value: "top-right", label: "Top right" },
        { value: "bottom-left", label: "Bottom left" }, { value: "bottom-right", label: "Bottom right" }]),
      option("offsetX", "Offset X", "integer", "12", "0", "4096"),
      option("offsetY", "Offset Y", "integer", "12", "0", "4096"),
      option("reverseOrder", "Reverse Order", "boolean", "1"),
      option("textShadow", "Text Shadow", "boolean", "1"),
      option("showBrackets", "Show Brackets", "boolean", "1"),
      option("bracketColor", "Bracket Color", "color", "#ffffffff", "0", "0"),
      option("showBackground", "Show Background", "boolean", "0"),
      option("staticBackgroundWidth", "Static Background Width", "boolean", "1"),
      option("backgroundWidth", "Background Width", "integer", "56", "10", "300"),
      option("backgroundHeight", "Background Height", "integer", "18", "10", "100"),
      option("border", "Border", "boolean", "0"),
      option("borderThickness", "Border Thickness", "integer", "50", "10", "500"),
      option("borderColor", "Border Color", "color", "#9f000000", "0", "0"),
      option("backgroundColor", "Background Color", "color", "#6f000000", "0", "0"),
      option("textColor", "Text Color", "color", "#ffffffff", "0", "0"),
    ] },
    { id: "armor-status", name: "Armor Status", enabled: false, settings: [
      option("enabled", "Enabled", "boolean", "0"), option("showDurability", "Durability", "boolean", "1"),
    ] },
  ];
  const appearanceKeys = ["scale", "reverseOrder", "textShadow", "showBrackets", "bracketColor", "showBackground",
    "staticBackgroundWidth", "backgroundWidth", "backgroundHeight", "border", "borderThickness", "borderColor", "backgroundColor", "textColor"];
  const appearanceDefaults = structuredClone(modules[0].settings.filter(item => appearanceKeys.includes(item.key)));
  let state = { revision: 41, current: { id: "game_menu" }, canGoBack: false, canCloseToGame: true };
  let rejectWrites = false;
  let loseWriteResponse = false;
  let rejectReads = false;
  let backTarget = "game_menu";
  let nextReadGate = null;
  const holdNextRead = () => {
    let signalStarted, release;
    const started = new Promise(resolve => { signalStarted = resolve; });
    const released = new Promise(resolve => { release = resolve; });
    nextReadGate = { signalStarted, released };
    return { started, release };
  };
  const actions = [], writes = [];
  await page.route("http://127.0.0.1:31311/api/v1/**", async (route) => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(body) });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204,
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type" } });
    if (path === "/api/v1/client") return json({ version: "fixture", minecraft: "1.8.9", runtime: "test",
      account: "fixture", accountKind: "unofficial", session: "online" });
    if (path.endsWith("/ui-state")) return json(state);
    if (path.endsWith("/ui-state/ack")) return route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*" } });
    if (path.endsWith("/ui-input-region")) return route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*" } });
    if (path.endsWith("/ui-actions")) {
      const action = request.postDataJSON(); actions.push(action);
      if (action.action === "close") state = { ...state, revision: state.revision + 1, current: { id: "none" }, canCloseToGame: false };
      else if (action.action === "back") state = { ...state, revision: state.revision + 1, current: { id: backTarget }, canGoBack: backTarget !== "game_menu" };
      else if (action.action === "navigate") state = { ...state, revision: state.revision + 1, current: action.route, canGoBack: true };
      return json(state);
    }
    if (path.endsWith("/modules")) {
      if (rejectReads) return json({ error: "unavailable fixture read" }, 503);
      const snapshot = structuredClone({ modules });
      const gate = nextReadGate;
      nextReadGate = null;
      if (gate) { gate.signalStarted(); await gate.released; }
      return json(snapshot);
    }
    if (path.endsWith("/modules/toggle") || path.endsWith("/modules/settings")) {
      const write = request.postDataJSON(); writes.push(write);
      if (rejectWrites) return json({ error: "rejected fixture write" }, 409);
      const module = modules.find(item => item.id === write.id);
      requireState(module, "UI submitted an invented module id");
      if ("enabled" in write) { module.enabled = write.enabled; module.settings[0].value = write.enabled ? "1" : "0"; }
      else {
        if (write.key === "resetAppearance" && write.id === "fps" && write.value === "1") {
          for (const initial of appearanceDefaults) module.settings.find(item => item.key === initial.key).value = initial.value;
        } else {
          const setting = module.settings.find(item => item.key === write.key);
          requireState(setting, "UI submitted an invented option"); setting.value = write.value;
        }
        // Keep the actual request pending long enough to exercise DOM focus
        // across the disabled/saving state, not an instant local mock.
        if (write.key === "scale") await new Promise(resolve => setTimeout(resolve, 150));
      }
      if (loseWriteResponse) return json({ error: "response lost after persistence" }, 503);
      return route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*" } });
    }
    if (path.endsWith("/worlds")) return json({ worlds: [] });
    if (path.endsWith("/servers")) return json({ servers: [] });
    if (path.endsWith("/accounts")) return json({ accounts: [] });
    throw new Error(`Unexpected control-center API: ${path}`);
  });
  const open = async (id, canGoBack = false, canCloseToGame = true, routeQuery = "") => {
    const queryParams = Object.fromEntries(new URLSearchParams(routeQuery));
    state = { revision: state.revision + 1, current: { id, ...(Object.keys(queryParams).length ? { params: queryParams } : {}) }, canGoBack, canCloseToGame };
    // Fresh isolated boot, even when the previous native Back kept this hash.
    await page.goto(`http://127.0.0.1:5174/?port=31311&fixtureRevision=${state.revision}#/${id}${routeQuery}`);
    await page.locator(`[data-opus-route="${id}"]`).waitFor();
  };
  await page.setViewportSize({ width: 900, height: 600 });
  await open("game_menu");
  const closeRequest = page.waitForRequest(request => request.url().endsWith("/ui-actions") && request.method() === "POST");
  await page.keyboard.press("Escape");
  await closeRequest;
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  requireState(actions.at(-1)?.action === "close", "Ready root Pause ignored Escape instead of closing to gameplay");
  requireState(actions.at(-1)?.revision === 42, "Pause Escape lost its rendered revision");

  await page.setViewportSize({ width: 1600, height: 1100 });
  await open("module_detail", true, true, "?moduleId=fps");
  const fpsPanel = page.locator('[data-opus-control-center]');
  await fpsPanel.waitFor();
  requireState(await page.getByRole("dialog", { name: "Client settings" }).count() === 1,
    "FPS settings must remain inside the Opus control center");
  requireState(await page.getByRole("heading", { name: "FPS", exact: true }).count() === 1
    && await page.getByRole("searchbox", { name: "Search modules" }).count() === 1
    && await page.getByRole("button", { name: "Close client settings" }).count() === 1
    && await page.getByRole("button", { name: "Edit HUD layout" }).count() === 1
    && await page.getByRole("button", { name: "Reset FPS appearance" }).count() === 1,
  "FPS options must use Opus navigation and controls");
  requireState(await page.getByRole("img", { name: "Opus" }).count() === 1
    && await page.getByRole("heading", { name: "Display", exact: true }).count() === 1
    && await page.getByRole("heading", { name: "Background", exact: true }).count() === 1
    && await page.locator(".control-center--fps").count() === 0,
  "FPS configuration must retain Opus branding without the copied Lunar surface");
  requireState(await page.getByRole("slider", { name: "Scale" }).count() === 1
    && await page.getByRole("switch", { name: "Reverse Order" }).count() === 1
    && await page.getByRole("switch", { name: "Text Shadow" }).count() === 1,
  "FPS scale and primary switches are missing");
  requireState(await page.getByRole("spinbutton", { name: "Opacity", exact: true }).count() === 1
    && await page.getByRole("radiogroup", { name: "Anchor", exact: true }).count() === 1
    && await page.getByRole("spinbutton", { name: "Offset X", exact: true }).count() === 1
    && await page.getByRole("spinbutton", { name: "Offset Y", exact: true }).count() === 1,
  "Existing FPS placement and opacity controls must remain editable");
  const fpsAtWide = await fpsPanel.boundingBox();
  requireState(fpsAtWide && fpsAtWide.x >= 0 && fpsAtWide.y >= 0
    && fpsAtWide.x + fpsAtWide.width <= 1600 && fpsAtWide.y + fpsAtWide.height <= 1100,
  "Opus FPS surface must remain inside the 1600x1100 viewport");
  const wideColumns = await page.locator(".fps-settings__content").evaluate(el => getComputedStyle(el).gridTemplateColumns);
  requireState(wideColumns.split(" ").length === 1, `FPS controls should use one wide column: ${wideColumns}`);
  const brackets = page.getByRole("button", { name: "Collapse Show Brackets options" });
  await page.getByRole("button", { name: "Collapse Show Background options" }).waitFor();
  await page.getByRole("button", { name: "Collapse Border options" }).waitFor();
  requireState(await page.getByRole("button", { name: "Edit Bracket Color" }).count() === 1
    && await page.getByRole("button", { name: "Edit Border Color" }).count() === 1
    && await page.getByRole("button", { name: "Edit Background Color" }).count() === 1,
  "Expanded FPS groups must show their native color controls");
  await brackets.click();
  await page.getByRole("button", { name: "Expand Show Brackets options" }).waitFor();
  requireState(await page.getByRole("button", { name: "Edit Bracket Color" }).count() === 0,
    "Collapsing Brackets must hide its nested color control");
  await page.getByRole("button", { name: "Expand Show Brackets options" }).click();
  await page.getByRole("button", { name: "Edit Bracket Color" }).waitFor();
  const reverse = page.getByRole("switch", { name: "Reverse Order" });
  await reverse.click();
  await page.waitForFunction(() => document.querySelector('[role="switch"][aria-label="Reverse Order"]')?.getAttribute("aria-checked") === "false");
  requireState(writes.at(-1)?.id === "fps" && writes.at(-1)?.key === "reverseOrder" && writes.at(-1)?.value === "0",
    "FPS switches must persist through the native module settings endpoint");
  const fpsColor = page.getByRole("textbox", { name: "Bracket Color ARGB value" });
  await fpsColor.fill("#ff123456"); await fpsColor.press("Enter");
  await page.waitForFunction(() => document.querySelector('[aria-label="Bracket Color ARGB value"]')?.value === "#ff123456");
  requireState(writes.at(-1)?.id === "fps" && writes.at(-1)?.key === "bracketColor" && writes.at(-1)?.value === "#ff123456",
    "ARGB color edits must persist the runtime wire format");
  await page.getByRole("button", { name: "Edit Bracket Color" }).click();
  const bracketEditor = page.getByRole("dialog", { name: "Bracket Color editor" });
  await bracketEditor.getByRole("button", { name: "Apply", exact: true }).click();
  requireState(await bracketEditor.count() === 0, "Applying an unchanged color must close the editor");
  await page.getByRole("button", { name: "Edit Text Color" }).click();
  const colorEditor = page.getByRole("dialog", { name: "Text Color editor" });
  const beforeEscape = writes.length;
  await colorEditor.getByRole("spinbutton", { name: "A", exact: true }).fill("0");
  await colorEditor.getByRole("spinbutton", { name: "A", exact: true }).press("Escape");
  requireState(await colorEditor.count() === 0 && writes.length === beforeEscape
    && await page.locator('[data-opus-route="module_detail"]').count() === 1,
  "Color Escape must discard its draft without closing Opus settings or saving");
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Edit Text Color");
  await page.getByRole("button", { name: "Edit Text Color" }).click();
  const beforeCancel = writes.length;
  await colorEditor.getByRole("spinbutton", { name: "A", exact: true }).fill("0");
  await colorEditor.getByRole("button", { name: "Cancel", exact: true }).click();
  requireState(writes.length === beforeCancel
    && await page.getByRole("textbox", { name: "Text Color ARGB value" }).inputValue() === "#ffffffff",
  "Color Cancel must discard RGB/alpha drafts without saving them");
  await page.getByRole("button", { name: "Edit Text Color" }).click();
  await colorEditor.getByRole("spinbutton", { name: "A", exact: true }).fill("0");
  await colorEditor.getByRole("button", { name: "Apply", exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[aria-label="Text Color ARGB value"]')?.value === "#00ffffff"
    && !document.querySelector('[aria-label="Text Color ARGB value"]')?.disabled);
  requireState(writes.at(-1)?.key === "textColor" && writes.at(-1)?.value === "#00ffffff", "Color alpha must reach the runtime");
  const textColor = page.getByRole("textbox", { name: "Text Color ARGB value" });
  const beforeInvalid = writes.length;
  await textColor.fill("#xxffffff"); await textColor.press("Enter");
  requireState(await textColor.getAttribute("aria-invalid") === "true" && writes.length === beforeInvalid,
    "Invalid ARGB must remain unsaved and explain the error");
  await textColor.fill("  #FFABCDEF  "); await textColor.press("Enter");
  await page.waitForFunction(() => document.querySelector('[aria-label="Text Color ARGB value"]')?.value === "#ffabcdef"
    && !document.querySelector('[aria-label="Text Color ARGB value"]')?.disabled);
  for (const [name, key, expected] of [["Scale", "scale", "101"], ["Background Width", "backgroundWidth", "57"],
    ["Background Height", "backgroundHeight", "19"], ["Border Thickness", "borderThickness", "51"]]) {
    await page.getByRole("slider", { name, exact: true }).press("ArrowRight");
    await page.waitForFunction(({name, expected}) => document.querySelector(`[aria-label="${name}"]`)?.value === expected
      && !document.querySelector(`[aria-label="${name}"]`)?.disabled, {name, expected});
    requireState(writes.at(-1)?.key === key && writes.at(-1)?.value === expected, `${name} did not persist its wire value`);
  }
  for (const [name, key, expected] of [["Text Shadow", "textShadow", "0"], ["Show Brackets", "showBrackets", "0"],
    ["Show Background", "showBackground", "1"], ["Static Background Width", "staticBackgroundWidth", "0"], ["Border", "border", "1"]]) {
    await page.getByRole("switch", { name, exact: true }).click();
    await page.waitForFunction(({name, expected}) => document.querySelector(`[aria-label="${name}"]`)?.getAttribute("aria-checked") === (expected === "1" ? "true" : "false")
      && !document.querySelector(`[aria-label="${name}"]`)?.disabled, {name, expected});
    requireState(writes.at(-1)?.key === key && writes.at(-1)?.value === expected, `${name} did not persist`);
  }
  const beforeReset = writes.length;
  await page.getByRole("button", { name: "Reset FPS appearance" }).click();
  await page.waitForFunction(() => document.querySelector('[role="switch"][aria-label="Reverse Order"]')?.getAttribute("aria-checked") === "true"
    && document.querySelector('[aria-label="Text Color ARGB value"]')?.value === "#ffffffff"
    && document.querySelector('[aria-label="Scale"]')?.value === "100"
    && !document.querySelector('[aria-label="Scale"]')?.disabled);
  requireState(writes.length === beforeReset + 1 && writes.at(-1)?.id === "fps"
    && writes.at(-1)?.key === "resetAppearance" && writes.at(-1)?.value === "1"
    && modules[0].settings.find(item => item.key === "bracketColor").value === "#ffffffff",
  "Reset appearance must be one atomic native operation");
  await page.setViewportSize({ width: 427, height: 600 });
  const fpsNarrow = await fpsPanel.boundingBox();
  const narrowColumns = await page.locator(".fps-settings__content").evaluate(el => getComputedStyle(el).gridTemplateColumns);
  const noHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  requireState(fpsNarrow && fpsNarrow.x >= 0 && fpsNarrow.x + fpsNarrow.width <= 427
    && narrowColumns.split(" ").length === 1 && noHorizontalOverflow,
  `FPS surface must fit the narrow viewport without horizontal scrolling: ${JSON.stringify({ fpsNarrow, narrowColumns, noHorizontalOverflow })}`);

  await open("quick_hub");
  await page.locator('[data-opus-module-id="fps"]').waitFor();
  requireState(await page.getByText("Time Changer", { exact: true }).count() === 0, "The catalog fabricated a Lunar module");
  const logo = page.getByRole("img", { name: "Opus" });
  requireState(await logo.evaluate(el => el.complete && el.naturalWidth > 0
    && new URL(el.src).pathname === "/brand/opus-mark-user.png"), "Control center must use the approved loaded Opus mark");
  await page.getByRole("switch", { name: "Enable FPS" }).click();
  await page.waitForFunction(() => document.querySelector('[role="switch"][aria-label="Enable FPS"]')?.getAttribute("aria-checked") === "true");
  requireState(writes.at(-1)?.id === "fps" && writes.at(-1)?.enabled === true, "Module did not reach native toggle API");
  await page.locator('[data-opus-module-id="armor-status"]').click();
  await page.getByRole("switch", { name: "Durability" }).click();
  await page.waitForFunction(() => document.querySelector('[role="switch"][aria-label="Durability"]')?.getAttribute("aria-checked") === "false");
  requireState(writes.at(-1)?.id === "armor-status" && writes.at(-1)?.key === "showDurability" && writes.at(-1)?.value === "0", "Durability did not reach its native owner");
  rejectWrites = true;
  await page.getByRole("switch", { name: "Durability" }).click();
  await page.getByRole("alert").waitFor();
  requireState(await page.getByRole("switch", { name: "Durability" }).getAttribute("aria-checked") === "false", "Rejected option was shown as saved");
  rejectWrites = false;
  loseWriteResponse = true;
  await page.getByRole("switch", { name: "Durability" }).click();
  await page.waitForFunction(() => document.querySelector('[role="switch"][aria-label="Durability"]')?.getAttribute("aria-checked") === "true"
    && !document.querySelector('[role="switch"][aria-label="Durability"]')?.disabled);
  requireState(await page.getByRole("alert").count() === 0, "Confirmed native write was reported as failed after a lost response");
  loseWriteResponse = false;
  rejectReads = true;
  await page.getByRole("switch", { name: "Durability" }).click();
  await page.getByRole("alert").waitFor();
  requireState(await page.getByRole("switch", { name: "Durability" }).isDisabled(), "Unconfirmed values remained editable");
  rejectReads = false;
  await page.getByRole("button", { name: "Refresh module values" }).click();
  await page.waitForFunction(() => document.querySelector('[role="switch"][aria-label="Durability"]')?.getAttribute("aria-checked") === "false"
    && !document.querySelector('[role="switch"][aria-label="Durability"]')?.disabled);
  requireState(await page.getByRole("alert").count() === 0, "Refresh did not recover unconfirmed native values");
  await page.getByRole("button", { name: "Edit HUD layout" }).click();
  await page.locator('[data-opus-route="hud_editor"]').waitFor();
  // Native HUD edits must be read when returning without a new browser boot.
  modules[0].settings.find(item => item.key === "scale").value = "130";
  backTarget = "settings";
  await page.keyboard.press("Escape");
  await page.locator('[data-opus-route="settings"]').waitFor();
  await page.waitForFunction(() => document.querySelector('[aria-label="Scale"]')?.value === "130", null, { timeout: 1500 });
  backTarget = "game_menu";

  // Recommit native state without reloading the retained SPA. A hash event is
  // the same host-state refresh signal used when the helper mirrors Java routes.
  const publish = async (id, canGoBack = false, canCloseToGame = true) => {
    state = { revision: state.revision + 1, current: { id }, canGoBack, canCloseToGame };
    const revision = state.revision;
    const committed = page.waitForRequest(request => request.url().endsWith("/ui-state/ack")
      && request.method() === "POST" && request.postDataJSON()?.revision === revision);
    await page.evaluate(() => window.dispatchEvent(new HashChangeEvent("hashchange")));
    await committed;
  };
  const overlapFailures = [];
  await open("quick_hub");
  await page.getByRole("slider", { name: "Scale" }).waitFor();
  await page.waitForFunction(() => !document.querySelector('[aria-label="Scale"]')?.disabled);
  const staleRead = holdNextRead();
  await publish("quick_hub");
  await Promise.race([staleRead.started, new Promise((_, reject) => setTimeout(() => reject(new Error("Native reread never started")), 3000))]);
  await page.getByRole("button", { name: "Edit HUD layout" }).click();
  await page.locator('[data-opus-route="hud_editor"]').waitFor();
  modules[0].settings.find(item => item.key === "scale").value = "134";
  backTarget = "quick_hub";
  await page.keyboard.press("Escape");
  await page.locator('[data-opus-route="quick_hub"]').waitFor();
  staleRead.release();
  try {
    await page.waitForFunction(() => document.querySelector('[aria-label="Scale"]')?.value === "134"
      && !document.querySelector('[aria-label="Scale"]')?.disabled, null, { timeout: 1500 });
  } catch { overlapFailures.push("Returning during a held native reread dropped the required fresh read"); }

  await publish("quick_hub", false);
  await page.waitForFunction(() => !document.querySelector('[aria-label="Scale"]')?.disabled);
  const retainedScale = page.getByRole("slider", { name: "Scale" });
  await retainedScale.focus();
  await retainedScale.evaluate(el => { el.dataset.retainedFocusFixture = "true"; });
  const park = page.waitForResponse(response => response.url().endsWith("/ui-actions")
    && response.request().method() === "POST" && response.request().postDataJSON()?.action === "close");
  await page.keyboard.press("Escape"); await park;
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  requireState(actions.at(-1)?.action === "close", "Root control center did not park to gameplay");
  const reopeningRead = holdNextRead();
  await publish("quick_hub", false);
  await Promise.race([reopeningRead.started, new Promise((_, reject) => setTimeout(() => reject(new Error("Retained reopen reread never started")), 3000))]);
  await page.waitForFunction(() => document.querySelector('[aria-label="Scale"]')?.disabled);
  reopeningRead.release();
  await page.waitForFunction(() => !document.querySelector('[aria-label="Scale"]')?.disabled);
  requireState(await retainedScale.getAttribute("data-retained-focus-fixture") === "true", "Focus fixture remounted instead of retaining the control");
  try {
    await page.waitForFunction(() => document.querySelector('[aria-label="Scale"]') === document.activeElement, null, { timeout: 1000 });
  } catch { overlapFailures.push("Automatic same-route reopen reread lost the retained input focus"); }
  requireState(overlapFailures.length === 0, overlapFailures.join("; "));
  backTarget = "game_menu";

  const geometry = [];
  for (const [width, height] of [[427, 240], [854, 480], [900, 600], [1470, 923]]) {
    await page.setViewportSize({ width, height }); await open("settings", true);
    const panel = page.locator('[data-opus-control-center]'); await panel.waitFor();
    const moduleMisses = await page.locator('[data-opus-module-id]').evaluateAll(items => items.filter(el => {
      const r = el.getBoundingClientRect();
      return !el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }).map(el => el.dataset.opusModuleId));
    requireState(moduleMisses.length === 0, `Hidden module selectors at ${width}x${height}: ${moduleMisses}`);
    const box = await panel.boundingBox();
    requireState(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1,
      `Control center exceeds ${width}x${height}`);
    const close = page.getByRole("button", { name: "Close client settings" });
    requireState(await close.evaluate(el => { const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }), "Close is covered by another layer");
    await close.click();
    await page.locator('[data-opus-route="game_menu"]').waitFor();
    requireState(actions.at(-1)?.action === "back", "Nested settings skipped its Pause parent");
    geometry.push({ width, height, box });
  }
  await page.setViewportSize({ width: 1280, height: 720 }); await open("settings", true);
  await page.keyboard.press("Escape");
  await page.locator('[data-opus-route="game_menu"]').waitFor();
  requireState(actions.at(-1)?.action === "back", "Nested settings Escape did not return to Pause");
  return { result: "Control center PASS: Opus FPS controls/ARGB/cancel/reset and runtime API catalog/options, truthful error recovery, overlapping reread/HUD return, retained focus, root/nested Escape and 4 sizes", geometry };
}
