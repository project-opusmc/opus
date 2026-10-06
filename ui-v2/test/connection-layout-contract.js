// Run in an isolated headless playwright-cli session against the local preview.
// Native actions end at the intercepted fixture, never a Minecraft session.
async (page) => {
  const requireState = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const base = "http://127.0.0.1:5174/";
  const geometry = [];
  for (const [width, height] of [[427, 240], [854, 480], [900, 600], [1280, 720]]) {
    await page.setViewportSize({ width, height });
    let emptyAction;
    for (const detail of ["", "Contacting server…"]) {
      await page.goto(`${base}#/connection?title=Connecting%20to%20server&serverAddress=127.0.0.1%3A25565&detail=${encodeURIComponent(detail)}`);
      const button = page.locator("[data-opus-connection-action='cancel']");
      await button.waitFor();
      // Wait for the existing entrance animation, not an arbitrary delay.
      await page.locator(".conn").evaluate(async (el) => {
        await Promise.all(el.getAnimations().map(animation => animation.finished));
      });
      const bounds = await button.boundingBox();
      requireState(bounds && bounds.x >= 0 && bounds.y >= 0
        && bounds.x + bounds.width <= width && bounds.y + bounds.height <= height,
      `Cancel must remain inside ${width}x${height}`);
      requireState(await button.evaluate(el => {
        const r = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      }), "Cancel must have an unobstructed hit target");
      if (!detail) emptyAction = bounds;
      else requireState(Math.abs(bounds.y - emptyAction.y) < 1,
        `Empty progress text moved Cancel at ${width}x${height}`);
      geometry.push({ width, height, empty: !detail,
        center: [bounds.x + bounds.width / 2, bounds.y + bounds.height / 2] });
    }
    await page.goto(`${base}#/connection?phase=disconnected&detail=${encodeURIComponent('Native kick reason\nQuoted "text" <script>plain text</script>')}`);
    const back = page.locator("[data-opus-connection-action='back']");
    await back.waitFor();
    const detail = page.locator("[data-opus-connection-detail]");
    requireState(await detail.textContent() === 'Native kick reason\nQuoted "text" <script>plain text</script>',
      "The native kick reason must remain literal multiline text");
    // Hash-only fixture updates can retain focus from the previous iteration.
    // Start at the reason, then actually Tab to Back to test keyboard focus.
    await detail.focus();
    await page.keyboard.press("Tab");
    requireState(await back.evaluate(el => el === document.activeElement
      && getComputedStyle(el).outlineStyle !== "none"),
      "Keyboard focus must remain visible");
  }

  // A stale Back flag must not create a button OR an Escape action during loading.
  const actions = [];
  await page.route("http://127.0.0.1:31240/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = body => route.fulfill({ status: 200, contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(body) });
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204,
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type" } });
    if (path === "/api/v1/client") return json({ version: "fixture", minecraft: "1.8.9", session: "test" });
    if (path.endsWith("/ui-state")) return json({ revision: 23, current: { id: "connection" },
      canGoBack: true, canCloseToGame: false, connection: { phase: "loading", title: "Loading terrain",
        detail: "Joining world…", serverName: "Fixture", serverAddress: "test.invalid", canCancel: false } });
    if (path.endsWith("/ui-state/ack")) return route.fulfill({ status: 204,
      headers: { "Access-Control-Allow-Origin": "*" } });
    if (path.endsWith("/ui-actions")) {
      actions.push(route.request().postDataJSON());
      return json({});
    }
    if (path.endsWith("/worlds")) return json({ worlds: [] });
    if (path.endsWith("/servers")) return json({ servers: [] });
    if (path.endsWith("/modules")) return json({ modules: [] });
    if (path.endsWith("/accounts")) return json({ accounts: [] });
    throw new Error(`Unexpected connection fixture request: ${path}`);
  });
  await page.goto(`${base}?port=31240#/connection`);
  await page.locator('[data-opus-connection-phase="loading"]').waitFor();
  requireState(await page.locator("[data-opus-connection-action]").count() === 0,
    "Loading must not expose a native action");
  await page.keyboard.press("Escape");
  // Wait for this browser input turn and the local fixture request queue.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  requireState(actions.length === 0, `Loading Escape invoked a native action: ${JSON.stringify(actions)}`);
  return { result: "Connection layout/input contract PASS: four sizes, stable Cancel, literal kick text, visible focus, inert loading Escape", geometry };
}
