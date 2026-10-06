// Run with playwright-cli run-code --filename test/create-world-contract.js.
// The preview must expose the host boundary honestly; the host fixture verifies
// the real SPA request payload, failure recovery and duplicate-submit guard.
async (page) => {
  const requireState = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const base = "http://127.0.0.1:5174/";
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`${base}#/singleplayer`);
  const create = page.locator("[data-opus-world-create]");
  requireState(await create.count() === 1, "Singleplayer must expose Create World without a selected save");
  requireState(await create.isEnabled(), "Create World must not require an existing world selection");
  await create.click();
  await page.getByRole("dialog").waitFor();
  requireState(await page.getByRole("heading", { name: "Create world", exact: true }).count() === 1,
    "Standalone preview must explain the real Minecraft world-creation boundary");
  await page.getByRole("button", { name: "Return to preview" }).click();

  const actions = [];
  let releaseAction;
  await page.route("http://127.0.0.1:31239/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status,
      contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(body) });
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: {
        "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Credentials": "true",
      } });
    }
    if (path === "/api/v1/client") return json({ version: "test", minecraft: "1.8.9", session: "zvwgvx", accountKind: "unofficial" });
    if (path.endsWith("/worlds")) return json({ worlds: [] });
    if (path.endsWith("/servers")) return json({ servers: [] });
    if (path.endsWith("/modules")) return json({ modules: [] });
    if (path.endsWith("/accounts")) return json({ accounts: [] });
    if (path.endsWith("/ui-state")) return json({ revision: 17,
      current: { id: "singleplayer" }, canGoBack: true, canCloseToGame: false });
    if (path.endsWith("/ui-state/ack")) return route.fulfill({ status: 204,
      headers: { "Access-Control-Allow-Origin": "*" } });
    if (path.endsWith("/ui-actions")) {
      actions.push(route.request().postDataJSON());
      await new Promise((resolve) => { releaseAction = resolve; });
      return json({ error: "UI action was not committed" }, 409);
    }
    throw new Error(`Unexpected Create World fixture request: ${path}`);
  });
  // Host HTTP requests are intercepted for isolation: no world/account writes.
  await page.goto(`${base}?port=31239#/singleplayer`);
  await page.waitForFunction(() => document.querySelector("[data-opus-world-create]")
    && document.querySelector("[data-opus-route='singleplayer']"));
  await create.click();
  await page.waitForFunction(() => document.querySelector("[data-opus-world-create]")?.disabled);
  requireState(actions.length === 1, "Create World must issue one host request");
  requireState(JSON.stringify(actions[0]) === JSON.stringify({ action: "create-world", revision: 17 }),
    `Create World must use its rendered revision: ${JSON.stringify(actions)}`);
  await create.evaluate((element) => { element.click(); element.click(); });
  requireState(actions.length === 1, "Pending Create World must not submit again");
  releaseAction();
  await page.waitForFunction(() => !document.querySelector("[data-opus-world-create]")?.disabled);
  requireState(await page.getByText("Minecraft could not open Create World. Try again from the world list.", { exact: true }).count() === 1,
    "Rejected Create World must restore the control and explain recovery");
  for (const viewport of [{ width: 854, height: 480 }, { width: 427, height: 240 },
    { width: 900, height: 600 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(viewport);
    const bounds = await create.boundingBox();
    requireState(bounds && bounds.x >= 0 && bounds.y >= 0
      && bounds.x + bounds.width <= viewport.width && bounds.y + bounds.height <= viewport.height,
    `Create World must remain visible at ${viewport.width}x${viewport.height}`);
    requireState(await create.evaluate(el => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }), `Create World must be reachable after rejection at ${viewport.width}x${viewport.height}`);
  }
  return "Create World contract PASS: visible without saves, honest preview boundary, revisioned host action, single-flight, error recovery, resize";
}
