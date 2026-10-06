// Isolated browser + intercepted native API. No real account, clipboard or game.
async (page) => {
  await page.goto("about:blank");
  await page.unrouteAll({ behavior: "wait" });
  const requireState = (condition, message) => { if (!condition) throw new Error(message); };
  const option = (key, label, type, value, min = "0", max = "1", options = []) =>
    ({ key, label, type, value, min, max, step: "1", options });
  const modules = [
    { id: "fps", name: "Performance overlay", enabled: false, settings: [
      option("enabled", "Enabled", "boolean", "0"), option("scale", "Scale", "integer", "100", "50", "150"),
      option("opacity", "Opacity", "integer", "100", "25", "100"),
      option("anchor", "Anchor", "enum", "top-left", "0", "0", [
        { value: "top-left", label: "Top left" }, { value: "top-right", label: "Top right" }]),
      option("offsetX", "Offset X", "integer", "12", "0", "4096"),
      option("offsetY", "Offset Y", "integer", "12", "0", "4096"),
    ] },
    { id: "armor-status", name: "Armor Status", enabled: false, settings: [
      option("enabled", "Enabled", "boolean", "0"), option("showDurability", "Durability", "boolean", "1"),
    ] },
  ];
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
        const setting = module.settings.find(item => item.key === write.key);
        requireState(setting, "UI submitted an invented option"); setting.value = write.value;
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
  const open = async (id, canGoBack = false, canCloseToGame = true) => {
    state = { revision: state.revision + 1, current: { id }, canGoBack, canCloseToGame };
    // Fresh isolated boot, even when the previous native Back kept this hash.
    await page.goto(`http://127.0.0.1:5174/?port=31311&fixtureRevision=${state.revision}#/${id}`);
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

  await open("quick_hub");
  await page.locator('[data-opus-module-id="fps"]').waitFor();
  requireState(await page.getByText("Time Changer", { exact: true }).count() === 0, "The catalog fabricated a Lunar module");
  const logo = page.getByRole("img", { name: "Opus" });
  requireState(await logo.evaluate(el => el.complete && el.naturalWidth > 0
    && new URL(el.src).pathname === "/brand/opus-mark-user.png"), "Control center must use the approved loaded Opus mark");
  await page.getByRole("switch", { name: "Enable Performance overlay" }).click();
  await page.waitForFunction(() => document.querySelector('[role="switch"][aria-label="Enable Performance overlay"]')?.getAttribute("aria-checked") === "true");
  requireState(writes.at(-1)?.id === "fps" && writes.at(-1)?.enabled === true, "Module did not reach native toggle API");
  const scale = page.getByRole("spinbutton", { name: "Scale" });
  const scaleSaved = page.waitForResponse(response => response.url().endsWith("/modules/settings"));
  await scale.fill("125"); await scale.press("Enter");
  await scaleSaved;
  await page.waitForFunction(() => !document.querySelector('[aria-label="Scale"]')?.disabled);
  await page.waitForFunction(() => document.querySelector('[aria-label="Scale"]') === document.activeElement, null, { timeout: 1000 });
  requireState(await scale.evaluate(el => el === document.activeElement), "Saving Scale lost keyboard focus");
  await page.waitForFunction(() => document.querySelector('[aria-label="Scale"]')?.value === "125");
  requireState(writes.at(-1)?.id === "fps" && writes.at(-1)?.key === "scale" && writes.at(-1)?.value === "125", "Scale was only saved locally");
  const anchor = page.getByRole("radio", { name: "Anchor: Top right" });
  await anchor.waitFor({ state: "visible", timeout: 1000 });
  await anchor.click();
  await page.waitForFunction(() => document.querySelector('[role="radio"][aria-label="Anchor: Top right"]')?.getAttribute("aria-checked") === "true");
  requireState(writes.at(-1)?.value === "top-right", "Anchor did not preserve its native enum value");
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
  requireState(actions.at(-1)?.route?.id === "hud_editor", "HUD editor button was inert");
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
  await page.getByRole("spinbutton", { name: "Scale" }).waitFor();
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
  const retainedScale = page.getByRole("spinbutton", { name: "Scale" });
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
  return { result: "Control center PASS: real native catalog/options, truthful error recovery, overlapping reread/HUD return, retained focus, root/nested Escape and 4 sizes", geometry };
}
